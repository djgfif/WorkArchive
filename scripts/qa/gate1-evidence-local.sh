#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR="${GATE1_EVIDENCE_DIR:-$ROOT_DIR/tmp/gate1-evidence}"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
REPORT_FILE="$REPORT_DIR/gate1-local-$STAMP.md"
TMP_DIR="$(mktemp -d)"
FAIL_COUNT=0

mkdir -p "$REPORT_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$ROOT_DIR"

redact() {
  sed -E \
    -e 's/([A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL)[A-Za-z0-9_]*=)[^[:space:]]+/\1[REDACTED]/gI' \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's#(postgresql://)[^[:space:]@]+@#\1[REDACTED]@#gI'
}

relative_path() {
  local path="$1"
  if [[ "$path" == "$ROOT_DIR/"* ]]; then
    printf '%s' "${path#"$ROOT_DIR"/}"
  else
    printf '[outside-workspace]'
  fi
}

append_header() {
  local commit dirty
  commit="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  if [[ -n "$(git status --short 2>/dev/null)" ]]; then
    dirty="dirty"
  else
    dirty="clean"
  fi

  {
    echo "# Gate 1 Local Evidence Helper Report"
    echo
    echo "- Timestamp UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Git commit: $commit"
    echo "- Working tree: $dirty"
    echo "- Hostname: [redacted]"
    echo "- Report path: $(relative_path "$REPORT_FILE")"
    echo
    echo "This generated report contains only local/repository-verifiable checks. Beta host checks, GitHub Settings controls, restore drills, and release-runner-only scans remain manual or blocked unless run in the proper environment."
    echo
  } >"$REPORT_FILE"
}

append_manual_blockers() {
  {
    echo "## Manual Or Environment-Blocked Evidence"
    echo
    echo "| Evidence item | Status | Reason |"
    echo "| --- | --- | --- |"
    echo "| beta host preflight | BLOCKED | Requires beta host and real .env.prod values. |"
    echo "| beta host smoke | BLOCKED | Requires running beta URL; public unauthenticated /metrics must return 404 there. |"
    echo "| GitHub branch protection / secret scanning / push protection | MANUAL | Requires GitHub Settings access. |"
    echo "| CodeQL latest run status | MANUAL | Requires GitHub Actions/Security view for the release commit. |"
    echo "| Dependabot status | MANUAL | Repository config is local, but enabled status is verified in GitHub. |"
    echo "| backup/restore drill | BLOCKED | Requires production-sized backup and non-production restore target. |"
    echo "| Trivy filesystem/image scans | BLOCKED | Requires official release runner with Trivy and immutable image refs. |"
    echo "| smoke performance baseline | BLOCKED | Requires beta host and authenticated disposable test account for sync/import/auth timings. |"
    echo
  } >>"$REPORT_FILE"
}

record_result() {
  local name="$1"
  local status="$2"
  local command="$3"
  local exit_code="$4"
  local output_file="$5"

  {
    echo "### $name"
    echo
    echo "- Status: $status"
    echo "- Command: \`$command\`"
    echo "- Exit code: $exit_code"
    echo "- Finished UTC: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo
    echo "\`\`\`text"
    sed -n '1,80p' "$output_file" | redact
    if [[ "$(wc -l <"$output_file")" -gt 80 ]]; then
      echo "[output truncated to first 80 lines]"
    fi
    echo "\`\`\`"
    echo
  } >>"$REPORT_FILE"
}

run_check() {
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

record_blocked() {
  local name="$1"
  local command="$2"
  local reason="$3"
  local output_file="$TMP_DIR/${name//[^A-Za-z0-9_.-]/_}.blocked.log"

  printf '%s\n' "$reason" >"$output_file"
  record_result "$name" "BLOCKED" "$command" "not-run" "$output_file"
}

append_header

if [[ "${GATE1_RUN_NPM_CI:-1}" == "1" || "${GATE1_RUN_NPM_CI:-1}" == "true" ]]; then
  run_check "npm ci" npm ci
else
  record_blocked "npm ci" "npm ci" "Skipped because GATE1_RUN_NPM_CI is not enabled."
fi

run_check "npm run security:public" npm run security:public
run_check "npm run check:docs-links" npm run check:docs-links
run_check "npm run lint" npm run lint
run_check "npm run typecheck" npm run typecheck
run_check "npm run test" npm run test
run_check "npm run test:e2e" npm run test:e2e
run_check "npm run build" npm run build

run_check "bash syntax: beta-preflight" bash -n scripts/deploy/beta-preflight.sh
run_check "bash syntax: beta-smoke" bash -n scripts/deploy/beta-smoke.sh
run_check "bash syntax: gate1 evidence helper" bash -n scripts/qa/gate1-evidence-local.sh
run_check "node syntax: commercial env preflight" node --check scripts/deploy/commercial-env-preflight.mjs
run_check "node syntax: import search QA" node --check scripts/qa/import-search-qa.mjs
run_check "node syntax: sync load smoke" node --check scripts/qa/sync-load-smoke.mjs

if [[ -f "$ROOT_DIR/.env.prod" ]]; then
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    run_check "docker compose production config" docker compose -f compose.prod.yml --env-file .env.prod config
  else
    record_blocked "docker compose production config" "docker compose -f compose.prod.yml --env-file .env.prod config" "Docker compose is not available in this environment."
  fi
else
  record_blocked "docker compose production config" "docker compose -f compose.prod.yml --env-file .env.prod config" ".env.prod is not present in this environment."
fi

append_manual_blockers

{
  echo "## Summary"
  echo
  if [[ "$FAIL_COUNT" -eq 0 ]]; then
    echo "Local helper completed with no failed local checks. Environment-only Gate 1 evidence remains BLOCKED/MANUAL unless run elsewhere."
  else
    echo "Local helper completed with $FAIL_COUNT failed local check(s). Do not copy failed items as passing Gate 1 evidence."
  fi
} >>"$REPORT_FILE"

echo "Gate 1 local evidence report: $(relative_path "$REPORT_FILE")"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
