import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { InstallApp } from "@/components/install-app";
import { SupportFooterLink } from "@/components/support";
import { Card } from "@/components/ui";
import { asaasEnabled } from "@/lib/asaas";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { founderSpotsLeft, spotsText } from "@/lib/founders";
import { FOUNDER_PRICE_CENTS, FOUNDER_SPOTS, PRICE_CENTS } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Como usar",
  description: "Como instalar o Sem Panela no celular e usar como jogador ou organizador da pelada.",
};

const sections = [
  ["instalar", "📲 Instalar"],
  ["entrar", "Entrar"],
  ["jogador", "⚽ Jogador"],
  ["organizador", "📋 Organizador"],
  ["financeiro", "💰 Financeiro"],
  ["tabela", "🏆 Tabela"],
  ["assinatura", "Assinatura"],
  ["duvidas", "Dúvidas"],
] as const;

function Shot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="mx-auto w-full max-w-[240px] space-y-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- prints estáticos, já otimizados em webp */}
      <img src={`/como-usar/${src}.webp`} alt={alt} loading="lazy" className="w-full rounded-xl ring-1 ring-black/10" />
      {caption && <figcaption className="text-center text-xs text-neutral-500">{caption}</figcaption>}
    </figure>
  );
}

function Shots({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Section({ id, kicker, title, children }: { id: string; kicker?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-16 space-y-3">
      {kicker && <p className="text-xs font-semibold uppercase tracking-widest text-pitch-700">{kicker}</p>}
      <h2 className="text-xl font-bold text-pitch-900">{title}</h2>
      {children}
    </section>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <Card className="space-y-3 text-sm text-neutral-700">
      <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pitch-700 text-sm text-white">{n}</span>
        {title}
      </h3>
      {children}
    </Card>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1 pl-5">{children}</ul>;
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl bg-surface p-4 text-sm ring-1 ring-black/5">
      <summary className="cursor-pointer font-semibold">{q}</summary>
      <div className="mt-2 text-neutral-700">{children}</div>
    </details>
  );
}

export default async function HowToPage() {
  const loggedIn = !!(await getCurrentUser());
  const automatic = asaasEnabled();
  const spotsLeft = automatic ? await founderSpotsLeft(await createClient()) : 0;

  return (
    <main className="flex flex-1 flex-col">
      <section className="bg-pitch-700 px-4 pb-8 pt-10 text-white">
        <div className="mx-auto max-w-xl space-y-3">
          <Link href={loggedIn ? "/grupos" : "/"} className="text-sm text-white/80">
            ← {loggedIn ? "Voltar para as peladas" : "Sem Panela"}
          </Link>
          <h1 className="text-3xl font-extrabold leading-tight">Como usar o Sem Panela</h1>
          <p className="text-white/80">
            Instale no celular e veja, passo a passo, como confirmar presença, sortear os times, anotar o placar e controlar quem pagou.
          </p>
        </div>
      </section>

      <nav className="sticky top-0 z-10 bg-[var(--app-bg)] shadow-sm">
        <div className="mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 py-2 text-sm">
          {sections.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="shrink-0 rounded-full bg-surface px-3 py-1 font-medium text-pitch-900 ring-1 ring-black/10">
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-xl space-y-10 px-4 py-6 pb-16">
        <Section id="instalar" kicker="Para todo mundo" title="Instalar no celular como app">
          <p className="text-sm text-neutral-700">
            O Sem Panela funciona direto no navegador, em <strong>sempanela.app.br</strong>, sem baixar nada da loja. Salvando na tela inicial,
            ele ganha ícone e abre em tela cheia, igual a um aplicativo.
          </p>
          <Card className="space-y-3">
            <h3 className="font-semibold">Instalar neste aparelho</h3>
            <InstallApp />
          </Card>
          <a href="/como-usar/instalar.webp" target="_blank" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem estática */}
            <img
              src="/como-usar/instalar.webp"
              alt="Passo a passo para salvar o Sem Panela na tela inicial do iPhone (Safari) e do Android (Chrome)"
              loading="lazy"
              className="w-full rounded-xl ring-1 ring-black/10"
            />
            <span className="mt-1 block text-center text-xs text-neutral-500">Toque na imagem para ver maior</span>
          </a>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="space-y-2 text-sm text-neutral-700">
              <h3 className="font-semibold text-neutral-900">iPhone (Safari)</h3>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Abra sempanela.app.br no <strong>Safari</strong>.</li>
                <li>
                  Toque em <strong>Compartilhar</strong> (quadrado com seta). Se não aparecer, toque antes em <strong>•••</strong>.
                </li>
                <li>
                  Toque em <strong>Adicionar à Tela de Início</strong> e depois em <strong>Adicionar</strong>.
                </li>
              </ol>
            </Card>
            <Card className="space-y-2 text-sm text-neutral-700">
              <h3 className="font-semibold text-neutral-900">Android (Chrome)</h3>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Abra sempanela.app.br no <strong>Chrome</strong>.</li>
                <li>
                  Toque nos <strong>três pontinhos</strong> no canto de cima.
                </li>
                <li>
                  Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong> e confirme.
                </li>
              </ol>
            </Card>
          </div>
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <strong>Dica para entrar:</strong> na primeira vez que abrir pelo ícone, o app pode pedir o e-mail de novo. No iPhone, digite o{" "}
            <strong>código de 6 dígitos</strong> que chega no e-mail em vez de tocar no link (o link abre no Safari, fora do app). Recebeu o link
            de acesso pelo WhatsApp? Abra ele no Safari primeiro e só depois adicione à Tela de Início.
          </p>
        </Section>

        <Section id="entrar" kicker="Para todo mundo" title="Entrar na sua conta">
          <Card className="space-y-3 text-sm text-neutral-700">
            <p>Tem três jeitos de entrar, e nenhum precisa de cadastro complicado:</p>
            <List>
              <li>
                <strong>E-mail:</strong> digite o e-mail e toque em <strong>Receber link de acesso</strong>. Chega um e-mail de
                nao-responda@sempanela.app.br com um link e um código de 6 dígitos. Use qualquer um dos dois.
              </li>
              <li>
                <strong>Google:</strong> toque em <strong>Entrar com Google</strong>, quando o botão aparecer.
              </li>
              <li>
                <strong>Link pelo WhatsApp:</strong> jogador que não quer usar e-mail pede ao organizador o link de acesso pessoal. É só tocar
                nele.
              </li>
            </List>
            <p>
              Quer entrar sem esperar o código? Em <strong>Perfil › Senha</strong> você cria uma senha e passa a entrar com e-mail e senha. Na
              primeira vez, o app pergunta como te chamam na pelada: é o nome que aparece na lista.
            </p>
            <Shot src="login" alt="Tela de entrada do Sem Panela" />
          </Card>
        </Section>

        <Section id="jogador" kicker="Guia do jogador" title="Confirmar presença em dois toques">
          <Step n={1} title="Entre pelo link de convite">
            <p>Abra o link que o organizador mandou no grupo e entre.</p>
            <List>
              <li>Se o organizador já tinha te cadastrado, escolha seu nome na lista. Assim você fica com a sua mensalidade e o seu histórico.</li>
              <li>
                Se não estiver na lista, marque <strong>Não estou na lista</strong>, confira o nome e toque em <strong>Entrar na pelada</strong>.
              </li>
            </List>
            <Shot src="jog-convite" alt="Tela do convite para entrar na pelada" />
          </Step>
          <Step n={2} title="Diga se vai no próximo jogo">
            <p>
              Na aba <strong>Jogo</strong> aparecem a data do próximo jogo e quantas vagas já foram preenchidas. Toque em{" "}
              <strong>Vou ✅</strong> ou <strong>Não vou</strong>. O app mostra a sua posição na lista.
            </p>
            <List>
              <li>Lotou? Quem confirma depois vai para a lista de espera. Se alguém desistir, o primeiro da espera sobe sozinho.</li>
              <li>Mensalista que confirma até o prazo do grupo passa na frente dos avulsos.</li>
              <li>Mudou de ideia? Toque no outro botão, quantas vezes precisar.</li>
            </List>
            <Shots>
              <Shot src="jog-jogo-antes" alt="Aba Jogo antes de responder" caption="Antes de responder" />
              <Shot src="jog-jogo-depois" alt="Aba Jogo com presença confirmada" caption="Confirmado na lista" />
            </Shots>
          </Step>
          <Step n={3} title="Veja os times">
            <p>
              Quando o organizador sorteia, os times aparecem na própria aba Jogo, com o goleiro 🧤 e a posição de cada um. Se a pelada tem
              times fixos do mês, eles ficam na aba <strong>Times</strong>.
            </p>
            <Shot src="jog-times" alt="Times sorteados" />
          </Step>
          <Step n={4} title="Gols ao vivo, placar e craque do jogo">
            <List>
              <li>
                Durante o jogo, toque em <strong>⚽ Marcar gols ao vivo</strong> para somar +1 gol a quem marcou. O placar atualiza para todo
                mundo.
              </li>
              <li>
                Depois do jogo, no cartão <strong>Último jogo</strong>, veja placar, gols e quem jogou.
              </li>
              <li>
                Quem jogou vota no <strong>craque do jogo</strong> (não vale votar em si mesmo) e pode dar notas de 1 a 10 para os colegas. As
                notas são anônimas: todo mundo vê só a média.
              </li>
            </List>
            <Shot src="jog-notas" alt="Notas e craque do jogo" />
          </Step>
          <Step n={5} title="Avisos no celular e mais de uma pelada">
            <p>
              Em <strong>Perfil</strong>, toque em <strong>🔔 Ativar avisos</strong> para receber o lembrete de confirmar presença, os times
              sorteados e quando abrir vaga. No iPhone, os avisos só funcionam com o app instalado na Tela de Início.
            </p>
            <p>
              Joga em mais de uma pelada? Toque em <strong>Sem Panela ⚽</strong> no topo para ver todas. O botão 🌓 troca entre tema claro e
              escuro.
            </p>
          </Step>
        </Section>

        <Section id="organizador" kicker="Guia do organizador" title="Organize a pelada sem planilha">
          <Step n={1} title="Crie a pelada">
            <p>
              Toque em <strong>+ Nova pelada</strong> e preencha nome, local, modalidade (society, futsal, campo ou vôlei), dia, horário e vagas
              por jogo. O próximo jogo é criado sozinho toda semana. Os primeiros 30 dias são grátis.
            </p>
            <Shot src="org-nova-pelada" alt="Criar nova pelada" />
          </Step>
          <Step n={2} title="Mande o convite e acerte os ajustes">
            <p>
              Na aba <strong>Ajustes</strong>, toque em <strong>Mandar convite no WhatsApp</strong>. Quem entrar pelo link vira jogador. Ali
              também ficam vagas, jogadores por time, prioridade dos mensalistas, mensalidade, avulso, sua chave Pix e a classificação.
            </p>
            <Shot src="org-ajustes" alt="Ajustes da pelada" />
          </Step>
          <Step n={3} title="Cadastre e ajuste os jogadores">
            <p>
              Na aba <strong>Jogadores</strong>, ajuste de cada um a posição, o nível de 1 a 5 (só organizadores veem, serve para equilibrar o
              sorteio) e o tipo: mensalista, avulso, sócio (paga o mês mas não é chamado toda semana) ou isento.
            </p>
            <List>
              <li>
                <strong>+ Cadastrar jogador</strong> adianta o cadastro de quem ainda não entrou. Depois, abra o jogador e toque em{" "}
                <strong>📲 Enviar acesso pelo WhatsApp</strong>.
              </li>
              <li>Convidado de um jogo só? Cadastre como convidado: ele não paga e não entra na tabela.</li>
              <li>
                Em <strong>Regras do sorteio</strong> você marca quem não pode cair no mesmo time.
              </li>
              <li>
                Para dividir a organização, abra o jogador e toque em <strong>Tornar organizador</strong>.
              </li>
            </List>
            <Shot src="org-jogadores" alt="Lista de jogadores" />
          </Step>
          <Step n={4} title="Cuide da lista da semana">
            <p>
              Tem gente que só responde no WhatsApp? Na aba Jogo, abra <strong>Marcar presença de outros jogadores</strong> e marque por eles.
              Embaixo aparece quem ainda não respondeu. <strong>Mandar lista no WhatsApp</strong> manda a lista pronta para o grupo.
            </p>
            <Shot src="org-presenca-outros" alt="Marcar presença de outros jogadores" />
          </Step>
          <Step n={5} title="Sorteie times equilibrados (ou use times fixos)">
            <p>
              Escolha quantos times e toque em <strong>Sortear times</strong>. Cada time ganha um goleiro e o resto é distribuído pelo nível e
              pela posição. Não gostou? Sorteie de novo. Depois, <strong>Mandar times no WhatsApp</strong>.
            </p>
            <p>
              Times que valem o mês todo? Monte na aba <strong>Times</strong> e, no dia, toque em <strong>Usar times fixos</strong>.
            </p>
            <Shots>
              <Shot src="org-sorteio" alt="Sorteio de times" caption="Sorteio" />
              <Shot src="org-times" alt="Times fixos do mês" caption="Times do mês" />
            </Shots>
          </Step>
          <Step n={6} title="Anote o placar e os gols">
            <p>
              Durante o jogo, use os <strong>gols ao vivo</strong>. Ou, depois, abra <strong>Último jogo</strong> (ou Jogos anteriores) e toque em{" "}
              <strong>Anotar placar e gols</strong>. Alguém faltou ou apareceu de surpresa? Use <strong>Corrigir quem jogou</strong>.
            </p>
            <p>
              Mexeu em algo sem querer? Em <strong>Ajustes › Ver histórico</strong> você vê o que mudou e desfaz.
            </p>
            <Shots>
              <Shot src="org-placar" alt="Anotar placar e gols" caption="Anotar placar" />
              <Shot src="org-resultado" alt="Resultado do jogo" caption="Resultado" />
            </Shots>
          </Step>
        </Section>

        <Section id="financeiro" kicker="Organizador" title="Quem pagou, quem deve e quanto tem no caixa">
          <Step n={1} title="O resumo do mês">
            <p>
              A aba <strong>Financeiro</strong> mostra um mês por vez: caixa da pelada, recebido, gastos, saldo e quanto ainda está em aberto.
              Já tinha dinheiro (ou dívida) antes? Toque em <strong>Mudar saldo inicial</strong>.
            </p>
            <Shot src="org-financeiro" alt="Resumo do financeiro" />
          </Step>
          <Step n={2} title="Marque os pagamentos e cobre">
            <List>
              <li>
                Recebeu o Pix? Toque em <strong>Marcar pago</strong>. Valor diferente (multa, desconto)? Use <strong>Outro valor</strong>.
              </li>
              <li>
                <strong>Mandar cobrança no WhatsApp</strong> monta a mensagem com o nome de cada um, o valor e a sua chave Pix.
              </li>
              <li>
                Em <strong>Gastos do mês</strong> lance quadra, bola, juiz… Gastos fixos? <strong>Repetir os gastos de…</strong> copia do mês
                anterior.
              </li>
            </List>
            <Shots>
              <Shot src="org-financeiro-pagos" alt="Pagamentos marcados" caption="Pagamentos" />
              <Shot src="org-gastos" alt="Gastos do mês" caption="Gastos" />
            </Shots>
          </Step>
        </Section>

        <Section id="tabela" kicker="Organizador" title="Tabela, artilharia e campeões">
          <Card className="space-y-3 text-sm text-neutral-700">
            <p>
              Ligue em <strong>Ajustes › Classificação</strong> e a aba <strong>Tabela</strong> aparece para todo mundo, com pódio, pontos,
              aproveitamento e artilharia.
            </p>
            <List>
              <li>
                <strong>Campeão do mês:</strong> a tabela zera todo mês e o líder vai para o histórico de campeões.
              </li>
              <li>
                <strong>Campeonato:</strong> crie com início e fim (1º e 2º turno, anual…) e escolha como sai o campeão: tabela, jogo final ou
                escolhido.
              </li>
              <li>Vitória vale 3 pontos e empate 1. Só entram jogos com placar anotado. Convidados não entram na tabela.</li>
            </List>
            <Shot src="tabela" alt="Tabela de classificação" />
          </Card>
        </Section>

        <Section id="assinatura" kicker="Organizador" title={`${formatMoney(PRICE_CENTS)} por mês por pelada`}>
          <Card className="space-y-3 text-sm text-neutral-700">
            <p>
              Valor fixo por pelada, com jogadores ilimitados. Quem paga é o organizador; os jogadores usam de graça. Os primeiros{" "}
              <strong>30 dias são grátis</strong>.
            </p>
            {spotsLeft > 0 && (
              <p className="rounded-xl bg-pitch-50 px-3 py-2 text-pitch-900 ring-1 ring-pitch-100">
                <strong>Preço de fundador:</strong> os {FOUNDER_SPOTS} primeiros grupos que assinarem pagam{" "}
                <strong>{formatMoney(FOUNDER_PRICE_CENTS)} por mês para sempre</strong>. Ainda {spotsText(spotsLeft)}.
              </p>
            )}
            <p>
              {automatic ? (
                <>
                  Em <strong>Ajustes › Assinatura do Sem Panela</strong> você assina por Pix ou cartão de crédito. Quando o pagamento cai, a pelada
                  é liberada na hora.
                </>
              ) : (
                <>
                  Em <strong>Ajustes › Assinatura do Sem Panela</strong> você vê até quando está pago e como fazer o Pix. A liberação é feita em
                  até 1 dia útil.
                </>
              )}
            </p>
            <p>
              Se vencer, ainda há 7 dias de carência. Depois disso a pelada fica só para leitura: todo mundo continua vendo tudo, mas ninguém
              muda nada até o pagamento. Nenhum dado se perde.
            </p>
          </Card>
        </Section>

        <Section id="duvidas" title="Dúvidas comuns">
          <div className="space-y-2">
            <Faq q="O e-mail de acesso não chegou.">
              Olhe no spam ou em Promoções. O remetente é nao-responda@sempanela.app.br. Se não achar, peça de novo e confira se o e-mail foi
              digitado certo.
            </Faq>
            <Faq q="Abri pelo ícone e ele pediu o e-mail de novo.">
              É normal na primeira vez, principalmente no iPhone. Peça o acesso e digite o código de 6 dígitos do e-mail. Depois disso o app
              lembra de você.
            </Faq>
            <Faq q="Não aparece a opção de instalar.">
              Confira se abriu no navegador certo: Safari no iPhone, Chrome no Android. Se o link abriu dentro do WhatsApp ou do Instagram, toque
              nos três pontinhos e escolha Abrir no navegador. Se já estiver instalado, a opção some.
            </Faq>
            <Faq q="Tem na loja de aplicativos?">
              Ainda não. Por enquanto é só salvar na tela inicial, como explicado acima: o resultado é o mesmo, com ícone e tela cheia.
            </Faq>
            <Faq q="Respondi no grupo do WhatsApp, preciso confirmar no app?">
              O ideal é confirmar no app, porque é ele que controla vagas e lista de espera. Se esquecer, o organizador pode marcar por você.
            </Faq>
            <Faq q="Os outros jogadores veem o meu nível?">Não. O nível só aparece para os organizadores e serve para equilibrar o sorteio.</Faq>
            <Faq q="Quero passar a organização para outra pessoa.">
              Em Jogadores, abra a pessoa e toque em Tornar organizador. Depois, abra o seu nome e toque em Deixar de ser organizador.
            </Faq>
          </div>
        </Section>

        <p className="text-center text-sm text-neutral-600">
          Ficou alguma dúvida? <SupportFooterLink label="Fale com o suporte" />.
        </p>
        <p className="text-center text-xs text-neutral-500">
          <Link href="/privacidade" className="underline">
            Política de privacidade
          </Link>
        </p>
      </div>
    </main>
  );
}
