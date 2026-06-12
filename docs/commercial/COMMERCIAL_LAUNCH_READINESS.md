# Commercial Launch Readiness Gate 1

Last reviewed: 2026-06-04

Scope: Work Archive public-service candidate readiness after the closed beta
hardening baseline. This gate does not approve a commercial launch by itself; it
sets the first measurable operating baseline.

## Scorecard

Current repository score: **620 / 1000**. Gate 1 public beta target:
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
| Data integrity                     | 70 / 100 | Prisma migrations, ownership checks, soft-delete sync, backup and restore policy.                                                                                                                                                                                                 | Restore drill proof is operational, not in code.                                 | Monthly restore drill and release backup enforcement.                               | Tested point-in-time restore or equivalent hosted backup feature. |
| Observability                      | 70 / 100 | Structured pino logs, request IDs, Prometheus metrics, and beta smoke coverage for `/metrics` exposure.                                                                                                                                                                           | No deployed dashboard/alert proof.                                               | Enable `/metrics` only behind internal allowlist and configure alerts.              | SLOs, dashboards, on-call runbooks, log retention policy.         |
| Deployment/release                 | 70 / 100 | Production compose, release migration profile, health/readiness endpoints.                                                                                                                                                                                                        | Rehearsal was partly manual.                                                     | Run commercial beta rehearsal script before release.                                | Blue/green or rollback-tested release procedure.                  |
| Backup/restore                     |  65 / 90 | Backup policy, restore commands, retention cleanup dry-run.                                                                                                                                                                                                                       | RPO/RTO not proven on real production-sized data.                                | Restore drill record before public beta.                                            | Automated scheduled backups with restore verification.            |
| Performance/load readiness         |  35 / 90 | Rate limiting and resource limits exist.                                                                                                                                                                                                                                          | No load baseline, no sync/import latency budget proof.                           | Smoke-level rehearsal and latency metrics.                                          | Load test for sync/import/auth and capacity plan.                 |
| Privacy/data retention             |  60 / 90 | Retention cleanup covers SecurityEvent, refresh sessions, and expired sync idempotency rows; provider keys are encrypted; refresh sessions store masked IP and coarse browser/OS summaries.                                                                                         | Retention proof and migration/backfill policy for any previously stored raw client metadata remain open. | Publish data retention and backup sensitivity policy.                               | Data deletion/export policy and historical raw metadata handling. |
| Secure SDLC                        |  55 / 70 | Existing validate workflow has lint/type/test/e2e/build/integration. Dependabot and CodeQL workflows are present in the repository.                                                                                                                                               | Branch protection and secret scanning are GitHub Settings proof, not repo proof. | Dependabot, CodeQL, branch protection documented.                                   | Vulnerability triage SLA and release blocking policy.             |
| Public feature permission boundary | 45 / 130 | Product docs state public/community is out of scope; tier board visibility has `private`, `link_only`, `exported`.                                                                                                                                                                | No public permission boundary document before Gate 1.                            | Default-private boundary documented before any public feature.                      | Implemented permission checks, moderation tools, abuse reporting. |

## Gate 1 Implementation Checklist

- Search quality: `npm run qa:import-search` passes after any ranking/provider
  change; live provider QA is recorded only from beta/staging.
- Sync reliability: `npm run qa:sync-load` dry-run passes locally; live sync
  load uses a disposable authenticated account before public beta approval.
- API boundary: new backend behavior is reviewed against the `Catalog`,
  `Imports`, `UserRecords`, `Sync`, and `Works` compatibility split documented
  in the architecture guide.
- Web E2E: `npm run test:e2e:web` may be run locally or in a dedicated release
  validation job, but do not add it to `validate` until browser dependency and
  runtime stability are documented.
- GitHub controls: branch protection, required checks, CodeQL, Dependabot,
  secret scanning, and push protection require operator evidence from GitHub
  Settings; repository files alone are not proof.

## Public Beta Gate 1 Release Blockers

A release candidate is blocked from public beta until all of these are true:

- `npm run security:public`, `npm run check:docs-links`, `npm run lint`,
  `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`
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
  non-production target before public beta.
- A smoke-level performance baseline is recorded for auth refresh, sync
  push/pull, import provider diagnostics, `/readyz`, and web static config.

## Confirmed Facts

- `apps/api/src/app.module.ts` uses `nestjs-pino` structured logging and generates
  request IDs from `x-request-id` or `randomUUID`.
- `apps/api/src/configure-app.ts` keeps `/health`, `/livez`, and `/readyz`
  outside the `/api` prefix and applies cookie parsing, Helmet, origin guard,
  CORS, rate limits, and validation.
- `apps/api/src/config/api-runtime-config.ts` validates production secrets,
  HTTPS origins, Redis rate limiting, `COOKIE_SECURE=true`,
  `SWAGGER_ENABLED=false`, and `TRUST_PROXY_HOPS=1`.
- `apps/api/src/modules/auth/auth.service.ts` rotates refresh cookies, stores
  refresh token hashes, and records security events for refresh failures.
- `apps/api/src/modules/sync/sync.service.ts` is a large single service and uses
  `UserSyncAppliedMutation` for idempotent push replay.
- `apps/api/src/modules/imports/runtime/provider-runtime-state.service.ts` uses
  Redis-backed provider cache/circuit state when `REDIS_URL` is configured and
  falls back to memory outside production; provider timeout defaults to 5
  seconds.
- `apps/api/src/operations/retention-cleanup.ts` supports dry-run cleanup for
  SecurityEvent, UserRefreshSession, and UserSyncAppliedMutation.
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

## Operationally Verifiable Only

- Real proxy behavior for secure cookies, trusted proxy hops, and client IPs.
- Whether `/metrics` is reachable only from an internal network or allowlisted
  monitoring system.
- Restore drill duration against production-sized data.
- Provider rate-limit behavior under real user traffic.
- Load headroom for large sync pulls and high import-provider failure rates.
- GitHub branch protection and secret scanning settings, which must be set in
  GitHub Settings by an operator.
