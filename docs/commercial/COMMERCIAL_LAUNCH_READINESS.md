# Commercial Launch Readiness Gate 1

Last reviewed: 2026-05-25

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

| Area                               |   Points | Current                                                                                                                                                                                                                                                                           | Gap                                                                              | Required before public beta                                                         | Required before commercial launch                                     |
| ---------------------------------- | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Security                           | 90 / 110 | Production config rejects weak secrets, insecure cookies, wildcard CORS, localhost production URLs, Swagger in production, and dev DB credentials. Containers are read-only with no-new-privileges. Public repo guardrails now allow the commercial readiness docs intentionally. | No WAF/edge policy, no hosted secret scanning proof.                             | Enable GitHub secret scanning, keep production env preflight mandatory, run CodeQL. | Formal threat model, incident drills, edge abuse controls.            |
| Auth/session safety                | 80 / 100 | Google OAuth, refresh-cookie rotation, reuse detection, session revocation, hashed refresh tokens.                                                                                                                                                                                | Refresh failure metrics were missing before Gate 1.                              | Alert on refresh failure spike, verify cookie behavior behind the real proxy.       | Session anomaly review, planned secret rotation procedure.            |
| Sync correctness                   | 80 / 120 | Idempotent push via `UserSyncAppliedMutation`, cursor-based pull, remote-newer conflicts, private entity ownership checks.                                                                                                                                                        | `sync.service.ts` is large; pull builds many changes in memory before `slice`.   | Track push/pull/conflict/validation metrics and document scaling plan.              | DB-level pagination, handler split, load test against large archives. |
| Data integrity                     | 70 / 100 | Prisma migrations, ownership checks, soft-delete sync, backup and restore policy.                                                                                                                                                                                                 | Restore drill proof is operational, not in code.                                 | Monthly restore drill and release backup enforcement.                               | Tested point-in-time restore or equivalent hosted backup feature.     |
| Observability                      | 70 / 100 | Structured pino logs, request IDs, Prometheus metrics, and beta smoke coverage for `/metrics` exposure.                                                                                                                                                                           | No deployed dashboard/alert proof.                                               | Enable `/metrics` only behind internal allowlist and configure alerts.              | SLOs, dashboards, on-call runbooks, log retention policy.             |
| Deployment/release                 | 70 / 100 | Production compose, release migration profile, health/readiness endpoints.                                                                                                                                                                                                        | Rehearsal was partly manual.                                                     | Run commercial beta rehearsal script before release.                                | Blue/green or rollback-tested release procedure.                      |
| Backup/restore                     |  65 / 90 | Backup policy, restore commands, retention cleanup dry-run.                                                                                                                                                                                                                       | RPO/RTO not proven on real production-sized data.                                | Restore drill record before public beta.                                            | Automated scheduled backups with restore verification.                |
| Performance/load readiness         |  35 / 90 | Rate limiting and resource limits exist.                                                                                                                                                                                                                                          | No load baseline, no sync/import latency budget proof.                           | Smoke-level rehearsal and latency metrics.                                          | Load test for sync/import/auth and capacity plan.                     |
| Privacy/data retention             |  60 / 90 | Retention cleanup covers SecurityEvent, refresh sessions, reset tokens; provider keys are encrypted.                                                                                                                                                                              | Raw `ipAddress`/`userAgent` remain in refresh sessions.                          | Publish data retention and backup sensitivity policy.                               | Data deletion/export policy and raw client metadata minimization.     |
| Secure SDLC                        |  55 / 70 | Existing validate workflow has lint/type/test/e2e/build/integration. Dependabot and CodeQL workflows are present in the repository.                                                                                                                                               | Branch protection and secret scanning are GitHub Settings proof, not repo proof. | Dependabot, CodeQL, branch protection documented.                                   | Vulnerability triage SLA and release blocking policy.                 |
| Public feature permission boundary | 45 / 130 | Product docs state public/community is out of scope; tier board visibility has `private`, `link_only`, `exported`.                                                                                                                                                                | No public permission boundary document before Gate 1.                            | Default-private boundary documented before any public feature.                      | Implemented permission checks, moderation tools, abuse reporting.     |

## Public Beta Gate 1 Release Blockers

A release candidate is blocked from public beta until all of these are true:

- `npm run security:public`, `npm run check:docs-links`, `npm run lint`,
  `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`
  pass on the release commit.
- `scripts/deploy/beta-preflight.sh` passes on the beta host with real
  `.env.prod` values.
- `scripts/deploy/beta-smoke.sh` passes against the beta URL. By default it
  expects `/metrics` to return `404`; if metrics are enabled for an internal
  collector, run it with `EXPECT_METRICS_STATUS=200` only from the allowed
  network path.
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
- `apps/api/src/modules/imports/imports.service.ts` has a process-local provider
  circuit breaker and a 5 second default provider timeout.
- `apps/api/src/operations/retention-cleanup.ts` supports dry-run cleanup for
  SecurityEvent, UserRefreshSession, and PasswordResetToken.
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
