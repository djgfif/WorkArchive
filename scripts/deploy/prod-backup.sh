#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"
COMPOSE_FILE="$ROOT_DIR/compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the deployment host and fill placeholders." >&2
  exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "sha256sum is required to create and verify backup checksums." >&2
  exit 1
fi

case "$BACKUP_DIR" in
  /*) ;;
  *) BACKUP_DIR="$ROOT_DIR/$BACKUP_DIR" ;;
esac

umask 077
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/work-archive-${timestamp}.dump"
checksum_file="${backup_file}.sha256"
tmp_file="${backup_file}.tmp"

cleanup() {
  rm -f "$tmp_file"
}
trap cleanup EXIT

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -lc 'pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --no-owner \
  --no-privileges' > "$tmp_file"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -lc \
  'pg_restore --list >/dev/null' < "$tmp_file"

mv "$tmp_file" "$backup_file"
trap - EXIT

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$backup_file")" > "$(basename "$checksum_file")"
  sha256sum -c "$(basename "$checksum_file")"
)

echo "Created backup: $backup_file"
echo "Created checksum: $checksum_file"
ls -lh "$backup_file"
echo "Move this file off-host immediately. Do not keep the only backup on the VPS."
