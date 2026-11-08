# Sem Panela ⚽

A pelada organizada e paga em dia: lista de presença com lista de espera, sorteio de times equilibrados e controle de quem pagou, num link para o grupo do WhatsApp.

App web (PWA) em **Next.js 16 + Supabase**, hospedado na **Vercel**.

## O que tem no MVP

| Tela | O que faz |
|---|---|
| `/login` | Login sem senha: link mágico **ou** código de 6 dígitos por e-mail |
| `/grupos` | Peladas do usuário; criar nova pelada (30 dias grátis) |
| `/convite/[código]` | Entrar na pelada pelo link do WhatsApp; pode assumir um cadastro feito pelo organizador |
| `/g/[id]` | Próximo jogo: Vou / Não vou, lista de espera, prioridade de mensalista, sorteio de times e envio para o WhatsApp |
| `/g/[id]/jogadores` | Cadastro de jogadores: posição, nível 1–5 (só o organizador vê), mensalista ou avulso |
| `/g/[id]/financeiro` | Mensalidades e avulsos por mês, quem deve e mensagem de cobrança pronta |
| `/g/[id]/config` | Ajustes, valores, chave Pix, link de convite e status da assinatura |
| `/admin` | Para o dono do SaaS: lista de grupos e marcação manual do "pago até" |
| `/perfil` | Nome e liga/desliga dos avisos no celular (com botão de teste) |

### Regras
- **Próximo jogo**: criado automaticamente pelo dia/horário do grupo; continua aberto até 3h depois do início e então abre a lista da semana seguinte.
- **Lista de espera**: quem confirma depois de lotar espera; quando alguém desiste, o primeiro da espera sobe sozinho.
- **Prioridade**: mensalista que confirma até `priority_hours` (padrão 24h) antes do jogo passa na frente dos avulsos.
- **Sorteio** (`src/lib/draw.ts`): um goleiro por time, linha distribuída por nível e depois trocas que reduzem a diferença entre os times.
- **Assinatura**: R$ 19,90/mês por grupo, Pix manual para o dono. O banco guarda `groups.paid_until`; 7 dias depois do vencimento o grupo fica **só leitura** (garantido pela RLS).

### Avisos no celular (Web Push)
Funciona no Android (Chrome) e no iPhone com o app instalado na tela de início (iOS 16.4+). O jogador ativa na tela da pelada ou no Perfil.

| Aviso | Quando | Para quem |
|---|---|---|
| Pelada amanhã / hoje | rotina diária às 10h (`/api/cron/avisos`, `vercel.json`) | quem ainda não respondeu |
| Times sorteados | quando o organizador sorteia ou usa os times fixos | cada jogador sorteado, com o nome do seu time |
| Abriu vaga | quando alguém desiste ou é tirado da lista | quem sobe da lista de espera |
| Mensalidade em aberto | dia 5, na rotina diária | mensalistas que não pagaram o mês |
| Assinatura vencendo | 3 dias antes, no dia, 1 dia depois e no último dia antes do só leitura | organizadores |
| Cobrar resposta / recado | botão "Avisar no celular" na tela do jogo | pendentes / todos |

Os aparelhos ficam em `push_subscriptions`; o envio usa a chave secreta do Supabase (`src/lib/supabase/admin.ts`) só no servidor. Sem as variáveis de push no `.env`, tudo isso fica escondido.

Para ligar: gere as chaves com `npx web-push generate-vapid-keys` e cadastre `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SUPABASE_SECRET_KEY` e `CRON_SECRET` (veja `.env.example`).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com os dados do Supabase
npm run dev
```

Testes e checagens:

```bash
npm test          # sorteio, lista de espera, datas e assinatura
npm run typecheck
npm run lint
```

## Configurando o Supabase (uma vez)

1. Crie um projeto na região **South America (São Paulo)**.
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem de data (ou `supabase db push` com a CLI).

   > Desde 30/10/2026 o Supabase não dá mais acesso automático da API a tabelas novas em `public`. Toda migration que cria tabela precisa trazer, logo depois do `create table`, o grant explícito (e só então os `revoke`/`grant update (...)` de colunas):
   >
   > ```sql
   > grant select, insert, update, delete on public.nova_tabela to authenticated, service_role;
   > ```
3. **Authentication > URL Configuration**: `Site URL` = URL do app (ex.: `https://sempanela.app.br`) e adicione `https://sempanela.app.br/**` e `http://localhost:3000/**` em *Redirect URLs*.
4. **Authentication > Email Templates**: troque **os dois** modelos, *Confirm signup* (jogador novo) e *Magic Link* (quem já tem conta). O padrão do Supabase vem em inglês ("Confirm your email address"), sem código e com um link que só funciona no mesmo navegador. Use o assunto `Seu acesso ao Sem Panela ⚽` e um corpo assim (o link funciona até aberto em outro navegador, e o código serve para quem está no app instalado):

   ```html
   <h2>Sem Panela ⚽</h2>
   <p><strong>Não existe senha.</strong> Toque no botão para entrar:</p>
   <p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Entrar no Sem Panela</a></p>
   <p>Ou volte para o Sem Panela e digite o código: <strong>{{ .Token }}</strong></p>
   <p>O link e o código valem por 1 hora. Se você não pediu este acesso, ignore este e-mail.</p>
   ```

   O link usa `{{ .RedirectTo }}`, então o domínio do app precisa estar em *Redirect URLs* (passo 3); senão o Supabase troca pelo `Site URL` e o link quebra.

