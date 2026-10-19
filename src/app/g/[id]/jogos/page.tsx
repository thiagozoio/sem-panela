import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { getGroupContext } from "@/lib/groups";
import { formatGameDate } from "@/lib/format";
import type { Game } from "@/lib/types";

export const metadata: Metadata = { title: "Jogos anteriores" };

export default async function PastGamesPage({ params }: PageProps<"/g/[id]/jogos">) {
  const { id } = await params;
  const { supabase, group } = await getGroupContext(id);
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("group_id", group.id)
    .lte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(30)
    .returns<Game[]>();

  return (
    <div className="space-y-4">
      <Link href={`/g/${group.id}`} className="text-sm text-pitch-700">
        ‹ Próximo jogo
      </Link>
      <Card>
        <h2 className="font-semibold">Jogos anteriores</h2>
        {!games?.length ? (
          <p className="pt-2 text-sm text-neutral-500">Ainda não teve jogo.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {games.map((g) => (
              <li key={g.id}>
                <Link href={`/g/${group.id}/jogos/${g.id}`} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <span>{formatGameDate(g.starts_at)}</span>
                  <span className="text-neutral-500">
                    {g.teams && g.scores?.length ? g.teams.map((t, i) => `${t.name} ${g.scores?.[i] ?? 0}`).join(" × ") : "ver"} ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
