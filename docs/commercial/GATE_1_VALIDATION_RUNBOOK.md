# Gate 1 Validation Runbook

Last updated: 2026-06-28

Gate 1 evidence must be copied from commands that actually ran. Leave an item
`not run`, `blocked`, or `manual` when the required environment is unavailable.

## Evidence Classification

Use the same A/B/C classification as
[`PUBLIC_BETA_GATE_1_EVIDENCE.md`](./PUBLIC_BETA_GATE_1_EVIDENCE.md):

- `A`: code or script work that can be resolved and re-run locally in this
  repository.
- `B`: documentation, runbook, or evidence-template clarity that can be fixed
  locally but does not prove the external system.
- `C`: evidence that requires a beta host, GitHub Settings access, release
  runner, restore target, monitoring stack, or disposable authenticated account.

Do not convert a `C` item to PASS from repository files alone. A local dry-run,
syntax check, or policy validator can prove that the automation is wired, but
the ledger must still show the external item as pending until the real command
or manual setting check ran in the named environment.

## Operator Checklist

- Expert feedback scope: run the accepted search, sync, API-boundary, and
  operational evidence gates below. Do not treat mobile, Tauri, new locale
  expansion, public community, social recommendation, or open-source licensing
  as Gate 1 blockers. Existing enabled locale integrity remains a local
  repository gate through the i18n checks below.
- Release runner security scans: run `npm run security:audit:prod`,
  `npm run security:audit`, `npm run security:scan:fs`, and
  `npm run security:scan:images` with immutable image refs; record only tool
  versions, timestamps, image refs, status, and summary counts.
- Beta host preflight/smoke: prefer
  `BETA_BASE_URL=<beta-url> scripts/deploy/commercial-beta-rehearsal.sh .env.prod`
  so the release migration, stack build/up, production healthcheck, beta smoke,
  and retention dry-run run together. For targeted reruns, run
  `scripts/deploy/beta-preflight.sh` with real `.env.prod`, then
  `BETA_BASE_URL=<beta-url> scripts/deploy/beta-smoke.sh`; verify public
  unauthenticated `/metrics` returns `404` and API security headers survive the
  deployed proxy path. The smoke script redacts URL userinfo, bearer/basic
  credentials, secret-like env values, and sensitive query parameters from its
  displayed diagnostics, but operators must still copy only curated summary
  lines into the evidence ledger.
- Deploy script gate: run `npm run qa:deploy-scripts` before host rehearsal so
  every beta/prod deploy script is syntax-checked and the smoke scripts still
  cover health, auth, metrics, no-store, backup, restore, and compose checks.
- Docker runtime preflight: run `npm run qa:docker-runtime` on the local machine
  or release runner to produce a redacted Docker CLI/Compose/env/config report.
  Run `npm run qa:docker-runtime:self-test` first to verify PASS, BLOCKED,
  build-mode, boolean parsing, and redaction behavior with a fake Docker CLI.
  On the Docker-enabled release runner, rerun with
  `DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime` to add production image
  build evidence. A `BLOCKED` report documents an environment blocker, not a
  product pass.
- Metrics/alerts/SLO/dashboard: run `npm run qa:alerts`, `npm run qa:slo`, and
  `npm run qa:dashboards`, then deploy
  `docs/operations/monitoring/work-archive-alerts.yml` to the monitoring system
  along with `docs/operations/monitoring/work-archive-slo-rules.yml`, and
  import `docs/operations/monitoring/work-archive-grafana-dashboard.json` into
  Grafana only after `/metrics` access is internally restricted. Then run
  `npm run qa:monitoring` against the real Prometheus/Grafana endpoints and
  copy only redacted summary rows into the evidence ledger.
- Live provider QA: run `IMPORT_SEARCH_QA_LIVE=true npm run qa:import-search`
  against beta/staging with an explicit base URL and disposable test account
  token; do not commit raw provider responses.
- Live sync load: run `SYNC_LOAD_DRY_RUN=false npm run qa:sync-load` only
  against a disposable authenticated account with
  `SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true`; do not commit raw sync payloads.
- Smoke performance baseline: run `npm run qa:performance-smoke` against the
  beta host; authenticated sync timings require a disposable account token and
  explicit acknowledgement.
