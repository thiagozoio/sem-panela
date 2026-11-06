import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Input, Select } from "@/components/ui";
import { ShareButtons } from "@/components/share";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import { splitList } from "@/lib/attendance";
import { formatGameDate, hasStarted, monthOf } from "@/lib/format";
import { teamsFromFixed, toDrawPlayer } from "@/lib/fixed-teams";
import { sportOf } from "@/lib/sports";
import { bestPlayer, mvpWinners, rankMvpVotes, rankRatings, resultMessage, scorers } from "@/lib/result";
import type { Attendance, FixedTeam, Game, GameGoal, Member, MvpSummary, RatingSummary } from "@/lib/types";
import { saveLineup, saveMvpVote, saveRatings, saveResult } from "../../actions";

export const metadata: Metadata = { title: "Resultado" };

const NOTES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default async function GameResultPage({ params }: PageProps<"/g/[id]/jogos/[gameId]">) {
  const { id, gameId } = await params;
  const { supabase, group, members, me, isOrganizer, readOnly } = await getGroupContext(id);

  const [{ data: gameRow }, { data: goals }, { data: summary }, { data: myRatings }, { data: mvpRows }, { data: myVoteRow }] = await Promise.all([
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
    // Sem a migração 20261105000000 essas duas dão erro e a votação some.
    supabase.rpc("game_mvp_summary", { p_game_id: gameId }),
    me
      ? supabase.from("game_mvp_votes").select("voted_id").eq("game_id", gameId).eq("voter_id", me.id).maybeSingle<{ voted_id: string }>()
      : Promise.resolve({ data: null }),
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
  const playedIds = new Set(played.map((m) => m.id));
  const ranking = rankRatings(((summary ?? []) as RatingSummary[]).filter((r) => playedIds.has(r.member_id)));
  const mvpVotes = rankMvpVotes(((mvpRows ?? []) as MvpSummary[]).filter((v) => playedIds.has(v.member_id)));
  const mvpOn = mvpRows !== null; // a votação existe no banco
  const totalMvpVotes = mvpVotes.reduce((n, v) => n + v.votes, 0);
  const myVote = myVoteRow?.voted_id ?? "";

  // Craque do jogo: o mais votado pelos jogadores (empate = todos os empatados).
  // Sem nenhum voto, continua valendo a maior média das notas.
  const winners = mvpWinners(mvpVotes);
  const best = winners.length ? null : bestPlayer(ranking);
  const craque = winners.length
    ? {
        name: winners.map((w) => nameOf(w.member_id)).join(" e "),
        detail: `${winners[0].votes} ${winners[0].votes === 1 ? "voto" : "votos"}`,
      }
    : best
      ? { name: nameOf(best.member_id), detail: `nota ${Number(best.average).toFixed(1).replace(".", ",")}` }
      : null;
  const myRating = new Map((myRatings ?? []).map((r) => [r.rated_id, r.rating]));
  const hasResult = !!game.scores?.length || goalList.length > 0;
  const canEditResult = isOrganizer && !readOnly;

  // Jogo sem times salvos (não teve sorteio): se o mês tem times fixos, o placar
  // é anotado com eles, e ao salvar eles viram os times do jogo.
  let fixedTeams: Game["teams"] = null;
  if (canEditResult && started && !game.teams) {
    const { data: fixed } = await supabase
      .from("fixed_teams")
      .select("name, member_ids")
      .eq("group_id", group.id)
      .eq("month", monthOf(game.starts_at))
      .order("sort")
      .returns<Pick<FixedTeam, "name" | "member_ids">[]>();
    if (fixed?.length) {
      const sport = sportOf(group.sport);
      const teams = teamsFromFixed(fixed, played.map((m) => toDrawPlayer(sport, m)));
      if (teams.length >= 2) fixedTeams = teams;
    }
  }
  const scoreTeams = game.teams ?? fixedTeams;

  // Para corrigir quem jogou: primeiro quem jogou, depois o resto do grupo (convidados no fim).
  const teamIndex = new Map(game.teams?.flatMap((t, i) => t.players.map((p) => [p.member_id, i] as const)) ?? []);
  const lineup =
    canEditResult && started
      ? [
          ...played,
          ...members
            .filter((m) => m.active && !playedIds.has(m.id))
            .sort((a, b) => Number(a.guest) - Number(b.guest) || a.name.localeCompare(b.name, "pt-BR")),
        ]
      : [];

  return (
    <div className="space-y-4">
      <Link href={`/g/${group.id}/jogos`} className="text-sm text-pitch-700">
        ‹ Jogos anteriores
      </Link>

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

        {craque && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ⭐ Craque do jogo: <strong>{craque.name}</strong> ({craque.detail})
          </p>
        )}

        {(hasResult || craque) && (
          <ShareButtons
            label="Mandar resultado no WhatsApp"
            text={resultMessage(group.name, game.starts_at, game.teams, game.scores, goalList, craque?.name ?? null)}
          />
        )}
      </Card>

      {canEditResult && started && (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold">Corrigir quem jogou</summary>
            <form action={saveLineup} className="mt-3 space-y-3">
              <input type="hidden" name="game_id" value={game.id} />
              <input type="hidden" name="group_id" value={group.id} />
              <p className="text-sm text-neutral-600">
                Veio quem não confirmou ou faltou quem confirmou? Ajuste aqui. Só quem jogou dá e recebe nota, entra nos gols
                {game.teams ? " e nos times" : " e na cobrança de avulso"}. Ninguém recebe aviso.
              </p>
              <ul className="divide-y divide-neutral-100">
                {lineup.map((m) => {
                  const playing = playedIds.has(m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className={playing ? "" : "text-neutral-500"}>
                        {m.name}
                        {m.guest && <span className="text-xs text-neutral-400"> (convidado)</span>}
                      </span>
                      <Select
                        name={`who_${m.id}`}
                        defaultValue={playing ? (game.teams ? String(teamIndex.get(m.id) ?? "") : "1") : ""}
                        aria-label={`${m.name} jogou?`}
                        className="w-36 px-2 py-1.5"
                      >
                        <option value="">Não jogou</option>
                        {game.teams ? (
                          game.teams.map((t, i) => (
                            <option key={t.name} value={i}>
                              {t.name}
                            </option>
                          ))
                        ) : (
                          <option value="1">Jogou</option>
                        )}
                      </Select>
                    </li>
                  );
                })}
              </ul>
              {!game.teams && <p className="text-xs text-neutral-500">Até {group.max_players} jogadores, o limite da pelada.</p>}
              <SubmitButton className="w-full">Salvar quem jogou</SubmitButton>
            </form>
          </details>
        </Card>
      )}

      {canEditResult && started && (
        <Card>
          <details open={!hasResult}>
            <summary className="cursor-pointer font-semibold">{hasResult ? "Corrigir placar e gols" : "Anotar placar e gols"}</summary>
            <form action={saveResult} className="mt-3 space-y-4">
              <input type="hidden" name="game_id" value={game.id} />
              <input type="hidden" name="group_id" value={group.id} />
              {!game.teams && fixedTeams && <input type="hidden" name="use_fixed" value="1" />}
              {!scoreTeams && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Esse jogo ficou sem times (não teve sorteio), então não tem placar. Dá para anotar os gols de cada jogador.
                </p>
              )}
              {scoreTeams && (
                <div className="flex flex-wrap gap-3">
                  {scoreTeams.map((t, i) => (
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

      {mvpOn && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Votação do craque</h2>
          {mvpVotes.length > 0 ? (
            <ol className="space-y-1 text-sm">
              {mvpVotes.map((v, i) => (
                <li key={v.member_id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="inline-block w-6 text-right text-neutral-400">{i + 1}.</span> {nameOf(v.member_id)}
                    {v.votes === mvpVotes[0].votes && " ⭐"}
                  </span>
                  <span className="font-semibold">
                    {v.votes} {v.votes === 1 ? "voto" : "votos"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-neutral-500">{started ? "Ninguém votou ainda." : "A votação abre quando o jogo começar."}</p>
          )}
          {totalMvpVotes > 0 && (
            <p className="text-xs text-neutral-500">
              {totalMvpVotes} {totalMvpVotes === 1 ? "pessoa votou" : "pessoas votaram"}. Ninguém sabe quem votou em quem.
            </p>
          )}

          {me && iPlayed && started && !readOnly && (
            <details open={!myVote} className="border-t border-neutral-100 pt-3">
              <summary className="cursor-pointer font-semibold">
                {myVote ? `Seu voto: ${nameOf(myVote)} · mudar` : "Votar no craque do jogo"}
              </summary>
              <form action={saveMvpVote} className="mt-3 space-y-3">
                <input type="hidden" name="game_id" value={game.id} />
                <input type="hidden" name="voter_id" value={me.id} />
                <ul className="divide-y divide-neutral-100">
                  {played
                    .filter((m) => m.id !== me.id)
                    .map((m) => (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-3 py-2 text-sm">
                          <input
                            type="radio"
                            name="voted_id"
                            value={m.id}
                            defaultChecked={myVote === m.id}
                            required
                            className="size-4 accent-pitch-700"
                          />
                          {m.name}
                        </label>
                      </li>
                    ))}
                </ul>
                <SubmitButton className="w-full">{myVote ? "Mudar voto" : "Votar"}</SubmitButton>
              </form>
            </details>
          )}
          {me && !iPlayed && started && <p className="text-xs text-neutral-500">Só quem jogou vota no craque.</p>}
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

      {me && iPlayed && started && !readOnly && (
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
