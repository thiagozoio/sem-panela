import { todayInBrazil } from "./format";
import type { Game, Match, Team, TeamPlayer } from "./types";

/** Só os dígitos, sem o 55 do Brasil: "(47) 99203-7481" -> "47992037481". */
export function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
}

/** "47992037481" -> "(47) 99203-7481"; o que não for número do Brasil fica como veio. */
export function formatPhone(input: string): string {
  const d = phoneDigits(input);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return input.trim();
}

/** Link para abrir a conversa no WhatsApp; vazio quando o número não tem DDD. */
export function whatsappTo(phone: string, text = ""): string {
  const d = phoneDigits(phone);
  if (d.length < 10) return "";
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/55${d}${query}`;
}

/** Data e hora do formulário (horário de Brasília, sem horário de verão) -> ISO. */
export function brazilDateTime(day: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const date = new Date(`${day}T${time}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO -> ["AAAA-MM-DD", "HH:MM"] no horário de Brasília, para preencher o formulário. */
export function toBrazilInputs(iso: string): [string, string] {
  const local = new Date(new Date(iso).getTime() - 3 * 3_600_000).toISOString();
  return [local.slice(0, 10), local.slice(11, 16)];
}

export type Outcome = "V" | "E" | "D";

export function outcomeOf(match: Pick<Match, "our_score" | "their_score">): Outcome | null {
  if (match.our_score == null || match.their_score == null) return null;
  if (match.our_score > match.their_score) return "V";
  if (match.our_score < match.their_score) return "D";
  return "E";
}

/** Próximos (do mais perto ao mais longe) e histórico (do mais recente ao mais antigo). */
export function splitMatches(matches: Match[], now = new Date()) {
  const t = now.getTime();
  // Jogo que já começou mas ainda está sem placar continua em "próximos" até o dia seguinte.
  const isPast = (m: Match) => {
    const start = new Date(m.starts_at).getTime();
    return start <= t && (outcomeOf(m) !== null || start + 86_400_000 <= t);
  };
  const upcoming = matches.filter((m) => !isPast(m)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = matches.filter(isPast).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return { upcoming, past };
}

export type MatchRecord = { opponent: string; games: number; wins: number; draws: number; losses: number; scored: number; conceded: number };

/** Retrospecto geral e contra cada adversário (mesmo nome, sem diferenciar maiúsculas). */
export function matchRecord(matches: Match[]) {
  const empty = (opponent: string): MatchRecord => ({ opponent, games: 0, wins: 0, draws: 0, losses: 0, scored: 0, conceded: 0 });
  const total = empty("");
  const byOpponent = new Map<string, MatchRecord>();
  for (const m of matches) {
    const outcome = outcomeOf(m);
    if (!outcome) continue;
    const key = m.opponent.trim().toLocaleLowerCase("pt-BR");
    const row = byOpponent.get(key) ?? empty(m.opponent.trim());
    byOpponent.set(key, row);
    for (const r of [total, row]) {
      r.games++;
      r.scored += m.our_score!;
      r.conceded += m.their_score!;
      if (outcome === "V") r.wins++;
      else if (outcome === "E") r.draws++;
      else r.losses++;
    }
  }
  const opponents = [...byOpponent.values()].sort((a, b) => b.games - a.games || a.opponent.localeCompare(b.opponent, "pt-BR"));
  return { total, opponents };
}

/** Nome do adversário limpo (até 60 letras) ou vazio. */
export function cleanOpponent(input: string | null | undefined): string {
  return (input ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Times do jogo contra time de fora: a turma toda (quem jogou) contra o adversário,
 * que não tem jogadores no app. O placar fica na mesma ordem: nós, eles.
 */
export function opponentTeams(groupName: string, opponent: string, players: TeamPlayer[]): Team[] {
  const us = groupName.trim().slice(0, 30) || "Nós";
  const them = cleanOpponent(opponent).slice(0, 30) || "Adversário";
  return [
    { name: us, players: players.map(({ member_id, name, position }) => ({ member_id, name, position })) },
    // Nome igual ao nosso confundiria os times (o placar usa o nome como chave na tela).
    { name: them.toLocaleLowerCase("pt-BR") === us.toLocaleLowerCase("pt-BR") ? `${them} (adv.)` : them, players: [] },
  ];
}

/** Adversário do jogo: o salvo no jogo ou, se não tiver, o do amistoso marcado no mesmo dia. */
export function opponentOf(game: Pick<Game, "starts_at" | "opponent">, matches: Pick<Match, "starts_at" | "opponent">[]): string {
  const saved = cleanOpponent(game.opponent);
  if (saved) return saved;
  const day = todayInBrazil(new Date(game.starts_at));
  return cleanOpponent(matches.find((m) => todayInBrazil(new Date(m.starts_at)) === day)?.opponent);
}

/**
 * Jogos da semana contra time de fora como amistosos do histórico (placar: nós, eles).
 * O amistoso marcado no mesmo dia contra o mesmo time sai da lista, para não contar duas vezes.
 */
export function mergeGameMatches(
  matches: Match[],
  games: (Pick<Game, "id" | "group_id" | "starts_at" | "scores" | "opponent">)[],
): (Match & { game_id?: string })[] {
  const fromGames = games
    .filter((g) => cleanOpponent(g.opponent))
    .map((g) => ({
      id: g.id,
      game_id: g.id,
      group_id: g.group_id,
      starts_at: g.starts_at,
      opponent: cleanOpponent(g.opponent),
      location: "",
      contact_name: "",
      contact_phone: "",
      notes: "",
      our_score: g.scores?.length === 2 ? g.scores[0] : null,
      their_score: g.scores?.length === 2 ? g.scores[1] : null,
      created_at: g.starts_at,
    }));
  const key = (m: Pick<Match, "starts_at" | "opponent">) =>
    `${todayInBrazil(new Date(m.starts_at))}|${m.opponent.trim().toLocaleLowerCase("pt-BR")}`;
  const taken = new Set(fromGames.map(key));
  return [...matches.filter((m) => !taken.has(key(m))), ...fromGames];
}
