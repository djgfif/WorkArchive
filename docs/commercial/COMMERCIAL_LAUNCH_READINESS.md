# Commercial Launch Readiness Gate 1

Last reviewed: 2026-06-04

Scope: Work Archive public-service candidate readiness after the closed beta
hardening baseline. This gate does not approve a commercial launch by itself; it
sets the first measurable operating baseline.

## Scorecard

Current repository score: **630 / 1000**. Gate 1 public beta target:
**730 / 1000**.

The repository now contains the Gate 1 automation and documentation hooks, but
the target score is not considered achieved until the operator records the
required evidence in
[`PUBLIC_BETA_GATE_1_EVIDENCE.md`](./PUBLIC_BETA_GATE_1_EVIDENCE.md). Do not
raise the score based on unrun checks.

## 2026-06-04 Expert Feedback Disposition

Accepted as Gate 1 work:

- provider/search QA expansion and ranking regression coverage;
- sync reliability evidence before broader auto-merge changes;
- API boundary documentation that keeps `Works` as compatibility rather than a
  growth surface;
- operational evidence for GitHub Settings, beta smoke, restore drill, and
  release-runner scans.

Corrected or deferred:

- License is not missing; README explicitly states that no open-source license
  has been granted and all rights are reserved.
- CI is present; the remaining E2E question is when web Playwright is stable
  enough to add to the validate workflow or release gate.
- Public/community/social/recommendation, mobile, Tauri, and i18n are not Gate
  1 implementation scope.

| Area                               |   Points | Current                                                                                                                                                                                                                                                                           | Gap                                                                              | Required before public beta                                                         | Required before commercial launch                                 |
| ---------------------------------- | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Security                           | 90 / 110 | Production config rejects weak secrets, insecure cookies, wildcard CORS, localhost production URLs, Swagger in production, and dev DB credentials. Containers are read-only with no-new-privileges. Public repo guardrails now allow the commercial readiness docs intentionally. | No WAF/edge policy, no hosted secret scanning proof.                             | Enable GitHub secret scanning, keep production env preflight mandatory, run CodeQL. | Formal threat model, incident drills, edge abuse controls.        |
| Auth/session safety                | 80 / 100 | Google OAuth, refresh-cookie rotation, reuse detection, session revocation, hashed refresh tokens.                                                                                                                                                                                | Refresh failure metrics were missing before Gate 1.                              | Alert on refresh failure spike, verify cookie behavior behind the real proxy.       | Session anomaly review, planned secret rotation procedure.        |
| Sync correctness                   | 80 / 120 | Idempotent push via `UserSyncAppliedMutation`, cursor-based bounded pull, remote-newer conflicts, private entity ownership checks.                                                                                                                                                | `sync.service.ts` is large; large-archive load evidence is still missing.        | Track push/pull/conflict/validation metrics and document scaling plan.              | Handler split and load test against large archives.               |
| Data integrity                     | 70 / 100 | Prisma migrations, static migration risk validation, ownership checks, soft-delete sync, backup and restore policy, and scripted non-production restore drill.                                                                                                                     | Restore drill proof still requires a real backup and disposable target.          | Monthly restore drill and release backup enforcement.                               | Tested point-in-time restore or equivalent hosted backup feature. |
| Observability                      | 80 / 100 | Structured pino logs, request IDs, Prometheus metrics, beta smoke coverage for `/metrics` exposure, repository-validated Prometheus alert rules, repository-validated SLO rules, and a repository-validated Grafana dashboard artifact.                                         | No deployed dashboard/alert/SLO routing proof.                                   | Enable `/metrics` only behind internal allowlist, configure alerts/SLOs, and deploy the dashboard. | SLO adoption evidence, on-call runbooks, log retention policy.    |
| Deployment/release                 | 70 / 100 | Production compose, release migration profile, health/readiness endpoints.                                                                                                                                                                                                        | Rehearsal was partly manual.                                                     | Run commercial beta rehearsal script before release.                                | Blue/green or rollback-tested release procedure.                  |
| Backup/restore                     |  65 / 90 | Backup policy, backup/verification commands with redacted reports, restore commands, retention cleanup dry-run.                                                                                                                                                                    | RPO/RTO not proven on real production-sized data.                                | Restore drill record before public beta.                                            | Automated scheduled backups with restore verification.            |
| Performance/load readiness         |  35 / 90 | Rate limiting, resource limits, sync load dry-run, and a smoke performance baseline runner exist.                                                                                                                                                                                  | No recorded beta-host load baseline or sync/import latency budget proof.          | Smoke-level rehearsal and latency metrics.                                          | Load test for sync/import/auth and capacity plan.                 |
| Privacy/data retention             |  60 / 90 | Retention cleanup covers SecurityEvent, refresh sessions, expired sync idempotency rows, and expired Notion preview snapshots; provider keys are encrypted; refresh sessions store masked IP and coarse browser/OS summaries.                                                          | Retention proof and migration/backfill policy for any previously stored raw client metadata remain open. | Publish data retention and backup sensitivity policy.                               | Data deletion/export policy and historical raw metadata handling. |
| Secure SDLC                        |  55 / 70 | Existing validate workflow has lint/type/test/e2e/build/integration. Dependabot and CodeQL workflows are present in the repository.                                                                                                                                               | Branch protection and secret scanning are GitHub Settings proof, not repo proof. | Dependabot, CodeQL, branch protection documented.                                   | Vulnerability triage SLA and release blocking policy.             |
| Public feature permission boundary | 45 / 130 | Product docs state public/community is out of scope; tier board visibility has `private`, `link_only`, `exported`.                                                                                                                                                                | No public permission boundary document before Gate 1.                            | Default-private boundary documented before any public feature.                      | Implemented permission checks, moderation tools, abuse reporting. |

