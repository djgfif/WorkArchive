# Log Redaction Policy

Status: Gate 1 policy baseline.

Backend logs and security events must be useful for operations without storing
secrets or one-time credentials. This policy covers HTTP request logs,
structured application logs, QA reports, and `security_events` metadata.

## HTTP Request Log Redaction

`apps/api/src/app.module.ts` owns HTTP request log redaction for
`nestjs-pino`.

Required behavior:

- redact `req.headers.authorization`;
- redact `req.headers.cookie`;
- redact `res.headers["set-cookie"]`;
- serialize request URLs through `sanitizeRequestUrlForLog`;
- log only the request path, not query strings or fragments.

The request URL rule specifically protects OAuth authorization codes, OAuth
state values, provider credential-like query parameters, and token-like values
that may appear in callback or diagnostic URLs.

## Security Audit Metadata

`apps/api/src/security/security-audit.service.ts` owns security audit metadata
sanitization.

Required behavior:

- drop sensitive metadata keys such as authorization, cookie, email, password,
  secret, token, API key, OAuth authorization code, OAuth state, nonce,
  session, provider account ID, credential, and set-cookie;
- redact inline bearer and basic credentials in retained string values;
- redact inline sensitive key-value pairs such as `code=...`, `state=...`,
  `nonce=...`, `session=...`, `id_token=...`, `refresh_token=...`, and
  `oauth_code=...`;
- strip URL query strings and fragments;
- remove control characters;
- cap stored string metadata length.

Security audit metadata must store bounded reason codes and stable identifiers,
not user input, cookies, OAuth authorization codes, access tokens, refresh
tokens, provider keys, or full URLs with query strings.

## Structured Application Logs

Authentication failure logs must be structured. Google OAuth callback failures,
Google provider token/JWKS failures, and refresh-token failures may record event
name, provider, bounded error code, HTTP status, stale-cache use, user ID, and
request ID. They must not include OAuth authorization codes, ID tokens, refresh
tokens, cookies, provider client secrets, API keys, or raw provider bodies.

Startup and operation failure logs must be structured and bounded. API bootstrap
failures, PostgreSQL startup connection failures, and one-off operations may
record the subsystem event and error code. This includes maintenance commands
such as legacy genre migration, retention cleanup, and import-provider circuit
clearing. They must not emit raw stack traces, database URLs, Redis URLs,
credentials, tokens, cookies, filesystem paths, or raw payload text.

Unhandled API exception logs must use the bounded `api.exception.unhandled`
event with request ID, error code, method, and sanitized path only. They must not
emit raw exception messages, stack frames, query strings, OAuth codes, database
URLs, tokens, or filesystem paths.

Import/search logs must keep provider diagnostics useful without storing raw
queries or provider payloads. Search summaries record query length, provider
set, result count, status, user scope, and request ID when available. Provider
failure logs record bounded provider/error fields and request ID, not provider
secrets, raw image data, access tokens, cookies, or raw search text.

Image proxy failure logs must be structured JSON and may record only the
provider host and bounded error code. They must not include the full upstream
image URL, path, query string, provider token, access token, or raw image data.

Work mutation failure logs must use bounded structured fields such as operation,
entity type, error code, user ID, work ID, and request ID. They must not append
raw exception messages, database URLs, tokens, cookies, or request payload text.

Operational fallback logs for Redis-backed rate limits, OAuth flow storage,
import provider runtime state, and security audit persistence must be structured.
They may record the subsystem event, provider, event type, request ID, and
bounded error code. They must not append raw exception messages, Redis URLs,
database URLs, credentials, tokens, cookies, API keys, OAuth codes, or payload
text.

Sync failure logs must remain structured and bounded. Push, pull, and per-change
failure events may record stable IDs such as user ID, entity ID, queue ID,
operation, counts, error code, duration, and request ID. They must not append raw
exception messages, request payloads, access tokens, cookies, API keys, OAuth
codes, provider payloads, or image blobs.

## Operator Log Retrieval

Operators must prefer `npm run ops:logs` or `scripts/deploy/prod-logs.sh` over
raw `docker logs` when reviewing production containers. The helper redacts URL
credentials, bearer/basic credentials, secret-like environment values,
PostgreSQL/Redis URL credentials, and sensitive query parameters such as
authorization codes, OAuth codes, state, nonce, access tokens, ID tokens,
refresh tokens, session values, credentials, API keys, cookies, passwords, and
secrets before printing logs by default. The same sensitive names must also be
redacted when they appear as standalone `key=value` fragments in diagnostics,
not only when they are URL query parameters.

Raw production logs require both `PROD_LOGS_RAW=true` and
`PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs`. Raw output is for local
incident inspection only and must not be copied into tickets, release evidence,
or docs without manual redaction.

## Release Gate

Run this check before public beta approval and after changing logging, auth,
OAuth, import providers, monitoring, or security audit code:

```bash
npm run qa:log-redaction-policy
```

The gate fails when HTTP request URL sanitization is removed, critical header
redaction is weakened, security audit metadata sanitization drifts, regression
tests disappear, or this policy falls out of sync with commercial readiness
evidence.
