import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { championshipChampions, championshipPeriod, monthlyChampions, type Title } from "@/lib/standings";
import { loadRanking } from "../data";

export const metadata: Metadata = { title: "Campeões" };

export default async function ChampionsPage({ params }: PageProps<"/g/[id]/classificacao/campeoes">) {
  const { id } = await params;
  const { group, mode, today, games, championships, fixedNames, nameOf } = await loadRanking(id);

  const titles: Title[] =
    mode === "campeonato"
      ? championshipChampions(championships, games, today, nameOf, fixedNames)
      : mode === "mensal"
        ? monthlyChampions(games, today, nameOf, fixedNames)
        : [];
  const periodOf = new Map(championships.map((c) => [c.id, championshipPeriod(c)]));

  // Quem tem mais títulos (empate no 1º lugar conta título para todos).
  const count = new Map<string, { key: string; name: string; titles: number }>();
  for (const t of titles)
    for (const r of t.players) count.set(r.key, { key: r.key, name: r.name, titles: (count.get(r.key)?.titles ?? 0) + 1 });
  const mostTitles = [...count.values()]
    .sort((a, b) => b.titles - a.titles || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <Link href={`/g/${group.id}/classificacao`} className="text-sm text-pitch-700">
        ‹ Classificação
      </Link>

      <Card className="space-y-3">
        <h2 className="font-semibold">🏆 Histórico de campeões</h2>
        {titles.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {mode === "off"
              ? "A classificação está desligada nesta pelada."
              : mode === "mensal"
                ? "Quando o primeiro mês com placares acabar, o campeão aparece aqui."
                : "Quando o primeiro campeonato acabar, o campeão aparece aqui."}
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {titles.map((t) => (
              <li key={t.key} className="py-2.5 text-sm">
                <p className="font-semibold">
                  {t.label}
                  {periodOf.has(t.key) && <span className="font-normal text-neutral-500"> · {periodOf.get(t.key)}</span>}
                </p>
                <p>🏆 {t.players.map((r) => r.name).join(" e ")}</p>
                {t.teams.length > 0 && <p className="text-neutral-600">Time: {t.teams.map((r) => r.name).join(" e ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {mostTitles.length > 0 && titles.length > 1 && (
        <Card className="space-y-2">
          <h3 className="font-semibold">Mais títulos</h3>
          <ol className="space-y-1 text-sm">
            {mostTitles.map((p, i) => (
              <li key={p.key} className="flex justify-between gap-2">
                <span>
                  <span className="inline-block w-6 text-right text-neutral-400">{i + 1}.</span> {p.name}
                </span>
                <span className="font-semibold">
                  {p.titles} {p.titles === 1 ? "título" : "títulos"}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}
