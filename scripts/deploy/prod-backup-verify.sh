#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
BACKUP_FILE="${BACKUP_FILE:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Set BACKUP_FILE to the .dump file created by scripts/deploy/prod-backup.sh." >&2
  exit 1
fi

case "$BACKUP_FILE" in
  /*) ;;
  *) BACKUP_FILE="$ROOT_DIR/$BACKUP_FILE" ;;
esac

CHECKSUM_FILE="${CHECKSUM_FILE:-${BACKUP_FILE}.sha256}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Missing backup file: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "Backup file is empty: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -f "$CHECKSUM_FILE" ]]; then
  echo "Missing checksum file: $CHECKSUM_FILE" >&2
  exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "sha256sum is required to verify backup checksums." >&2
  exit 1
fi

backup_dir="$(dirname "$BACKUP_FILE")"
checksum_name="$(basename "$CHECKSUM_FILE")"

(
  cd "$backup_dir"
  sha256sum -c "$checksum_name"
)

if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$BACKUP_FILE" >/dev/null
elif [[ -f "$ENV_FILE" ]] && command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -lc \
    'pg_restore --list >/dev/null' < "$BACKUP_FILE"
else
  echo "pg_restore is required, or Docker Compose with a running postgres service must be available." >&2
  exit 1
fi

echo "Verified backup: $BACKUP_FILE"
ls -lh "$BACKUP_FILE"
