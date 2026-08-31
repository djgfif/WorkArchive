# Public Beta Gate 1 Evidence

Status: partial — core local code-completion gates passed 2026-08-04; host/beta environment items pending; older policy gates remain recorded with their individual run dates.

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

## Open Evidence Classification

Classification key: `A` = code/script can resolve locally, `B` =
runbook/evidence template needs documentation, `C` = beta host, GitHub Settings,
release runner, restore target, or disposable account evidence is required.

| Area                          | Open item                                                                                                               | Class | Current handling                                                                                            | Required evidence before approval                                                                                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker runtime                | `DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime`                                                                   | C     | Local development Compose was healthy on 2026-08-04; this is not production release-runner approval evidence. | Docker-enabled release runner PASS report with `- Mode: config-and-build`, production image build PASS, and redacted `tmp/docker-runtime/docker-runtime-preflight-*.md` summary.                                          |
| Production compose config     | `docker compose -f compose.prod.yml --env-file .env.prod config`                                                        | C     | Repository validates compose hardening and script syntax; real `.env.prod` is intentionally absent locally. | Release runner or beta host command result tied to the release commit and production env file.                                                                                                                               |
| GitHub controls               | Branch protection, required checks, CodeQL, Dependabot, secret scanning, push protection                                | C     | `master` protection and required `verify`, `integration`, and `CodeQL` checks are enabled; remaining security settings still need operator evidence. | GitHub Settings/Security tab review for the release commit, including secret scanning, push protection, Dependabot state, and any explicit waiver owner/expiry.                                                               |
| Beta host preflight and smoke | Health, readiness, auth refresh, OAuth start cookie, no-store headers, metrics exposure, provider readiness, sync smoke | C     | `qa:deploy-scripts` verifies script coverage; no beta URL is assigned in this ledger.                       | `scripts/deploy/commercial-beta-rehearsal.sh .env.prod` or targeted `beta-preflight.sh` plus `BETA_BASE_URL=<beta-url> beta-smoke.sh` PASS summary, including public `/metrics` 404 and internal collector 200 when enabled. |
| Live import/search QA         | `IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search`                                                                   | C     | Local credential-free live smoke passed on 2026-08-04; beta/staging authenticated evidence remains open.   | Live PASS report against beta/staging with explicit base URL and disposable authenticated token; copy only the redacted `tmp/import-search-qa/import-search-qa-*.md` summary.                                                |
| Live sync load QA             | `SYNC_LOAD_DRY_RUN=false npm run qa:sync-load`                                                                          | C     | Dry-run synthetic payload validation passes locally.                                                        | Live PASS report against a disposable authenticated account with `SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true`, 1000 synthetic records, zero conflicts/failures, and oversized batch DTO rejection.                                |
| Monitoring deployment         | Alert/SLO/dashboard deployment and live `/metrics` collection                                                           | C     | Alert, SLO, dashboard, and dry-run monitoring artifacts validate locally.                                   | Deployed rule/dashboard identifiers, collector target, public `/metrics` 404, internal collector 200, and live `npm run qa:monitoring` PASS report.                                                                          |
| Backup/restore drill          | Production-sized backup, off-host copy, disposable restore, post-restore smoke                                          | C     | Plan-only restore report is pre-review only and not approval evidence.                                      | `ops:backup`, `ops:backup:verify`, off-host copy identifier, and `RESTORE_DRILL_CONFIRM=restore-disposable-target npm run ops:restore-drill` PASS report with observed RPO/RTO and post-restore `/readyz`/sync smoke.        |
| Performance baseline          | Beta-host p50/p95 and rate-limit header observations                                                                    | C     | Dry-run script path exists; all measured rows remain beta-host pending.                                     | Live `npm run qa:performance-smoke` report with p50/p95, budget status, status codes, and rate-limit header summaries for required scenarios.                                                                                |
| Release metadata and approval | Public beta URL, release notes, decision, approver, blockers                                                            | C     | Ledger remains partial until the operator fills release-specific values.                                    | Final operator approval after `GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence` passes.                                                                                                                                 |
| Runbook/template clarity      | Operator commands, expected results, failure triage, and redaction rules                                                | B     | Maintained in `GATE_1_VALIDATION_RUNBOOK.md`; update it when a required evidence format changes.            | Documentation review plus `npm run check:docs-links` and non-strict `npm run qa:gate1:evidence` after edits.                                                                                                                 |
| Local repository gates        | Security, docs, lint, typecheck, tests, build, local QA policy checks                                                   | A     | Core individual local PASS results were refreshed on 2026-08-04; policy-specific QA rows retain their own run dates. | Fresh release-commit PASS summaries from `npm run qa:gate1:local` or the individual commands listed below.                                                                                                            |