5. Para virar admin, depois do primeiro login rode no SQL Editor:

   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'seu@email.com');
   ```

O e-mail padrão do Supabase tem limite baixo de envios por hora; para produção configure um SMTP (ex.: Resend) em **Authentication > SMTP Settings**.

## Login dos jogadores sem e-mail

**Link pessoal (WhatsApp).** Em *Jogadores*, o organizador abre um jogador e toca em *Enviar acesso pelo WhatsApp*. O jogador toca no link, aperta *Entrar* e fica logado no celular, sem e-mail nem código. Regras:

- Vale por 7 dias. Depois do primeiro uso ainda funciona por 1 hora (para abrir no navegador e depois no app instalado). Gerar outro invalida o anterior.
- Só serve para jogador comum: nunca para organizador, dono de grupo, admin ou quem já entra com e-mail.
- Precisa da variável `SUPABASE_SECRET_KEY` (Project Settings > API Keys > *Secret key*) no servidor. A conta criada usa um e-mail interno `<id>@jogador.sempanela.app.br` que não recebe mensagens.

**Convite guardado.** Quem abre `/convite/<código>` ganha um cookie com o código por 30 dias. Se depois de entrar (e-mail aberto em outro navegador, Google, link pessoal, app instalado) a pessoa cair em *Minhas peladas* sem nenhum grupo, o app manda de volta para o convite. Na tela vazia também dá para colar o link de convite.

**Entrar com Google.** Crie um *OAuth Client ID* (tipo *Web application*) no Google Cloud Console com a URI de redirecionamento `https://<projeto>.supabase.co/auth/v1/callback`, cole o Client ID e o Secret em **Authentication > Providers > Google** no Supabase e ponha `NEXT_PUBLIC_GOOGLE_LOGIN=1` na Vercel.

## Cobrança automática (Asaas)

Sem `ASAAS_API_KEY` o app continua com o Pix manual (`NEXT_PUBLIC_BILLING_PIX_KEY` e o "+1 mês" no `/admin`). Para ligar:

1. Rode `supabase/migrations/20261108120000_cobranca_asaas.sql` no SQL Editor.
2. No Asaas (comece pelo sandbox, https://sandbox.asaas.com): **Integrações > Chaves de API** e gere a chave. Na Vercel: `ASAAS_API_KEY` (a chave) e `ASAAS_WEBHOOK_TOKEN` (uma senha longa que você inventa). `SUPABASE_SECRET_KEY` e `CRON_SECRET` também precisam estar lá.
3. No Asaas: **Integrações > Webhooks > Adicionar**: URL `https://<seu-dominio>/api/webhooks/asaas`, token = o mesmo `ASAAS_WEBHOOK_TOKEN`, fila sequencial, eventos de **Cobranças** e **Assinaturas**.

Como funciona: em **Ajustes**, o organizador informa nome e CPF/CNPJ e escolhe Pix ou cartão. O app cria o cliente e a assinatura mensal no Asaas (primeiro vencimento = o "pago até" atual) e abre a página de pagamento. Quando o Asaas avisa `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED`, `billing_apply_payment` empurra o `paid_until` um mês (uma vez por cobrança, mesmo com aviso repetido); estorno e contestação desfazem. Uma rotina diária (`/api/cron/cobranca`) confere no Asaas as cobranças pagas e aplica as que algum aviso perdeu. A chave de produção (`$aact_prod_...`) troca o endereço da API sozinha.

## Deploy na Vercel

1. Importe o repositório na Vercel (região `gru1`, São Paulo, em *Settings > Functions*).
2. Cadastre as variáveis do `.env.example` em *Settings > Environment Variables*.
3. Cada push na `main` publica sozinho.

## Estrutura

```
supabase/migrations/   esquema, RLS e funções do banco
src/proxy.ts           renova a sessão do Supabase a cada requisição
src/lib/               regras puras (sorteio, lista, datas, assinatura) + acesso a dados
src/app/               telas (App Router) e server actions
```

## Próximos passos (fora do MVP)
- Plano anual e Pix Automático no Asaas (precisa de CNPJ com 6 meses).
- Pix da turma com baixa automática.
