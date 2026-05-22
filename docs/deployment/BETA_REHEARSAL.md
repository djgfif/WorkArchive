# Commercial Beta Rehearsal

Run this before promoting a release candidate to public beta.

## Automated Rehearsal

The script skips cleanly when Docker or Docker Compose is unavailable.

```bash
scripts/deploy/commercial-beta-rehearsal.sh .env.prod
```

It performs:

- `docker compose -f compose.prod.yml --env-file .env.prod config`
- release-profile API migration
- stack build/up
- `/health`, `/livez`, `/readyz`
- web static health via `/work-archive-config.js`
- `/api/auth/google/status`
- `/api/imports/providers`
- retention cleanup dry-run

The script does not print secret values. Review Docker logs separately if a
step fails, and redact environment values before sharing output.

## Operator Env Preflight

This check reads `.env.prod`, masks secrets, and verifies the public beta
security baseline. It complements API startup validation and does not replace it.

```bash
scripts/deploy/commercial-env-preflight.mjs .env.prod
```

Required checks include production mode, Redis rate limiting, secure cookies,
Swagger disabled, HTTPS CORS/web/OAuth URLs, and non-default 32+ character JWT,
security-event, and provider-key encryption secrets.