## Gate 1 Implementation Checklist

- Search quality: `npm run qa:import-search` passes after any ranking/provider
  change; live provider QA is recorded only from beta/staging.
- Sync reliability: `npm run qa:sync-load` dry-run passes locally; live sync
  load uses a disposable authenticated account before public beta approval.
- Migration safety: `npm run qa:migrations` passes, and any high-risk Prisma SQL
  is recorded in
  `docs/operations/MIGRATION_RISK_REGISTER.md` with explicit approval.
- Performance baseline: `npm run qa:performance-smoke` records beta-host p50/p95
  for `/readyz`, refresh without cookie, import provider status, runtime web
  config, and optional disposable-account sync push/pull.
- API boundary: new backend behavior is reviewed against the `Catalog`,
  `Imports`, `UserRecords`, `Sync`, and `Works` compatibility split documented
  in the architecture guide.
- Web E2E: `validate` installs Playwright Chromium dependencies with
  `npx playwright install --with-deps chromium` and runs
  `npm run test:e2e:web` as a release gate.
- GitHub controls: branch protection, required checks, CodeQL, Dependabot,
  secret scanning, and push protection require operator evidence from GitHub
  Settings; repository files alone are not proof.
- CI release guard: the `validate` workflow runs `npm run qa:commercial:repo`
  to block drift in migration risk registration, monitoring artifacts, Gate 1
  evidence validation, and deployment script syntax.

## Public Beta Gate 1 Release Blockers

A release candidate is blocked from public beta until all of these are true:

- `npm run security:public`, `npm run check:docs-links`, `npm run qa:migrations`,
  `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`,
  `npm run test:e2e:web`, and `npm run build`
  pass on the release commit.
- `scripts/deploy/beta-preflight.sh` passes on the beta host with real
  `.env.prod` values.
- `scripts/deploy/beta-smoke.sh` passes against the beta URL. By default it
  expects `/metrics` to return `404`; if metrics are enabled for an internal
  collector, keep the public unauthenticated check at `404` and set
  `SMOKE_METRICS_BEARER_TOKEN` only from the allowed network path to verify the
  collector `200`.
- GitHub branch protection, CodeQL, Dependabot, secret scanning, and push
  protection are enabled or explicitly waived in the evidence record.
- A PostgreSQL backup is created, moved off-host, and restored once into a
  non-production target before public beta; prefer `npm run ops:restore-drill`
  so checksum verification, restore, migrations, startup, and smoke evidence
  land in one redacted report.
- A smoke-level performance baseline is recorded for auth refresh, sync
  push/pull, import provider diagnostics, `/readyz`, and web static config.

## Confirmed Facts

- `apps/api/src/app.module.ts` uses `nestjs-pino` structured logging and generates
  request IDs from `x-request-id` or `randomUUID`.
- `apps/api/src/configure-app.ts` keeps `/health`, `/livez`, and `/readyz`
  outside the `/api` prefix and applies cookie parsing, Helmet, origin guard,
  CORS, rate limits, and validation.
- `apps/api/src/main.ts` enables `SIGTERM`/`SIGINT` shutdown hooks, and
  `apps/api/src/security/security-runtime-cleanup.service.ts` closes Redis
  rate-limit clients during Nest application shutdown.
- `apps/api/src/config/api-runtime-config.ts` validates production secrets,
  required Google OAuth credentials, HTTPS origins, Redis rate limiting,
  metrics bearer-token shape, bounded API request body limits,
  bounded `/readyz` dependency check timeouts,
  `COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`, `HOST` shape, rate-limit key
  prefix shape, and `TRUST_PROXY_HOPS=1`.
- `apps/api/src/modules/auth/auth.service.ts` rotates refresh cookies, stores
  refresh token hashes, and records security events for refresh failures.
