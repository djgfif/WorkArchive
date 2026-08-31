#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPORT_DIR_INPUT="${GATE1_EVIDENCE_DIR:-$ROOT_DIR/tmp/gate1-evidence}"
if [[ "$REPORT_DIR_INPUT" = /* ]]; then
  REPORT_DIR="$REPORT_DIR_INPUT"
else
  REPORT_DIR="$ROOT_DIR/$REPORT_DIR_INPUT"
fi
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
REPORT_FILE="$REPORT_DIR/gate1-local-$STAMP.md"
TMP_DIR="$(mktemp -d)"
FAIL_COUNT=0
CURRENT_HOST="$(hostname 2>/dev/null || true)"

mkdir -p "$REPORT_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$ROOT_DIR"

escape_sed_regex() {
  sed -E 's/[][\/.^$*+?{}()|]/\\&/g'
}

redact() {
  local root_regex host_regex
  root_regex="$(printf '%s' "$ROOT_DIR" | escape_sed_regex)"
  host_regex="$(printf '%s' "$CURRENT_HOST" | escape_sed_regex)"
  if [[ -z "$host_regex" ]]; then
    host_regex='__WORK_ARCHIVE_NO_HOST_MATCH__'
  fi

  sed -E \
    -e "s#${root_regex}#[workspace]#g" \
    -e "s#${host_regex}#[redacted]#g" \
    -e 's/([A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL|REDIS_URL)[A-Za-z0-9_]*=)[^[:space:]&;,]+/\1[REDACTED]/gI' \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's/(Basic )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's#\b(access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=([^[:space:]&;,]+)#\1=[REDACTED]#gI' \
    -e 's#(postgresql://)[^[:space:]@]+@#\1[REDACTED]@#gI' \
    -e 's#(rediss?://)[^[:space:]@]+@#\1[REDACTED]@#gI' \
    -e 's#(https?://)[^[:space:]/@]+(:[^[:space:]@]*)?@#\1[REDACTED]@#gI' \
    -e 's#([?&](access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^[:space:]&]+#\1[REDACTED]#gI'
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
    echo "| monitoring evidence live run | BLOCKED | Requires real Prometheus/Grafana endpoints and reviewed /metrics collector path. |"
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
run_check "npm run check:web-i18n" npm run check:web-i18n
run_check "npm run check:web-i18n-resources" npm run check:web-i18n-resources
run_check "npm run check:web-i18n-packs" npm run check:web-i18n-packs
run_check "npm run lint" npm run lint
run_check "npm run typecheck" npm run typecheck
run_check "npm run test" npm run test
run_check "npm run test:e2e" npm run test:e2e
run_check "npm run build" npm run build

run_check "bash syntax: beta-preflight" bash -n scripts/deploy/beta-preflight.sh
run_check "bash syntax: beta-smoke" bash -n scripts/deploy/beta-smoke.sh
run_check "bash syntax: commercial beta rehearsal" bash -n scripts/deploy/commercial-beta-rehearsal.sh
run_check "bash syntax: prod-build" bash -n scripts/deploy/prod-build.sh
run_check "bash syntax: prod-up" bash -n scripts/deploy/prod-up.sh
run_check "bash syntax: prod-down" bash -n scripts/deploy/prod-down.sh
run_check "bash syntax: prod-healthcheck" bash -n scripts/deploy/prod-healthcheck.sh
run_check "bash syntax: prod-logs" bash -n scripts/deploy/prod-logs.sh
run_check "bash syntax: prod-backup" bash -n scripts/deploy/prod-backup.sh
run_check "bash syntax: prod-backup-verify" bash -n scripts/deploy/prod-backup-verify.sh
run_check "bash syntax: prod-restore-drill" bash -n scripts/deploy/prod-restore-drill.sh
run_check "bash syntax: gate1 evidence helper" bash -n scripts/qa/gate1-evidence-local.sh
run_check "node syntax: commercial env preflight" node --check scripts/deploy/commercial-env-preflight.mjs
run_check "node syntax: gate1 evidence validator" node --check scripts/qa/validate-gate1-evidence.mjs
run_check "node syntax: gate1 missing evidence report" node --check scripts/qa/gate1-missing-evidence-report.mjs
run_check "node syntax: prisma migration validator" node --check scripts/qa/validate-prisma-migrations.mjs
run_check "node syntax: BOLA matrix validator" node --check scripts/qa/validate-bola-matrix.mjs
run_check "node syntax: API auth surface validator" node --check scripts/qa/validate-api-auth-surface.mjs
run_check "node syntax: API input contract validator" node --check scripts/qa/validate-api-input-contracts.mjs
run_check "node syntax: API cache policy validator" node --check scripts/qa/validate-api-cache-policy.mjs
run_check "node syntax: API security headers validator" node --check scripts/qa/validate-api-security-headers.mjs
run_check "node syntax: API error policy validator" node --check scripts/qa/validate-api-error-policy.mjs
run_check "node syntax: CSRF policy validator" node --check scripts/qa/validate-csrf-policy.mjs
run_check "node syntax: image proxy policy validator" node --check scripts/qa/validate-image-proxy-policy.mjs
run_check "node syntax: deploy script policy validator" node --check scripts/qa/validate-deploy-scripts.mjs
run_check "node syntax: owner invariants validator" node --check scripts/qa/validate-owner-invariants.mjs
run_check "node syntax: auth session policy validator" node --check scripts/qa/validate-auth-session-policy.mjs
run_check "node syntax: OAuth policy validator" node --check scripts/qa/validate-oauth-policy.mjs
run_check "node syntax: log redaction policy validator" node --check scripts/qa/validate-log-redaction-policy.mjs
run_check "node syntax: operator safety validator" node --check scripts/qa/validate-operator-safety.mjs
run_check "node syntax: backup restore policy validator" node --check scripts/qa/validate-backup-restore-policy.mjs
run_check "node syntax: secure SDLC policy validator" node --check scripts/qa/validate-secure-sdlc-policy.mjs
run_check "node syntax: compose hardening validator" node --check scripts/qa/validate-compose-hardening.mjs
run_check "node syntax: public boundary validator" node --check scripts/qa/validate-public-permission-boundary.mjs
run_check "node syntax: retention policy validator" node --check scripts/qa/validate-retention-policy.mjs
run_check "node syntax: user data rights policy validator" node --check scripts/qa/validate-user-data-rights-policy.mjs
run_check "node syntax: user data rights smoke" node --check scripts/qa/user-data-rights-smoke.mjs
run_check "node syntax: account deletion rehearsal" node --check scripts/qa/account-deletion-rehearsal.mjs
run_check "node syntax: prometheus alert validator" node --check scripts/qa/validate-prometheus-alerts.mjs
run_check "node syntax: prometheus slo validator" node --check scripts/qa/validate-prometheus-slo-rules.mjs
run_check "node syntax: grafana dashboard validator" node --check scripts/qa/validate-grafana-dashboard.mjs
run_check "node syntax: monitoring evidence" node --check scripts/qa/monitoring-evidence.mjs
run_check "node syntax: docker runtime preflight" node --check scripts/qa/docker-runtime-preflight.mjs
run_check "node syntax: docker runtime preflight self-test" node --check scripts/qa/docker-runtime-preflight.self-test.mjs
run_check "node syntax: import search QA" node --check scripts/qa/import-search-qa.mjs
run_check "node syntax: performance smoke" node --check scripts/qa/performance-smoke.mjs
run_check "node syntax: sync architecture validator" node --check scripts/qa/validate-sync-architecture.mjs
run_check "node syntax: sync load smoke" node --check scripts/qa/sync-load-smoke.mjs
run_check "restore drill plan-only" env RESTORE_DRILL_PLAN_ONLY=true npm run ops:restore-drill
run_check "npm run qa:alerts" npm run qa:alerts
run_check "npm run qa:gate1:evidence" npm run qa:gate1:evidence
run_check "npm run qa:gate1:missing" npm run qa:gate1:missing
run_check "npm run qa:migrations" npm run qa:migrations
run_check "npm run qa:bola-matrix" npm run qa:bola-matrix
run_check "npm run qa:api-auth-surface" npm run qa:api-auth-surface
run_check "npm run qa:api-input-contracts" npm run qa:api-input-contracts
run_check "npm run qa:api-cache-policy" npm run qa:api-cache-policy
run_check "npm run qa:api-security-headers" npm run qa:api-security-headers
run_check "npm run qa:api-error-policy" npm run qa:api-error-policy
run_check "npm run qa:csrf-policy" npm run qa:csrf-policy
run_check "npm run qa:image-proxy-policy" npm run qa:image-proxy-policy
run_check "npm run qa:deploy-scripts" npm run qa:deploy-scripts
run_check "npm run qa:owner-invariants" npm run qa:owner-invariants
run_check "npm run qa:auth-session-policy" npm run qa:auth-session-policy
run_check "npm run qa:oauth-policy" npm run qa:oauth-policy
run_check "npm run qa:log-redaction-policy" npm run qa:log-redaction-policy
run_check "npm run qa:operator-safety" npm run qa:operator-safety
run_check "npm run qa:backup-restore-policy" npm run qa:backup-restore-policy
run_check "npm run qa:secure-sdlc-policy" npm run qa:secure-sdlc-policy
run_check "npm run qa:compose-hardening" npm run qa:compose-hardening
run_check "npm run qa:public-boundary" npm run qa:public-boundary
run_check "npm run qa:retention-policy" npm run qa:retention-policy
run_check "npm run qa:user-data-rights-policy" npm run qa:user-data-rights-policy
run_check "npm run qa:user-data-rights-smoke dry-run" env USER_DATA_RIGHTS_SMOKE_LIVE=false npm run qa:user-data-rights-smoke
run_check "npm run qa:account-deletion-rehearsal dry-run" env ACCOUNT_DELETION_REHEARSAL_LIVE=false npm run qa:account-deletion-rehearsal
run_check "npm run qa:slo" npm run qa:slo
run_check "npm run qa:dashboards" npm run qa:dashboards
run_check "npm run qa:import-search" npm run qa:import-search
run_check "npm run qa:sync-architecture" npm run qa:sync-architecture
run_check "npm run qa:sync-load dry-run" env SYNC_LOAD_DRY_RUN=true npm run qa:sync-load
run_check "npm run qa:performance-smoke dry-run" env PERF_SMOKE_DRY_RUN=true npm run qa:performance-smoke
run_check "npm run qa:monitoring dry-run" env MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring
run_check "npm run qa:docker-runtime:self-test" npm run qa:docker-runtime:self-test
run_check "npm run qa:docker-runtime report" npm run qa:docker-runtime

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
