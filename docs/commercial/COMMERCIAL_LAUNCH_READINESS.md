# Commercial Launch Readiness Gate 1

Last reviewed: 2026-07-01

Scope: Work Archive public-service candidate readiness after the closed beta
hardening baseline. This gate does not approve a commercial launch by itself; it
sets the first measurable operating baseline.

## Scorecard

Current repository score: **736 / 1000**. Gate 1 public beta target:
**730 / 1000**.

The repository now contains the Gate 1 automation and documentation hooks, but
the target score is not considered achieved until the operator records the
required evidence in
[`PUBLIC_BETA_GATE_1_EVIDENCE.md`](./PUBLIC_BETA_GATE_1_EVIDENCE.md). Do not
raise the score based on unrun checks.

`npm run qa:user-data-rights-smoke` now provides the non-destructive local and
live evidence path for server-side account export and deletion-preview checks;
`npm run qa:account-deletion-rehearsal` provides the guarded destructive
disposable-account deletion rehearsal path.

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

| Area                               |    Points | Current                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Gap                                                                                                                                                                             | Required before public beta                                                                                 | Required before commercial launch                                     |
| ---------------------------------- | --------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Security                           | 110 / 110 | Production config rejects weak, default, or reused production secret values, placeholder OAuth/public URL values, insecure cookies, wildcard CORS, localhost production URLs, a `WEB_BASE_URL` origin missing from CORS, OAuth redirect callback path drift, Swagger in production, unsafe DB/Redis URL shape, and dev DB credentials. Application containers are read-only, capability-dropped, resource-bounded, and checked by `npm run qa:compose-hardening`. Public repo guardrails now allow the commercial readiness docs intentionally. `npm run qa:api-auth-surface` validates the API authorization surface, `npm run qa:api-input-contracts` validates global unknown-field rejection, controller body/query DTO contracts, and sync strict payload validation, `npm run qa:api-cache-policy` validates API cache-control boundaries, `npm run qa:api-security-headers` validates the backend security header floor, `npm run qa:api-error-policy` validates request-id error responses and sanitized unhandled 500 bodies, `npm run qa:csrf-policy` validates production Fetch Metadata and Origin allowlist guards, and `npm run qa:bola-matrix` validates user-owned object authorization coverage for REST and sync surfaces.                                                                                                                                                                                                                 | No WAF/edge policy or hosted secret scanning proof, but local repository security controls meet the Gate 1 baseline.                                                            | Enable GitHub secret scanning, keep production env preflight mandatory, run CodeQL.                         | Formal threat model, incident drills, edge abuse controls.            |
| Auth/session safety                |  82 / 100 | Google OAuth, refresh-cookie rotation, reuse detection, session revocation, hashed refresh tokens, fixed `HS256` access/refresh JWT signing and verification with issuer/audience, required `jti`/`iat`/`exp` claims, token TTL upper-bound and future-issued-token checks, safe identity claim shape, current-user email claim matching, and token-kind claim shape checks, refresh failure metrics, refresh failure spike alert rules, and a repository gate that fixes production refresh cookies at `HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/api/auth`. `npm run qa:oauth-policy` fixes Google-only login, disabled legacy password routes, OAuth return-origin allowlisting, one-time flow state validation, and OAuth code/token log-safety coverage. Beta smoke now verifies that `/api/auth/google/start` preserves the OAuth flow cookie attributes through the deployed proxy (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/auth/google`) without exposing raw state or nonce cookies.                                                                                                                                                                                                                                                                                                                                                                                   | Real beta-host execution evidence for OAuth flow cookies and refresh-cookie login behavior is still missing.                                                                     | Deploy the refresh failure alert and verify cookie behavior behind the real proxy.                          | Session anomaly review, planned secret rotation procedure.            |
| Sync correctness                   |  85 / 120 | Idempotent push via `UserSyncAppliedMutation`, 200-change push batch limits at DTO and service boundaries, cursor-based bounded pull, remote-newer conflicts, private entity ownership checks, push/pull outcome metrics, bounded sync duration histograms, conflict/validation metrics, a thin `SyncService` facade, focused push/pull services, tier-board root/lane/card/asset/version-guard sync handlers split behind a dispatcher-compatible entrypoint, series/contributor graph entity handlers split behind `sync-push.graph-entity-handler.ts`, and `npm run qa:sync-architecture` drift checks for the sync service split.                                                                                                                                                                                                                                                                                                                                                                                                                                     | Some entity-family sync handlers are still substantial, and large-archive load evidence is still missing.                                                                        | Deploy sync metrics/alerts and record live push/pull latency evidence.                                      | Continue handler splits and load test against large archives.         |
| Data integrity                     |  70 / 100 | Prisma migrations, static migration risk validation, ownership checks, soft-delete sync, backup and restore policy, and scripted non-production restore drill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Restore drill proof still requires a real backup and disposable target.                                                                                                         | Monthly restore drill and release backup enforcement.                                                       | Tested point-in-time restore or equivalent hosted backup feature.     |
| Observability                      |  90 / 100 | Structured pino logs, request IDs, Prometheus metrics including client-header guard, user data rights, and sync latency outcomes, runtime/preflight enforcement of the `/metrics` internal-access review flag, beta smoke coverage for `/metrics` exposure, repository-validated Prometheus alert rules, repository-validated SLO rules, a repository-validated Grafana dashboard artifact, HTTP request URL query/fragment stripping, security audit metadata sanitization, and `npm run qa:log-redaction-policy` drift checks for log redaction policy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | No deployed dashboard/alert/SLO routing proof.                                                                                                                                  | Enable `/metrics` only behind internal allowlist, configure alerts/SLOs, and deploy the dashboard.          | SLO adoption evidence, on-call runbooks, log retention policy.        |
| Deployment/release                 |  75 / 100 | Production compose, release migration profile, health/readiness endpoints, production web proxy routes for `/health`, `/livez`, `/readyz`, `/metrics`, and `npm run qa:deploy-scripts` coverage for beta/prod deploy scripts. The commercial beta rehearsal now reuses the beta preflight, production healthcheck, beta smoke, and retention cleanup dry-run scripts instead of direct one-off endpoint curls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Rehearsal still requires a real beta host.                                                                                                                                      | Run commercial beta rehearsal script before release.                                                        | Blue/green or rollback-tested release procedure.                      |
| Backup/restore                     |   65 / 90 | Backup policy, checksum-verified backup/verification commands with redacted reports, scripted restore drill command, retention cleanup dry-run, and `npm run qa:backup-restore-policy` drift checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | RPO/RTO not proven on real production-sized data.                                                                                                                               | Restore drill record before public beta.                                                                    | Automated scheduled backups with restore verification.                |
| Performance/load readiness         |   52 / 90 | Global `/api`, route-family, and sensitive account-operation rate limiting, bounded rate-limit rejection metrics/alerts, 200-change sync push batch limits, application and stateful compose resource limits, bounded Node HTTP request/header/keep-alive timeouts, sync load dry-run, and a smoke performance baseline runner exist. The performance smoke runner records p50/p95 timings, rate-limit headers, and can fail live required scenarios when an approved `PERF_SMOKE_MAX_P50_MS` or `PERF_SMOKE_MAX_P95_MS` budget is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | No recorded beta-host load baseline or approved sync/import latency budget proof.                                                                                               | Smoke-level rehearsal and latency/rate-limit metrics.                                                       | Load test for sync/import/auth and capacity plan.                     |
| Privacy/data retention             |   87 / 90 | Retention cleanup covers `security_events`, `user_refresh_sessions`, `user_sync_applied_mutations`, and `notion_pull_preview_snapshots`; provider keys are encrypted; refresh sessions store masked IP and coarse browser/OS summaries; `GET /api/auth/data-export` returns user-scoped backend account data while omitting token hashes, provider encrypted keys, security hashes/metadata, OAuth provider account ids, sync result JSON, Notion preview change payloads, and catalog submission payloads/notes; `GET /api/auth/account/deletion-preview` returns count-only deletion impact; `DELETE /api/auth/account` deletes the authenticated server-side account, records `auth.account.delete`, records rejected confirmations as `auth.account.delete_failed`, cascades account-owned rows, detaches retained operational references, and records bounded user data rights metrics; `docs/security/DATA_RETENTION_AND_PRIVACY.md` and `docs/security/USER_DATA_RIGHTS_POLICY.md` define historical client metadata, backup sensitivity, server export, and Account deletion policy; `npm run qa:retention-policy`, `npm run qa:user-data-rights-policy`, `npm run qa:user-data-rights-smoke`, and `npm run qa:account-deletion-rehearsal` block privacy policy, smoke, and destructive rehearsal drift. | Hosted proof for retention dry-run/delete counts, backup storage controls, any historical production metadata, and account deletion rehearsal remains external/future evidence. | Attach retention cleanup, backup sensitivity, and account-deletion rehearsal evidence to the Gate 1 ledger. | Historical raw metadata handling and deletion restore-drill evidence. |
| Secure SDLC                        |   65 / 70 | Existing validate workflow has lint/type/test/e2e/build/integration. Dependabot and CodeQL workflows are present in the repository. `npm run security:audit:prod:high` is documented as the high or critical production dependency release gate, `multer` is pinned to the patched `2.2.0` release through a scoped override, dev/test `undici` is updated to `7.28.0`, `js-yaml` is pinned to `5.1.0`, and local `npm audit` currently reports 0 vulnerabilities. `npm run qa:secure-sdlc-policy` blocks drift in the vulnerability triage SLA, lockfile patch versions, scan ledger, and waiver contract.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Branch protection, secret scanning, and release-runner scan proof are GitHub/operator evidence, not repo proof.                                                                  | Dependabot, CodeQL, branch protection documented; production npm audit high/critical gate passed on release runner. | Maintain vulnerability triage SLA and release blocking policy evidence. |
| Public feature permission boundary |  70 / 130 | Product docs state public/community is out of scope; tier board visibility has `private`, `link_only`, `exported`; `docs/security/PUBLIC_FEATURE_PERMISSION_BOUNDARY.md` is canonical and `npm run qa:public-boundary` is wired into commercial repo gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No hosted public/share route, moderation workflow, or abuse/takedown process exists because public features remain out of Gate 1.                                               | Keep the default-private boundary check passing before any public feature.                                  | Implemented permission checks, moderation tools, abuse reporting.     |

## Gate 1 Implementation Checklist

- Search quality: `npm run qa:import-search` passes after any ranking/provider
  change; live provider QA is recorded only from beta/staging.
- Sync reliability: `npm run qa:sync-load` dry-run passes locally; live sync
  load uses a disposable authenticated account before public beta approval.
- Sync architecture: `npm run qa:sync-architecture` passes and keeps
  `SyncService` as a thin push/pull facade, preserves the
  `sync-push.tier-board-handler.ts` and `sync-push.graph-entity-handler.ts`
  dispatcher-compatible entrypoints, and verifies focused tier-board
  root/lane/card/asset/version-guard plus graph series/contributor modules
  remain split.
- Migration safety: `npm run qa:migrations` passes, and any high-risk Prisma SQL
  is recorded in
  `docs/operations/MIGRATION_RISK_REGISTER.md` with explicit approval.
- BOLA matrix: `npm run qa:bola-matrix` passes and verifies every sync entity
  type and user-owned REST object family has a resolved ownership row before
  public beta approval.
- API authorization surface: `npm run qa:api-auth-surface` passes and verifies
  every controller is classified as protected, optional bearer, public health,
  metrics bearer-token, or policy-bounded public image proxy, and common Bearer
  parsing rejects extra segments or injected header text. Provider search
  traffic only enters the authenticated rate-limit bucket after the access JWT
  verifies with the expected algorithm, issuer, audience, TTL upper bound,
  future-issued-token guard, safe identity claim shape, and access-token claim
  shape.
- API input contracts: `npm run qa:api-input-contracts` passes and verifies
  global unknown-field rejection, bounded request target length handling,
  sanitized malformed/oversized request body failures before DTO validation,
  unsupported request body media type rejection, controller body/query DTO
  contracts, validation errors that do not echo raw submitted values, `@ApiBody`
  metadata for body DTOs, the explicit provider credential exception, and
  strict sync payload validation.
- API cache policy: `npm run qa:api-cache-policy` passes and verifies normal
  `/api/*` responses default to `Cache-Control: no-store`, `/api/image-proxy`
  remains the explicit cacheable API exception, `/health`, `/livez`, and
  `/readyz` remain `no-store`, `/metrics` remains `no-store`, and beta/prod
  smoke scripts verify those response headers.
- API security headers: `npm run qa:api-security-headers` passes and verifies
  Helmet wiring, `x-powered-by` removal, the API CSP floor, no-sniff,
  referrer-policy, HSTS, focused e2e coverage, beta smoke proxy coverage, and
  commercial Gate 1 wiring.
- API error responses: `npm run qa:api-error-policy` passes and verifies the
  global exception filter, request-id error response bodies, sanitized
  unhandled 500 responses, sanitized request parser/media type failures, direct
  security-middleware rejection request IDs, stack stripping, focused e2e
  coverage, and commercial Gate 1 wiring.
- CSRF policy: `npm run qa:csrf-policy` passes and verifies production unsafe
  requests keep Fetch Metadata blocking, Origin allowlist fallback, audit
  events, explicit CORS preflight method/header allowlists, focused e2e
  coverage, and commercial Gate 1 wiring.
- OAuth policy: `npm run qa:oauth-policy` passes and verifies Google-only
  login, disabled legacy password routes, OAuth return-origin allowlisting,
  one-time flow state validation, cookie scope, token/code log-safety
  regressions, and commercial Gate 1 wiring.
- Image proxy policy: `npm run qa:image-proxy-policy` passes and verifies the
  public image proxy keeps HTTPS-only provider allowlists, DNS/private-address
  rejection before fetch and after redirects, max-byte and raster content-type
  checks, deterministic cache headers, and host-only failure logs.
- Deploy script policy: `npm run qa:deploy-scripts` passes and verifies beta
  preflight, beta smoke, commercial beta rehearsal, prod up/down,
  prod-healthcheck, backup, backup verification, and restore drill scripts are
  syntax-checked by commercial and Gate 1 local gates; the same check verifies
  beta/prod smoke scripts cover health, auth, metrics, no-store, compose,
  backup, restore operations, and `qa:docker-runtime` release-runner wiring.
- Docker runtime preflight: `npm run qa:docker-runtime` records Docker CLI,
  Compose, production compose config, and optional production image build
  evidence. `npm run qa:docker-runtime:self-test` verifies the preflight
  script's PASS, BLOCKED, build-mode, boolean parsing, and redaction behavior
  with a fake Docker CLI. A release runner must use
  `DOCKER_RUNTIME_BUILD=true npm run qa:docker-runtime`; a local BLOCKED report
  documents environment availability only and does not approve release.
- Log redaction policy: `npm run qa:log-redaction-policy` passes and verifies
  HTTP request URL query/fragment stripping, auth/cookie/set-cookie header
  redaction, security audit metadata key dropping, inline OAuth/token
  key-value redaction, and regression tests.
- Compose hardening: `npm run qa:compose-hardening` passes and verifies
  production application services keep read-only filesystems, tmpfs scratch
  paths, dropped capabilities, no-new-privileges, resource limits, and no host
  port exposure for API jobs. The same check verifies Postgres and Redis stay
  internal and resource-bounded.
- Performance baseline: `npm run qa:performance-smoke` records beta-host p50/p95
  for `/readyz`, refresh without cookie, import provider status, runtime web
  config, and optional disposable-account sync push/pull.
- API boundary: new backend behavior is reviewed against the `Catalog`,
  `Imports`, `UserRecords`, `Sync`, and `Works` compatibility split documented
  in the architecture guide.
- Public permission boundary: `npm run qa:public-boundary` passes; any
  public/share/community route requires an updated default-private permission
  contract, BOLA matrix coverage, owner-scope tests, and release evidence before
  implementation.
- Retention/privacy boundary: `npm run qa:retention-policy` passes and verifies
  retention cleanup targets, current operational docs, historical client
  metadata policy, and backup sensitivity policy. `npm run
  qa:user-data-rights-policy` passes and verifies the authenticated
  `/api/auth/data-export` endpoint, the `/api/auth/account/deletion-preview`
  impact endpoint, the `/api/auth/account` deletion endpoint, omitted sensitive
  fields, retained-record anonymization, rejected-confirmation audit, and
  bounded user data rights metrics and Account deletion policy.
- Web E2E: `validate` installs Playwright Chromium dependencies with
  `npx playwright install --with-deps chromium` and runs
  `npm run test:e2e:web` as a release gate.
- GitHub controls: branch protection, required checks, CodeQL, Dependabot,
  secret scanning, and push protection require operator evidence from GitHub
  Settings; repository files alone are not proof.
- Secure SDLC: `npm run qa:secure-sdlc-policy` passes; public beta and
  production releases require `npm run security:audit:prod:high` to pass or a
  time-boxed vulnerability waiver with advisory id, reachable server-side path
  assessment, compensating control, owner, expiry, and next retest command.
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
- `npm run security:audit:prod:high` passes on the release runner, or every high
  or critical production runtime dependency finding has an explicit waiver with
  owner and expiry in the evidence record.
- A PostgreSQL backup is created, moved off-host, and restored once into a
  non-production target before public beta; create it with
  `npm run ops:backup`, verify it with `npm run ops:backup:verify`, and prefer
  `npm run ops:restore-drill` so checksum verification, restore, migrations,
  startup, and smoke evidence land in one redacted report.
- A smoke-level performance baseline is recorded for auth refresh, sync
  push/pull, import provider diagnostics, `/readyz`, and web static config.

## Confirmed Facts

- `apps/api/src/app.module.ts` uses `nestjs-pino` structured logging and generates
  request IDs from `x-request-id` or `randomUUID`.
- `apps/api/src/configure-app.ts` keeps `/health`, `/livez`, and `/readyz`
  outside the `/api` prefix and applies cookie parsing, Helmet, origin guard,
  CORS, rate limits, and validation.
- `apps/api/src/modules/health/health.controller.ts` returns safe readiness
  failure bodies with failed `checks` names and `requestId`, while logging
  `health.ready.failed` with the same request id for operator correlation.
- `apps/api/src/main.ts` enables `SIGTERM`/`SIGINT` shutdown hooks, and
  `apps/api/src/security/security-runtime-cleanup.service.ts` closes Redis
  rate-limit clients during Nest application shutdown.
- `apps/api/src/config/api-runtime-config.ts` validates production secrets,
  rejects reused production secret values across runtime secret purposes,
  required non-placeholder Google OAuth credentials, HTTPS non-placeholder
  public origins, Redis rate limiting, PostgreSQL database URL scheme,
  non-localhost database host, dev DB credential rejection, Redis URL scheme
  and non-localhost host,
  metrics bearer-token shape, bounded global API, catalog, unsafe mutation, and
  sensitive auth operation rate limits,
  bounded API request body limits,
  `/metrics` internal-access review when metrics are enabled,
  bounded `/readyz` dependency check timeouts,
  bounded Node HTTP request/header/keep-alive timeouts,
  `WEB_BASE_URL` origin presence in `CORS_ORIGIN`,
  OAuth redirect callback path and empty query/fragment shape,
  `COOKIE_SECURE=true`, `SWAGGER_ENABLED=false`, `HOST` shape, rate-limit key
  prefix shape, and `TRUST_PROXY_HOPS=1`.
- `apps/api/src/security/security-middleware.ts` applies a global `/api`
  rate-limit bucket before auth, catalog, unsafe mutation, sensitive auth, sync,
  import, image-proxy, and Notion buckets;
  every rejection records a security event and
  `work_archive_rate_limit_exceeded_total` when metrics are enabled.
- `apps/api/src/modules/auth/auth.service.ts` rotates refresh cookies, stores
  refresh token hashes, signs and verifies Work Archive JWTs with fixed
  `HS256`, issuer, audience, required registered claims, token TTL upper-bound
  and future-issued-token checks, safe identity claim shape, current-user email
  claim matching, and token-kind claim shape, records refresh success/failure
  metrics, and records security events for refresh failures.
- `GET /api/auth/data-export` returns the authenticated user's server-side
  account data and records `auth.user_data.export`, while omitting refresh token
  hashes, external provider encrypted keys, security event hashes/metadata, and
  OAuth provider account ids. It records
  `work_archive_user_data_rights_total{operation="export",result="success|failure"}`
  when metrics are enabled.
- `GET /api/auth/account/deletion-preview` returns count-only cascade deletion
  and retained-record anonymization impact for the authenticated user without
  row payload contents, and records
  `work_archive_user_data_rights_total{operation="deletion_preview",result="success|failure"}`
  when metrics are enabled.
- `DELETE /api/auth/account` requires the authenticated user's current email and
  an irreversible acknowledgement, records `auth.account.delete` only after
  confirmation validation, records rejected confirmations as
  `auth.account.delete_failed` with bounded metadata, deletes the `User` row for
  cascade-owned data, detaches retained security/moderation references, clears
  the refresh cookie, and records
  `work_archive_user_data_rights_total{operation="delete",result="success|failure"}`
  with no user identifiers in metric labels.
- `apps/api/src/modules/auth/auth.cookies.ts` and
  `apps/api/src/modules/auth/auth-google-oauth.ts` scope auth cookies to
  `HttpOnly`, `Secure`, `SameSite=Strict` or OAuth-appropriate `SameSite=Lax`,
  and `/api/auth` paths; `npm run qa:auth-session-policy` blocks drift in this
  cookie contract.
- `apps/api/src/modules/sync/sync.service.ts` delegates push and pull to
  dedicated services; sync push uses `UserSyncAppliedMutation` for idempotent
  replay, rejects push batches above 200 changes before storage writes, and
  records bounded push/pull outcome, duration, conflict, and validation metrics.
  Tier-board sync keeps root board, lane, card, asset, and version-guard write
  logic in focused modules while preserving `sync-push.tier-board-handler.ts`
  as the dispatcher-compatible entrypoint; `npm run qa:sync-architecture`
  blocks regression to a monolithic sync facade or tier-board handler.
- `apps/api/src/modules/imports/runtime/provider-runtime-state.service.ts` uses
  Redis-backed provider cache/circuit state when `REDIS_URL` is configured and
  falls back to memory outside production; Redis-backed provider failure counts
  and circuit state are updated atomically with a Lua script; provider timeout
  defaults to 5 seconds.
- `apps/api/src/modules/imports/import-provider-search-stage.ts` limits one
  import search request to 3 concurrent provider lookups, preserving response
  order while reducing upstream quota and cost spikes.
- `apps/api/src/modules/imports/import-provider-search-runner.ts` records
  provider-level latency histograms with bounded `provider` and `result`
  labels.
- `apps/api/src/operations/import-provider-circuit-clear.ts` provides a dry-run
  by default operator command to clear one Redis-backed import provider circuit
  without restarting API instances.
- `apps/api/src/operations/retention-cleanup.ts` supports dry-run cleanup for
  SecurityEvent, UserRefreshSession, UserSyncAppliedMutation, and expired Notion
  pull preview snapshots.
- `compose.prod.yml` runs Postgres, Redis, API, migration, retention cleanup, and
  web services with production-oriented defaults.
- `.github/workflows/validate.yml`, `.github/workflows/codeql.yml`, and
  `.github/dependabot.yml` provide repository-level validation, CodeQL, and
  dependency update automation.
- `docs/security/SECURE_SDLC.md` defines the vulnerability triage SLA and
  release blocking policy for high or critical production runtime dependency
  findings; `scripts/qa/validate-secure-sdlc-policy.mjs` keeps that policy,
  release checklist, scan ledger, and evidence ledger aligned.
- `scripts/security/public-readiness-check.sh` permits the current
  `docs/commercial` area and still rejects unexpected public-root files,
  non-example env files, tracked artifacts, personal paths, and high-confidence
  secret patterns.
- `scripts/deploy/beta-preflight.sh` and
  `scripts/deploy/commercial-env-preflight.mjs` fail when metrics are enabled
  without explicit internal-access review, when production URLs still use
  placeholders, or when Google OAuth credentials are missing.
- `scripts/deploy/beta-smoke.sh` checks that `/metrics` is not publicly exposed
  by default.
- `scripts/deploy/prod-restore-drill.sh` runs the non-production restore drill
  behind an explicit `RESTORE_DRILL_CONFIRM=restore-disposable-target` guard and
  writes redacted evidence to `tmp/restore-drills/`; it verifies the selected
  backup before restore.
- `scripts/deploy/prod-backup.sh` and `scripts/deploy/prod-backup-verify.sh`
  create checksum-verified PostgreSQL backup artifacts and redacted operator
  reports under `tmp/backups/`; the `.dump` and `.sha256` sidecar must be moved
  off-host immediately.
- `npm run qa:backup-restore-policy` blocks drift in the backup command,
  checksum verification, restore drill confirmation, redacted reporting, and
  public beta evidence requirements.
- `scripts/qa/validate-prisma-migrations.mjs` blocks unregistered high-risk
  Prisma migration SQL, using
  `docs/operations/MIGRATION_RISK_REGISTER.md` as the approved risk register.
- `scripts/qa/validate-compose-hardening.mjs` blocks production compose drift
  for application service read-only filesystems, tmpfs scratch paths, dropped
  capabilities, no-new-privileges, application and stateful resource limits,
  and internal-only stateful services.
- `scripts/qa/performance-smoke.mjs` records redacted p50/p95 timing summaries
  and observed standard rate-limit headers for Gate 1 smoke scenarios, then
  writes reports to `tmp/performance-smoke/`.
- `docs/operations/monitoring/work-archive-alerts.yml` defines Gate 1
  Prometheus alerts for readiness, API 5xx/latency, auth refresh failures,
  user data rights failures, rate-limit rejection spikes, client header guard
  misses, sync conflicts/validation failures/latency, and import provider
  failures/circuit opens/latency; `npm run qa:alerts` validates the repository
  copy.
- `docs/operations/monitoring/work-archive-slo-rules.yml` defines Gate 1 SLO
  recording and burn-alert rules for API availability/latency, auth refresh,
  sync, and import search success; `npm run qa:slo` validates the repository
  copy.
- `docs/operations/monitoring/work-archive-grafana-dashboard.json` defines the
  Gate 1 Grafana dashboard for API readiness, request rate, latency, auth,
  user data rights outcomes, sync outcomes/latency, and import-provider health
  including provider p95 latency;
  `npm run qa:dashboards` validates the repository copy.
- `scripts/qa/monitoring-evidence.mjs` collects redacted live Prometheus,
  Grafana, SLO sample, and `/metrics` exposure evidence into
  `tmp/monitoring-evidence/`; dry-run mode validates report generation only.
- `scripts/qa/validate-gate1-evidence.mjs` checks the public beta evidence
  ledger for missing live-host, monitoring, restore, performance, GitHub, and
  approver proof; strict mode blocks approval while placeholders remain.
- `scripts/qa/gate1-missing-evidence-report.mjs` groups remaining Gate 1
  evidence gaps by release metadata, GitHub controls, beta host smoke,
  monitoring, backup/restore, performance, and release-runner gates so operators
  can execute the missing work without weakening strict approval.
- `scripts/qa/commercial-repo-gates.sh` is wired into the GitHub `validate`
  workflow through `npm run qa:commercial:repo` for repository-verifiable Gate 1
  commercial artifacts, including offline import/search QA, sync load dry-run,
  sync architecture drift checks, performance smoke dry-run, and monitoring
  evidence dry-run report generation.
- `docs/security/PUBLIC_FEATURE_PERMISSION_BOUNDARY.md` defines the Gate 1
  default-private rule for public/share/community expansion, and
  `scripts/qa/validate-public-permission-boundary.mjs` verifies the document,
  Prisma tier-board visibility enum, BOLA matrix, and commercial gate wiring.
- `docs/security/BOLA_MATRIX.md` records owner-scoped REST and sync object
  coverage for work/user records, release records, import provider credentials,
  Notion connections, catalog submissions, personal graph records, and tier
  boards; `scripts/qa/validate-bola-matrix.mjs` verifies matrix rows, sync
  entity coverage, unresolved `gap`/`partial` status absence, and commercial
  gate wiring.
- `docs/security/API_AUTHORIZATION_SURFACE.md` classifies every API controller
  boundary; `scripts/qa/validate-api-auth-surface.mjs` verifies protected route
  guards, optional bearer imports routes, cookie-mediated auth routes, metrics
  bearer-token hiding, public health routes, image proxy policy delegation, and
  commercial gate wiring.
- `docs/security/IMAGE_PROXY_PLAN.md` defines the image proxy SSRF, allowlist,
  redirect, content-type, byte-limit, cache, and logging policy;
  `scripts/qa/validate-image-proxy-policy.mjs` verifies the implementation,
  tests, documentation, and commercial gate wiring.
- `docs/security/DATA_RETENTION_AND_PRIVACY.md` defines retention targets,
  historical client metadata handling, server-side data export, and backup
  sensitivity policy, while `docs/security/USER_DATA_RIGHTS_POLICY.md` defines
  the `/api/auth/data-export`, `/api/auth/account/deletion-preview`, and
  `/api/auth/account` contracts. The
  `scripts/qa/validate-retention-policy.mjs` and
  `scripts/qa/validate-user-data-rights-policy.mjs` gates verify that
  operational docs, retention cleanup targets, and data-rights policy stay
  aligned.

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