- Prisma migration safety: run `npm run qa:migrations`; any high-risk SQL must
  have an approved entry in
  `docs/operations/MIGRATION_RISK_REGISTER.md` before the release candidate is
  approved.
- Backup/restore drill: create a production-sized PostgreSQL backup with
  `npm run ops:backup`, verify it with `npm run ops:backup:verify`, copy it
  off-host, restore once into a non-production target, and record observed
  RPO/RTO plus post-restore `/readyz` and sync smoke.
- GitHub Settings controls: verify branch protection, required checks, CodeQL,
  Dependabot, secret scanning, push protection, and any waivers in GitHub
  Settings for the release commit.
- Final evidence validation: after the operator ledger is filled, run
  `GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence`; a public beta approval
  is blocked while this command reports placeholders, dry-run-only evidence,
  missing live host checks, or missing approver fields.

## Execution Order

1. Start from a clean release-candidate commit.
2. Run local repository gates:

   ```bash
   npm run qa:gate1:local
   ```

   The local helper also runs the enabled-locale i18n gates (`check:web-i18n`,
   `check:web-i18n-resources`, and `check:web-i18n-packs`). These are required
   because Korean UI copy and reviewed locale resources are part of the current
   public beta surface even when new locale expansion is out of scope.

   For CI and faster local release-candidate checks,
   `npm run qa:commercial:repo` validates the repository-verifiable commercial
   artifacts: deployment script syntax, migration risk registration,
   alert/SLO/dashboard artifacts, monitoring dry-run report generation, and the
   non-strict Gate 1 evidence placeholder scan.

3. Run focused import/search QA:

   ```bash
   npm run qa:import-search
   ```

4. Run sync load payload validation in dry-run mode:

   ```bash
   npm run qa:sync-load
   ```

5. Run web Playwright E2E only when the local/browser runtime is available:

   ```bash
   npm run test:e2e:web
   ```

   If browser dependencies are unavailable, record `not run` with the missing
   runtime reason. Do not infer failure of the product from a missing local
   Playwright browser dependency. In Codex sandboxed sessions, Vite may fail
   before tests start with
   `listen EPERM: operation not permitted 127.0.0.1:18730`; rerun outside the
   sandbox before recording product failure. If a stale local Vite server is
   already bound to the default port, run the same suite on a free port:

   ```bash
   WEB_E2E_PORT=19998 npm run test:e2e:web
   ```

6. On the release runner, run dependency/container security scans.
7. Validate Prisma migration safety with `npm run qa:migrations`.
8. Validate alert rules with `npm run qa:alerts`, SLO rules with
   `npm run qa:slo`, and the Grafana dashboard with `npm run qa:dashboards`.
9. Run Docker runtime preflight self-test, then the runtime preflight. On the
   release runner, include the production image build:

   ```bash
   npm run qa:docker-runtime:self-test
   DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime
   ```

10. On the beta host, run the commercial beta rehearsal, or run production env
    preflight and beta smoke as targeted reruns.
11. After monitoring deployment, run `npm run qa:monitoring` against the real
    Prometheus/Grafana endpoints.
12. With GitHub Settings access, verify branch protection, required checks,
    CodeQL, Dependabot, secret scanning, and push protection.
13. With backup/restore access, perform the restore drill into a non-production
    target.
14. With a disposable authenticated test account, run live import/search QA,
    live sync load validation, and smoke performance baseline.
