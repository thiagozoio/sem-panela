import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Política de privacidade" };

const WHATSAPP = process.env.NEXT_PUBLIC_BILLING_WHATSAPP ?? "";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <div className="space-y-2 text-sm text-neutral-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-pitch-700">← Sem Panela</Link>
      <h1 className="mt-2 text-2xl font-extrabold text-pitch-900">Política de privacidade</h1>
      <p className="mb-6 text-sm text-neutral-500">Atualizada em 28 de outubro de 2026.</p>
      <Card className="space-y-6">
        <Section title="O que é o Sem Panela">
          <p>
            O Sem Panela é um app para organizar peladas: lista de presença, sorteio de times, resultados e controle de
            pagamentos do grupo. Esta página explica quais dados usamos e por quê, de acordo com a LGPD (Lei 13.709/2018).
          </p>
        </Section>
        <Section title="Quais dados guardamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Conta:</strong> seu e-mail e o nome ou apelido que você usa na pelada. Se você entrar com o Google,
              recebemos só o seu e-mail e o seu nome da conta Google. Se entrar pelo link que o organizador mandou, não
              pedimos e-mail.
            </li>
            <li>
              <strong>Dados da pelada:</strong> presença nos jogos, times sorteados, gols, notas, posição e, para o
              organizador, o nível dos jogadores e os pagamentos de mensalidade e avulso.
            </li>
            <li>
              <strong>Telefone:</strong> quando o organizador cadastra o seu WhatsApp. Só os organizadores do grupo veem.
            </li>
            <li>
              <strong>Notificações:</strong> se você ativar os avisos no celular, guardamos o endereço técnico para enviar
              as notificações.
            </li>
            <li>
              <strong>Estatísticas de uso:</strong> contagem anônima de visitas às páginas (Vercel Web Analytics), sem
              cookies de rastreamento nem identificação pessoal.
            </li>
          </ul>
        </Section>
        <Section title="Para que usamos">
          <p>
            Só para fazer o app funcionar para o seu grupo: mostrar a lista, sortear os times, registrar resultados e
            pagamentos, enviar o link ou código de acesso e os avisos que você pediu. Não vendemos nem compartilhamos seus
            dados com anunciantes, e não usamos seus dados do Google para nenhum outro fim.
          </p>
        </Section>
        <Section title="Quem vê seus dados">
          <p>
            As pessoas do seu grupo veem o seu nome, presença, times e resultados. Nível, telefone e pagamentos ficam
            visíveis só para os organizadores do grupo.
          </p>
          <p>
            Para funcionar, o app usa estes fornecedores: Supabase (banco de dados e login, servidores em São Paulo),
            Vercel (hospedagem), Resend (envio dos e-mails de login) e, se você escolher, Google (login com Google).
          </p>
        </Section>
        <Section title="Por quanto tempo">
          <p>
            Enquanto você tiver conta ou fizer parte de um grupo. Se você pedir para apagar a conta, removemos seus dados
            pessoais; o histórico do grupo (por exemplo, um pagamento já registrado) pode ficar sem o seu e-mail.
          </p>
        </Section>
        <Section title="Seus direitos">
          <p>
            Você pode pedir a qualquer momento para ver, corrigir ou apagar seus dados, ou tirar dúvidas sobre esta
            política.
            {WHATSAPP && (
              <>
                {" "}Fale com a gente pelo{" "}
                <a className="font-medium text-pitch-700 underline" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                .
              </>
            )}
          </p>
        </Section>
      </Card>
    </main>
  );
}
