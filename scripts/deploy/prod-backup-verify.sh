#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
BACKUP_FILE="${BACKUP_FILE:-}"
REPORT_DIR="${BACKUP_VERIFY_REPORT_DIR:-$ROOT_DIR/tmp/backups}"
CURRENT_HOST="$(hostname 2>/dev/null || true)"

fail() {
  printf '%s\n' "$1" | redact >&2
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
  backup_regex="$(printf '%s' "$(dirname "$BACKUP_FILE")" | escape_sed_regex)"
  if [[ -z "$host_regex" ]]; then
    host_regex='__WORK_ARCHIVE_NO_HOST_MATCH__'
  fi

  sed -E \
    -e "s#${root_regex}#[workspace]#g" \
    -e "s#${backup_regex}#[backup-dir]#g" \
    -e "s#${host_regex}#[redacted]#g" \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's/(Basic )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's#\b(access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=([^[:space:]&;,]+)#\1=[REDACTED]#gI' \
    -e 's#(https?://)[^[:space:]/@]+(:[^[:space:]@]*)?@#\1[REDACTED]@#gI' \
    -e 's#([?&](access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^[:space:]&]+#\1[REDACTED]#gI' \
    -e 's/([A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL|REDIS_URL)[A-Za-z0-9_]*=)[^[:space:]&;,]+/\1[REDACTED]/gI' \
    -e 's#(postgresql://)[^[:space:]@]+@#\1[REDACTED]@#gI' \
    -e 's#(rediss?://)[^[:space:]@]+@#\1[REDACTED]@#gI'
}

record_report() {
  {
    echo "# Production Backup Verification"
    echo
    echo "- Timestamp UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Backup file: $(basename "$BACKUP_FILE")"
    echo "- Checksum file: $(basename "$CHECKSUM_FILE")"
    echo "- Backup size bytes: $(stat -c %s "$BACKUP_FILE")"
    echo "- SHA256: $checksum_value"
    echo "- pg_restore list method: $restore_method"
    echo "- Hostname: [redacted]"
    echo
    echo "This report intentionally excludes secrets, database contents, and raw"
    echo "backup paths."
    echo
    echo "## Verification"
    echo
    echo "- sha256 sidecar verification: PASS"
    echo "- pg_restore listing check: PASS"
  } >"$REPORT_FILE"
}

[[ -n "$BACKUP_FILE" ]] || fail \
  "Set BACKUP_FILE to the .dump file created by scripts/deploy/prod-backup.sh."

ENV_FILE="$(resolve_path "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$COMPOSE_FILE")"
BACKUP_FILE="$(resolve_path "$BACKUP_FILE")"
REPORT_DIR="$(resolve_path "$REPORT_DIR")"
CHECKSUM_FILE="${CHECKSUM_FILE:-${BACKUP_FILE}.sha256}"
CHECKSUM_FILE="$(resolve_path "$CHECKSUM_FILE")"

[[ -f "$BACKUP_FILE" ]] || fail "Missing backup file: $BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || fail "Backup file is empty: $BACKUP_FILE"
[[ -f "$CHECKSUM_FILE" ]] || fail "Missing checksum file: $CHECKSUM_FILE"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required to verify backup checksums."

backup_dir="$(dirname "$BACKUP_FILE")"
checksum_name="$(basename "$CHECKSUM_FILE")"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_FILE="$REPORT_DIR/prod-backup-verify-${timestamp}.md"
mkdir -p "$REPORT_DIR"

(
  cd "$backup_dir"
  sha256sum -c "$checksum_name"
)

if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$BACKUP_FILE" >/dev/null
  restore_method="local pg_restore"
elif [[ -f "$ENV_FILE" ]] && command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -lc \
    'pg_restore --list >/dev/null' < "$BACKUP_FILE"
  restore_method="docker compose postgres pg_restore"
else
  fail "pg_restore is required, or Docker Compose with a running postgres service must be available."
fi

checksum_value="$(cut -d ' ' -f 1 "$CHECKSUM_FILE")"
record_report

echo "Verified backup: $(relative_path "$BACKUP_FILE")" | redact
echo "Verification report: $(relative_path "$REPORT_FILE")" | redact
ls -lh "$BACKUP_FILE" | redact