## Release Candidate

- Date and timezone: 2026-08-03 KST (core local verification run; policy-specific QA rows retain individual dates)
- Commit SHA: 00c8a76c628e71c4a6c83c1b3dc7f031194ad81d (clean working tree)
- Host or environment: local development (repository gates only; beta host pending)
- Operator: gkho0 (Codex-assisted local run)
- Public beta URL: not yet assigned
- Release notes or ticket:

## Repository Gates

- `GATE1_RUN_NPM_CI=0 npm run qa:gate1:local`: PASS — no local check failures; report `tmp/gate1-evidence/gate1-local-20260803T073657Z.md`. Dependency reinstall was intentionally not run, and environment-only evidence remains blocked/manual (2026-08-03).
- `npm ci`: not run — skipped explicitly with `GATE1_RUN_NPM_CI=0`; existing lockfile-installed Node 22.22.3 / npm 10.9.8 environment was used.
- `npm run security:public`: PASS — public readiness and secret leak checks passed (2026-08-04)
- `npm run check:docs-links`: PASS — all markdown local links valid (2026-08-04)
- `npm run check:web-i18n`: PASS — web i18n hardcoding check passed; Korean UI literals remain confined to approved resource/parser/helper files (2026-08-04)
- `npm run lint`: PASS — no ESLint errors across web/api/shared-types (2026-08-04)
- `npm run typecheck`: PASS — no TypeScript errors (2026-08-04)
- `npm run test`: PASS — API 92 suites / 770 tests, web 75 files / 489 tests, and shared-types 2 files / 6 tests passed; 1,265 tests total (2026-08-04)
- `npm run build`: PASS — shared-types `tsc`, API `tsc`, web Vite production build; largest JavaScript chunk 568,218 bytes against the 650,000-byte limit (2026-08-04)
- `npm run check:web-boundaries`: PASS — no web feature boundary violations found (2026-08-04)
- `npm run check:web-import-cycles`: PASS — no web import cycles found (2026-08-04)
- `npm run check:web-i18n-resources`: PASS — web i18n resource parity check passed for ko, en, ja, and zh-CN (2026-08-03)
- `npm run check:web-i18n-packs`: PASS — reviewed translation pack coverage 2482/2482 unique baseline paths (2026-08-03)
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
- `npm run qa:public-boundary`: PASS — default-private public/share boundary check passed after product-direction doc cleanup and Tier Board private-first UI labeling review (2026-07-03)
- `npm run qa:retention-policy`: PASS — retention cleanup targets, operational docs, historical client metadata policy, and backup sensitivity policy align with current code (2026-06-20)
- `npm run qa:user-data-rights-policy`: PASS — authenticated server-side user data export, count-only account deletion preview, account deletion, rejected-confirmation audit, omitted sensitive fields, retained-record anonymization, and bounded user data rights metrics align with current code (2026-06-21)
- `npm run qa:account-deletion-rehearsal`: PASS — dry-run verifies the destructive disposable-account rehearsal guard, preview-first order, production client header, and post-delete token invalidation check contract (2026-06-26)
- `npm run qa:commercial:repo`: PASS — repository-verifiable commercial gates passed in non-strict Gate 1 mode; live evidence placeholders remain (2026-07-01; not rerun in the 2026-07-03 core local verification pass)
- `npm run qa:import-search`: PASS — report `tmp/import-search-qa/import-search-qa-20260701T123411Z.md`, 28 offline matrix cases plus live-smoke manifest coverage
- `IMPORT_SEARCH_QA_LIVE=true IMPORT_QA_BASE_URL=http://127.0.0.1:18730 npm run qa:import-search`: PASS — local development Compose report `tmp/import-search-qa/import-search-qa-20260804T072153Z.md`; fallback safety `1/1`, credential-free provider-quality media types `4`, and all `6` smoke cases passed. A Google Books failure/circuit-open result did not block Open Library/Wikidata/AniList results or manual-add fallback. This is local unauthenticated code-completion evidence only (2026-08-04).
- `IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search` against beta/staging with a disposable authenticated token: not run — copy only the redacted PASS summary here before approval.
- `npm run qa:sync-load`: PASS — run with `SYNC_LOAD_DRY_RUN=true`; report `tmp/sync-load/sync-load-smoke-20260803T073619Z.md`; 1,000 synthetic records and 5 push batches generated without API calls (2026-08-03)
- `SYNC_LOAD_DRY_RUN=false npm run qa:sync-load`: not run — requires beta host base URL and disposable authenticated token; copy the redacted live `tmp/sync-load/sync-load-smoke-*.md` PASS summary here before approval.
- `npm run test:e2e:web`: PASS — 23 Playwright tests passed and 3 project-conditional cases skipped across chromium and mobile-chrome (2026-08-04)
- `npm run test:e2e`: PASS — API e2e 4 suites / 47 tests passed locally (2026-06-24); beta-host smoke evidence remains separate below
- `docker compose --env-file .env.compose up --build -d`: PASS — local development web/API/PostgreSQL containers healthy and API `/readyz` returned 200 (2026-08-04). This does not satisfy `.env.prod` production compose or Docker-enabled release-runner evidence.
- `docker compose -f compose.prod.yml --env-file .env.prod config`: not run — requires .env.prod

