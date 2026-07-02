# Public Beta Gate 1 Evidence

Status: partial — local repository gates passed 2026-07-01; host/beta environment items pending.

Use this file as the operator ledger for the first public beta release
candidate. Do not paste secrets, cookies, OAuth codes, access tokens, API keys,
database dumps, backup contents, raw sync payloads, or personally identifying
tester data.

For repeatable collection, follow
[`GATE_1_VALIDATION_RUNBOOK.md`](./GATE_1_VALIDATION_RUNBOOK.md). Local helper
reports can be generated with `npm run qa:gate1:local`, import/search QA with
`npm run qa:import-search`, migration safety with `npm run qa:migrations`, sync
load dry-run validation with `npm run qa:sync-load`, and an advisory missing
evidence grouping with `npm run qa:gate1:missing`. Copy only observed summary
results into this ledger;
leave environment-only items blank, `blocked`, or `not run` until they are run
on the required release runner, beta host, GitHub Settings page, restore target,
or disposable authenticated test account.

Before approving public beta, run
`GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence`. The non-strict
`npm run qa:gate1:evidence` mode is useful while filling this ledger, but it is
not an approval gate because it reports incomplete evidence without failing.

2026-06-04 expert feedback disposition: accepted work is search QA, sync
reliability evidence, API boundary documentation, and operational Gate 1
evidence. Public/community/social/recommendation, mobile, Tauri, i18n, and
open-source licensing changes are not part of this evidence run.

## Release Candidate

- Date and timezone: 2026-07-01 KST (local verification run)
- Commit SHA: 00c55e96cbc422ced1437395d4bc57a354cece69 + dirty working tree
- Host or environment: local development (repository gates only; beta host pending)
- Operator: gkho0
- Public beta URL: not yet assigned
- Release notes or ticket:

## Repository Gates

