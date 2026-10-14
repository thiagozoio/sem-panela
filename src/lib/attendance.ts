import type { Attendance, Member } from "./types";

export type ListEntry = { member: Member; confirmedAt: string; priority: boolean };

/**
 * Divide quem confirmou entre lista principal e lista de espera.
 * Mensalistas que confirmaram até `priorityHours` antes do jogo passam na frente;
 * dentro de cada faixa vale a ordem de confirmação.
 */
export function splitList(
  attendances: Attendance[],
  members: Member[],
  maxPlayers: number,
  startsAt: string,
  priorityHours: number,
): { confirmed: ListEntry[]; waitlist: ListEntry[]; out: Member[] } {
  const byId = new Map(members.map((m) => [m.id, m]));
  const cutoff = new Date(startsAt).getTime() - priorityHours * 3600_000;

  const going: ListEntry[] = [];
  const out: Member[] = [];
  for (const a of attendances) {
    const member = byId.get(a.member_id);
    if (!member || !member.active) continue;
    if (!a.going) {
      out.push(member);
      continue;
    }
    const priority =
      member.kind === "mensalista" && new Date(a.confirmed_at).getTime() <= cutoff;
    going.push({ member, confirmedAt: a.confirmed_at, priority });
  }

  going.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime();
  });

  return {
    confirmed: going.slice(0, maxPlayers),
    waitlist: going.slice(maxPlayers),
    out: out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}
