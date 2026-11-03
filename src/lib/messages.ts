import { formatGameDate, formatMoney } from "./format";
import type { ListEntry } from "./attendance";
import { byPosition, positionInfo, type Sport } from "./sports";
import type { Team } from "./types";

export function listMessage(
  groupName: string,
  startsAt: string,
  confirmed: ListEntry[],
  waitlist: ListEntry[],
  out: { name: string }[],
  maxPlayers: number,
  link: string,
  sport: Sport,
  teamOf: Map<string, string> = new Map(),
): string {
  const lines = [`${sport === "volei" ? "🏐" : "⚽"} *${groupName}*`, formatGameDate(startsAt), ""];
  lines.push(`*Confirmados (${confirmed.length}/${maxPlayers})*`);
  confirmed.forEach((e, i) => {
    const team = teamOf.get(e.member.id);
    lines.push(`${i + 1}. ${e.member.name}${e.member.guest ? " (convidado)" : ""}${positionSuffix(sport, e.member.position)}${team ? ` · ${team}` : ""}`);
  });
  if (waitlist.length) {
    lines.push("", "*Lista de espera*");
    waitlist.forEach((e, i) => lines.push(`${i + 1}. ${e.member.name}${e.member.guest ? " (convidado)" : ""}`));
  }
  if (out.length) {
    lines.push("", `*Não vão (${out.length})*`);
    out.forEach((m) => lines.push(`❌ ${m.name}`));
  }
  lines.push("", `Confirme aqui: ${link}`);
  return lines.join("\n");
}

/** Time de cada jogador (member_id → nome do time), a partir dos times do jogo ou dos times fixos do mês. */
export function teamNames(teams: { name: string; member_ids: string[] }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of teams) for (const id of t.member_ids) if (!map.has(id)) map.set(id, t.name);
  return map;
}

function positionSuffix(sport: Sport, position: string): string {
  const info = positionInfo(sport, position);
  if (!info) return "";
  return info.value === "goleiro" ? " 🧤" : ` (${info.label.toLowerCase()})`;
}

export function teamsMessage(groupName: string, startsAt: string, teams: Team[], sport: Sport): string {
  const lines = [`${sport === "volei" ? "🏐" : "⚽"} *${groupName}*: times`, formatGameDate(startsAt)];
  for (const t of teams) {
    lines.push("", `*${t.name}*`);
    [...t.players].sort(byPosition(sport)).forEach((p) => {
      const info = positionInfo(sport, p.position);
      lines.push(info?.value === "goleiro" ? `🧤 ${p.name}` : `• ${p.name}${info ? ` (${info.label.toLowerCase()})` : ""}`);
    });
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
