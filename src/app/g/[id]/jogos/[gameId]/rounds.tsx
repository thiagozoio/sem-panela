"use client";

import { useState, useTransition } from "react";
import { Button, Select } from "@/components/ui";
import { dayTable, reachedLimit, suggestNext, type GameFormat, type Round } from "@/lib/rounds";
import type { TeamColor } from "@/lib/team-colors";
import { deleteRound, setRoundFinished, startRound } from "../../actions";

export type RoundTeam = { name: string; color: TeamColor };

function Dot({ color }: { color: TeamColor }) {
  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${color.plain ? "ring-1 ring-black/20" : ""}`}
      style={{ background: color.bg }}
      aria-hidden
    />
  );
}

/** Tabela do dia e a lista das partidas (todo mundo vê). O organizador pode apagar uma partida. */
export function RoundsSummary({
  groupId,
  gameId,
  teams,
  rounds,
  canDelete,
}: {
  groupId: string;
  gameId: string;
  teams: RoundTeam[];
  rounds: Round[];
  canDelete: boolean;
}) {
  if (!rounds.length) return <p className="text-sm text-neutral-500">Nenhuma partida anotada ainda.</p>;
  const table = dayTable(teams.length, rounds).filter((r) => r.played > 0);
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="text-left font-normal">Tabela do dia</th>
            <th className="w-8 font-normal">J</th>
            <th className="w-8 font-normal">V</th>
            <th className="w-8 font-normal">E</th>
            <th className="w-8 font-normal">D</th>
            <th className="w-9 font-normal">Gols</th>
            <th className="w-9 font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {table.map((r, i) => (
            <tr key={r.team} className="border-t border-neutral-100 text-center">
              <td className="py-1 text-left">
                <span className="flex items-center gap-2">
                  <span className="w-4 text-xs text-neutral-400">{i + 1}</span>
                  <Dot color={teams[r.team].color} />
                  <span className="truncate font-semibold">{teams[r.team].name}</span>
                </span>
              </td>
              <td>{r.played}</td>
              <td>{r.wins}</td>
              <td>{r.draws}</td>
              <td>{r.losses}</td>
              <td>
                {r.goalsFor}:{r.goalsAgainst}
              </td>
              <td className="font-bold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ol className="space-y-1 text-sm">
        {rounds.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-1.5">
            <span className="w-8 shrink-0 text-xs text-neutral-400">{i + 1}ª</span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-right">
              <span className="truncate">{teams[r.home]?.name ?? "?"}</span>
              {teams[r.home] && <Dot color={teams[r.home].color} />}
            </span>
            <span className="shrink-0 px-1 font-bold tabular-nums">
              {r.home_score} x {r.away_score}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              {teams[r.away] && <Dot color={teams[r.away].color} />}
              <span className="truncate">{teams[r.away]?.name ?? "?"}</span>
            </span>
            {!r.finished ? (
              <span className="shrink-0 rounded-full bg-pitch-50 px-2 py-0.5 text-[10px] font-bold uppercase text-pitch-700">rolando</span>
            ) : (
              canDelete && (
                <form action={deleteRound} className="shrink-0">
                  <input type="hidden" name="group_id" value={groupId} />
                  <input type="hidden" name="game_id" value={gameId} />
                  <input type="hidden" name="round_id" value={r.id} />
                  <button type="submit" className="text-xs text-neutral-500 underline underline-offset-2" aria-label={`Apagar a partida ${i + 1}`}>
                    apagar
                  </button>
                </form>
              )
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Comandos das partidas, junto dos gols ao vivo: encerrar a que está rolando, reabrir a última
 * ou começar a próxima (já com os times sugeridos pelo formato).
 */
export function RoundControls({
  groupId,
  gameId,
  format,
  teams,
  rounds,
  roundGoals,
}: {
  groupId: string;
  gameId: string;
  format: GameFormat;
  teams: RoundTeam[];
  rounds: Round[];
  roundGoals: number | null;
}) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const last = rounds.at(-1);
  const open = last && !last.finished ? last : null;
  const [home, away] = suggestNext(format, teams.length, rounds);
  const suggestionKey = `${rounds.length}-${home}-${away}`;
  const [picked, setPicked] = useState({ key: suggestionKey, home, away });
  const choice = picked.key === suggestionKey ? picked : { key: suggestionKey, home, away };

  const run = (fn: () => Promise<boolean>) => {
    setFailed(false);
    start(async () => {
      let ok = false;
      try {
        ok = await fn();
      } catch {
        ok = false;
      }
      if (!ok) setFailed(true);
    });
  };

  const nameOf = (i: number) => teams[i]?.name ?? "?";

  return (
    <div className="space-y-3 rounded-xl bg-pitch-50 p-3">
      {open ? (
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-pitch-700">Partida {rounds.length} rolando</p>
          <p className="text-lg font-extrabold">
            {nameOf(open.home)} <span className="tabular-nums">{open.home_score} x {open.away_score}</span> {nameOf(open.away)}
          </p>
          {roundGoals != null && (
            <p className="text-xs text-neutral-500">Acaba sozinha quando um time fizer {roundGoals === 1 ? "1 gol" : `${roundGoals} gols`}.</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending}
            onClick={() => run(() => setRoundFinished({ groupId, gameId, roundId: open.id, finished: true }))}
          >
            Encerrar partida (acabou o tempo)
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {last && (
            <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Partida {rounds.length} encerrada: {nameOf(last.home)} {last.home_score} x {last.away_score} {nameOf(last.away)}
              </span>
              {!reachedLimit(last, roundGoals) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setRoundFinished({ groupId, gameId, roundId: last.id, finished: false }))}
                  className="text-xs text-pitch-700 underline underline-offset-2"
                >
                  reabrir
                </button>
              )}
            </p>
          )}
          <p className="text-sm font-semibold text-pitch-900">{last ? "Próxima partida" : "Primeira partida"}</p>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Time 1"
              value={choice.home}
              onChange={(e) => setPicked({ ...choice, home: Number(e.target.value) })}
              className="min-w-0 flex-1 px-2 py-1.5"
            >
              {teams.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name}
                </option>
              ))}
            </Select>
            <span className="text-sm font-bold text-neutral-400">x</span>
            <Select
              aria-label="Time 2"
              value={choice.away}
              onChange={(e) => setPicked({ ...choice, away: Number(e.target.value) })}
              className="min-w-0 flex-1 px-2 py-1.5"
            >
              {teams.map((t, i) => (
                <option key={t.name} value={i}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          {last && teams.length > 2 && (
            <p className="text-xs text-neutral-500">
              {format === "fica" ? "Sugestão: quem ganhou fica e entra quem está esperando." : "Sugestão: os times que menos se enfrentaram."} Dá para trocar.
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={pending || choice.home === choice.away}
            onClick={() => run(() => startRound({ groupId, gameId, home: choice.home, away: choice.away }))}
          >
            {pending ? "Salvando…" : "Começar partida"}
          </Button>
        </div>
      )}
      {failed && <p className="text-center text-xs text-red-700">Não deu para salvar. Confira a internet e tente de novo.</p>}
    </div>
  );
}
