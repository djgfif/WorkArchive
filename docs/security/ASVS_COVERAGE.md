# ASVS 5.0 Coverage

Last reviewed: 2026-06-20.

Scope: Work Archive API, web runtime headers, production compose, and security
operations artifacts. This is a coverage map, not a certification claim.

OWASP ASVS 5.0 chapter references follow the published ASVS 5.0 taxonomy:
<https://cornucopia.owasp.org/taxonomy/asvs-5.0>.

Status values:

- `satisfied`: implemented and covered by code, tests, or release procedure.
- `partial`: implemented but missing matrix coverage, operational evidence, or
  a planned hardening step.
- `gap`: not implemented or intentionally deferred.

## Coverage Matrix

| Area | ASVS 5.0 reference | Status | Current evidence | Remaining work |
| --- | --- | --- | --- | --- |
| Authentication | V6 Authentication, V10 OAuth and OIDC | partial | Google-only OAuth state and nonce cookies are generated and verified in `apps/api/src/modules/auth/auth.controller.ts`; Google ID tokens validate issuer, audience, algorithm, nonce, and email verification in `apps/api/src/modules/auth/auth.service.ts`; legacy email/password routes return `410 Gone`. | Add OAuth callback and refresh-session security test evidence to each release artifact; consider MFA policy only if the product scope changes beyond Google identity. |
| Session management | V7 Session Management, V9 Self Contained Tokens | partial | Access tokens are short-lived JWTs; refresh tokens are stored in HttpOnly cookies, hashed server-side, rotated, revocable per session, and reuse revokes all sessions in `auth.service.ts`; cookie security comes from `auth.cookies.ts` and runtime `COOKIE_SECURE`. | Add release evidence for session revocation and refresh reuse tests; document cookie attributes in the deployment checklist. |
| Access control | V8 Authorization | partial | Work read/update/delete paths are current-user scoped through `WorksService`, `UserRecordsService.updateActiveForUser`, and `JwtAuthGuard`; release-record REST mutations first load records through an owned parent work record; sync push checks owner mismatch for work, release records, timeline entries, personal graph entities, and tier board entities; pull queries are user-scoped. | Keep `docs/security/BOLA_MATRIX.md` current when adding controllers or sync object families; attach BOLA test evidence to each release artifact. |
| Input validation | V2 Validation and Business Logic, V4 API and Web Service | satisfied | Nest `ValidationPipe` enables transform and whitelist in `apps/api/src/configure-app.ts`; sync payloads use DTO validation with whitelist and `forbidNonWhitelisted`; runtime config validates env shape and numeric/boolean values in `api-runtime-config.ts`. | Maintain DTO validation on every new mutation and sync entity; add property tests only when validation logic becomes complex. |
| Output encoding and sanitization | V1 Encoding and Sanitization, V3 Web Frontend Security | partial | React output is encoded by default; API stores normalized strings; nginx CSP restricts scripts to self and blocks objects/frames in `apps/web/nginx.conf`. | Remove `style-src 'unsafe-inline'` only after the CSP report-only plan proves compatibility; see `docs/security/CSP_HARDENING_PLAN.md`. |
| API hardening | V4 API and Web Service | partial | Global `/api` prefix; explicit JSON and URL-encoded request body limits; CORS allowlist; production fetch metadata guard; production origin guard; client header guard `off/audit/enforce`; rate limits for auth, sync, imports; request IDs and security audit events in `security-middleware.ts`. | Run client header audit before enforce; add evidence for `http.client_header_missing` volume and legitimate client coverage. |
| Configuration | V13 Configuration | partial | Production rejects default secrets, short secrets, localhost CORS origins, non-HTTPS production public URLs, memory rate limiting, missing trust proxy hops, overlarge request body limits, overlarge readiness dependency timeouts, and enabled Swagger in `api-runtime-config.ts`; compose keeps `WORK_ARCHIVE_CLIENT_HEADER_GUARD` default at `audit`. | Attach config preflight output to release artifacts; finish container user/capability hardening review for stateful services. |
| Logging and error handling | V16 Security Logging and Error Handling | partial | `SecurityAuditService` records auth failures/success, logout, session revocation, blocked origin/fetch metadata/client header events, and rate-limit events with hashed IP/user-agent context and sanitized metadata values; sync and import providers emit structured operational logs; Gate 1 Prometheus alert rules are versioned in `docs/operations/monitoring/work-archive-alerts.yml`; Gate 1 SLO rules are versioned in `docs/operations/monitoring/work-archive-slo-rules.yml`; the Gate 1 Grafana dashboard is versioned in `docs/operations/monitoring/work-archive-grafana-dashboard.json`; `scripts/qa/monitoring-evidence.mjs` collects redacted monitoring deployment evidence; `scripts/qa/validate-gate1-evidence.mjs` blocks public beta approval when live evidence placeholders remain. | Deploy and route the alert/SLO rules, import the dashboard in the beta monitoring stack, run live monitoring evidence collection, prove retention cleanup in release notes, and keep logs free of tokens, OAuth codes, provider keys, and full image URLs. |
| Data protection and cryptography | V11 Cryptography, V14 Data Protection | partial | JWT secrets and security event hash secrets are required in production; external provider credentials are encrypted via `ExternalApiKeyCryptoService`; refresh tokens are hashed; retention cleanup exists for security events and sessions; `npm run qa:migrations` blocks unregistered high-risk Prisma migration SQL through `docs/operations/MIGRATION_RISK_REGISTER.md`. | Add release artifact proving retention dry-run/delete counts; make `UserWorkRecord.userId` non-null after the owner invariant migration plan passes. |
| External service use | V12 Secure Communication, V13.2 Backend Communication Configuration | partial | Google OAuth endpoints and most import providers use HTTPS and bounded fetch timeouts; provider credential access is user-scoped; KOBIS HTTP provider is disabled unless explicitly enabled; `fetchExternal` and image proxy use HTTPS-only URLs, provider allowlists, DNS resolution with private/special-use address rejection, timeouts, max bytes, content-type checks, and cache headers. | Add staging report-only telemetry before narrowing CSP `img-src`; keep provider allowlist changes reviewed as code changes. |
| Security scan evidence | V13 Configuration, V15 Secure Coding and Architecture | partial | Root `package.json` keeps `security:audit`, `security:audit:prod`, `security:scan:fs`, `security:scan:images`, and `security:scan:release`; scan recording template exists in `docs/security/SECURITY_SCAN_RESULTS.md`. | Run npm audit and Trivy on the release runner for every beta/production candidate and commit or attach summarized results. |

## Release Gate

Before public beta or production:

1. Update this matrix if a control status changes.
2. Update `docs/security/BOLA_MATRIX.md` for ownership-sensitive routes.
3. Attach scan summaries in `docs/security/SECURITY_SCAN_RESULTS.md`.
4. Re-run the validation commands listed in the release checklist and this
   task's completion report.