- `npm run security:public`: PASS — public readiness check passed (2026-07-01, dirty working tree)
- `npm run check:docs-links`: PASS — all markdown local links valid (2026-07-01)
- `npm run lint`: PASS — no ESLint errors across web/api/shared-types (2026-07-01)
- `npm run typecheck`: PASS — no TypeScript errors (2026-07-01)
- `npm run test`: PASS — API 92 suites / 770 tests, web 62 files / 402 tests, shared-types 2 files / 6 tests (2026-07-01)
- `npm run build`: PASS — shared-types `tsc`, API `tsc`, web Vite production build (2026-07-01)
- `npm run check:web-boundaries`: PASS — no web feature boundary violations found (2026-07-01)
- `npm run check:web-import-cycles`: PASS — no web import cycles found (2026-07-01)
- `npm run qa:migrations`: PASS — Prisma migration safety check passed with registered high-risk historical migrations
- `npm run qa:bola-matrix`: PASS — BOLA matrix covers user-owned REST object families and every sync entity type; no unresolved `gap` or `partial` rows (2026-06-24)
- `npm run qa:api-auth-surface`: PASS — API authorization surface classifies every controller and verifies guarded, optional bearer, public health, metrics bearer-token, and policy-bounded image proxy boundaries (2026-06-24)
- `npm run qa:api-input-contracts`: PASS — global DTO validation rejects unknown fields, controller body/query DTO contracts, body DTO Swagger metadata, provider credential exception, and sync strict payload validation align (2026-06-25)
- `npm run qa:api-cache-policy`: PASS — normal `/api/*` responses default to `Cache-Control: no-store`, `/api/image-proxy` remains the explicit cacheable API exception, `/health`, `/livez`, and `/readyz` remain `no-store`, and `/metrics` remains `no-store` (2026-06-24)
- `npm run qa:api-security-headers`: PASS — API Helmet wiring, `x-powered-by` removal, CSP floor, no-sniff, referrer policy, HSTS, e2e coverage, beta smoke proxy coverage, and Gate 1 wiring remain aligned (2026-06-25)
- `npm run qa:api-error-policy`: PASS — global API exception filter wiring, request-id error responses, sanitized unhandled 500 bodies, stack stripping, e2e coverage, and Gate 1 wiring remain aligned (2026-06-25)
- `npm run qa:csrf-policy`: PASS — production Fetch Metadata and Origin allowlist guards, audit events, focused e2e coverage, and Gate 1 wiring remain aligned (2026-06-25)
- `npm run qa:image-proxy-policy`: PASS — image proxy HTTPS allowlist, DNS/private-address rejection, redirect revalidation, raster content-type and byte limits, deterministic cache headers, and host-only failure logging remain aligned (2026-06-25)
- `npm run qa:deploy-scripts`: PASS — beta/prod deploy scripts are syntax-checked, commercial repo gates and Gate 1 local evidence include them, Docker runtime preflight wiring is enforced, and beta/prod smoke checks cover health, auth, metrics, no-store, backup, restore, and compose operations (2026-07-01)
- `npm run qa:docker-runtime:self-test`: PASS — fake Docker CLI self-test verifies config-only PASS, build-mode PASS, Docker version BLOCKED, invalid boolean failure, and Docker report redaction behavior (2026-07-01)
- `npm run qa:docker-runtime`: BLOCKED locally — report `tmp/docker-runtime/docker-runtime-preflight-20260701T120857Z.md` records Docker CLI/WSL socket availability as an environment blocker, not a product failure. Release approval still requires `DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime` on a Docker-enabled release runner.
- `DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime`: not run — requires Docker-enabled release runner with `.env.prod`; copy the redacted `tmp/docker-runtime/docker-runtime-preflight-*.md` PASS summary here before approval.
- `npm run qa:owner-invariants`: PASS — `UserWorkRecord.userId` is required, cascades from the owning user, and owner-invariant docs/tests/gates remain aligned (2026-06-25)
- `npm run qa:log-redaction-policy`: PASS — HTTP request URL query/fragment stripping, auth/cookie/set-cookie header redaction, security audit metadata key dropping, inline OAuth/token key-value redaction, and regression tests align (2026-06-26)
- `npm run qa:operator-safety`: PASS — destructive/operational dry-run flags for retention cleanup and import provider circuit clearing reject invalid boolean values before state is counted, read, deleted, or cleared (2026-06-25)
- `npm run qa:compose-hardening`: PASS — production compose application services are read-only and capability-dropped, all production services are resource-bounded, and stateful services remain internal (2026-06-20)
- `npm run qa:auth-session-policy`: PASS — refresh and OAuth cookie scope/security policy, tests, docs, and commercial gate wiring align (2026-06-20)
- `npm run qa:oauth-policy`: PASS — Google-only login, disabled legacy password routes, OAuth return-origin allowlist, flow cookie/state validation, token/code log-safety tests, docs, and commercial gate wiring align (2026-06-25)
- `npm run qa:backup-restore-policy`: PASS — backup creation, checksum verification, restore drill confirmation, redacted reporting, and evidence docs align (2026-06-20)
- `npm run qa:secure-sdlc-policy`: PASS — vulnerability triage SLA, high/critical production audit gate, lockfile patch pins, scan ledger, and waiver contract remain aligned (2026-06-25)
- `npm run qa:public-boundary`: PASS — default-private public/share boundary check passed (2026-06-20)
- `npm run qa:retention-policy`: PASS — retention cleanup targets, operational docs, historical client metadata policy, and backup sensitivity policy align with current code (2026-06-20)
- `npm run qa:user-data-rights-policy`: PASS — authenticated server-side user data export, count-only account deletion preview, account deletion, rejected-confirmation audit, omitted sensitive fields, retained-record anonymization, and bounded user data rights metrics align with current code (2026-06-21)
- `npm run qa:account-deletion-rehearsal`: PASS — dry-run verifies the destructive disposable-account rehearsal guard, preview-first order, production client header, and post-delete token invalidation check contract (2026-06-26)
- `npm run qa:commercial:repo`: PASS — repository-verifiable commercial gates passed in non-strict Gate 1 mode; live evidence placeholders remain (2026-07-01)
- `npm run qa:import-search`: PASS — report `tmp/import-search-qa/import-search-qa-20260701T123411Z.md`, 28 offline matrix cases plus live-smoke manifest coverage
- `IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search`: not run — requires beta host base URL and disposable authenticated token; copy the redacted live `tmp/import-search-qa/import-search-qa-*.md` PASS summary here before approval.
- `npm run qa:sync-load`: PASS — report `tmp/sync-load/sync-load-smoke-20260701T123414Z.md`, dry-run synthetic payload validation
- `SYNC_LOAD_DRY_RUN=false npm run qa:sync-load`: not run — requires beta host base URL and disposable authenticated token; copy the redacted live `tmp/sync-load/sync-load-smoke-*.md` PASS summary here before approval.
- `npm run test:e2e:web`: PASS — 17 Playwright tests passed and 3 skipped across chromium and mobile-chrome with `WEB_E2E_PORT=19998` (2026-07-01)
- `npm run test:e2e`: PASS — API e2e 4 suites / 47 tests passed locally (2026-06-24); beta-host smoke evidence remains separate below
- `docker compose -f compose.prod.yml --env-file .env.prod config`: not run — requires .env.prod

## GitHub Controls

- Branch protection enabled for `master`: not verified — check GitHub Settings > Branches
- Required checks: not verified — should require `validate` workflow to pass
- CodeQL result: workflow present (.github/workflows/codeql.yml); runs on push/PR/weekly schedule — confirm no alert backlog in GitHub Security tab
- Dependabot enabled: config present (.github/dependabot.yml) — npm + github-actions, weekly Monday 09:00 KST — confirm enabled in GitHub Settings > Code security
- Production npm audit high/critical gate: PASS — local `npm run security:audit:prod:high` passed on 2026-06-24 with `multer@2.2.0`, `undici@7.28.0`, and `js-yaml@5.1.0`; local `npm audit` reports 0 vulnerabilities; high or critical release runner rerun still required before approval
- Secret scanning enabled: not verified — enable in GitHub Settings > Code security > Secret scanning
- Push protection enabled: not verified — enable alongside secret scanning
- Vulnerability waivers: none; local npm audit reports 0 vulnerabilities, and release-runner rerun is still required before approval

