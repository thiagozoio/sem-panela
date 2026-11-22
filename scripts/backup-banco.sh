#!/usr/bin/env bash
# Backup do banco do Supabase (schemas public e auth) em formato custom do
# pg_dump, criptografado com AES-256 (gpg). Usado pelo workflow
# .github/workflows/backup-banco.yml; também roda à mão:
#   SUPABASE_DB_URL=... BACKUP_PASSPHRASE=... scripts/backup-banco.sh [pasta]
# O arquivo sem criptografia nunca sai desta máquina: é apagado no fim.
set -euo pipefail

: "${SUPABASE_DB_URL:?Falta o segredo SUPABASE_DB_URL}"
: "${BACKUP_PASSPHRASE:?Falta o segredo BACKUP_PASSPHRASE}"

OUT_DIR="${1:-backup}"
PG_BIN="${PG_BIN:-}"   # pasta do pg_dump; vazio = o que estiver no PATH
mkdir -p "$OUT_DIR"

STAMP="$(TZ=America/Sao_Paulo date +%Y-%m-%d_%H%M)"
DUMP="$OUT_DIR/sem-panela-$STAMP.dump"
trap 'rm -f "$DUMP"' EXIT

"${PG_BIN:+$PG_BIN/}pg_dump" \
  --dbname="$SUPABASE_DB_URL" \
  --format=custom --compress=9 \
  --schema=public --schema=auth \
  --file="$DUMP"

# Confere se o arquivo abre e quantas tabelas têm dados (sem mostrar dados).
TABLES="$("${PG_BIN:+$PG_BIN/}pg_restore" --list "$DUMP" | grep -c ' TABLE DATA ' || true)"
if [ "$TABLES" -lt 5 ]; then
  echo "Backup suspeito: só $TABLES tabelas com dados." >&2
  exit 1
fi

printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --quiet \
  --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 \
  --output "$DUMP.gpg" "$DUMP"

echo "Backup pronto: $(basename "$DUMP.gpg") ($(du -h "$DUMP.gpg" | cut -f1), $TABLES tabelas com dados)"
