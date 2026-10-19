import "server-only";
import { getGroupContext } from "@/lib/groups";
import { todayInBrazil } from "@/lib/format";
import { sportOf } from "@/lib/sports";
import { rankingOf, type Championship, type ResultGame } from "@/lib/standings";

/** Tudo o que a classificação precisa: jogos com placar, nomes dos times fixos e campeonatos. */
export async function loadRanking(groupId: string) {
  const ctx = await getGroupContext(groupId);
  const { supabase, group, members } = ctx;
  const mode = rankingOf(group.ranking);
  const [{ data: games }, { data: fixed }, { data: championships }] = await Promise.all([
    supabase
      .from("games")
      .select("starts_at, teams, scores, game_goals(member_id, goals)")
      .eq("group_id", group.id)
      .not("scores", "is", null)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at")
      .returns<ResultGame[]>(),
    supabase.from("fixed_teams").select("month, name").eq("group_id", group.id).returns<{ month: string; name: string }[]>(),
    mode === "campeonato"
      ? supabase.from("championships").select("*").eq("group_id", group.id).order("starts_on").returns<Championship[]>()
      : Promise.resolve({ data: [] as Championship[] }),
  ]);

  const fixedByMonth = new Map<string, Set<string>>();
  for (const t of fixed ?? []) fixedByMonth.set(t.month, (fixedByMonth.get(t.month) ?? new Set()).add(t.name));
  const byId = new Map(members.map((m) => [m.id, m.name]));

  return {
    ...ctx,
    mode,
    sport: sportOf(group.sport),
    today: todayInBrazil(),
    games: games ?? [],
    championships: championships ?? [],
    fixedNames: (month: string) => fixedByMonth.get(month) ?? new Set<string>(),
    nameOf: (memberId: string, fallback = "?") => byId.get(memberId) ?? fallback,
  };
}
