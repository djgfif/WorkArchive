#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.restore}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
BACKUP_FILE="${BACKUP_FILE:-}"
REPORT_DIR="${RESTORE_DRILL_REPORT_DIR:-$ROOT_DIR/tmp/restore-drills}"
CONFIRM="${RESTORE_DRILL_CONFIRM:-}"
BASE_URL="${RESTORE_DRILL_BASE_URL:-${BETA_BASE_URL:-}}"
EXPECT_GOOGLE_OAUTH_CONFIGURED="${EXPECT_GOOGLE_OAUTH_CONFIGURED:-true}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
REPORT_FILE="$REPORT_DIR/restore-drill-$STAMP.md"
TMP_DIR="$(mktemp -d)"
FAIL_COUNT=0
START_SECONDS="$(date -u +%s)"
CURRENT_HOST="$(hostname 2>/dev/null || true)"

mkdir -p "$REPORT_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

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
  backup_regex="$(printf '%s' "$(dirname "$BACKUP_FILE")" | escape_sed_regex)"
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

append_report_header() {
  {
    echo "# Production Backup Restore Drill"
    echo
    echo "- Timestamp UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Environment file: $(relative_path "$ENV_FILE")"
    echo "- Compose file: $(relative_path "$COMPOSE_FILE")"
    echo "- Backup file: $(basename "$BACKUP_FILE")"
    echo "- Restore target: disposable/non-production compose stack"
    echo "- Post-restore smoke URL: ${BASE_URL:-not configured}"
    echo
    echo "This report intentionally excludes secrets, database contents, access"
    echo "tokens, and raw backup paths."
    echo
  } >"$REPORT_FILE"
}

record_result() {
  local name="$1"
  local status="$2"
  local command="$3"
  local exit_code="$4"
  local output_file="$5"

  {
    echo "## $name"
    echo
    echo "- Status: $status"
    echo "- Command: \`$command\`"
    echo "- Exit code: $exit_code"
    echo "- Finished UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    echo '```text'
    sed -n '1,120p' "$output_file" | redact
    if [[ "$(wc -l <"$output_file")" -gt 120 ]]; then
      echo "[output truncated to first 120 lines]"
    fi
    echo '```'
    echo
  } >>"$REPORT_FILE"
}

run_step() {
  local name="$1"
  shift
  local output_file="$TMP_DIR/${name//[^A-Za-z0-9_.-]/_}.log"
  local command="$*"
  local exit_code

  set +e
  "$@" >"$output_file" 2>&1
  exit_code=$?
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    record_result "$name" "PASS" "$command" "$exit_code" "$output_file"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    record_result "$name" "FAIL" "$command" "$exit_code" "$output_file"
  fi
}

run_restore_step() {
  local output_file="$TMP_DIR/restore_backup.log"
  local exit_code

  set +e
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres sh -lc 'pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --dbname "$POSTGRES_DB"' <"$BACKUP_FILE" >"$output_file" 2>&1
  exit_code=$?
  set -e

  if [[ "$exit_code" -eq 0 ]]; then
    record_result "Restore backup into target database" "PASS" \
      "docker compose ... exec -T postgres pg_restore < BACKUP_FILE" \
      "$exit_code" "$output_file"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    record_result "Restore backup into target database" "FAIL" \
      "docker compose ... exec -T postgres pg_restore < BACKUP_FILE" \
      "$exit_code" "$output_file"
  fi
}

record_skipped() {
  local name="$1"
  local command="$2"
  local reason="$3"
  local output_file="$TMP_DIR/${name//[^A-Za-z0-9_.-]/_}.skipped.log"

  printf '%s\n' "$reason" >"$output_file"
  record_result "$name" "SKIPPED" "$command" "not-run" "$output_file"
}

[[ "$CONFIRM" == "restore-disposable-target" ]] || fail \
  "Set RESTORE_DRILL_CONFIRM=restore-disposable-target to confirm this destructive non-production restore drill."

[[ -n "$BACKUP_FILE" ]] || fail \
  "Set BACKUP_FILE to the .dump file created by scripts/deploy/prod-backup.sh."

ENV_FILE="$(resolve_path "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$COMPOSE_FILE")"
BACKUP_FILE="$(resolve_path "$BACKUP_FILE")"

[[ -f "$ENV_FILE" ]] || fail "Missing env file: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "Missing compose file: $COMPOSE_FILE"
[[ -f "$BACKUP_FILE" ]] || fail "Missing backup file: $BACKUP_FILE"
[[ -s "$BACKUP_FILE" ]] || fail "Backup file is empty: $BACKUP_FILE"

command -v docker >/dev/null 2>&1 || fail "docker is required for the restore drill."
docker compose version >/dev/null 2>&1 || fail "docker compose is required for the restore drill."

append_report_header

run_step "Verify backup file" env \
  ENV_FILE="$ENV_FILE" \
  COMPOSE_FILE="$COMPOSE_FILE" \
  BACKUP_FILE="$BACKUP_FILE" \
  bash "$ROOT_DIR/scripts/deploy/prod-backup-verify.sh"

run_step "Start database dependencies" docker compose \
  -f "$COMPOSE_FILE" \
  --env-file "$ENV_FILE" \
  up -d postgres redis

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  run_restore_step
else
  record_skipped "Restore backup into target database" \
    "docker compose ... exec -T postgres pg_restore < BACKUP_FILE" \
    "Skipped because an earlier restore prerequisite failed."
fi

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  run_step "Run release migrations" docker compose \
    -f "$COMPOSE_FILE" \
    --env-file "$ENV_FILE" \
    --profile release \
    run --rm api-migrate
else
  record_skipped "Run release migrations" \
    "docker compose ... --profile release run --rm api-migrate" \
    "Skipped because restore failed or a prerequisite failed."
fi

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  run_step "Start restored API and web" docker compose \
    -f "$COMPOSE_FILE" \
    --env-file "$ENV_FILE" \
    up -d api web
else
  record_skipped "Start restored API and web" \
    "docker compose ... up -d api web" \
    "Skipped because restore or migrations failed."
fi

if [[ "$FAIL_COUNT" -eq 0 && -n "$BASE_URL" ]]; then
  run_step "Post-restore beta smoke" env \
    BETA_BASE_URL="$BASE_URL" \
    EXPECT_GOOGLE_OAUTH_CONFIGURED="$EXPECT_GOOGLE_OAUTH_CONFIGURED" \
    "$ROOT_DIR/scripts/deploy/beta-smoke.sh"
else
  record_skipped "Post-restore beta smoke" \
    "BETA_BASE_URL=<restore-url> scripts/deploy/beta-smoke.sh" \
    "Skipped because RESTORE_DRILL_BASE_URL/BETA_BASE_URL was not configured or an earlier step failed."
fi

END_SECONDS="$(date -u +%s)"
RTO_SECONDS=$((END_SECONDS - START_SECONDS))

{
  echo "## Summary"
  echo
  echo "- Finished UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "- Observed restore drill duration seconds: $RTO_SECONDS"
  if [[ "$FAIL_COUNT" -eq 0 ]]; then
    echo "- Result: PASS"
  else
    echo "- Result: FAIL ($FAIL_COUNT failed step(s))"
  fi
} >>"$REPORT_FILE"

echo "Restore drill report: $(relative_path "$REPORT_FILE")"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
