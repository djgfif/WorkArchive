# Commercial Beta Rehearsal

Run this before promoting a release candidate to public beta.

## Automated Rehearsal

The script skips cleanly when Docker or Docker Compose is unavailable.

```bash
scripts/deploy/commercial-beta-rehearsal.sh .env.prod
```

It performs:

- production beta preflight with the real `.env.prod`
- `docker compose -f compose.prod.yml --env-file .env.prod config`
- release-profile API migration
- stack build/up
- production healthcheck for `/health`, `/livez`, and `/readyz` through the
  deployed web origin, with displayed diagnostics redacted
- beta smoke for web static serving, runtime config, Google OAuth status, API
  security headers through the deployed proxy, OAuth flow cookie attributes,
  import providers, refresh guard behavior, sync validation, and read-only
  container filesystems
- public unauthenticated `/metrics` exposure check, always expecting `404`
- optional internal collector `/metrics` check with `SMOKE_METRICS_BEARER_TOKEN`,
  expecting `200` and Work Archive metrics content
- retention cleanup dry-run

The script redacts URL userinfo, bearer/basic credentials, secret-like
environment values, and sensitive query parameters from displayed diagnostics.
Review Docker logs separately if a step fails, and redact environment values
before sharing output.

## Operator Env Preflight

This check reads `.env.prod`, masks secrets, and verifies the public beta
security baseline. It complements API startup validation and does not replace it.

```bash
scripts/deploy/commercial-env-preflight.mjs .env.prod
```

Required checks include production mode, Redis rate limiting, secure cookies,
Swagger disabled, host-specific HTTPS CORS/web/OAuth URLs, present Google OAuth
credentials, and non-default 32+ character JWT, security-event, and provider-key
encryption secrets.

If `METRICS_ENABLED=true`, the preflight requires
`METRICS_INTERNAL_ACCESS_REVIEWED=true`. That flag is an operator assertion that
the endpoint is reachable only by an internal collector or allowlisted
reverse-proxy path. Production metrics also require `METRICS_BEARER_TOKEN`;
public smoke should keep expecting `/metrics` to return `404`, and collector
smoke can set `SMOKE_METRICS_BEARER_TOKEN` to verify the internal `200` path.

## Evidence

Record each public beta release candidate in
[`../../commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`](../../commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md).
The release is not Gate 1 complete until repository gates, GitHub controls,
host smoke, restore drill, metrics exposure, and smoke-level latency baseline
are all recorded.
