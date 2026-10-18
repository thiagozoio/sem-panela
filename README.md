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

### Regras
- **Próximo jogo**: criado automaticamente pelo dia/horário do grupo; continua aberto até 3h depois do início e então abre a lista da semana seguinte.
- **Lista de espera**: quem confirma depois de lotar espera; quando alguém desiste, o primeiro da espera sobe sozinho.
- **Prioridade**: mensalista que confirma até `priority_hours` (padrão 24h) antes do jogo passa na frente dos avulsos.
- **Sorteio** (`src/lib/draw.ts`): um goleiro por time, linha distribuída por nível e depois trocas que reduzem a diferença entre os times.
- **Assinatura**: R$ 19,90/mês por grupo, Pix manual para o dono. O banco guarda `groups.paid_until`; 7 dias depois do vencimento o grupo fica **só leitura** (garantido pela RLS).

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
3. **Authentication > URL Configuration**: `Site URL` = URL do app (ex.: `https://sempanela.vercel.app`) e adicione `https://sempanela.vercel.app/**` e `http://localhost:3000/**` em *Redirect URLs*.
4. **Authentication > Email Templates**, nos modelos *Magic Link* e *Confirm signup*, troque o corpo por algo assim (o link funciona até aberto em outro navegador, e o código serve para quem está no app instalado):

   ```html
   <h2>Seu acesso ao Sem Panela</h2>
   <p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Entrar no Sem Panela</a></p>
   <p>Ou digite o código: <strong>{{ .Token }}</strong></p>
   ```

5. Para virar admin, depois do primeiro login rode no SQL Editor:

   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'seu@email.com');
   ```

O e-mail padrão do Supabase tem limite baixo de envios por hora; para produção configure um SMTP (ex.: Resend) em **Authentication > SMTP Settings**.

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
- Cobrança automática da assinatura pelo Asaas (o campo `paid_until` já é o ponto de integração: o webhook só precisa atualizá-lo).
- Pix da turma com baixa automática, placar e artilharia, notificações.
