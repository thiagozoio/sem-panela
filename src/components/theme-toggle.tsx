"use client";

import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { auto: "dark", dark: "light", light: "auto" };
const LABEL: Record<Theme, string> = { auto: "Tema automático", dark: "Tema escuro", light: "Tema claro" };
const ICON: Record<Theme, string> = { auto: "🌓", dark: "🌙", light: "☀️" };

function saved(): Theme {
  try {
    const v = localStorage.getItem("theme");
    if (v === "dark" || v === "light") return v;
  } catch {}
  return "auto";
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("auto");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a escolha salva só existe no navegador
    setTheme(saved());
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply(saved());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = NEXT[theme];
    setTheme(next);
    try {
      if (next === "auto") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {}
    apply(next);
  }

  return (
    <button type="button" onClick={cycle} title={LABEL[theme]} aria-label={LABEL[theme]} className="opacity-90 hover:opacity-100">
      {ICON[theme]}
    </button>
  );
}
