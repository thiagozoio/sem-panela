import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-4xl">🤷</p>
      <p className="text-neutral-700">Não achamos essa página, ou você não faz parte dessa pelada.</p>
      <LinkButton href="/grupos">Ir para minhas peladas</LinkButton>
    </main>
  );
}
