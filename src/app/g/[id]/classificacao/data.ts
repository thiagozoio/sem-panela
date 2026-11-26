import "server-only";
import { getGroupContext } from "@/lib/groups";
import { todayInBrazil } from "@/lib/format";
import { sportOf } from "@/lib/sports";
import type { RoundScore } from "@/lib/rounds";
import { rankingOf, withoutGuests, type Championship, type ResultGame } from "@/lib/standings";

/** Tudo o que a classificação precisa: jogos com placar, nomes dos times fixos e campeonatos. */
export async function loadRanking(groupId: string) {
  const ctx = await getGroupContext(groupId);
  const { supabase, group, members } = ctx;
  const mode = rankingOf(group.ranking);
  const [{ data: games }, { data: fixed }, { data: championships }, { data: rounds }] = await Promise.all([
    supabase
      .from("games")
      .select("id, starts_at, teams, scores, game_goals(member_id, goals), attendances(member_id, going)")
      .eq("group_id", group.id)
      .not("scores", "is", null)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at")
      .returns<ResultGame[]>(),
    supabase.from("fixed_teams").select("month, name").eq("group_id", group.id).returns<{ month: string; name: string }[]>(),
    mode === "campeonato"
      ? supabase.from("championships").select("*").eq("group_id", group.id).order("starts_on").returns<Championship[]>()
      : Promise.resolve({ data: [] as Championship[] }),
    // Partidas do dia (formato com várias partidas). Sem a migração 20261126000000 dá erro e fica vazio.
    supabase
      .from("game_rounds")
      .select("game_id, home, away, home_score, away_score")
      .eq("group_id", group.id)
      .order("seq")
      .returns<(RoundScore & { game_id: string })[]>(),
  ]);
  const roundsOf = new Map<string, RoundScore[]>();
  for (const r of rounds ?? []) roundsOf.set(r.game_id, [...(roundsOf.get(r.game_id) ?? []), r]);
  const withRounds = (games ?? []).map((g) => (g.id && roundsOf.has(g.id) ? { ...g, rounds: roundsOf.get(g.id) } : g));

  const fixedByMonth = new Map<string, Set<string>>();
  for (const t of fixed ?? []) fixedByMonth.set(t.month, (fixedByMonth.get(t.month) ?? new Set()).add(t.name));
  const byId = new Map(members.map((m) => [m.id, m.name]));

  return {
    ...ctx,
    mode,
    sport: sportOf(group.sport),
    today: todayInBrazil(),
    // Convidado nunca entra na classificação.
    games: withoutGuests(withRounds, new Set(members.filter((m) => m.guest).map((m) => m.id))),
    championships: championships ?? [],
    fixedNames: (month: string) => fixedByMonth.get(month) ?? new Set<string>(),
    nameOf: (memberId: string, fallback = "?") => byId.get(memberId) ?? fallback,
  };
}