- `apps/api/src/modules/sync/sync.service.ts` is a large single service and uses
  `UserSyncAppliedMutation` for idempotent push replay.
- `apps/api/src/modules/imports/runtime/provider-runtime-state.service.ts` uses
  Redis-backed provider cache/circuit state when `REDIS_URL` is configured and
  falls back to memory outside production; provider timeout defaults to 5
  seconds.
- `apps/api/src/operations/retention-cleanup.ts` supports dry-run cleanup for
  SecurityEvent, UserRefreshSession, UserSyncAppliedMutation, and expired Notion
  pull preview snapshots.
- `compose.prod.yml` runs Postgres, Redis, API, migration, retention cleanup, and
  web services with production-oriented defaults.
- `.github/workflows/validate.yml`, `.github/workflows/codeql.yml`, and
  `.github/dependabot.yml` provide repository-level validation, CodeQL, and
  dependency update automation.
- `scripts/security/public-readiness-check.sh` permits the current
  `docs/commercial` area and still rejects unexpected public-root files,
  non-example env files, tracked artifacts, personal paths, and high-confidence
  secret patterns.
- `scripts/deploy/beta-preflight.sh` and
  `scripts/deploy/commercial-env-preflight.mjs` fail when metrics are enabled
  without explicit internal-access review.
- `scripts/deploy/beta-smoke.sh` checks that `/metrics` is not publicly exposed
  by default.
- `scripts/deploy/prod-restore-drill.sh` runs the non-production restore drill
  behind an explicit `RESTORE_DRILL_CONFIRM=restore-disposable-target` guard and
  writes redacted evidence to `tmp/restore-drills/`.
- `scripts/deploy/prod-backup.sh` and `scripts/deploy/prod-backup-verify.sh`
  create checksum-verified PostgreSQL backup artifacts and redacted operator
  reports under `tmp/backups/`.
- `scripts/qa/validate-prisma-migrations.mjs` blocks unregistered high-risk
  Prisma migration SQL, using
  `docs/operations/MIGRATION_RISK_REGISTER.md` as the approved risk register.
- `scripts/qa/performance-smoke.mjs` records redacted p50/p95 timing summaries
  for Gate 1 smoke scenarios and writes reports to `tmp/performance-smoke/`.
- `docs/operations/monitoring/work-archive-alerts.yml` defines Gate 1
  Prometheus alerts for readiness, API 5xx/latency, auth refresh failures, sync
  conflicts/validation failures, and import provider failures/circuit opens;
  `npm run qa:alerts` validates the repository copy.
- `docs/operations/monitoring/work-archive-slo-rules.yml` defines Gate 1 SLO
  recording and burn-alert rules for API availability/latency, auth refresh,
  sync, and import search success; `npm run qa:slo` validates the repository
  copy.
- `docs/operations/monitoring/work-archive-grafana-dashboard.json` defines the
  Gate 1 Grafana dashboard for API readiness, request rate, latency, auth,
  sync, and import-provider health; `npm run qa:dashboards` validates the
  repository copy.
- `scripts/qa/monitoring-evidence.mjs` collects redacted live Prometheus,
  Grafana, SLO sample, and `/metrics` exposure evidence into
  `tmp/monitoring-evidence/`; dry-run mode validates report generation only.
- `scripts/qa/validate-gate1-evidence.mjs` checks the public beta evidence
  ledger for missing live-host, monitoring, restore, performance, GitHub, and
  approver proof; strict mode blocks approval while placeholders remain.
- `scripts/qa/commercial-repo-gates.sh` is wired into the GitHub `validate`
  workflow through `npm run qa:commercial:repo` for repository-verifiable Gate 1
  commercial artifacts.

## Operationally Verifiable Only

- Real proxy behavior for secure cookies, trusted proxy hops, and client IPs.
- Whether `/metrics` is reachable only from an internal network or allowlisted
  monitoring system.
- Whether `work-archive-alerts.yml` is deployed to the actual monitoring system
  and routes to the intended notification channel.
- Whether `work-archive-slo-rules.yml` is deployed to the actual monitoring
  system and the 30 day SLO records are populated by real beta traffic.
- Whether `work-archive-grafana-dashboard.json` is imported into the actual
  Grafana stack and visible to operators.
- Whether `npm run qa:monitoring` passes against real beta monitoring endpoints
  and its summary is recorded in the Gate 1 evidence ledger.
- Whether `GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence` passes after
  the operator ledger is fully populated.
- Restore drill duration against production-sized data.
- Provider rate-limit behavior under real user traffic.
- Load headroom for large sync pulls and high import-provider failure rates.
- GitHub branch protection and secret scanning settings, which must be set in
  GitHub Settings by an operator.
