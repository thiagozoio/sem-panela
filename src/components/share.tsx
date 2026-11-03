"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { buttonStyles } from "./ui";
import { whatsappAppUrl, whatsappLink } from "@/lib/format";

const noSubscribe = () => () => {};

function isMobile(): boolean {
  const ua = navigator.userAgent;
  // iPad com iPadOS se apresenta como Mac; o toque denuncia.
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Link para o WhatsApp que funciona no celular.
 * No computador abre o wa.me numa aba nova (WhatsApp Web). No celular abre o app
 * direto pelo whatsapp://; se o app não abrir, cai no compartilhar do sistema
 * ou, sem ele, no wa.me na mesma janela.
 */
export function WhatsAppLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={(e) => {
        if (!isMobile()) return;
        e.preventDefault();
        let left = false;
        const onHide = () => {
          if (document.visibilityState === "hidden") left = true;
        };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", onHide);
        window.location.href = whatsappAppUrl(href);
        setTimeout(() => {
          document.removeEventListener("visibilitychange", onHide);
          window.removeEventListener("pagehide", onHide);
          if (left || document.visibilityState === "hidden") return;
          window.location.href = href;
        }, 1500);
      }}
    >
      {children}
    </a>
  );
}

/** Botões para mandar um texto pronto no WhatsApp ou copiar. */
export function ShareButtons({ text, label = "Mandar no WhatsApp" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  // No servidor não existe navigator: o botão só aparece no navegador.
  const shareable = useSyncExternalStore(noSubscribe, () => "share" in navigator && isMobile(), () => false);
  return (
    <div className="flex flex-wrap gap-2">
      <WhatsAppLink href={whatsappLink(text)} className={buttonStyles.primary}>
        {label}
      </WhatsAppLink>
      <button
        type="button"
        className={buttonStyles.secondary}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
          } catch {
            copyFallback(text);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
      {shareable && (
        <button
          type="button"
          className={buttonStyles.secondary}
          onClick={() => navigator.share({ text }).catch(() => {})}
        >
          Outros apps
        </button>
      )}
    </div>
  );
}

/** Cópia para navegadores sem a API de área de transferência (ou que a bloqueiam). */
function copyFallback(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  el.remove();
}

export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm" />
      <button
        type="button"
        className={buttonStyles.secondary}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            copyFallback(value);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
