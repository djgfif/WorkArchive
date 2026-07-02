#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

bash -n scripts/deploy/beta-preflight.sh
bash -n scripts/deploy/beta-smoke.sh
bash -n scripts/deploy/commercial-beta-rehearsal.sh
bash -n scripts/deploy/prod-build.sh
bash -n scripts/deploy/prod-up.sh
bash -n scripts/deploy/prod-down.sh
bash -n scripts/deploy/prod-healthcheck.sh
bash -n scripts/deploy/prod-logs.sh
bash -n scripts/deploy/prod-backup.sh
bash -n scripts/deploy/prod-backup-verify.sh
bash -n scripts/deploy/prod-restore-drill.sh
bash -n scripts/qa/gate1-evidence-local.sh

node --check scripts/deploy/commercial-env-preflight.mjs
node --check scripts/qa/validate-gate1-evidence.mjs
node --check scripts/qa/validate-gate1-evidence.self-test.mjs
node --check scripts/qa/gate1-missing-evidence-report.mjs
node --check scripts/qa/validate-prisma-migrations.mjs
node --check scripts/qa/validate-bola-matrix.mjs
node --check scripts/qa/validate-api-auth-surface.mjs
node --check scripts/qa/validate-api-input-contracts.mjs
node --check scripts/qa/validate-api-cache-policy.mjs
node --check scripts/qa/validate-api-security-headers.mjs
node --check scripts/qa/validate-api-error-policy.mjs
node --check scripts/qa/validate-csrf-policy.mjs
node --check scripts/qa/validate-image-proxy-policy.mjs
node --check scripts/qa/validate-deploy-scripts.mjs
node --check scripts/qa/validate-owner-invariants.mjs
node --check scripts/qa/validate-compose-hardening.mjs
node --check scripts/qa/validate-auth-session-policy.mjs
node --check scripts/qa/validate-oauth-policy.mjs
node --check scripts/qa/validate-log-redaction-policy.mjs
node --check scripts/qa/validate-operator-safety.mjs
node --check scripts/qa/validate-backup-restore-policy.mjs
node --check scripts/qa/validate-secure-sdlc-policy.mjs
node --check scripts/qa/validate-public-permission-boundary.mjs
node --check scripts/qa/validate-retention-policy.mjs
node --check scripts/qa/validate-user-data-rights-policy.mjs
node --check scripts/qa/user-data-rights-smoke.mjs
node --check scripts/qa/account-deletion-rehearsal.mjs
node --check scripts/qa/validate-prometheus-alerts.mjs
node --check scripts/qa/validate-prometheus-slo-rules.mjs
node --check scripts/qa/validate-grafana-dashboard.mjs
node --check scripts/qa/monitoring-evidence.mjs
node --check scripts/qa/docker-runtime-preflight.mjs
node --check scripts/qa/docker-runtime-preflight.self-test.mjs
node --check scripts/qa/import-search-qa.mjs
node --check scripts/qa/performance-smoke.mjs
node --check scripts/qa/validate-sync-architecture.mjs
node --check scripts/qa/sync-load-smoke.mjs

npm run qa:migrations
npm run qa:bola-matrix
npm run qa:api-auth-surface
npm run qa:api-input-contracts
npm run qa:api-cache-policy
npm run qa:api-security-headers
npm run qa:api-error-policy
npm run qa:csrf-policy
npm run qa:image-proxy-policy
npm run qa:deploy-scripts
npm run qa:owner-invariants
npm run qa:compose-hardening
npm run qa:auth-session-policy
npm run qa:oauth-policy
npm run qa:log-redaction-policy
npm run qa:operator-safety
npm run qa:backup-restore-policy
RESTORE_DRILL_PLAN_ONLY=true npm run ops:restore-drill
npm run qa:secure-sdlc-policy
npm run qa:public-boundary
npm run qa:retention-policy
npm run qa:user-data-rights-policy
USER_DATA_RIGHTS_SMOKE_LIVE=false npm run qa:user-data-rights-smoke
ACCOUNT_DELETION_REHEARSAL_LIVE=false npm run qa:account-deletion-rehearsal
npm run qa:alerts
npm run qa:slo
npm run qa:dashboards
npm run qa:import-search
npm run qa:sync-architecture
SYNC_LOAD_DRY_RUN=true npm run qa:sync-load
PERF_SMOKE_DRY_RUN=true npm run qa:performance-smoke
MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring
npm run qa:docker-runtime:self-test
npm run qa:docker-runtime
npm run qa:gate1:evidence
npm run qa:gate1:evidence:self-test
npm run qa:gate1:missing
