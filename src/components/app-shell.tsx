import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";

export function AppShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-pitch-700 text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/grupos" className="text-lg font-extrabold tracking-tight">
            Sem Panela ⚽
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {admin && <Link href="/admin">Admin</Link>}
            <Link href="/perfil">Perfil</Link>
            <form action={signOut}>
              <button className="opacity-80 hover:opacity-100">Sair</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 space-y-4 px-4 py-4 pb-16">{children}</main>
    </div>
  );
}
