export const TZ = "America/Sao_Paulo";

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function formatGameDate(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${date.charAt(0).toUpperCase()}${date.slice(1)}, ${time}`;
}

/** "2026-10-31" -> "31/10/2026" (datas sem hora, sem fuso). */
export function formatDay(day: string): string {
  const [y, m, d] = day.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "80" / "80,50" / "R$ 80,50" -> centavos. */
export function parseMoney(input: string): number {
  const clean = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number(clean);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

/** Data de hoje (YYYY-MM-DD) no fuso de São Paulo. */
export function todayInBrazil(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

/** Primeiro dia do mês (YYYY-MM-01) de uma data YYYY-MM-DD. */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Soma meses a uma data YYYY-MM-DD, segurando o fim do mês (31/01 + 1 = 28/02). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
