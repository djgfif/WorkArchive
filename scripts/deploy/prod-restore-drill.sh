#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.restore}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
BACKUP_FILE="${BACKUP_FILE:-}"
REPORT_DIR="${RESTORE_DRILL_REPORT_DIR:-$ROOT_DIR/tmp/restore-drills}"
CONFIRM="${RESTORE_DRILL_CONFIRM:-}"
PLAN_ONLY="${RESTORE_DRILL_PLAN_ONLY:-false}"
BASE_URL="${RESTORE_DRILL_BASE_URL:-${BETA_BASE_URL:-}}"
EXPECT_GOOGLE_OAUTH_CONFIGURED="${EXPECT_GOOGLE_OAUTH_CONFIGURED:-true}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
TMP_DIR="$(mktemp -d)"
FAIL_COUNT=0
START_SECONDS="$(date -u +%s)"
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

normalize_bool() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes) printf 'true' ;;
    0|false|no|'') printf 'false' ;;
    *) fail "RESTORE_DRILL_PLAN_ONLY must be true or false." ;;
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
  if [[ -z "$host_regex" ]]; then
    host_regex='__WORK_ARCHIVE_NO_HOST_MATCH__'
  fi
  if [[ -n "$BACKUP_FILE" ]]; then
    backup_regex="$(printf '%s' "$(dirname "$BACKUP_FILE")" | escape_sed_regex)"
  else
    backup_regex='__WORK_ARCHIVE_NO_BACKUP_DIR_MATCH__'
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

backup_file_label() {
  if [[ -n "$BACKUP_FILE" ]]; then
    basename "$BACKUP_FILE"
  else
    printf 'not configured'
  fi
}

append_report_header() {
  {
    echo "# Production Backup Restore Drill"
    echo
    echo "- Timestamp UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Environment file: $(relative_path "$ENV_FILE")"
    echo "- Compose file: $(relative_path "$COMPOSE_FILE")"
    echo "- Backup file: $(backup_file_label)"
    echo "- Restore target: disposable/non-production compose stack"
    echo "- Post-restore smoke URL: $(printf '%s' "${BASE_URL:-not configured}" | redact)"
    echo "- Plan-only mode: $PLAN_ONLY"
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

write_plan_only_report() {
  append_report_header

  {
    echo "## Plan-Only Review"
    echo
    echo "No Docker, pg_restore, migration, startup, smoke, or destructive restore"
    echo "commands were executed. This report is a preflight artifact for operator"
    echo "review before running the confirmed restore drill against a disposable"
    echo "target."
    echo
    echo "| Step | Command family | Safety control |"
    echo "| --- | --- | --- |"
    echo "| Verify selected backup | \`npm run ops:backup:verify\` | Requires non-empty BACKUP_FILE and sha256 sidecar. |"
    echo "| Start dependencies | \`docker compose up -d postgres redis\` | Uses ENV_FILE and COMPOSE_FILE from this report. |"
    echo "| Restore backup | \`pg_restore --clean --if-exists --no-owner --no-privileges\` | Confirmed drill requires \`RESTORE_DRILL_CONFIRM=restore-disposable-target\`. |"
    echo "| Apply migrations | \`docker compose --profile release run --rm api-migrate\` | API container entrypoint must not run migrations. |"
    echo "| Start app | \`docker compose up -d api web\` | Target must be disposable/non-production. |"
    echo "| Smoke restored stack | \`scripts/deploy/beta-smoke.sh\` | Runs only when RESTORE_DRILL_BASE_URL/BETA_BASE_URL is set. |"
    echo
    echo "To execute the real drill after review:"
    echo
    echo "\`\`\`bash"
    echo "RESTORE_DRILL_CONFIRM=restore-disposable-target \\"
    echo "ENV_FILE=$(relative_path "$ENV_FILE") \\"
    echo "RESTORE_DRILL_BASE_URL=<disposable-restored-web-origin> \\"
    echo "BACKUP_FILE=<verified-backup.dump> \\"
    echo "npm run ops:restore-drill"
    echo "\`\`\`"
    echo
    echo "Do not point RESTORE_DRILL_BASE_URL at production."
  } >>"$REPORT_FILE"

  echo "Restore drill plan report: $(relative_path "$REPORT_FILE")" | redact
}

PLAN_ONLY="$(normalize_bool "$PLAN_ONLY")"
REPORT_DIR="$(resolve_path "$REPORT_DIR")"
REPORT_FILE="$REPORT_DIR/restore-drill-$STAMP.md"
if [[ "$PLAN_ONLY" == "true" ]]; then
  REPORT_FILE="$REPORT_DIR/restore-drill-plan-$STAMP.md"
fi

mkdir -p "$REPORT_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

ENV_FILE="$(resolve_path "$ENV_FILE")"
COMPOSE_FILE="$(resolve_path "$COMPOSE_FILE")"
if [[ -n "$BACKUP_FILE" ]]; then
  BACKUP_FILE="$(resolve_path "$BACKUP_FILE")"
fi

if [[ "$PLAN_ONLY" == "true" ]]; then
  write_plan_only_report
  exit 0
fi

[[ "$CONFIRM" == "restore-disposable-target" ]] || fail \
  "Set RESTORE_DRILL_CONFIRM=restore-disposable-target to confirm this destructive non-production restore drill."

[[ -n "$BACKUP_FILE" ]] || fail \
  "Set BACKUP_FILE to the .dump file created by scripts/deploy/prod-backup.sh."

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
    ENV_FILE="$ENV_FILE" \
    COMPOSE_FILE="$COMPOSE_FILE" \
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

echo "Restore drill report: $(relative_path "$REPORT_FILE")" | redact

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
