/**
 * Guarda o pedido de instalação do Chrome (Android/computador) assim que ele chega,
 * antes de qualquer componente montar. O botão "Instalar no celular" usa depois.
 */
export const installCaptureScript = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__spInstall=e;window.dispatchEvent(new Event("sp-install-ready"))});window.addEventListener("appinstalled",function(){window.__spInstall=null;window.dispatchEvent(new Event("sp-installed"))});`;

export type Platform = "installed" | "ios" | "ios-other" | "in-app" | "android" | "desktop";

/** Descobre onde a pessoa está, para mostrar o passo a passo certo. */
export function detectPlatform(ua: string, standalone: boolean, touchMac: boolean): Platform {
  if (standalone) return "installed";
  if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|WhatsApp|; wv\)/i.test(ua)) return "in-app";
  const ios = /iPhone|iPad|iPod/i.test(ua) || touchMac;
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
