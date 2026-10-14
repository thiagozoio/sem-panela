"use client";

import { useState } from "react";
import { buttonStyles } from "./ui";
import { whatsappLink } from "@/lib/format";

/** Botões para mandar um texto pronto no WhatsApp ou copiar. */
export function ShareButtons({ text, label = "Mandar no WhatsApp" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <a href={whatsappLink(text)} target="_blank" rel="noreferrer" className={buttonStyles.primary}>
        {label}
      </a>
      <button
        type="button"
        className={buttonStyles.secondary}
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
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
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