## GitHub Controls

- Branch protection enabled for `master`: ENABLED through the GitHub API on 2026-08-31 — strict status checks, administrator enforcement, conversation resolution, and force-push/deletion blocking are active
- Required checks: ENABLED — `verify`, `integration`, and `CodeQL`; a failing or pending required check blocks merge
- CodeQL result: PASS for PR #73 on 2026-08-31; workflow runs on push/PR/weekly schedule — alert backlog still requires confirmation in the GitHub Security tab
- Dependabot enabled: config present (.github/dependabot.yml) — npm + github-actions, weekly Monday 09:00 KST — confirm enabled in GitHub Settings > Code security
- Production npm audit high/critical gate: PASS — local `npm run security:audit:prod:high` passed on 2026-06-24 with `multer@2.2.0`, `undici@7.28.0`, and `js-yaml@5.1.0`; local `npm audit` reports 0 vulnerabilities; high or critical release runner rerun still required before approval
- Secret scanning enabled: not verified — enable in GitHub Settings > Code security > Secret scanning
- Push protection enabled: not verified — enable alongside secret scanning
- Vulnerability waivers: none; local npm audit reports 0 vulnerabilities, and release-runner rerun is still required before approval

## Host Preflight And Smoke

- scripts/deploy/beta-preflight.sh: pending — beta host required. Run `ENV_FILE=.env.prod COMPOSE_FILE=compose.prod.yml scripts/deploy/beta-preflight.sh`; expected evidence is PASS/FAIL, timestamp, release commit, env file name only, and any blocker without secret values.
- Migration command: pending — run either `BETA_BASE_URL=<beta-url> scripts/deploy/commercial-beta-rehearsal.sh .env.prod` or targeted `docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate`; expected evidence is exit status, migration profile, and rollback/previous-image command if used.
- API/web startup: pending — from the rehearsal `docker compose ... up -d --build` and `scripts/deploy/prod-healthcheck.sh`; expected evidence is API/web container health, release image refs or digests, and startup PASS/FAIL.
- scripts/deploy/beta-smoke.sh: pending — run `BETA_BASE_URL=<beta-url> EXPECT_GOOGLE_OAUTH_CONFIGURED=true scripts/deploy/beta-smoke.sh`; expected evidence is redacted PASS/FAIL summary only.
- /health: pending — beta smoke must record HTTP status and `Cache-Control: no-store`.
- /livez: pending — beta smoke must record HTTP status and `Cache-Control: no-store`.
- /readyz: pending — beta smoke must record HTTP status, `Cache-Control: no-store`, and readiness body status without secrets.
- `/metrics` public unauthenticated exposure result: pending — beta smoke must record public HTTP status, expected `404`.
- `/metrics` internal collector bearer-token result: pending — record internal collector status, expected `200` only when metrics are enabled and the request comes from the reviewed internal path; do not paste the bearer token.
- Google OAuth start flow cookie attributes: pending — record whether OAuth start sets `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/api/auth/google`; do not paste cookie values.
- Auth refresh smoke: pending — record `POST /api/auth/refresh` status for the expected unauthenticated/guarded path plus no-store headers; do not paste cookies or tokens.
- Google OAuth login/logout: pending — run with a disposable account or approved OAuth test flow; record only redirect/status/cookie-attribute summary.
- No-store header checks: pending — beta smoke must summarize normal `/api/*`, auth, health, livez, readyz, and metrics cache policy.
- Provider readiness: pending — beta smoke or live import/search QA must record provider readiness status counts and configured credential mode summary.
- User data rights smoke (`npm run qa:user-data-rights-smoke` live report): pending — run `USER_DATA_RIGHTS_SMOKE_LIVE=true USER_DATA_RIGHTS_SMOKE_BASE_URL=<beta-url> npm run qa:user-data-rights-smoke` after setting `USER_DATA_RIGHTS_SMOKE_ACCESS_TOKEN` in the operator shell; copy only the redacted report summary.
- Guest JSON export/import: pending — beta smoke/manual browser run must record guest export, import preview, and confirm/cancel behavior without committing backup contents.
- Guest-to-account transfer review: pending — disposable account run must record that guest records remain intact if transfer is cancelled and that duplicate preview/import summary is visible.
- Authenticated sync push/pull: pending — disposable account run must record push/pull status, queue counts, and no raw payloads.
- Sync conflict resolution: pending — disposable account run must record conflict row visibility and local/remote/manual action availability; conflict payloads stay out of the ledger.
- Import provider failure fallback: pending — beta smoke or manual run must record provider-unavailable handling and visible manual-add fallback.