## Host Preflight And Smoke

- `scripts/deploy/beta-preflight.sh`:
- Migration command:
- API/web startup:
- `scripts/deploy/beta-smoke.sh`:
- `/health`:
- `/livez`:
- `/readyz`:
- `/metrics` public unauthenticated exposure result:
- `/metrics` internal collector bearer-token result:
- Google OAuth start flow cookie attributes:
- Google OAuth login/logout:
- User data rights smoke (`npm run qa:user-data-rights-smoke` live report):
- Guest JSON export/import:
- Guest-to-account transfer review:
- Authenticated sync push/pull:
- Sync conflict resolution:
- Import provider failure fallback:

## Metrics And Alerts

- `npm run qa:alerts`: PASS — 13 Prometheus alert rules validated locally (2026-06-21)
- `npm run qa:slo`: PASS — 7 SLO recording rules and 5 SLO alerts validated locally (2026-06-20)
- `npm run qa:dashboards`: PASS — Grafana dashboard validated locally with 16 panels (2026-06-21)
- `npm run qa:monitoring` report: PASS — dry-run report `tmp/monitoring-evidence/monitoring-evidence-20260701T123415Z.md` generated locally (2026-07-01)
- Alert rule file deployed:
- SLO rule file deployed:
- Grafana dashboard file deployed:
- Grafana dashboard UID:
- Prometheus/collector target for `/metrics`:
- Alertmanager or notification channel:
- API availability SLO 30d:
- API latency p95 SLO 30d:
- Auth refresh success SLO 30d:
- Sync success SLO 30d:
- Import search success SLO 30d:
- Public unauthenticated `/metrics` result:
- Internal collector `/metrics` result:
- Alert/SLO/dashboard waivers or threshold/target/query changes:

## Backup And Restore Drill

- Restore drill plan-only report (pre-review only; not approval evidence): PASS — `tmp/restore-drills/restore-drill-plan-20260701T123410Z.md` generated locally without Docker, `pg_restore`, migrations, startup, smoke, or destructive restore commands (2026-07-01)
- Backup command (`npm run ops:backup`):
- Backup report (`tmp/backups/prod-backup-*.md` summary only):
- Backup file identifier:
- Backup checksum sidecar (`.sha256`):
- Backup verification command (`npm run ops:backup:verify`):
- Backup verification report (`tmp/backups/prod-backup-verify-*.md` summary only):
- Backup off-host copy location:
- Restore drill command (`npm run ops:restore-drill` with `RESTORE_DRILL_CONFIRM=restore-disposable-target`):
- Restore target (must be disposable/non-production):
- Restore drill report (`tmp/restore-drills/restore-drill-*.md` summary only):
- Restore start/end time:
- Observed RPO:
- Observed RTO:
- Post-restore `/readyz`:
- Post-restore sync smoke:
- Gaps found:

## Smoke-Level Performance Baseline

Run `npm run qa:performance-smoke` against the beta host and copy p50/p95,
budget status, status codes, and rate-limit header summaries from the generated
`tmp/performance-smoke/performance-smoke-*.md` summary. If a metric is not
measured, write `not measured` and explain why.

- Performance smoke command:
- Performance smoke report:
- Authenticated disposable account used for sync timing: yes/no/not available

| Scenario                                |          p50 |          p95 | Budget status | Rate-limit headers | Notes              |
| --------------------------------------- | -----------: | -----------: | ------------- | ------------------ | ------------------ |
| `GET /readyz`                           | not measured | not measured | not measured  | not measured       | beta host required |
| `POST /api/auth/refresh` without cookie | not measured | not measured | not measured  | not measured       | beta host required |
| Google OAuth login callback             | not measured | not measured | not measured  | not measured       | beta host required |
| Sync push small batch                   | not measured | not measured | not measured  | not measured       | beta host required |
| Sync pull small archive                 | not measured | not measured | not measured  | not measured       | beta host required |
| Import provider status                  | not measured | not measured | not measured  | not measured       | beta host required |
| Web `/work-archive-config.js`           | not measured | not measured | not measured  | not measured       | beta host required |

Sync load dry-run (local, no API calls): PASS — run ID 20260701T123414Z-dbc2f428, 1000 synthetic records, 5 batches generated, status PASS. Live run requires beta host + disposable authenticated account.

## Decision

- Public beta approved:
- Approver:
- Follow-up blockers:
- Follow-up non-blockers:
