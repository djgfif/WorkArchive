#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$ROOT_DIR"

bash -n scripts/deploy/beta-preflight.sh
bash -n scripts/deploy/beta-smoke.sh
bash -n scripts/deploy/prod-healthcheck.sh
bash -n scripts/deploy/prod-backup.sh
bash -n scripts/deploy/prod-backup-verify.sh
bash -n scripts/deploy/prod-restore-drill.sh
bash -n scripts/qa/gate1-evidence-local.sh

node --check scripts/deploy/commercial-env-preflight.mjs
node --check scripts/qa/validate-gate1-evidence.mjs
node --check scripts/qa/validate-prisma-migrations.mjs
node --check scripts/qa/validate-prometheus-alerts.mjs
node --check scripts/qa/validate-prometheus-slo-rules.mjs
node --check scripts/qa/validate-grafana-dashboard.mjs
node --check scripts/qa/monitoring-evidence.mjs
node --check scripts/qa/import-search-qa.mjs
node --check scripts/qa/performance-smoke.mjs
node --check scripts/qa/sync-load-smoke.mjs

npm run qa:migrations
npm run qa:alerts
npm run qa:slo
npm run qa:dashboards
MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring
npm run qa:gate1:evidence
