"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SOFT_MS = 30_000;
const HARD_MS = 30 * 60_000;

/**
 * O app salvo na tela de início (iPhone e Android) fica aberto em segundo plano por dias
 * e só busca o menu e os dados de novo numa navegação completa. Ao voltar para ele,
 * atualiza a tela (depois de 30 s fora) ou recarrega tudo, pegando a versão nova do app
 * (depois de 30 min fora).
 */
export function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (away >= HARD_MS) window.location.reload();
      else if (away >= SOFT_MS) router.refresh();
    };
    // Página restaurada do cache de voltar/avançar do navegador: pode estar bem velha.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);
  return null;
}
