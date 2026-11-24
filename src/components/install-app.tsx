"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonStyles } from "./ui";
import { detectPlatform, type Platform } from "@/lib/install";
import { APP_NAME, SITE_HOST } from "@/lib/brand";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window {
    __spInstall?: InstallEvent | null;
  }
}

function currentPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const touchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return detectPlatform(navigator.userAgent, standalone, touchMac);
}

/**
 * Botão "Instalar no celular": no Chrome do Android abre a janela de instalação;
 * no iPhone e nos outros casos mostra o passo a passo de cada aparelho.
 */
export function InstallApp({ compact = false }: { compact?: boolean }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- lê o aparelho só no navegador */
    setPlatform(currentPlatform());
    setPrompt(window.__spInstall ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
    const ready = () => setPrompt(window.__spInstall ?? null);
    const installed = () => {
      setPrompt(null);
      setDone(true);
    };
    window.addEventListener("sp-install-ready", ready);
    window.addEventListener("sp-installed", installed);
    // O Chrome só oferece instalar sites com service worker; o mesmo dos avisos.
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    return () => {
      window.removeEventListener("sp-install-ready", ready);
      window.removeEventListener("sp-installed", installed);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__spInstall = null;
    setPrompt(null);
    if (outcome === "accepted") setDone(true);
  }

  if (!platform) return <div className="h-10" aria-hidden />;

  if (platform === "installed" || done) {
    return (
      <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900 ring-1 ring-pitch-100">
        ✅ {done ? `Pronto! O ${APP_NAME} foi instalado. Procure o ícone na tela inicial.` : `Você já está usando o ${APP_NAME} instalado no celular.`}
      </p>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {prompt && (
        <button type="button" onClick={install} className={`${buttonStyles.primary} w-full`}>
          📲 Instalar no celular
        </button>
      )}
      {!prompt && <Steps platform={platform} />}
      {prompt && !compact && (
        <p className="text-xs text-neutral-500">Toque no botão e confirme em Instalar. O ícone aparece na tela inicial.</p>
      )}
      {compact && (
        <Link href="/como-usar#instalar" className="block text-xs text-pitch-700 underline">
          Ver o passo a passo com imagens
        </Link>
      )}
    </div>
  );
}

function Steps({ platform }: { platform: Platform }) {
  switch (platform) {
    case "ios":
      return (
        <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
          <li>
            Toque em <strong>Compartilhar</strong> (o quadrado com a seta, embaixo da tela). Se não aparecer, toque antes em{" "}
            <strong>•••</strong>.
          </li>
          <li>
            Role o menu e toque em <strong>Adicionar à Tela de Início</strong>.
          </li>
          <li>
            Toque em <strong>Adicionar</strong>, no canto de cima.
          </li>
        </ol>
      );
    case "ios-other":
      return (
        <p className="text-neutral-700">
          No iPhone, abra <strong>{SITE_HOST}</strong> no <strong>Safari</strong>, toque em <strong>Compartilhar</strong> e depois em{" "}
          <strong>Adicionar à Tela de Início</strong>. Em alguns navegadores o mesmo botão Compartilhar também tem essa opção.
        </p>
      );
    case "in-app":
      return (
        <p className="text-neutral-700">
          Você abriu o link dentro de outro app (WhatsApp, Instagram…). Toque nos <strong>três pontinhos</strong> e escolha{" "}
          <strong>Abrir no navegador</strong> (Chrome no Android, Safari no iPhone). Lá aparece a opção de instalar.
        </p>
      );
    case "android":
      return (
        <ol className="list-decimal space-y-1 pl-5 text-neutral-700">
          <li>
            No Chrome, toque nos <strong>três pontinhos</strong> no canto de cima.
          </li>
          <li>
            Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
          </li>
          <li>
            Confirme em <strong>Instalar</strong> (ou <strong>Adicionar</strong>).
          </li>
        </ol>
      );
    default:
      return (
        <p className="text-neutral-700">
          Abra <strong>{SITE_HOST}</strong> no navegador do celular: no iPhone pelo Safari (Compartilhar › Adicionar à Tela de Início) e no
          Android pelo Chrome (três pontinhos › Instalar app).
        </p>
      );
  }
}
