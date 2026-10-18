/** Esqueleto mostrado na hora enquanto a página carrega. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando">
      <div className="h-24 rounded-2xl bg-surface ring-1 ring-black/5" />
      <div className="h-48 rounded-2xl bg-surface ring-1 ring-black/5" />
      <div className="h-32 rounded-2xl bg-surface ring-1 ring-black/5" />
    </div>
  );
}