## Metrics And Alerts

- `npm run qa:alerts`: PASS — 13 Prometheus alert rules validated locally (2026-06-21)
- `npm run qa:slo`: PASS — 7 SLO recording rules and 5 SLO alerts validated locally (2026-06-20)
- `npm run qa:dashboards`: PASS — Grafana dashboard validated locally with 16 panels (2026-06-21)
- `npm run qa:monitoring` report: pending live evidence — current report `tmp/monitoring-evidence/monitoring-evidence-20260701T123415Z.md` is dry-run only and does not approve public beta. Run `MONITORING_PROMETHEUS_URL=<url> MONITORING_GRAFANA_URL=<url> MONITORING_PUBLIC_BASE_URL=<beta-url> MONITORING_INTERNAL_METRICS_URL=<internal-metrics-url> npm run qa:monitoring` after rules/dashboard deployment.
- Alert rule file deployed: pending — record deployed `docs/operations/monitoring/work-archive-alerts.yml` version, target stack, timestamp, and PASS/FAIL import status.
- SLO rule file deployed: pending — record deployed `docs/operations/monitoring/work-archive-slo-rules.yml` version, target stack, timestamp, and PASS/FAIL import status.
- Grafana dashboard file deployed: pending — record deployed `docs/operations/monitoring/work-archive-grafana-dashboard.json` version, folder, datasource, and import status.
- Grafana dashboard UID: pending — copy the UID from Grafana after import; do not use a guessed UID.
- Prometheus/collector target for `/metrics`: pending — record collector job/target label and internal path only; no bearer token.
- Alertmanager or notification channel: pending — record channel name, route status, and test notification result without recipient personal data.
- API availability SLO 30d: pending — copy `work_archive:slo_api_availability:ratio_30d` value from live monitoring report.
- API latency p95 SLO 30d: pending — copy `work_archive:slo_api_latency:p95_30d` value from live monitoring report.
- Auth refresh success SLO 30d: pending — copy `work_archive:slo_auth_refresh_success:ratio_30d` value from live monitoring report.
- Sync success SLO 30d: pending — copy `work_archive:slo_sync_success:ratio_30d` value from live monitoring report.
- Import search success SLO 30d: pending — copy `work_archive:slo_import_search_success:ratio_30d` value from live monitoring report.
- Public unauthenticated `/metrics` result: pending — expected `404` from `MONITORING_PUBLIC_BASE_URL`.
- Internal collector `/metrics` result: pending — expected `200` from `MONITORING_INTERNAL_METRICS_URL` only when collector bearer token is configured in the operator shell.
- Alert/SLO/dashboard waivers or threshold/target/query changes: pending — record owner, expiry, changed query/threshold, and next retest command for any waiver; write `none` only after review.

## Backup And Restore Drill

