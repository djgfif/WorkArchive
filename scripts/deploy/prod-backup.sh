#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
REPORT_DIR="${BACKUP_REPORT_DIR:-$ROOT_DIR/tmp/backups}"
CURRENT_HOST="$(hostname 2>/dev/null || true)"

fail() {
  echo "$1" >&2
  exit 1
}

resolve_path() {
  local path="$1"
  case "$path" in
    /*) printf '%s' "$path" ;;
    *) printf '%s/%s' "$ROOT_DIR" "$path" ;;
  esac
}

relative_path() {
  local path="$1"
  if [[ "$path" == "$ROOT_DIR/"* ]]; then
    printf '%s' "${path#"$ROOT_DIR"/}"
  else
    printf '[outside-workspace]'
  fi
}

escape_sed_regex() {
  sed -E 's/[][\/.^$*+?{}()|]/\\&/g'
}

redact() {
  local root_regex host_regex backup_regex
  root_regex="$(printf '%s' "$ROOT_DIR" | escape_sed_regex)"
  host_regex="$(printf '%s' "$CURRENT_HOST" | escape_sed_regex)"
  backup_regex="$(printf '%s' "$BACKUP_DIR" | escape_sed_regex)"
  if [[ -z "$host_regex" ]]; then
    host_regex='__WORK_ARCHIVE_NO_HOST_MATCH__'
  fi

  sed -E \
    -e "s#${root_regex}#[workspace]#g" \
    -e "s#${backup_regex}#[backup-dir]#g" \
    -e "s#${host_regex}#[redacted]#g" \
    -e 's/([A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL)[A-Za-z0-9_]*=)[^[:space:]]+/\1[REDACTED]/gI' \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's#(postgresql://)[^[:space:]@]+@#\1[REDACTED]@#gI'
}

record_report() {
  {
    echo "# Production PostgreSQL Backup"
    echo
    echo "- Timestamp UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Environment file: $(relative_path "$ENV_FILE")"
    echo "- Compose file: $(relative_path "$COMPOSE_FILE")"
    echo "- Backup file: $(basename "$backup_file")"
    echo "- Checksum file: $(basename "$checksum_file")"
    echo "- Backup size bytes: $(stat -c %s "$backup_file")"
    echo "- SHA256: $checksum_value"
    echo "- Hostname: [redacted]"
    echo
    echo "This report intentionally excludes secrets, database contents, and raw"
    echo "backup paths. Move the .dump and .sha256 files off-host immediately."
    echo
    echo "## Verification"
    echo
    echo "- pg_dump custom-format export: PASS"
    echo "- pg_restore listing check: PASS"
    echo "- sha256 sidecar verification: PASS"
  } >"$REPORT_FILE"
}

ENV_FILE="$(resolve_path "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$COMPOSE_FILE")"
BACKUP_DIR="$(resolve_path "$BACKUP_DIR")"
REPORT_DIR="$(resolve_path "$REPORT_DIR")"

[[ -f "$ENV_FILE" ]] || fail \
  "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the deployment host and fill placeholders."
[[ -f "$COMPOSE_FILE" ]] || fail "Missing compose file: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || fail "docker is required to create production backups."
docker compose version >/dev/null 2>&1 || fail "docker compose is required to create production backups."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required to create and verify backup checksums."

umask 077
mkdir -p "$BACKUP_DIR"
mkdir -p "$REPORT_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/work-archive-${timestamp}.dump"
checksum_file="${backup_file}.sha256"
tmp_file="${backup_file}.tmp"
REPORT_FILE="$REPORT_DIR/prod-backup-${timestamp}.md"

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

checksum_value="$(cut -d ' ' -f 1 "$checksum_file")"
record_report

echo "Created backup: $(relative_path "$backup_file")" | redact
echo "Created checksum: $(relative_path "$checksum_file")" | redact
echo "Backup report: $(relative_path "$REPORT_FILE")" | redact
ls -lh "$backup_file" | redact
echo "Move this file off-host immediately. Do not keep the only backup on the VPS."
