"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/push-actions";

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const DISMISS_KEY = "push-prompt-dismissed";
const SYNC_KEY = "push-synced";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function storage(kind: "local" | "session", key: string, value?: string): string | null {
  try {
    const s = kind === "local" ? localStorage : sessionStorage;
    if (value !== undefined) s.setItem(key, value);
    return s.getItem(key);
  } catch {
    return null;
  }
}

async function register() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/**
 * Ativa as notificações push neste aparelho.
 * - "prompt": convite discreto na tela da pelada; some quando ativado, recusado ou dispensado.
 * - "settings": controle completo no perfil (ativar, desativar e testar).
 */
export function PushToggle({ publicKey, variant }: { publicKey: string; variant: "prompt" | "settings" }) {
  const [status, setStatus] = useState<Status>("loading");
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let next: Status;
      if (!supported) next = isIOS() && !isStandalone() ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await register();
        const sub = await reg.pushManager.getSubscription();
        next = sub ? "on" : "off";
        // Mantém o aparelho ligado à conta logada (alguém pode ter trocado de conta neste celular).
        if (sub && !storage("session", SYNC_KEY)) {
          storage("session", SYNC_KEY, "1");
          await savePushSubscription(sub.toJSON(), navigator.userAgent);
        }
      }
      if (cancelled) return;
      setStatus(next);
      setDismissed(storage("local", DISMISS_KEY) === "1");
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await register();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const ok = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if (!ok) {
        await sub.unsubscribe();
        setNote("Não deu para ativar agora. Tente de novo.");
        return;
      }
      storage("session", SYNC_KEY, "1");
      setStatus("on");
      if (variant === "prompt") setNote("Avisos ativados! ✅");
    } catch {
      setNote("Não deu para ativar neste navegador.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setNote("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const ok = await sendTestPush().catch(() => false);
    setNote(ok ? "Enviado! Deve aparecer em alguns segundos." : "Não deu para enviar o teste.");
    setBusy(false);
  }

  if (!publicKey || status === "loading") return null;

  if (variant === "prompt") {
    if (note && status === "on") return <p className="rounded-2xl bg-pitch-50 p-3 text-sm text-pitch-900 ring-1 ring-pitch-100">{note}</p>;
    if (dismissed || (status !== "off" && status !== "ios-install")) return null;
    const dismiss = () => {
      storage("local", DISMISS_KEY, "1");
      setDismissed(true);
    };
    return (
      <div className="space-y-2 rounded-2xl bg-pitch-50 p-3 text-sm text-pitch-900 ring-1 ring-pitch-100">
        <p className="font-semibold">🔔 Receber avisos da pelada no celular?</p>
        {status === "ios-install" ? (
          <p>
            No iPhone, os avisos funcionam com o app instalado: toque em <strong>Compartilhar</strong> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>. Abra o Sem Panela por lá e ative aqui.
          </p>
        ) : (
          <p>Lembrete para confirmar presença, times sorteados e vaga aberta na lista de espera.</p>
        )}
        {note && <p className="text-red-700">{note}</p>}
        <div className="flex gap-2">
          {status === "off" && (
            <Button onClick={enable} disabled={busy}>
              {busy ? "Ativando…" : "Ativar avisos"}
            </Button>
          )}
          <Button variant="ghost" onClick={dismiss}>
            Agora não
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {status === "on" && <p>✅ Os avisos estão ativados neste aparelho.</p>}
      {status === "off" && <p>Receba no celular o lembrete para confirmar presença, os times sorteados e quando abrir vaga na lista.</p>}
      {status === "denied" && (
        <p>
          Os avisos estão bloqueados para o Sem Panela. Libere nas configurações de notificação do celular (ou do navegador) e
          volte aqui.
        </p>
      )}
      {status === "ios-install" && (
        <p>
          No iPhone, os avisos só funcionam com o app instalado na tela de início (iOS 16.4 ou mais novo): toque em{" "}
          <strong>Compartilhar</strong>, depois em <strong>Adicionar à Tela de Início</strong>, e abra o Sem Panela por lá.
        </p>
      )}
      {status === "unsupported" && <p>Este navegador não aceita notificações. Tente pelo Chrome no Android ou pelo app instalado no iPhone.</p>}
      <div className="flex flex-wrap gap-2">
        {status === "off" && (
          <Button onClick={enable} disabled={busy}>
            {busy ? "Ativando…" : "Ativar avisos"}
          </Button>
        )}
        {status === "on" && (
          <>
            <Button variant="secondary" onClick={test} disabled={busy}>
              Mandar um teste
            </Button>
            <Button variant="ghost" onClick={disable} disabled={busy}>
              Desativar
            </Button>
          </>
        )}
      </div>
      {note && <p className="text-neutral-600">{note}</p>}
    </div>
  );
}