15. Copy only summary results into
    `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.
16. Run the final strict evidence validator:

    ```bash
    GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence
    ```

## Local Checks

The local helper records command, exit code, timestamp, git commit, dirty status,
and a redacted output summary. The report redacts workspace paths, hostnames,
secret-like environment values, bearer/basic credentials, database and Redis URL
userinfo, HTTP(S) URL userinfo, and sensitive query parameters such as OAuth
codes, authorization codes, state values, nonce values, access tokens, ID
tokens, refresh tokens, session values, credentials, cookies, API keys,
passwords, and secrets. The same names are redacted when they appear as
standalone `key=value` diagnostic fragments:

```bash
npm run qa:gate1:local
```

It runs local/repository-verifiable checks such as `npm ci`,
`npm run security:public`, docs links, i18n hardcoding/resource/pack parity,
lint, typecheck, tests, e2e, build, script syntax checks, Prisma migration
safety, Gate 1 evidence placeholder
detection in non-strict mode, offline import/search QA, sync load dry-run,
performance smoke dry-run, monitoring evidence dry-run, Docker runtime preflight
report generation, and Docker compose config only when Docker and `.env.prod`
are available. It does not run beta host, GitHub Settings, restore drill, Trivy
image, or live provider checks.

The GitHub `validate` workflow runs `npm run qa:commercial:repo`, so
repository-verifiable commercial artifacts cannot drift silently between manual
release rehearsals.

Backup, backup verification, and restore-drill reports use the same sensitive
URL, credential, and standalone `key=value` redaction rules before their
summaries are copied into the ledger.
Backticked local report references in the evidence ledger must point to regular
`tmp/**/*.md` files inside this workspace, not symlinks, and each referenced
report must be non-empty and at most 1 MiB. Copy curated summaries into the
ledger instead of linking or pasting large raw logs. The strict validator also
scans referenced report contents for raw bearer/basic credentials, URL userinfo,
database/Redis credential URLs, secret-like environment values, and sensitive
standalone `key=value` fragments.

Generated reports are written to `tmp/gate1-evidence/` unless
`GATE1_EVIDENCE_DIR` is set. For a faster rerun that keeps the existing
dependency install, use:

```bash
GATE1_RUN_NPM_CI=0 npm run qa:gate1:local
```

Generated reports are operator artifacts. Do not commit them wholesale; copy
only curated, redacted summary lines into the evidence ledger when the run is
part of a real release-candidate validation.

The non-strict evidence check:

```bash
npm run qa:gate1:evidence
```

prints missing or placeholder evidence while returning success so local
repository checks can still complete before the beta host exists. Use strict
mode only when deciding whether the release candidate can be approved:

```bash
GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence
```

To group the remaining evidence by operating area and next action while the
ledger is still incomplete, run:

```bash
npm run qa:gate1:missing
```

This report is advisory. It does not approve a release candidate and does not
replace the strict evidence validator.

## Release Runner Checks

Run these on the approved release runner with network access and Trivy
installed:

```bash
npm run security:audit:prod:high
npm run security:audit:prod
npm run security:audit
npm run security:scan:fs
WORK_ARCHIVE_API_IMAGE=<immutable-api-tag-or-digest> \
WORK_ARCHIVE_WEB_IMAGE=<immutable-web-tag-or-digest> \
npm run security:scan:images
```

Record only tool versions, timestamps, image refs, status, and summary counts in
`docs/security/SECURITY_SCAN_RESULTS.md`. Do not paste raw vulnerability reports
or scan payloads.
`security:audit:prod:high` is the high or critical production dependency release
gate. A public beta release requires a PASS result or a time-boxed vulnerability
waiver with reachability, compensating control, owner, expiry, and next retest
command.

## Beta Host Checks

Run with real beta-host `.env.prod` values:

```bash
scripts/deploy/beta-preflight.sh
BETA_BASE_URL=<beta-url> scripts/deploy/beta-smoke.sh
```

The public unauthenticated `/metrics` result must remain `404`. If metrics are
enabled for an internal collector, verify the bearer-token path only from the
reviewed internal network path and never commit the token.

Preferred full rehearsal:

```bash
BETA_BASE_URL=<beta-url> \
EXPECT_GOOGLE_OAUTH_CONFIGURED=true \
scripts/deploy/commercial-beta-rehearsal.sh .env.prod
```

Evidence packet to copy into the ledger:

- preflight command, timestamp, release commit, and PASS/FAIL;
- migration command and status from the `api-migrate` release profile;
- API/web startup status and any rollback command used;
- beta smoke command and PASS/FAIL;
- HTTP status and `Cache-Control` summary for `/health`, `/livez`, `/readyz`,
  and normal `/api/*` no-store checks;
- public unauthenticated `/metrics` status, expected `404`;
- internal collector `/metrics` status, expected `200` only from the reviewed
  internal path when metrics are enabled;
- OAuth start cookie attribute summary for `HttpOnly`, `Secure`,
  `SameSite=Lax`, and `Path=/api/auth/google`;
- auth refresh/login/logout smoke result without tokens or cookies;
- provider readiness and import fallback result;
- authenticated disposable-account sync push/pull and conflict review smoke.

If beta preflight fails, stop before starting or migrating the stack unless the
release owner explicitly decides otherwise. If migration or startup fails after
the stack changes, run the documented rollback or previous-image redeploy for
that host, then record the failed step and rollback command in the ledger. If
beta smoke fails, keep the deployment out of public beta approval, capture only
redacted summary lines, and triage by failing family: health/readiness,
headers/cache, auth/OAuth, metrics exposure, provider readiness, or sync.

## Metrics, Alerts, SLOs, And Dashboard

Validate the repository alert rules:

```bash
npm run qa:alerts
```

Validate the repository SLO recording and burn-alert rules:

```bash
npm run qa:slo
```

Validate the repository Grafana dashboard artifact:

```bash
npm run qa:dashboards
```

Validate the monitoring evidence collector shape without live calls:

```bash
MONITORING_EVIDENCE_DRY_RUN=true npm run qa:monitoring
```

Deploy `docs/operations/monitoring/work-archive-alerts.yml` to the beta
Prometheus/Alertmanager stack only after `/metrics` is reachable from the
reviewed internal collector path and hidden from public unauthenticated traffic.
Deploy `docs/operations/monitoring/work-archive-slo-rules.yml` to the same
Prometheus rule path so 30 day SLO records are calculated from beta traffic.
Import `docs/operations/monitoring/work-archive-grafana-dashboard.json` into
the beta Grafana stack from the same reviewed metrics source. Record the alert
rule version, SLO rule version, collector target, dashboard UID, Grafana folder,
notification channel, observed SLO ratios, and any threshold/target/query
waivers in the evidence ledger.

After deployment, collect live monitoring evidence:

```bash
MONITORING_PROMETHEUS_URL=https://prometheus.example.com \
MONITORING_GRAFANA_URL=https://grafana.example.com \
MONITORING_PUBLIC_BASE_URL=https://beta.example.com \
MONITORING_INTERNAL_METRICS_URL=https://internal.example.com/metrics \
npm run qa:monitoring
```

Set bearer-token environment variables only in the operator shell when the
monitoring endpoints require them. The script writes redacted reports to
`tmp/monitoring-evidence/` and verifies expected alert rules, SLO records, SLO
query samples, the Grafana dashboard UID, public `/metrics` hiding when a
public base URL is supplied, and internal collector access when supplied.
Dry-run output is not live monitoring evidence.

## GitHub Settings Checks

Verify and record:

- Branch protection for `master`.
- Required checks.
- Latest CodeQL result for the release commit.
- Dependabot enabled.
- Secret scanning enabled.
- Push protection enabled.
- Any explicit waivers and approver.

These cannot be proven from local repository files alone.

## Provider/Search QA

Offline/static mode is CI-safe and does not call external providers:

```bash
npm run qa:import-search
```

Live mode requires an explicit beta/staging URL and should use a disposable test
account token when authenticated provider coverage is required:

```bash
IMPORT_SEARCH_QA_LIVE=true \
IMPORT_QA_BASE_URL=https://beta.example.com \
IMPORT_QA_ACCESS_TOKEN=<disposable-test-account-token> \
npm run qa:import-search
```

To isolate one provider family during beta triage, filter the live matrix by
fixture provider IDs:

```bash
IMPORT_SEARCH_QA_LIVE=true \
IMPORT_QA_BASE_URL=https://beta.example.com \
IMPORT_QA_ACCESS_TOKEN=<disposable-test-account-token> \
IMPORT_SEARCH_QA_PROVIDERS=aladin,kakao_book,naver_book \
npm run qa:import-search
```

The golden matrix is in `docs/qa/IMPORT_SEARCH_QA_MATRIX.md`. Live provider
results are observations for that run, not permanent truth. By default, the
runner executes a smoke subset of that matrix and writes reports to
`tmp/import-search-qa/`; set `IMPORT_SEARCH_QA_FULL_MATRIX=true` only when the
operator intends to run every matrix case. `IMPORT_SEARCH_QA_PROVIDERS` filters
the selected matrix to cases whose fixture providers match the comma-separated
list.

## User Data Rights Smoke

Dry-run mode validates the non-destructive smoke contract without API calls:

```bash
npm run qa:user-data-rights-smoke
```

Dry-run and live reports are written to `tmp/user-data-rights-smoke/` unless
`USER_DATA_RIGHTS_SMOKE_REPORT_DIR` is set.

Live mode requires a disposable authenticated account token:

```bash
USER_DATA_RIGHTS_SMOKE_LIVE=true \
USER_DATA_RIGHTS_SMOKE_BASE_URL=https://beta.example.com \
USER_DATA_RIGHTS_SMOKE_ACCESS_TOKEN=<disposable-test-account-token> \
npm run qa:user-data-rights-smoke
```

Live PASS verifies `GET /api/auth/data-export` and
`GET /api/auth/account/deletion-preview` return the expected JSON contracts,
`Cache-Control: no-store`, no known secret field names, and no row payload
contents in the deletion preview. The smoke intentionally never calls
`DELETE /api/auth/account`; record destructive account deletion rehearsal only
after a separate disposable-account run:

```bash
ACCOUNT_DELETION_REHEARSAL_LIVE=true \
ACCOUNT_DELETION_REHEARSAL_BASE_URL=https://beta.example.com \
ACCOUNT_DELETION_REHEARSAL_ACCESS_TOKEN=<disposable-test-account-token> \
ACCOUNT_DELETION_REHEARSAL_CONFIRM_EMAIL=<disposable-account-email> \
ACCOUNT_DELETION_REHEARSAL_DISPOSABLE_ACCOUNT_ACK=true \
ACCOUNT_DELETION_REHEARSAL_CONFIRM=delete-disposable-account \
npm run qa:account-deletion-rehearsal
```

For local contract validation without a destructive request, run:

```bash
npm run qa:account-deletion-rehearsal
```

Live PASS verifies the count-only deletion preview first, sends
`DELETE /api/auth/account` with `X-Work-Archive-Client: web`, and then verifies
the same token receives `401` from `GET /api/auth/data-export`. Copy only the
redacted report summary from `tmp/account-deletion-rehearsal/` into the ledger.

## Sync Load Validation

Dry-run mode validates synthetic payload generation without API calls:

```bash
npm run qa:sync-load
```

Dry-run and live reports are written to `tmp/sync-load/` unless
`SYNC_LOAD_REPORT_DIR` is set.

Live mode requires a disposable authenticated test account:

```bash
SYNC_LOAD_DRY_RUN=false \
SYNC_LOAD_BASE_URL=https://beta.example.com \
SYNC_LOAD_ACCESS_TOKEN=<disposable-test-account-token> \
SYNC_LOAD_DISPOSABLE_ACCOUNT_ACK=true \
SYNC_LOAD_RECORDS=1000 \
SYNC_LOAD_BATCH_SIZE=200 \
SYNC_LOAD_PULL_LIMIT=500 \
npm run qa:sync-load
```

The script creates only synthetic records with titles prefixed
`Gate1 Sync Load QA`. Do not run it against a real user account.

### Sync Load Acceptance Criteria

Default Gate 1 dry-run and live parameters:

- `SYNC_LOAD_RECORDS=1000`
- `SYNC_LOAD_BATCH_SIZE=200` (the script caps batches at 200, matching the API
  DTO and service boundary)
- `SYNC_LOAD_PULL_LIMIT=500`

Dry-run PASS proves only payload generation, report creation, and local script
shape. It does not prove API capacity.

Live PASS on a disposable authenticated beta/staging account requires:

- every push batch receives a successful response;
- every synthetic mutation result is `applied`;
- conflicts are `0`;
- bounded pull observes every synthetic record exactly once;
- missing synthetic records are `0`;
- duplicate synthetic records are `0`;
- pull pagination does not repeat cursors and does not return `hasMore=true`
  without `nextCursor`;
- default pull limit smoke succeeds;
- `limit=1500` smoke either succeeds with bounded behavior or returns DTO
  validation `400`.
- oversized `201`-change push batch smoke returns DTO validation `400` before
  storage writes.

Record observed `requestP50Ms`, `requestP95Ms`, `totalDurationMs`,
`maxResponseBytes`, push batch count, pull page count, `limit=1500` status,
oversized push status, conflict count, failure count, and the run ID in the
evidence ledger. p50/p95 are release observations
for Gate 1, not hard pass/fail thresholds until a production latency budget is
approved.

## Smoke Performance Baseline

Dry-run mode validates report generation without HTTP calls:

```bash
PERF_SMOKE_DRY_RUN=true npm run qa:performance-smoke
```

For repository-only budget-path validation, dry-run can emit synthetic timing
samples without opening network sockets:

```bash
PERF_SMOKE_DRY_RUN=true \
PERF_SMOKE_DRY_RUN_SAMPLE_MS=1200 \
PERF_SMOKE_MAX_P95_MS=1000 \
npm run qa:performance-smoke
```

Live beta-host mode records p50/p95 timings and observed standard rate-limit
headers for `/readyz`, refresh without a cookie, import provider status,
`/work-archive-config.js`, and optional small sync push/pull:

```bash
PERF_SMOKE_BASE_URL=https://beta.example.com \
PERF_SMOKE_ALLOWED_ORIGIN=https://beta.example.com \
PERF_SMOKE_ACCESS_TOKEN=<disposable-test-account-token> \
PERF_SMOKE_DISPOSABLE_ACCOUNT_ACK=true \
npm run qa:performance-smoke
```

To enforce an approved release smoke budget, add one or both latency caps:

```bash
PERF_SMOKE_MAX_P50_MS=500 \
PERF_SMOKE_MAX_P95_MS=1000 \
npm run qa:performance-smoke
```

When a cap is set, any required live scenario that exceeds it marks the report
`FAIL` and exits non-zero. Leave the caps unset while collecting the first beta
baseline, then set them only after the release owner approves the budget.

Reports are written to `tmp/performance-smoke/` unless
`PERF_SMOKE_REPORT_DIR` is set. If the release must block when authenticated
sync timing is unavailable, add `PERF_SMOKE_REQUIRE_AUTHENTICATED=true`.
Otherwise the unauthenticated/public scenarios can still produce a partial
baseline and the sync row should remain `not measured` in the evidence ledger.
Copy p50/p95, budget status, status codes, and
`RateLimit-*`/`RateLimit`/`Retry-After` header summaries into the evidence
ledger. Do not run authenticated sync timing against a real user account.

## Backup And Restore Drill

Create a PostgreSQL backup, copy it off-host, restore once into a
non-production target, then smoke `/readyz` and authenticated sync. Record
observed RPO/RTO and gaps. Do not commit database dumps, backup contents, or raw
user data.

Preferred command sequence:

```bash
BACKUP_DIR=backups npm run ops:backup
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump npm run ops:backup:verify
RESTORE_DRILL_CONFIRM=restore-disposable-target \
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump \
ENV_FILE=.env.restore \
RESTORE_DRILL_BASE_URL=https://restore.example.com \
npm run ops:restore-drill
```

Copy only the redacted summaries from `tmp/backups/prod-backup-*.md`,
`tmp/backups/prod-backup-verify-*.md`, and
`tmp/restore-drills/restore-drill-*.md` into the evidence ledger.

Approval evidence requires a confirmed restore report, not a plan-only report.
The restored target must be disposable and must not share production
`DATABASE_URL`, Redis state, OAuth redirect credentials, or public DNS. If
restore verification fails, do not retry against production. Recreate or replace
the disposable target, keep the failed restore report, and record the failing
step, suspected cause, and next retest command in the ledger.

## What Must Not Be Committed

- Secrets, access tokens, OAuth codes, cookies, provider keys, or `.env.prod`.
- Database dumps, backup contents, or raw sync payloads with personal data.
- Raw provider responses with user/provider data.
- Full audit or Trivy raw reports when they contain unnecessary dependency
  metadata; commit only summaries when appropriate.

QA evidence scripts redact URL usernames, passwords, and sensitive query parameters
such as authorization codes, state values, tokens, cookies, API keys, passwords,
and secrets before writing diagnostics. Review generated evidence before
committing summaries and never commit raw live responses.

## Filling The Evidence Ledger

Keep `PUBLIC_BETA_GATE_1_EVIDENCE.md` as the human operator ledger. Copy only
observed command summaries from generated reports and operational runs. Do not
change the top-level `Status: partial` to a release-ready status until
`GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence` passes on the filled
ledger and the approver records the final decision.
