# Backup diário do banco

Todo dia às **3h da manhã (horário de Brasília)** o GitHub faz uma cópia do banco do Supabase, tranca com uma senha sua e guarda por **90 dias**. Não custa nada.

- O que entra: tudo do app (grupos, jogadores, jogos, pagamentos, notas…) e os logins dos usuários.
- Onde fica: na aba **Actions** do repositório, em cada execução do "Backup diário do banco".
- Segurança: o repositório é público, então o arquivo sai **criptografado (AES-256)**. Sem a senha ninguém abre. O arquivo nunca vai para o código.

Arquivos: `.github/workflows/backup-banco.yml` (agenda), `scripts/backup-banco.sh` (faz o backup) e `scripts/restaurar-banco.sh` (restaura).

---

## Configurar (uma vez só, uns 10 minutos)

### 1. Pegar o endereço do banco no Supabase

1. Entre em <https://supabase.com/dashboard> e abra o projeto do Coletinho.
2. Clique no botão **Connect** no alto da página.
3. Na aba **Connection String**, procure **Session pooler** e copie o endereço. Ele é parecido com:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
   > Use o **Session pooler**, não o "Direct connection": o direto só funciona por IPv6 e o GitHub não tem.
4. Troque `[YOUR-PASSWORD]` (com os colchetes) pela **senha do banco**.
   - Não lembra a senha? Vá em **Project Settings → Database → Reset database password** e crie uma nova **só com letras e números** (símbolos como `@`, `#` e `/` quebram o endereço). Trocar essa senha **não derruba o app**, porque o app usa as chaves da API, não essa senha.

Guarde esse endereço completo por um minuto; ele vai no passo 2.

### 2. Colocar os segredos no GitHub

1. Abra <https://github.com/thiagozoio/sem-panela/settings/secrets/actions>
   (ou: repositório → **Settings** → **Secrets and variables** → **Actions**).
2. Clique em **New repository secret** e crie:
   - **Name:** `SUPABASE_DB_URL` — **Secret:** o endereço do passo 1.
3. Clique de novo em **New repository secret** e crie:
   - **Name:** `BACKUP_PASSPHRASE` — **Secret:** uma senha longa só sua, com **12 caracteres ou mais** (ex.: quatro palavras soltas, `bola-trave-chuteira-domingo`).

> ⚠️ **Anote a `BACKUP_PASSPHRASE` num lugar seguro fora do GitHub** (gerenciador de senhas, por exemplo). O GitHub não mostra o segredo de novo, e **sem essa senha o backup não abre**.

### 3. Aceitar o PR

O GitHub só roda a agenda diária depois que o PR do backup estiver no `main`.

### 4. Testar uma vez

1. Abra <https://github.com/thiagozoio/sem-panela/actions/workflows/backup-banco.yml>
   (ou: aba **Actions** → **Backup diário do banco** na lista da esquerda).
2. Clique em **Run workflow** → **Run workflow** (botão verde).
3. Espere 1 ou 2 minutos e atualize a página. Bolinha **verde** = deu certo.
4. Clique na execução: lá embaixo, em **Artifacts**, aparece `backup-banco-N`. Esse é o backup.

Se ficar **vermelho**, clique na execução e no passo que falhou: a mensagem diz o que faltou (por exemplo "Falta o segredo SUPABASE_DB_URL" ou senha do banco errada).

### Avisos do GitHub que podem chegar por e-mail

- **Falhou:** o GitHub manda e-mail quando um backup agendado dá erro.
- **60 dias sem mexer no repositório:** em repositório público o GitHub pausa as agendas e manda um e-mail avisando. Basta abrir o link do e-mail (ou a página do passo 4) e clicar em **Enable workflow**.

---

## Baixar um backup

1. Aba **Actions** → **Backup diário do banco** → clique no dia que você quer.
2. Em **Artifacts**, clique em `backup-banco-N`. Baixa um `.zip`.
3. Dentro do `.zip` está o arquivo `sem-panela-AAAA-MM-DD_HHMM.dump.gpg`.

Guarde esse arquivo onde quiser (Google Drive, pendrive): ele está trancado com a sua senha.

## Restaurar (se o banco se perder)

### Jeito fácil: pedir ao Claude

Crie um projeto **novo** no Supabase (região São Paulo), baixe o backup e peça ao Claude no projeto "Software/Aplicativo para pelada de futebol" para restaurar, mandando o arquivo `.dump.gpg`. A senha do backup e a do banco novo você passa na hora, e elas não ficam salvas. Depois é só trocar as chaves do Supabase na Vercel pelas do projeto novo.

### Jeito técnico (se for fazer você mesmo)

Precisa de `gpg` e do `pg_restore` na mesma versão do Postgres do Supabase (no Mac: `brew install gnupg postgresql@17`; no Windows é mais simples usar o jeito fácil acima).

```bash
# 1) Abrir o arquivo (pede a senha do backup)
gpg --output backup.dump --decrypt sem-panela-AAAA-MM-DD_HHMM.dump.gpg

# 2) Restaurar num projeto Supabase NOVO (endereço "Session pooler" do projeto novo)
BACKUP_PASSPHRASE='sua senha do backup' \
  scripts/restaurar-banco.sh sem-panela-AAAA-MM-DD_HHMM.dump.gpg \
  "postgresql://postgres.NOVO:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

O script recusa um banco que já tenha as tabelas do Sem Panela, para não misturar nada. Ele restaura nesta ordem: usuários de login, tabelas do app (com as regras de acesso) e o gatilho que cria o perfil de quem faz login pela primeira vez.

Para só **olhar** um backup (achar algo que alguém apagou) sem mexer no banco de verdade:

```bash
pg_restore --file backup.sql backup.dump   # vira um arquivo de texto com todos os dados
```

Depois do restore, ainda é preciso no projeto novo: configurar o login (e-mail/SMTP do Resend, Google, URLs do site) como no projeto antigo e trocar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` na Vercel.
