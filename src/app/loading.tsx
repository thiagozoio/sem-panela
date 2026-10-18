import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-pitch-700 text-white">
        <div className="mx-auto max-w-xl px-4 py-3 text-lg font-extrabold tracking-tight">Sem Panela ⚽</div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-4">
        <PageSkeleton />
      </main>
    </div>
  );
}
