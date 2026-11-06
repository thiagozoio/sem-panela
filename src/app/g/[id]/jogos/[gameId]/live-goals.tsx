"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyLiveGoal, type LiveState } from "@/lib/live";
import type { Team } from "@/lib/types";
import { liveGoal } from "../../actions";

type Player = { id: string; name: string };

/**
 * Placar ao vivo: "+1" do lado de cada jogador soma o gol dele e o do time, e já salva.
 * "−" desfaz. Os toques vão para o servidor um de cada vez, na ordem, para nenhum se perder.
 */
export function LiveGoals({
  groupId,
  gameId,
  teams,
  players,
  initial,
}: {
  groupId: string;
  gameId: string;
  /** Times do placar (do jogo ou os fixos do mês). Sem times, só conta os gols de cada um. */
  teams: Team[] | null;
  /** Quem jogou, para o jogo sem times (e quem ficou fora dos times). */
  players: Player[];
  initial: LiveState;
}) {
  const router = useRouter();
  const [state, setState] = useState<LiveState>(initial);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const queue = useRef(Promise.resolve());
  const confirmed = useRef(initial);
  const inFlight = useRef(0);

  function tap(delta: 1 | -1, target: { memberId: string } | { team: number }) {
    setFailed(false);
    setState((s) => applyLiveGoal(s, teams, delta, target));
    inFlight.current += 1;
    setPending(inFlight.current);
    queue.current = queue.current.then(async () => {
      let saved: LiveState | null = null;
      try {
        saved = await liveGoal({ groupId, gameId, delta, ...("memberId" in target ? { memberId: target.memberId } : { team: target.team }) });
      } catch {
        saved = null;
      }
      if (saved) confirmed.current = saved;
      else setFailed(true);
      inFlight.current -= 1;
      setPending(inFlight.current);
      // Tudo salvo: mostra o que está no banco e atualiza o resto da tela.
      if (inFlight.current === 0) {
        setState(confirmed.current);
        router.refresh();
      }
    });
  }

  const inTeams = new Set(teams?.flatMap((t) => t.players.map((p) => p.member_id)) ?? []);
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const outside = players.filter((p) => !inTeams.has(p.id));

  const row = (p: Player) => {
    const goals = state.goals[p.id] ?? 0;
    return (
      <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
        <span className="min-w-0 truncate">
          {p.name}
          {goals > 0 && <span className="ml-1 font-semibold text-pitch-700">{"⚽".repeat(Math.min(goals, 5))}{goals > 5 && ` ${goals}`}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => tap(-1, { memberId: p.id })}
            disabled={goals === 0}
            aria-label={`Tirar um gol de ${p.name}`}
            className="size-10 rounded-xl text-lg font-bold text-neutral-500 ring-1 ring-black/10 transition active:bg-neutral-100 disabled:opacity-30"
          >
            −
          </button>
          <span className="w-5 text-center font-semibold tabular-nums">{goals}</span>
          <button
            type="button"
            onClick={() => tap(1, { memberId: p.id })}
            aria-label={`Gol de ${p.name}`}
            className="h-10 rounded-xl bg-pitch-700 px-3 font-bold text-white transition active:brightness-90"
          >
            +1 gol
          </button>
        </span>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {teams && (
        <div className="flex flex-wrap justify-center gap-3 text-center">
          {teams.map((t, i) => (
            <div key={t.name} className="min-w-24 rounded-xl bg-pitch-50 px-3 py-2">
              <p className="text-sm font-semibold text-pitch-900">{t.name}</p>
              <p className="text-3xl font-extrabold tabular-nums">{state.scores?.[i] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-neutral-500" aria-live="polite">
        {failed
          ? "Não deu para salvar um gol. Confira a internet e o placar."
          : pending
            ? "Salvando…"
            : "Cada toque já fica salvo. Errou? Use o −."}
      </p>

      {teams?.map((t, i) => {
        const roster = t.players.map((p) => ({ id: p.member_id, name: nameOf.get(p.member_id) ?? p.name }));
        return (
          <div key={t.name}>
            <h3 className="text-sm font-semibold text-pitch-900">{t.name}</h3>
            <ul className="divide-y divide-neutral-100">{roster.map(row)}</ul>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs text-neutral-500">
              <span>Gol contra ou sem autor</span>
              <button
                type="button"
                onClick={() => tap(-1, { team: i })}
                disabled={!(state.scores?.[i] ?? 0)}
                aria-label={`Tirar um gol do ${t.name}`}
                className="size-8 rounded-lg font-bold ring-1 ring-black/10 disabled:opacity-30"
              >
                −
              </button>
              <button
                type="button"
                onClick={() => tap(1, { team: i })}
                aria-label={`Gol sem autor para o ${t.name}`}
                className="h-8 rounded-lg px-2 font-semibold text-pitch-700 ring-1 ring-pitch-700/30"
              >
                +1
              </button>
            </div>
          </div>
        );
      })}

      {outside.length > 0 && (
        <div>
          {teams && <h3 className="text-sm font-semibold">Sem time</h3>}
          <ul className="divide-y divide-neutral-100">{outside.map(row)}</ul>
        </div>
      )}
    </div>
  );
}