- `RESTORE_DRILL_PLAN_ONLY=true npm run ops:restore-drill` (pre-review only; not approval evidence): PASS — `tmp/restore-drills/restore-drill-plan-20260803T073637Z.md` generated locally without Docker, `pg_restore`, migrations, startup, smoke, or destructive restore commands (2026-08-03)
- Backup command (`npm run ops:backup`): pending — run `BACKUP_DIR=backups npm run ops:backup` on the approved host; copy command, timestamp, exit status, and redacted summary only.
- Backup report (`tmp/backups/prod-backup-*.md` summary only): pending — copy the generated report path and status; do not commit or paste dump contents.
- Backup file identifier: pending — record opaque backup filename/object key and creation timestamp; do not include storage credentials.
- Backup checksum sidecar (`.sha256`): pending — record checksum sidecar filename and verification status, not raw backup contents.
- Backup verification command (`npm run ops:backup:verify`): pending — run `BACKUP_FILE=<backup-file> npm run ops:backup:verify` before off-host copy is accepted.
- Backup verification report (`tmp/backups/prod-backup-verify-*.md` summary only): pending — copy status, pg_restore/list verification summary, and report path.
- Backup off-host copy location: pending — record approved storage location identifier and copy verification status; no signed URLs or credentials.
- Restore drill command (`npm run ops:restore-drill` with `RESTORE_DRILL_CONFIRM=restore-disposable-target`): pending — run `RESTORE_DRILL_CONFIRM=restore-disposable-target BACKUP_FILE=<backup-file> ENV_FILE=.env.restore RESTORE_DRILL_BASE_URL=<restore-url> npm run ops:restore-drill`.
- Restore target (must be disposable/non-production): pending — record target name/URL class and confirmation that it does not share production DATABASE_URL, Redis state, OAuth redirect credentials, or public DNS.
- Restore drill report (`tmp/restore-drills/restore-drill-*.md` summary only): pending — copy redacted PASS/FAIL summary and report path; plan-only reports do not count.
- Restore start/end time: pending — record UTC start/end timestamps from the drill.
- Observed RPO: pending — calculate from backup timestamp to restore source point.
- Observed RTO: pending — calculate from restore start to post-restore smoke PASS.
- Post-restore `/readyz`: pending — record HTTP status/body summary from disposable target.
- Post-restore sync smoke: pending — run beta smoke or sync smoke against the disposable target with a disposable account; no raw payloads.
- Gaps found: pending — record `none` only after a completed restore drill review, otherwise list failed step, suspected cause, rollback/recreate action, and next retest command.

## Smoke-Level Performance Baseline

Run `npm run qa:performance-smoke` against the beta host and copy p50/p95,
budget status, status codes, and rate-limit header summaries from the generated
tmp/performance-smoke/performance-smoke-\*.md summary. If a metric is not
measured, write `not measured` and explain why.

- Performance smoke command: pending — run `PERF_SMOKE_BASE_URL=<beta-url> PERF_SMOKE_ALLOWED_ORIGIN=<beta-url> PERF_SMOKE_DISPOSABLE_ACCOUNT_ACK=true npm run qa:performance-smoke` after setting `PERF_SMOKE_ACCESS_TOKEN` in the operator shell; leave latency caps unset for the first baseline unless a release owner has approved budgets.
- Performance smoke report: pending — copy redacted tmp/performance-smoke/performance-smoke-\*.md summary with p50/p95, budget status, HTTP status codes, and rate-limit header summaries.
- Authenticated disposable account used for sync timing: pending — record `yes` only for a disposable account with explicit acknowledgement; otherwise record why sync rows remain not measured.

| Scenario                                |          p50 |          p95 | Budget status | Rate-limit headers | Notes              |
| --------------------------------------- | -----------: | -----------: | ------------- | ------------------ | ------------------ |
| `GET /readyz`                           | not measured | not measured | not measured  | not measured       | beta host required |
| `POST /api/auth/refresh` without cookie | not measured | not measured | not measured  | not measured       | beta host required |
| Google OAuth login callback             | not measured | not measured | not measured  | not measured       | beta host required |
| Sync push small batch                   | not measured | not measured | not measured  | not measured       | beta host required |
| Sync pull small archive                 | not measured | not measured | not measured  | not measured       | beta host required |
| Import provider status                  | not measured | not measured | not measured  | not measured       | beta host required |
| Web `/work-archive-config.js`           | not measured | not measured | not measured  | not measured       | beta host required |

Sync load dry-run (local, no API calls): PASS — run ID 20260803T073619Z-f48f0c30, 1,000 synthetic records, 5 batches generated, status PASS. Live run requires beta host + disposable authenticated account.

## Decision

- Public beta approved:
- Approver:
- Follow-up blockers:
- Follow-up non-blockers:
