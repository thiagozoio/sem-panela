import { formatGameDate, formatMoney } from "./format";
import type { ListEntry } from "./attendance";
import type { Team } from "./types";

export function listMessage(
  groupName: string,
  startsAt: string,
  confirmed: ListEntry[],
  waitlist: ListEntry[],
  maxPlayers: number,
  link: string,
): string {
  const lines = [`⚽ *${groupName}*`, formatGameDate(startsAt), ""];
  lines.push(`*Confirmados (${confirmed.length}/${maxPlayers})*`);
  confirmed.forEach((e, i) => lines.push(`${i + 1}. ${e.member.name}${e.member.position === "goleiro" ? " 🧤" : ""}`));
  if (waitlist.length) {
    lines.push("", "*Lista de espera*");
    waitlist.forEach((e, i) => lines.push(`${i + 1}. ${e.member.name}`));
  }
  lines.push("", `Confirme aqui: ${link}`);
  return lines.join("\n");
}

export function teamsMessage(groupName: string, startsAt: string, teams: Team[]): string {
  const lines = [`⚽ *${groupName}*: times`, formatGameDate(startsAt)];
  for (const t of teams) {
    lines.push("", `*${t.name}*`);
    t.players.forEach((p) => lines.push(`${p.position === "goleiro" ? "🧤" : "•"} ${p.name}`));
  }
  lines.push("", "Times do Sem Panela, sem panelinha 😉");
  return lines.join("\n");
}

export function debtorsMessage(
  groupName: string,
  monthName: string,
  debtors: { name: string; amountCents: number; what: string }[],
  pixKey: string,
): string {
  const lines = [`💰 *${groupName}*: pagamentos em aberto (${monthName})`, ""];
  debtors.forEach((d) => lines.push(`• ${d.name}: ${formatMoney(d.amountCents)} (${d.what})`));
  if (pixKey) lines.push("", `Pix: ${pixKey}`);
  lines.push("", "Valeu, galera! 🙏");
  return lines.join("\n");
}
