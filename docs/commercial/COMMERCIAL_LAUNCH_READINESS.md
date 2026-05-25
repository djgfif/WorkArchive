# Commercial Launch Readiness Gate 1

Scope: Work Archive public-service candidate readiness after the closed beta
hardening baseline. This gate does not approve a commercial launch by itself; it
sets the first measurable operating baseline.

## Scorecard

Current score: **620 / 1000**. Gate 1 target after this change: **730 / 1000**.

| Area | Points | Current | Gap | Required before public beta | Required before commercial launch |
| --- | ---: | --- | --- | --- | --- |
| Security | 90 / 110 | Production config rejects weak secrets, insecure cookies, wildcard CORS, localhost production URLs, Swagger in production, and dev DB credentials. Containers are read-only with no-new-privileges. | No WAF/edge policy, no hosted secret scanning proof. | Enable GitHub secret scanning, keep production env preflight mandatory, run CodeQL. | Formal threat model, incident drills, edge abuse controls. |
| Auth/session safety | 80 / 100 | Google OAuth, refresh-cookie rotation, reuse detection, session revocation, hashed refresh tokens. | Refresh failure metrics were missing before Gate 1. | Alert on refresh failure spike, verify cookie behavior behind the real proxy. | Session anomaly review, planned secret rotation procedure. |
| Sync correctness | 80 / 120 | Idempotent push via `UserSyncAppliedMutation`, cursor-based pull, remote-newer conflicts, private entity ownership checks. | `sync.service.ts` is large; pull builds many changes in memory before `slice`. | Track push/pull/conflict/validation metrics and document scaling plan. | DB-level pagination, handler split, load test against large archives. |
| Data integrity | 70 / 100 | Prisma migrations, ownership checks, soft-delete sync, backup and restore policy. | Restore drill proof is operational, not in code. | Monthly restore drill and release backup enforcement. | Tested point-in-time restore or equivalent hosted backup feature. |
| Observability | 70 / 100 | Structured pino logs and request IDs existed; Gate 1 adds Prometheus metrics. | No deployed dashboard/alert proof. | Enable `/metrics` only behind internal allowlist and configure alerts. | SLOs, dashboards, on-call runbooks, log retention policy. |
| Deployment/release | 70 / 100 | Production compose, release migration profile, health/readiness endpoints. | Rehearsal was partly manual. | Run commercial beta rehearsal script before release. | Blue/green or rollback-tested release procedure. |
| Backup/restore | 65 / 90 | Backup policy, restore commands, retention cleanup dry-run. | RPO/RTO not proven on real production-sized data. | Restore drill record before public beta. | Automated scheduled backups with restore verification. |
| Performance/load readiness | 35 / 90 | Rate limiting and resource limits exist. | No load baseline, no sync/import latency budget proof. | Smoke-level rehearsal and latency metrics. | Load test for sync/import/auth and capacity plan. |
| Privacy/data retention | 60 / 90 | Retention cleanup covers SecurityEvent, refresh sessions, reset tokens; provider keys are encrypted. | Raw `ipAddress`/`userAgent` remain in refresh sessions. | Publish data retention and backup sensitivity policy. | Data deletion/export policy and raw client metadata minimization. |
| Secure SDLC | 55 / 70 | Existing validate workflow has lint/type/test/e2e/build/integration. | No Dependabot/CodeQL before Gate 1. | Dependabot, CodeQL, branch protection documented. | Vulnerability triage SLA and release blocking policy. |
| Public feature permission boundary | 45 / 130 | Product docs state public/community is out of scope; tier board visibility has `private`, `link_only`, `exported`. | No public permission boundary document before Gate 1. | Default-private boundary documented before any public feature. | Implemented permission checks, moderation tools, abuse reporting. |

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

## Operationally Verifiable Only

- Real proxy behavior for secure cookies, trusted proxy hops, and client IPs.
- Whether `/metrics` is reachable only from an internal network or allowlisted
  monitoring system.
- Restore drill duration against production-sized data.
- Provider rate-limit behavior under real user traffic.
- Load headroom for large sync pulls and high import-provider failure rates.
- GitHub branch protection and secret scanning settings, which must be set in
  GitHub Settings by an operator.
