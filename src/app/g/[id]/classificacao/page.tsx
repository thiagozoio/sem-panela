import type { Metadata } from "next";
import Link from "next/link";
import { Button, Card, LinkButton } from "@/components/ui";
import { MonthNav } from "@/components/month-nav";
import { ShareButtons } from "@/components/share";
import { monthLabel, monthParam, monthStart } from "@/lib/format";
import {
  championshipPeriod,
  currentChampionship,
  inChampionship,
  inMonth,
  leaders,
  standings,
  standingsMessage,
  topScorers,
  type Row,
} from "@/lib/standings";
import { deleteChampionship } from "../actions";
import { ChampionshipForm } from "./championship-form";
import { loadRanking } from "./data";
import { Legend, StandingsTable } from "./standings-table";

export const metadata: Metadata = { title: "Classificação" };

const names = (rows: Row[]) => rows.map((r) => r.name).join(" e ");

export default async function RankingPage({ params, searchParams }: PageProps<"/g/[id]/classificacao">) {
  const { id } = await params;
  const sp = await searchParams;
  const data = await loadRanking(id);
  const { group, isOrganizer, readOnly, mode, sport, today, games, championships, fixedNames, nameOf } = data;
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
  const periodGames = mode === "mensal" ? inMonth(games, month) : selected ? inChampionship(games, selected) : [];
  const title = mode === "mensal" ? monthLabel(month) : selected ? `${selected.name} (${championshipPeriod(selected)})` : "";
  const finished = mode === "mensal" ? month < monthStart(today) : !!selected && selected.ends_on < today;
  const notStarted = mode === "campeonato" && !!selected && selected.starts_on > today;

  const table = standings(periodGames, nameOf, fixedNames);
  const topPlayers = leaders(table.players);
  const topTeams = leaders(table.teams);
  const scorers = topScorers(periodGames, (mid) => nameOf(mid)).slice(0, 10);
  const year = today.slice(0, 4);

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

            {topPlayers.length > 0 ? (
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
            <summary className="cursor-pointer text-sm font-semibold text-pitch-700">+ Novo campeonato</summary>
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
