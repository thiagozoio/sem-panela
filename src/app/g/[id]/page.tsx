import Link from "next/link";
import { Badge, Button, Card, Input } from "@/components/ui";
import { ShareButtons } from "@/components/share";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import { splitList, type ListEntry } from "@/lib/attendance";
import { suggestedTeams } from "@/lib/draw";
import { formatGameDate, monthOf } from "@/lib/format";
import { listMessage, teamsMessage } from "@/lib/messages";
import { byPosition, positionInfo, sportOf, type Sport } from "@/lib/sports";
import type { Attendance, Game, Member } from "@/lib/types";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { applyFixedTeams, clearAttendance, clearTeams, drawTeamsAction, setAttendance } from "./actions";

export default async function GamePage({ params }: PageProps<"/g/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  // O próximo jogo é garantido em paralelo com o carregamento do grupo.
  const [{ group, members, me, isOrganizer, readOnly }, { data: gameId }] = await Promise.all([
    getGroupContext(id),
    supabase.rpc("ensure_next_game", { p_group_id: id }),
  ]);
  const { data: gameRow } = await supabase
    .from("games")
    .select("*, attendances(*)")
    .eq("id", gameId)
    .single<Game & { attendances: Attendance[] }>();
  if (!gameRow) return <Card>Não deu para abrir a lista. Recarregue a página.</Card>;
  const { attendances, ...game } = gameRow;
  const sport = sportOf(group.sport);
  const [{ count: fixedTeams }, { data: lastGame }] = await Promise.all([
    isOrganizer && !readOnly
      ? supabase
          .from("fixed_teams")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id)
          .eq("month", monthOf(game.starts_at))
      : Promise.resolve({ count: 0 }),
    supabase
      .from("games")
      .select("id, starts_at, teams, scores")
      .eq("group_id", group.id)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<Game, "id" | "starts_at" | "teams" | "scores">>(),
  ]);

  const list = splitList(attendances ?? [], members, group.max_players, game.starts_at, group.priority_hours);
  const answered = new Set((attendances ?? []).map((a) => a.member_id));
  const pending = members.filter((m) => m.active && !answered.has(m.id));
  const myIndex = me ? list.confirmed.findIndex((e) => e.member.id === me.id) : -1;
  const myWait = me ? list.waitlist.findIndex((e) => e.member.id === me.id) : -1;
  const myOut = me ? list.out.some((m) => m.id === me.id) : false;
  const origin = await siteUrl();

  const drawnIds = new Set(game.teams?.flatMap((t) => t.players.map((p) => p.member_id)) ?? []);
  const listChanged =
    !!game.teams &&
    (drawnIds.size !== list.confirmed.length || list.confirmed.some((e) => !drawnIds.has(e.member.id)));

  const hidden = (memberId: string) => (
    <>
      <input type="hidden" name="group_id" value={group.id} />
      <input type="hidden" name="game_id" value={game.id} />
      <input type="hidden" name="member_id" value={memberId} />
    </>
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-pitch-700">Próximo jogo</p>
            <p className="text-lg font-bold">{formatGameDate(game.starts_at)}</p>
          </div>
          <Badge tone={list.confirmed.length >= group.max_players ? "amber" : "green"}>
            {list.confirmed.length}/{group.max_players}
          </Badge>
        </div>

        {me && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-700">
              {myIndex >= 0
                ? `Você está confirmado (${myIndex + 1}º da lista).`
                : myWait >= 0
                  ? `Você está na lista de espera (${myWait + 1}º).`
                  : myOut
                    ? "Você avisou que não vai."
                    : "Você vai?"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <form action={setAttendance}>
                {hidden(me.id)}
                <input type="hidden" name="going" value="1" />
                <SubmitButton className="w-full" disabled={readOnly || myIndex >= 0 || myWait >= 0} pendingText="…">
                  Vou ✅
                </SubmitButton>
              </form>
              <form action={setAttendance}>
                {hidden(me.id)}
                <input type="hidden" name="going" value="0" />
                <SubmitButton variant="secondary" className="w-full" disabled={readOnly || myOut} pendingText="…">
                  Não vou
                </SubmitButton>
              </form>
            </div>
          </div>
        )}
      </Card>

      {lastGame && (
        <Link
          href={`/g/${group.id}/jogos/${lastGame.id}`}
          className="flex items-center justify-between gap-2 rounded-2xl bg-surface p-4 text-sm shadow-sm ring-1 ring-black/5"
        >
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-pitch-700">Último jogo</span>
            {formatGameDate(lastGame.starts_at)}
            {lastGame.teams && lastGame.scores?.length
              ? ` · ${lastGame.teams.map((t, i) => `${t.name} ${lastGame.scores?.[i] ?? 0}`).join(" × ")}`
              : ""}
          </span>
          <span className="whitespace-nowrap font-semibold text-pitch-700">Placar e notas ›</span>
        </Link>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Confirmados</h2>
        <PlayerList entries={list.confirmed} sport={sport} empty="Ninguém confirmou ainda." />
        {list.waitlist.length > 0 && (
          <>
            <h2 className="pt-2 font-semibold">Lista de espera</h2>
            <PlayerList entries={list.waitlist} sport={sport} />
          </>
        )}
        {list.out.length > 0 && (
          <p className="text-sm text-neutral-500">Não vão: {list.out.map((m) => m.name).join(", ")}</p>
        )}
        <ShareButtons
          label="Mandar lista no WhatsApp"
          text={listMessage(group.name, game.starts_at, list.confirmed, list.waitlist, group.max_players, `${origin}/g/${group.id}`, sport)}
        />
      </Card>

      {isOrganizer && !readOnly && (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold">Marcar presença de outros jogadores</summary>
            <ul className="mt-3 divide-y divide-neutral-100">
              {members
                .filter((m) => m.active)
                .map((m) => (
                  <AttendanceRow
                    key={m.id}
                    member={m}
                    status={
                      list.confirmed.some((e) => e.member.id === m.id) || list.waitlist.some((e) => e.member.id === m.id)
                        ? "in"
                        : list.out.some((o) => o.id === m.id)
                          ? "out"
                          : "none"
                    }
                    hidden={hidden(m.id)}
                  />
                ))}
            </ul>
            {pending.length > 0 && (
              <p className="mt-3 text-xs text-neutral-500">Ainda não responderam: {pending.map((m) => m.name).join(", ")}</p>
            )}
          </details>
        </Card>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Times</h2>
        {game.teams ? (
          <>
            {listChanged && isOrganizer && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">A lista mudou depois do sorteio. Sorteie de novo.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {game.teams.map((t) => (
                <div key={t.name} className="rounded-xl bg-pitch-50 p-3">
                  <p className="font-semibold text-pitch-900">{t.name}</p>
                  <ul className="mt-1 text-sm">
                    {[...t.players].sort(byPosition(sport)).map((p) => (
                      <li key={p.member_id}>
                        {p.position === "goleiro" && sport !== "volei" ? "🧤 " : "• "}
                        {p.name}
                        <PositionTag sport={sport} position={p.position} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <ShareButtons label="Mandar times no WhatsApp" text={teamsMessage(group.name, game.starts_at, game.teams, sport)} />
          </>
        ) : (
          <p className="text-sm text-neutral-600">
            {isOrganizer ? "Quando a lista fechar, sorteie os times aqui." : "O organizador ainda não sorteou os times."}
          </p>
        )}

        {isOrganizer && !readOnly && (
          <form action={drawTeamsAction} className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
            <input type="hidden" name="group_id" value={group.id} />
            <input type="hidden" name="game_id" value={game.id} />
            <label className="text-sm">
              <span className="block text-neutral-600">Times</span>
              <Input
                name="teams"
                type="number"
                min={2}
                max={8}
                defaultValue={suggestedTeams(list.confirmed.length, group.players_per_team)}
                className="w-20"
              />
            </label>
            <SubmitButton pendingText="Sorteando…" disabled={list.confirmed.length < 2}>
              {game.teams ? "Sortear de novo" : "Sortear times"}
            </SubmitButton>
            {!!fixedTeams && (
              <Button variant="secondary" formAction={applyFixedTeams} disabled={list.confirmed.length < 2}>
                Usar times fixos
              </Button>
            )}
            {game.teams && (
              <Button variant="ghost" formAction={clearTeams}>
                Apagar sorteio
              </Button>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}

/** Sigla da posição (ZAG, PIV…); o goleiro já aparece com 🧤. */
function PositionTag({ sport, position }: { sport: Sport; position: string }) {
  const info = positionInfo(sport, position);
  if (!info || info.value === "goleiro") return null;
  return (
    <span className="ml-1 text-xs text-neutral-500" title={info.label}>
      {info.short}
    </span>
  );
}

function PlayerList({ entries, sport, empty }: { entries: ListEntry[]; sport: Sport; empty?: string }) {
  if (entries.length === 0) return <p className="text-sm text-neutral-500">{empty}</p>;
  return (
    <ol className="space-y-1 text-sm">
      {entries.map((e, i) => (
        <li key={e.member.id} className="flex items-center gap-2">
          <span className="w-6 text-right text-neutral-400">{i + 1}.</span>
          <span>{e.member.name}</span>
          {positionInfo(sport, e.member.position)?.value === "goleiro" && <span title="Goleiro">🧤</span>}
          <PositionTag sport={sport} position={e.member.position} />
          {e.member.kind === "mensalista" && <Badge>mensalista</Badge>}
        </li>
      ))}
    </ol>
  );
}

function AttendanceRow({
  member,
  status,
  hidden,
}: {
  member: Member;
  status: "in" | "out" | "none";
  hidden: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <span>
        {member.name}
        {status === "in" && " ✅"}
        {status === "out" && " ❌"}
      </span>
      <form action={setAttendance} className="flex gap-1">
        {hidden}
        <Button name="going" value="1" variant={status === "in" ? "primary" : "secondary"} className="px-3 py-1.5" disabled={status === "in"}>
          Vai
        </Button>
        <Button name="going" value="0" variant="secondary" className="px-3 py-1.5" disabled={status === "out"}>
          Não
        </Button>
        {status !== "none" && (
          <Button formAction={clearAttendance} variant="ghost" className="px-2 py-1.5" title="Limpar resposta">
            ↺
          </Button>
        )}
      </form>
    </li>
  );
}
