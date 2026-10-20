import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Input, Select } from "@/components/ui";
import { UpgradeCard } from "@/components/billing-banner";
import { ShareButtons } from "@/components/share";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import { splitList } from "@/lib/attendance";
import { formatGameDate, hasStarted } from "@/lib/format";
import { bestPlayer, rankRatings, resultMessage, scorers } from "@/lib/result";
import type { Attendance, Game, GameGoal, Member, RatingSummary } from "@/lib/types";
import { saveRatings, saveResult } from "../../actions";

export const metadata: Metadata = { title: "Resultado" };

const NOTES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default async function GameResultPage({ params }: PageProps<"/g/[id]/jogos/[gameId]">) {
  const { id, gameId } = await params;
  const { supabase, group, members, me, isOrganizer, locked } = await getGroupContext(id);

  const [{ data: gameRow }, { data: goals }, { data: summary }, { data: myRatings }] = await Promise.all([
    supabase
      .from("games")
      .select("*, attendances(*)")
      .eq("id", gameId)
      .eq("group_id", group.id)
      .maybeSingle<Game & { attendances: Attendance[] }>(),
    supabase.from("game_goals").select("*").eq("game_id", gameId).returns<GameGoal[]>(),
    supabase.rpc("game_rating_summary", { p_game_id: gameId }),
    me
      ? supabase.from("game_ratings").select("rated_id, rating").eq("game_id", gameId).eq("rater_id", me.id)
      : Promise.resolve({ data: [] as { rated_id: string; rating: number }[] }),
  ]);
  if (!gameRow) notFound();
  const { attendances, ...game } = gameRow;
  const started = hasStarted(game.starts_at);

  // Quem jogou: os times do jogo (se teve sorteio) ou a lista de confirmados.
  const byId = new Map(members.map((m) => [m.id, m]));
  const going = new Set((attendances ?? []).filter((a) => a.going).map((a) => a.member_id));
  const played: Member[] = game.teams
    ? game.teams.flatMap((t) => t.players.map((p) => byId.get(p.member_id))).filter((m): m is Member => !!m && going.has(m.id))
    : splitList(attendances ?? [], members, group.max_players, game.starts_at, group.priority_hours).confirmed.map((e) => e.member);
  const iPlayed = !!me && played.some((m) => m.id === me.id);

  const nameOf = (mid: string) => byId.get(mid)?.name ?? "?";
  const goalsOf = new Map((goals ?? []).map((g) => [g.member_id, g.goals]));
  const goalList = scorers(goals ?? [], nameOf);
  const ranking = rankRatings(((summary ?? []) as RatingSummary[]).filter((r) => byId.has(r.member_id)));
  const best = bestPlayer(ranking);
  const myRating = new Map((myRatings ?? []).map((r) => [r.rated_id, r.rating]));
  const hasResult = !!game.scores?.length || goalList.length > 0;
  const canEditResult = isOrganizer && !locked;

  return (
    <div className="space-y-4">
      <Link href={`/g/${group.id}/jogos`} className="text-sm text-pitch-700">
        ‹ Jogos anteriores
      </Link>

      {locked && <UpgradeCard feature="Placar, gols e notas" organizer={isOrganizer} groupName={group.name} />}

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-700">Resultado</p>
          <p className="text-lg font-bold">{formatGameDate(game.starts_at)}</p>
        </div>

        {game.teams && game.scores?.length ? (
          <div className="flex flex-wrap justify-center gap-3 text-center">
            {game.teams.map((t, i) => (
              <div key={t.name} className="min-w-24 rounded-xl bg-pitch-50 px-3 py-2">
                <p className="text-sm font-semibold text-pitch-900">{t.name}</p>
                <p className="text-3xl font-extrabold">{game.scores?.[i] ?? 0}</p>
              </div>
            ))}
          </div>
        ) : (
          !hasResult && (
            <p className="text-sm text-neutral-500">
              {canEditResult ? "Anote o placar e quem fez gol logo abaixo." : "O organizador ainda não anotou o resultado."}
            </p>
          )
        )}

        {goalList.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Gols</h3>
            <ul className="text-sm">
              {goalList.map((g) => (
                <li key={g.name}>
                  ⚽ {g.name}
                  {g.goals > 1 && <span className="text-neutral-500"> ({g.goals})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {best && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ⭐ Craque do jogo: <strong>{nameOf(best.member_id)}</strong> (nota {Number(best.average).toFixed(1).replace(".", ",")})
          </p>
        )}

        {(hasResult || best) && (
          <ShareButtons
            label="Mandar resultado no WhatsApp"
            text={resultMessage(group.name, game.starts_at, game.teams, game.scores, goalList, best ? nameOf(best.member_id) : null)}
          />
        )}
      </Card>

      {canEditResult && started && (
        <Card>
          <details open={!hasResult}>
            <summary className="cursor-pointer font-semibold">{hasResult ? "Corrigir placar e gols" : "Anotar placar e gols"}</summary>
            <form action={saveResult} className="mt-3 space-y-4">
              <input type="hidden" name="game_id" value={game.id} />
              {game.teams && (
                <div className="flex flex-wrap gap-3">
                  {game.teams.map((t, i) => (
                    <label key={t.name} className="text-sm">
                      <span className="block text-neutral-600">{t.name}</span>
                      <Input name={`score_${i}`} type="number" min={0} max={99} defaultValue={game.scores?.[i] ?? 0} className="w-20" />
                    </label>
                  ))}
                </div>
              )}
              <div>
                <p className="text-sm text-neutral-600">Gols de cada jogador</p>
                <ul className="divide-y divide-neutral-100">
                  {played.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span>{m.name}</span>
                      <Input
                        name={`goals_${m.id}`}
                        type="number"
                        min={0}
                        max={50}
                        defaultValue={goalsOf.get(m.id) ?? 0}
                        aria-label={`Gols de ${m.name}`}
                        className="w-20 px-2 py-1.5"
                      />
                    </li>
                  ))}
                </ul>
              </div>
              <SubmitButton className="w-full">Salvar resultado</SubmitButton>
            </form>
          </details>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Notas</h2>
        {ranking.length > 0 ? (
          <ol className="space-y-1 text-sm">
            {ranking.map((r, i) => (
              <li key={r.member_id} className="flex items-center justify-between gap-2">
                <span>
                  <span className="inline-block w-6 text-right text-neutral-400">{i + 1}.</span> {nameOf(r.member_id)}
                </span>
                <span className="font-semibold">
                  {Number(r.average).toFixed(1).replace(".", ",")}{" "}
                  <span className="text-xs font-normal text-neutral-500">
                    ({r.votes} {r.votes === 1 ? "voto" : "votos"})
                  </span>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-neutral-500">Ninguém deu nota ainda.</p>
        )}
        <p className="text-xs text-neutral-500">Cada um vê só a média. Ninguém sabe quem deu qual nota.</p>
      </Card>

      {me && iPlayed && started && !locked && (
        <Card>
          <details open={myRating.size === 0}>
            <summary className="cursor-pointer font-semibold">{myRating.size ? "Mudar minhas notas" : "Dar notas para quem jogou"}</summary>
            <form action={saveRatings} className="mt-3 space-y-3">
              <input type="hidden" name="game_id" value={game.id} />
              <input type="hidden" name="rater_id" value={me.id} />
              <ul className="divide-y divide-neutral-100">
                {played
                  .filter((m) => m.id !== me.id)
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span>{m.name}</span>
                      <Select
                        name={`rating_${m.id}`}
                        defaultValue={myRating.get(m.id) ?? ""}
                        aria-label={`Nota de ${m.name}`}
                        className="w-24 px-2 py-1.5"
                      >
                        <option value="">–</option>
                        {NOTES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>
                    </li>
                  ))}
              </ul>
              <SubmitButton className="w-full">Salvar notas</SubmitButton>
            </form>
          </details>
        </Card>
      )}
      {me && !iPlayed && started && <p className="text-center text-xs text-neutral-500">Só quem jogou dá nota.</p>}
    </div>
  );
}
