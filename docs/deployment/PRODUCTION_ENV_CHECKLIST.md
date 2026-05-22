# Production Environment Checklist

Do not commit `.env.prod`. Keep real secrets outside GitHub and outside exported
JSON backups.

Use this checklist to create `.env.prod` on the deployment host:

```bash
cp .env.example .env.prod
chmod 600 .env.prod
```

## Required Database Values

```bash
POSTGRES_DB=work_archive
POSTGRES_USER=work_archive
POSTGRES_PASSWORD=<generate with: openssl rand -base64 32>
DATABASE_URL=postgresql://work_archive:<same password>@postgres:5432/work_archive?schema=public
```

`DATABASE_URL` must match the Postgres service credentials. Do not use the
development `postgres/postgres` credential in production.

## Required API Secrets

Generate each value independently:

```bash
openssl rand -base64 48
```

Required keys:

```bash
JWT_ACCESS_SECRET=<generated 48+ byte secret>
JWT_REFRESH_SECRET=<generated 48+ byte secret>
EXTERNAL_API_KEY_ENCRYPTION_SECRET=<generated 48+ byte secret>
SECURITY_EVENT_HASH_SECRET=<generated 48+ byte secret>
```

Do not reuse secrets across fields. Rotate by deploying a planned session reset
window for JWT refresh secret changes.

## Google OAuth

Create an OAuth Web Client in Google Cloud Console.

Authorized redirect URI example:

```text
https://archive.example.com/api/auth/google/callback
```

Environment:

```bash
GOOGLE_OAUTH_CLIENT_ID=<google web client id>
GOOGLE_OAUTH_CLIENT_SECRET=<google web client secret>
GOOGLE_OAUTH_REDIRECT_URI=https://archive.example.com/api/auth/google/callback
```

`GOOGLE_OAUTH_REDIRECT_URI` must exactly match the Google Console Authorized
redirect URI, including scheme, host, path, and trailing slash behavior.

## Public Origins And URLs

```bash
CORS_ORIGIN=https://archive.example.com
WEB_BASE_URL=https://archive.example.com
VITE_API_BASE_URL=/api
```

If the API is hosted on a separate subdomain, set `VITE_API_BASE_URL` to that
public API origin and include the web origin in `CORS_ORIGIN`.

## Production Security Defaults

```bash
RATE_LIMIT_STORE=redis
REDIS_URL=redis://redis:6379
TRUST_PROXY_HOPS=1
COOKIE_SECURE=true
SWAGGER_ENABLED=false
NODE_ENV=production
```

`TRUST_PROXY_HOPS=1` assumes the API receives requests through the web/reverse
proxy layer. Re-evaluate only if the proxy topology changes.

Production compose runs API and web as non-root containers with read-only
runtime filesystems and tmpfs scratch paths. Migrations are not run in the API
entrypoint; run the release profile job before rolling the app:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
```

## Operational Retention

Defaults:

```bash
RETENTION_SECURITY_EVENT_DAYS=180
RETENTION_REVOKED_REFRESH_SESSION_DAYS=30
RETENTION_EXPIRED_REFRESH_SESSION_DAYS=30
RETENTION_USED_PASSWORD_RESET_TOKEN_DAYS=7
RETENTION_EXPIRED_PASSWORD_RESET_TOKEN_DAYS=7
RETENTION_CLEANUP_DRY_RUN=true
```

Production deletion requires:

```bash
RETENTION_CLEANUP_DRY_RUN=false
RETENTION_CLEANUP_CONFIRM=delete-expired-operational-data
```

Run a dry-run first and review matched counts:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile maintenance run --rm retention-cleanup
```

## Search Provider Keys

Cost-bearing import provider keys are user-scoped. Users enter Brave Search,
Tavily Search, Naver, Kakao, Aladin, TMDB, and KOBIS keys in Settings; values
are encrypted with `EXTERNAL_API_KEY_ENCRYPTION_SECRET`.

```bash
IMPORT_SERVER_SEARCH_GUEST_ENABLED=false
```

`IMPORT_SERVER_SEARCH_GUEST_ENABLED` is reserved for future server-credential
providers. It does not expose Brave Search or Tavily Search to guests.

KOBIS upstream search is HTTP-only in the current provider implementation and
uses a query parameter API key because the provider API requires it. Keep it
user-scoped, avoid guest exposure, and deploy only where outbound traffic stays
inside an acceptable network boundary.

## Final Preflight

```bash
docker compose -f compose.prod.yml --env-file .env.prod config
```

Confirm no secret values are pasted into issue trackers, deployment reports, or
GitHub comments.
