"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({
  groupId,
  organizer,
  ranking,
  matches,
}: {
  groupId: string;
  organizer: boolean;
  ranking: boolean;
  matches: boolean;
}) {
  const pathname = usePathname();
  const base = `/g/${groupId}`;
  const tabs = [
    { href: base, label: "Jogo" },
    { href: `${base}/jogadores`, label: "Jogadores" },
    { href: `${base}/times`, label: "Times" },
    ...(ranking ? [{ href: `${base}/classificacao`, label: "Tabela" }] : []),
    ...(matches ? [{ href: `${base}/amistosos`, label: "Amistosos" }] : []),
    ...(organizer
      ? [
          { href: `${base}/financeiro`, label: "Financeiro" },
          { href: `${base}/config`, label: "Ajustes" },
        ]
      : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-surface p-1 ring-1 ring-black/5">
      {tabs.map((t) => {
        const active = pathname === t.href || (t.href !== base && pathname.startsWith(`${t.href}/`));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-center text-[13px] font-semibold ${
              active ? "bg-pitch-700 text-white" : "text-neutral-600 hover:bg-pitch-50"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
