#!/usr/bin/env bash
# Restaura um backup feito por scripts/backup-banco.sh num projeto Supabase
# NOVO (vazio). Uso:
#   BACKUP_PASSPHRASE=... scripts/restaurar-banco.sh sem-panela-AAAA-MM-DD_HHMM.dump.gpg "URL_DO_BANCO_NOVO"
# Precisa de gpg e do pg_restore na mesma versão do Postgres do Supabase.
# Ordem: usuários de login (auth) -> tabelas do app (public) -> gatilho que
# cria o perfil quando alguém novo faz login.
set -euo pipefail

ARQ="${1:?Informe o arquivo .dump.gpg}"
DEST="${2:?Informe a URL do banco de destino}"
: "${BACKUP_PASSPHRASE:?Defina BACKUP_PASSPHRASE com a senha do backup}"
PG_BIN="${PG_BIN:-}"
P="${PG_BIN:+$PG_BIN/}"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ "$("${P}psql" "$DEST" -Atc "select to_regclass('public.groups') is not null")" = "t" ]; then
  echo "O banco de destino já tem as tabelas do Sem Panela. Restaure num projeto novo." >&2
  exit 1
fi

case "$ARQ" in
  *.gpg)
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet \
      --pinentry-mode loopback --passphrase-fd 0 \
      --output "$TMP/backup.dump" --decrypt "$ARQ" ;;
  *) cp "$ARQ" "$TMP/backup.dump" ;;
esac

"${P}pg_restore" --list "$TMP/backup.dump" | grep -E 'TABLE DATA auth (users|identities) ' > "$TMP/1-auth.list"
"${P}pg_restore" --list "$TMP/backup.dump" | grep -E ' TRIGGER auth ' > "$TMP/3-gatilho.list" || true

# replica: não dispara gatilhos nem confere chaves enquanto carrega os dados.
export PGOPTIONS='-c session_replication_role=replica'

echo "1/3 usuários de login..."
"${P}pg_restore" --dbname="$DEST" --no-owner --use-list="$TMP/1-auth.list" "$TMP/backup.dump"
echo "2/3 tabelas do app..."
"${P}pg_restore" --dbname="$DEST" --no-owner --schema=public "$TMP/backup.dump"
if [ -s "$TMP/3-gatilho.list" ]; then
  echo "3/3 gatilho de novos logins..."
  "${P}pg_restore" --dbname="$DEST" --no-owner --use-list="$TMP/3-gatilho.list" "$TMP/backup.dump"
fi
echo "Pronto. Grupos restaurados: $("${P}psql" "$DEST" -Atc 'select count(*) from public.groups')"
