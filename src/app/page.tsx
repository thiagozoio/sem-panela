import Link from "next/link";
import { SupportFooterLink } from "@/components/support";
import { redirect } from "next/navigation";
import { LinkButton } from "@/components/ui";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME, SLOGAN } from "@/lib/brand";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { asaasEnabled } from "@/lib/asaas";
import { founderSpotsLeft, spotsText } from "@/lib/founders";
import { FOUNDER_PRICE_CENTS, FOUNDER_SPOTS, PRICE_CENTS } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

const features = [
  ["📋", "Lista de presença", "O jogador confirma com um toque. Lotou? Vai para a lista de espera, com prioridade para mensalista."],
  ["⚖️", "Times sem panelinha", "Sorteio equilibrado pelo nível e pela posição de cada um, com um goleiro por time. Futsal, society, campo ou vôlei. Não gostou? Sorteia de novo."],
  ["💰", "Quem pagou, quem deve", "Mensalidade e avulso marcados num lugar só, com a cobrança pronta para mandar no grupo."],
  ["📲", "Tudo pelo WhatsApp", "Um link no grupo e pronto. Funciona no navegador do celular, sem baixar nada."],
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/grupos");
  // A vaga de fundador é pega ao assinar pelo app, então só aparece com a cobrança automática ligada.
  const spotsLeft = asaasEnabled() ? await founderSpotsLeft(await createClient()) : 0;

  return (
    <main className="flex flex-1 flex-col">
      <section
        className="px-4 pb-12 pt-10 text-white"
        style={{ background: "repeating-linear-gradient(90deg, #13693a 0 48px, #177a44 48px 96px)" }}
      >
        <div className="mx-auto max-w-xl space-y-5">
          <div className="flex items-center gap-3">
            <BrandMark className="h-16 w-auto drop-shadow" />
            <p className="text-2xl font-extrabold tracking-tight">{APP_NAME}</p>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight">{SLOGAN}</h1>
          <p className="text-white/80">
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
          <div key={title} className="flex gap-3 rounded-2xl bg-surface p-4 ring-1 ring-black/5">
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
        {spotsLeft > 0 && (
          <p className="rounded-2xl bg-pitch-50 p-4 text-center text-sm text-pitch-900 ring-1 ring-pitch-100">
            <strong>Preço de fundador:</strong> os {FOUNDER_SPOTS} primeiros grupos que assinarem pagam{" "}
            <strong>{formatMoney(FOUNDER_PRICE_CENTS)} por mês para sempre</strong>. Ainda {spotsText(spotsLeft)}.
          </p>
        )}
        <Link
          href="/como-usar"
          className="flex items-center gap-3 rounded-2xl bg-surface p-4 ring-1 ring-black/5"
        >
          <span className="text-2xl">📲</span>
          <span>
            <span className="block font-semibold">Como usar e instalar no celular</span>
            <span className="block text-sm text-neutral-600">Passo a passo para jogador e organizador, com imagens.</span>
          </span>
        </Link>
        <p className="text-center text-xs text-neutral-500">
          <Link href="/como-usar" className="underline">Como usar</Link>
          {" · "}
          <Link href="/privacidade" className="underline">Política de privacidade</Link>
          {" · "}
          <SupportFooterLink />
        </p>
      </section>
    </main>
  );
}
