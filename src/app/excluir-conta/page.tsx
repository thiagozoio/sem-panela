import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { SUPPORT_EMAIL, SUPPORT_WHATSAPP, supportMailto } from "@/lib/support";
import { APP_NAME } from "@/lib/brand";

// Página pública exigida pela Google Play ("URL para exclusão de conta"):
// nome do app, passos para pedir a exclusão e o que é apagado ou mantido, e por quanto tempo.
export const metadata: Metadata = { title: "Excluir conta" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-neutral-700">{children}</div>
    </section>
  );
}

export default function DeleteAccountPage() {
  const mailto = supportMailto(`Excluir minha conta - ${APP_NAME}`);
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-pitch-700">← {APP_NAME}</Link>
      <h1 className="mt-2 text-2xl font-extrabold text-pitch-900">Excluir sua conta do {APP_NAME}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Vale para o app {APP_NAME} no Android (Google Play), no iPhone e no site.
      </p>
      <Card className="space-y-6">
        <Section title="Como pedir">
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Mande um e-mail para{" "}
              <a className="font-medium text-pitch-700 underline" href={mailto}>
                {SUPPORT_EMAIL}
              </a>{" "}
              com o assunto <strong>“Excluir minha conta”</strong>
              {SUPPORT_WHATSAPP && (
                <>
                  {" "}ou peça pelo{" "}
                  <a className="font-medium text-pitch-700 underline" href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </>
              )}
              .
            </li>
            <li>Informe o e-mail ou o telefone que você usa para entrar e o nome do seu grupo.</li>
            <li>Confirmamos que o pedido é seu e excluímos a conta em até 15 dias. Avisamos quando terminar.</li>
          </ol>
          <p>
            Se você é organizador e quer apagar o grupo inteiro, diga isso no pedido. Se quer apagar só alguns dados (por
            exemplo, seu telefone), também pode pedir sem excluir a conta.
          </p>
        </Section>
        <Section title="O que é apagado">
          <ul className="list-disc space-y-1 pl-5">
            <li>Sua conta de acesso: e-mail, senha, login com Google e o link de acesso.</li>
            <li>Seu nome ou apelido, telefone, posição e nível.</li>
            <li>Os endereços das notificações do celular.</li>
          </ul>
        </Section>
        <Section title="O que pode ficar">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              O histórico do grupo (placares, gols, presença e pagamentos já registrados) continua para os outros jogadores,
              mas sem o seu nome, e-mail ou telefone.
            </li>
            <li>
              Cópias de segurança do banco de dados guardam os dados por até <strong>90 dias</strong> e depois são apagadas
              sozinhas.
            </li>
            <li>
              Se você pagou a assinatura de um grupo, os registros de cobrança ficam guardados pelo prazo exigido pela lei
              fiscal (até 5 anos).
            </li>
          </ul>
        </Section>
        <p className="text-xs text-neutral-500">
          Mais detalhes na <Link className="underline" href="/privacidade">política de privacidade</Link>.
        </p>
      </Card>
    </main>
  );
}
