import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { getGroupContext } from "@/lib/groups";
import { TZ } from "@/lib/format";
import { describeChange, groupChanges, undoableIds, UNDO_LIMIT, type ChangeEntry } from "@/lib/history";
import { UndoButton } from "./undo-button";

export const metadata: Metadata = { title: "Histórico de alterações" };

const SHOWN = 20;

function when(iso: string): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day} às ${time}`;
}

export default async function HistoryPage({ params }: PageProps<"/g/[id]/historico">) {
  const { id } = await params;
  const { supabase, group, members, isOrganizer, readOnly } = await getGroupContext(id);
  if (!isOrganizer) notFound();

  // Linhas bastam para ~20 alterações (um placar com gols tem várias linhas).
  const { data, error } = await supabase
    .from("change_log")
    .select("*")
    .eq("group_id", group.id)
    .order("id", { ascending: false })
    .limit(300)
    .returns<ChangeEntry[]>();

  const changes = groupChanges(data ?? []).slice(0, SHOWN);
  const undoable = undoableIds(changes);

  const gameIds = [
    ...new Set(changes.flatMap((c) => c.entries.map((e) => (e.new_row ?? e.old_row)?.game_id)).filter((v): v is string => typeof v === "string")),
  ];
  const { data: games } = gameIds.length
    ? await supabase.from("games").select("id, starts_at").in("id", gameIds)
    : { data: [] as { id: string; starts_at: string }[] };

  const names = {
    members: new Map(members.map((m) => [m.id, m.name])),
    games: new Map((games ?? []).map((g) => [g.id, g.starts_at])),
  };
  const byUser = new Map(members.filter((m) => m.user_id).map((m) => [m.user_id!, m.name]));
  const who = (userId: string | null) => (userId && byUser.get(userId)) || "Organizador";

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/g/${group.id}/config`} className="text-sm text-pitch-700">
          ← Ajustes
        </Link>
        <h2 className="mt-1 text-lg font-semibold">Histórico de alterações</h2>
        <p className="text-sm text-neutral-600">
          O que os organizadores mudaram na pelada. Dá para desfazer uma das {UNDO_LIMIT} alterações mais recentes.
          Respostas dos próprios jogadores (presença, notas, votos) não aparecem aqui.
        </p>
      </div>

      {error ? (
        <Card>
          <p className="text-sm text-neutral-600">O histórico ainda não está ligado: falta rodar a atualização do banco.</p>
        </Card>
      ) : changes.length === 0 ? (
        <Card>
          <p className="text-sm text-neutral-600">Nenhuma alteração ainda. Assim que um organizador mudar algo, aparece aqui.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-black/5">
            {changes.map((c, i) => {
              const lines = describeChange(c, names);
              return (
                <li key={c.id} className={`space-y-2 p-4 ${c.undoneAt ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-medium ${c.undoneAt ? "line-through" : ""}`}>{lines[0]}</p>
                      {lines.slice(1, 4).map((l) => (
                        <p key={l} className="text-sm text-neutral-600">
                          {l}
                        </p>
                      ))}
                      {lines.length > 4 && <p className="text-sm text-neutral-500">e mais {lines.length - 4}</p>}
                      <p className="mt-1 text-xs text-neutral-500">
                        {who(c.actorId)} · {when(c.at)}
                      </p>
                    </div>
                    {c.undoneAt ? (
                      <Badge>Desfeita</Badge>
                    ) : (
                      i === 0 && <Badge tone="green">Mais recente</Badge>
                    )}
                  </div>
                  {c.undoneAt && (
                    <p className="text-xs text-neutral-500">
                      Desfeita por {who(c.undoneBy)} · {when(c.undoneAt)}
                    </p>
                  )}
                  {undoable.has(c.id) && !readOnly && <UndoButton changeId={c.id} />}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
