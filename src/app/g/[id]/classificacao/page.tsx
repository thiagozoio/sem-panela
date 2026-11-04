import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, Field, Input, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { MonthNav } from "@/components/month-nav";
import { ShareButtons } from "@/components/share";
import { addMonths, formatGameDate, monthLabel, monthParam, monthStart } from "@/lib/format";
import {
  championshipPeriod,
  currentChampionship,
  decideChampion,
  decidedByOf,
  finalGameIds,
  tableGames,
  turnsOf,
  inMonth,
  leaders,
  monthlyTeamChampions,
  standings,
  standingsMessage,
  topScorers,
  type Row,
} from "@/lib/standings";
import { buildFinalTeams, createSeason, deleteChampionship } from "../actions";
import { FinalForm } from "./final-form";
import { ChampionshipForm } from "./championship-form";
import { loadRanking } from "./data";
import { Legend, StandingsTable } from "./standings-table";

export const metadata: Metadata = { title: "Classificação" };

const names = (rows: Row[]) => rows.map((r) => r.name).join(" e ");

export default async function RankingPage({ params, searchParams }: PageProps<"/g/[id]/classificacao">) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadRanking(id);
  const { supabase, group, members, isOrganizer, readOnly, mode, sport, today, games, championships, fixedNames, nameOf } = data;
  const canEdit = isOrganizer && !readOnly;
  const base = `/g/${group.id}/classificacao`;

  if (mode === "off") {
    return (
      <Card className="space-y-2">
        <h2 className="font-semibold">Classificação</h2>
        <p className="text-sm text-neutral-600">
          A classificação está desligada nesta pelada.
          {isOrganizer && " Ligue em Ajustes: campeão do mês ou campeonato com datas (1º e 2º turno, anual)."}
        </p>
        {isOrganizer && <LinkButton href={`/g/${group.id}/config`} variant="secondary">Ir para Ajustes</LinkButton>}
      </Card>
    );
  }

  // Período escolhido: o mês (?mes=) ou o campeonato (?c=).
  const month = monthParam(sp.mes);
  const selected =
    mode === "campeonato" ? (championships.find((c) => c.id === sp.c) ?? currentChampionship(championships, today)) : null;
  const finals = finalGameIds(championships);
  const periodGames = mode === "mensal" ? inMonth(games, month) : selected ? tableGames(games, selected, finals) : [];
  const title = mode === "mensal" ? monthLabel(month) : selected ? `${selected.name} (${championshipPeriod(selected)})` : "";
  const finished = mode === "mensal" ? month < monthStart(today) : !!selected && selected.ends_on < today;
  const notStarted = mode === "campeonato" && !!selected && selected.starts_on > today;

  // Times fixos valem um mês: no campeonato a tabela é só de jogadores, mais o time campeão de cada mês.
  const table = standings(periodGames, nameOf, mode === "mensal" ? fixedNames : undefined);
  const teamMonths = mode === "campeonato" ? monthlyTeamChampions(periodGames, nameOf, fixedNames) : [];
  const currentMonth = monthStart(today);
  const topPlayers = leaders(table.players);
  const topTeams = leaders(table.teams);
  const scorers = topScorers(periodGames, (mid) => nameOf(mid)).slice(0, 10);
  const year = today.slice(0, 4);

  // Campeonato decidido em jogo final ou à mão: o campeão não é o líder da tabela.
  const decidedBy = decidedByOf(selected?.decided_by);
  const finalGame = selected?.final_game_id ? games.find((g) => g.id === selected.final_game_id) : undefined;
  const decision = selected ? decideChampion(selected, table.players, finalGame, today, nameOf) : null;

  // Jogos que o organizador pode escolher como final: dos últimos meses e o próximo.
  const { data: recentGames } =
    mode === "campeonato" && canEdit
      ? await supabase
          .from("games")
          .select("id, starts_at")
          .eq("group_id", group.id)
          .gte("starts_at", `${addMonths(today, -6)}T00:00:00-03:00`)
          .order("starts_at", { ascending: false })
          .limit(40)
          .returns<{ id: string; starts_at: string }[]>()
      : { data: [] as { id: string; starts_at: string }[] };
  const gameOptions = (recentGames ?? []).map((g) => ({ id: g.id, label: formatGameDate(g.starts_at) }));
  const playerOptions = members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const finalDate = (c: { final_game_id?: string | null }) => {
    const g = (recentGames ?? []).find((r) => r.id === c.final_game_id) ?? games.find((r) => r.id === c.final_game_id);
    return g ? formatGameDate(g.starts_at) : null;
  };

  return (
    <div className="space-y-4">
      {mode === "mensal" && <MonthNav month={month} />}

      {mode === "campeonato" && championships.length > 0 && (
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {championships.map((c) => (
            <Link
              key={c.id}
              href={`?c=${c.id}`}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
                c.id === selected?.id ? "bg-pitch-700 text-white ring-pitch-700" : "bg-surface text-pitch-900 ring-black/10"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {mode === "campeonato" && !selected ? (
        <Card className="space-y-2">
          <h2 className="font-semibold">Nenhum campeonato ainda</h2>
          <p className="text-sm text-neutral-600">
            {canEdit
              ? "Crie o campeonato com a data de início e de fim. Para 1º e 2º turno, crie dois. Os jogos com placar anotado dentro das datas entram na tabela."
              : "O organizador ainda não criou um campeonato."}
          </p>
        </Card>
      ) : (
        <>
          <Card className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-pitch-700">
                {mode === "mensal" ? "Campeão do mês" : "Campeonato"}
              </p>
              <h2 className="text-lg font-bold">{title}</h2>
            </div>

            {decision && decidedBy !== "tabela" ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {decision.champions.length > 0 ? (
                  <>
                    🏆 Campeão{decidedBy === "final" ? " na final" : ""}: <strong>{names(decision.champions)}</strong>
                  </>
                ) : decision.pending === "empate" ? (
                  "A final empatou. O organizador escolhe o campeão."
                ) : decision.pending === "sem-placar" ? (
                  `O campeão sai na final${finalDate(selected!) ? ` (${finalDate(selected!)})` : ""}.`
                ) : decision.pending === "sem-jogo" ? (
                  "O campeão sai num jogo final, que o organizador ainda vai marcar."
                ) : (
                  "O campeão vai ser escolhido pelo organizador."
                )}
                {decision.champions.length === 0 && topPlayers.length > 0 && (
                  <>
                    <br />
                    Liderando a tabela: <strong>{names(topPlayers)}</strong>
                  </>
                )}
              </p>
            ) : topPlayers.length > 0 ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {finished ? "🏆 Campeão: " : "Liderando: "}
                <strong>{names(topPlayers)}</strong>
                {topTeams.length > 0 && (
                  <>
                    <br />
                    {finished ? "🏆 Time campeão: " : "Time liderando: "}
                    <strong>{names(topTeams)}</strong>
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">
                {notStarted
                  ? "O campeonato ainda não começou."
                  : "Nenhum jogo com placar neste período. O organizador anota o placar na página de cada jogo."}
              </p>
            )}

            {table.players.length > 0 && (
              <ShareButtons
                label="Mandar tabela no WhatsApp"
                text={standingsMessage(group.name, title, table.players, table.teams, sport)}
              />
            )}
          </Card>

          {table.teams.length > 0 && (
            <Card className="space-y-2">
              <h3 className="font-semibold">Times</h3>
              <StandingsTable rows={table.teams} sport={sport} label="Time" leaders={topTeams.length} />
            </Card>
          )}

          {teamMonths.length > 0 && (
            <Card className="space-y-2">
              <h3 className="font-semibold">Time campeão de cada mês</h3>
              <ul className="divide-y divide-neutral-100 text-sm">
                {teamMonths.map((t) => (
                  <li key={t.month} className="flex justify-between gap-2 py-1.5">
                    <span>{t.label}</span>
                    <span className="font-semibold">
                      {t.month < currentMonth ? "🏆 " : ""}
                      {names(t.teams)}
                      {t.month >= currentMonth && <span className="font-normal text-neutral-500"> (liderando)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {table.players.length > 0 && (
            <Card className="space-y-2">
              <h3 className="font-semibold">Jogadores</h3>
              <StandingsTable rows={table.players} sport={sport} label="Jogador" leaders={topPlayers.length} />
              <Legend sport={sport} />
            </Card>
          )}

          {scorers.length > 0 && (
            <Card className="space-y-2">
              <h3 className="font-semibold">Artilharia</h3>
              <ol className="space-y-1 text-sm">
                {scorers.map((s, i) => (
                  <li key={s.member_id} className="flex justify-between gap-2">
                    <span>
                      <span className="inline-block w-6 text-right text-neutral-400">{i + 1}.</span> {s.name}
                    </span>
                    <span className="font-semibold">⚽ {s.goals}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}

      <LinkButton href={`${base}/campeoes`} variant="secondary" className="w-full">
        🏆 Histórico de campeões
      </LinkButton>

      {mode === "campeonato" && canEdit && (
        <Card className="space-y-3">
          <h3 className="font-semibold">Campeonatos</h3>
          {championships.length > 0 && (
            <ul className="divide-y divide-neutral-100">
              {championships.map((c) => (
                <li key={c.id} className="py-2">
                  <details>
                    <summary className="cursor-pointer text-sm">
                      <strong>{c.name}</strong> <span className="text-neutral-500">{championshipPeriod(c)}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      <ChampionshipForm groupId={group.id} championship={c} />
                      <FinalForm groupId={group.id} championship={c} games={gameOptions} players={playerOptions} />
                      {decidedByOf(c.decided_by) === "final" && c.final_game_id && turnsOf(c, championships).length === 2 && (
                        <form action={buildFinalTeams} className="space-y-1">
                          <input type="hidden" name="group_id" value={group.id} />
                          <input type="hidden" name="championship_id" value={c.id} />
                          <SubmitButton variant="secondary" className="w-full" pendingText="Montando…">
                            Montar os times da final: {turnsOf(c, championships).map((t) => t.name).join(" × ")}
                          </SubmitButton>
                          <p className="text-xs text-neutral-500">
                            Os {group.players_per_team} melhores de cada turno. Quem está entre os melhores dos dois joga pelo 1º, e o
                            2º time chama o próximo da tabela. Depois é só anotar o placar no jogo, como sempre.
                          </p>
                        </form>
                      )}
                      <form action={deleteChampionship}>
                        <input type="hidden" name="group_id" value={group.id} />
                        <input type="hidden" name="championship_id" value={c.id} />
                        <Button variant="ghost" className="px-2 py-1 text-xs text-red-700">
                          Apagar campeonato (os jogos e placares continuam)
                        </Button>
                      </form>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
          <details open={championships.length === 0}>
            <summary className="cursor-pointer text-sm font-semibold text-pitch-700">+ Temporada inteira (1º turno, 2º turno e anual)</summary>
            <form action={createSeason} className="mt-3 space-y-3">
              <input type="hidden" name="group_id" value={group.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ano">
                  <Input name="year" type="number" min={2000} max={2100} defaultValue={year} required />
                </Field>
                <Field label="1º turno termina em">
                  <Input name="first_ends" type="date" defaultValue={`${year}-06-30`} required />
                </Field>
              </div>
              <p className="text-xs text-neutral-500">
                O 2º turno começa no dia seguinte e vai até 31/12. O anual soma o ano inteiro. Dá para mudar as datas de cada um
                depois, tocando no nome dele.
              </p>
              <SubmitButton className="w-full" pendingText="Criando…">
                Criar os três campeonatos
              </SubmitButton>
            </form>
          </details>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-pitch-700">+ Um campeonato só</summary>
            <div className="mt-3">
              <ChampionshipForm
                groupId={group.id}
                suggestion={
                  championships.length === 0
                    ? { name: `1º turno ${year}`, starts_on: `${year}-01-01`, ends_on: `${year}-06-30` }
                    : undefined
                }
              />
            </div>
          </details>
        </Card>
      )}
    </div>
  );
}
