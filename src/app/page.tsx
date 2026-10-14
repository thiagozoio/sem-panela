import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { PRICE_CENTS } from "@/lib/subscription";

const features = [
  ["📋", "Lista de presença", "O jogador confirma com um toque. Lotou? Vai para a lista de espera, com prioridade para mensalista."],
  ["⚖️", "Times sem panelinha", "Sorteio equilibrado pelo nível de cada um, com um goleiro por time. Não gostou? Sorteia de novo."],
  ["💰", "Quem pagou, quem deve", "Mensalidade e avulso marcados num lugar só, com a cobrança pronta para mandar no grupo."],
  ["📲", "Tudo pelo WhatsApp", "Um link no grupo e pronto. Funciona no navegador do celular, sem baixar nada."],
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/grupos");

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-pitch-700 px-4 pb-12 pt-14 text-white">
        <div className="mx-auto max-w-xl space-y-5">
          <p className="text-sm font-semibold uppercase tracking-widest text-pitch-100">Sem Panela ⚽</p>
          <h1 className="text-3xl font-extrabold leading-tight">A pelada organizada e paga em dia.</h1>
          <p className="text-pitch-100">
            Lista de presença, sorteio de times equilibrados e controle de quem pagou, tudo num link para o grupo do WhatsApp.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/login?next=/grupos/novo" variant="secondary">Criar minha pelada</LinkButton>
            <LinkButton href="/login" className="ring-1 ring-white/40">Já tenho conta</LinkButton>
          </div>
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-xl gap-3 px-4 py-8">
        {features.map(([icon, title, text]) => (
          <div key={title} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/5">
            <span className="text-2xl">{icon}</span>
            <div>
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm text-neutral-600">{text}</p>
            </div>
          </div>
        ))}
        <p className="pt-4 text-center text-sm text-neutral-600">
          30 dias grátis. Depois, <strong>{formatMoney(PRICE_CENTS)} por mês</strong> por grupo, com jogadores ilimitados. Só o organizador paga.
        </p>
      </section>
    </main>
  );
}
