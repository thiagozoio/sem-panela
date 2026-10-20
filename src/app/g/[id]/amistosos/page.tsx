import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Card, Input, LinkButton } from "@/components/ui";
import { UpgradeCard } from "@/components/billing-banner";
import { ShareButtons } from "@/components/share";
import { SubmitButton } from "@/components/submit";
import { getGroupContext } from "@/lib/groups";
import { formatGameDate, hasStarted } from "@/lib/format";
import { formatPhone, matchRecord, outcomeOf, splitMatches, whatsappTo, type MatchRecord } from "@/lib/matches";
import type { Match } from "@/lib/types";
import { deleteMatch, saveMatchScore } from "../actions";
import { MatchForm } from "./match-form";

export const metadata: Metadata = { title: "Amistosos" };

const OUTCOME = {
  V: { label: "vitória", tone: "green" },
  E: { label: "empate", tone: "neutral" },
  D: { label: "derrota", tone: "red" },
} as const;

function matchMessage(groupName: string, m: Match) {
  return [
    `⚽ *${groupName}* x *${m.opponent}*`,
    `📅 ${formatGameDate(m.starts_at)}`,
    m.location && `📍 ${m.location}`,
    m.notes && `📝 ${m.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function MatchesPage({ params, searchParams }: PageProps<"/g/[id]/amistosos">) {
  const { id } = await params;
  const { adversario } = await searchParams;
  const { supabase, group, isOrganizer, locked } = await getGroupContext(id);
  const canEdit = isOrganizer && !locked;
  const base = `/g/${group.id}/amistosos`;

  if (!group.matches) {
    return (
      <Card className="space-y-2">
        <h2 className="font-semibold">Amistosos</h2>
        <p className="text-sm text-neutral-600">
          Os jogos contra outros times estão desligados nesta pelada.
          {isOrganizer && " Ligue em Ajustes, em “Jogos contra outros times”."}
        </p>
        {isOrganizer && <LinkButton href={`/g/${group.id}/config`} variant="secondary">Ir para Ajustes</LinkButton>}
      </Card>
    );
  }

  const { data } = await supabase.from("matches").select("*").eq("group_id", group.id).returns<Match[]>();
  const { upcoming, past } = splitMatches(data ?? []);
  const opponent = typeof adversario === "string" ? adversario : "";
  const sameOpponent = (m: Match) => m.opponent.trim().toLocaleLowerCase("pt-BR") === opponent.toLocaleLowerCase("pt-BR");
  const history = opponent ? past.filter(sameOpponent) : past;
  const { total, opponents } = matchRecord(history);
  const all = opponent ? null : opponents;

  return (
    <div className="space-y-4">
      {locked && <UpgradeCard feature="Amistosos" organizer={isOrganizer} groupName={group.name} />}
      <Card className="space-y-3">
        <h2 className="font-semibold">Próximos jogos</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nenhum amistoso marcado.{canEdit && " Marque o próximo logo abaixo."}
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((m) => (
              <li key={m.id} className="space-y-2 rounded-xl bg-neutral-50 p-3">
                <MatchInfo match={m} />
                <ShareButtons label="Avisar a turma no WhatsApp" text={matchMessage(group.name, m)} />
                {canEdit && <OrganizerTools groupId={group.id} match={m} defaultTime={group.start_time.slice(0, 5)} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEdit && (
        <Card>
          <details open={upcoming.length === 0 && past.length === 0}>
            <summary className="cursor-pointer font-semibold">+ Marcar amistoso</summary>
            <div className="mt-3">
              <MatchForm groupId={group.id} defaultTime={group.start_time.slice(0, 5)} />
            </div>
          </details>
        </Card>
      )}

      {past.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{opponent ? `Contra ${history[0]?.opponent ?? opponent}` : "Histórico"}</h2>
            {opponent && (
              <Link href={base} className="text-sm font-medium text-pitch-700">
                ver todos
              </Link>
            )}
          </div>
          {total.games > 0 && <RecordLine record={total} />}
          <ul className="divide-y divide-neutral-100">
            {history.map((m) => (
              <li key={m.id} className="py-2">
                {canEdit ? (
                  <details>
                    <summary className="cursor-pointer list-none">
                      <PastSummary match={m} />
                    </summary>
                    <div className="mt-2 space-y-2">
                      <MatchInfo match={m} />
                      <OrganizerTools groupId={group.id} match={m} defaultTime={group.start_time.slice(0, 5)} />
                    </div>
                  </details>
                ) : (
                  <PastSummary match={m} />
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {all && all.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Retrospecto por adversário</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-neutral-500">
                <tr>
                  <th className="py-1 text-left font-medium">Adversário</th>
                  <th className="px-1 font-medium">J</th>
                  <th className="px-1 font-medium">V</th>
                  <th className="px-1 font-medium">E</th>
                  <th className="px-1 font-medium">D</th>
                  <th className="px-1 font-medium">Gols</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-center">
                {all.map((r) => (
                  <tr key={r.opponent}>
                    <td className="py-1.5 text-left">
                      <Link href={`?adversario=${encodeURIComponent(r.opponent)}`} className="font-medium text-pitch-700">
                        {r.opponent}
                      </Link>
                    </td>
                    <td className="px-1">{r.games}</td>
                    <td className="px-1">{r.wins}</td>
                    <td className="px-1">{r.draws}</td>
                    <td className="px-1">{r.losses}</td>
                    <td className="whitespace-nowrap px-1">
                      {r.scored}:{r.conceded}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function MatchInfo({ match: m }: { match: Match }) {
  const phone = m.contact_phone && formatPhone(m.contact_phone);
  const href = whatsappTo(m.contact_phone);
  return (
    <div className="space-y-1 text-sm">
      <p className="font-semibold">x {m.opponent}</p>
      <p className="text-neutral-700">📅 {formatGameDate(m.starts_at)}</p>
      {m.location && <p className="text-neutral-700">📍 {m.location}</p>}
      {(m.contact_name || phone) && (
        <p className="text-neutral-700">
          👤 {m.contact_name || "Contato"}
          {phone &&
            (href ? (
              <>
                {" · "}
                <a href={href} target="_blank" rel="noreferrer" className="font-medium text-pitch-700">
                  {phone} (WhatsApp)
                </a>
              </>
            ) : (
              ` · ${phone}`
            ))}
        </p>
      )}
      {m.notes && <p className="text-neutral-600">📝 {m.notes}</p>}
    </div>
  );
}

function PastSummary({ match: m }: { match: Match }) {
  const outcome = outcomeOf(m);
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">x {m.opponent}</p>
        <p className="text-xs text-neutral-500">{formatGameDate(m.starts_at)}</p>
      </div>
      {outcome ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-bold tabular-nums">
            {m.our_score} x {m.their_score}
          </span>
          <Badge tone={OUTCOME[outcome].tone}>{OUTCOME[outcome].label}</Badge>
        </div>
      ) : (
        <Badge tone="amber">sem placar</Badge>
      )}
    </div>
  );
}

function RecordLine({ record: r }: { record: MatchRecord }) {
  return (
    <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900">
      {r.games} {r.games === 1 ? "jogo" : "jogos"}: <strong>{r.wins}</strong> {r.wins === 1 ? "vitória" : "vitórias"},{" "}
      <strong>{r.draws}</strong> {r.draws === 1 ? "empate" : "empates"} e <strong>{r.losses}</strong>{" "}
      {r.losses === 1 ? "derrota" : "derrotas"}. Gols: {r.scored} pró, {r.conceded} contra.
    </p>
  );
}

function OrganizerTools({ groupId, match: m, defaultTime }: { groupId: string; match: Match; defaultTime: string }) {
  const started = hasStarted(m.starts_at);
  return (
    <div className="space-y-2">
      {(started || m.our_score != null) && (
        <form action={saveMatchScore} className="flex items-end gap-2">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="match_id" value={m.id} />
          <label className="flex-1 space-y-1 text-xs font-medium text-neutral-600">
            <span>Nós</span>
            <Input name="our_score" type="number" min={0} max={99} defaultValue={m.our_score ?? ""} className="text-center" />
          </label>
          <span className="pb-3 font-bold text-neutral-400">x</span>
          <label className="flex-1 space-y-1 text-xs font-medium text-neutral-600">
            <span className="block truncate">{m.opponent}</span>
            <Input name="their_score" type="number" min={0} max={99} defaultValue={m.their_score ?? ""} className="text-center" />
          </label>
          <SubmitButton className="shrink-0">Salvar placar</SubmitButton>
        </form>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-pitch-700">editar amistoso</summary>
        <div className="mt-3 space-y-2">
          <MatchForm groupId={groupId} match={m} defaultTime={defaultTime} />
          <form action={deleteMatch}>
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="match_id" value={m.id} />
            <Button variant="ghost" className="px-2 py-1 text-xs text-red-700">
              Apagar amistoso
            </Button>
          </form>
        </div>
      </details>
    </div>
  );
}
