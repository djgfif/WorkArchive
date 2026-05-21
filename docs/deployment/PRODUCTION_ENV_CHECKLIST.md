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

## Optional Provider Keys

Server-scoped import provider keys are optional:

```bash
TMDB_API_READ_TOKEN=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
KAKAO_REST_API_KEY=
KOBIS_API_KEY=
BRAVE_SEARCH_API_KEY=
TAVILY_API_KEY=
IMPORT_SERVER_SEARCH_GUEST_ENABLED=false
```

User-scoped provider keys are entered by users in Settings and encrypted with
`EXTERNAL_API_KEY_ENCRYPTION_SECRET`.

## Final Preflight

```bash
docker compose -f compose.prod.yml --env-file .env.prod config
```

Confirm no secret values are pasted into issue trackers, deployment reports, or
GitHub comments.
