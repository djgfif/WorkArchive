# Release Checklist

## Preflight

- Confirm this release does not introduce Kafka, Saga orchestration, an API Gateway, Redis general caching, public community features, or email/password login.
- For public beta candidates, confirm
  `docs/commercial/COMMERCIAL_LAUNCH_READINESS.md` is the active gate and update
  `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md` with real run results.
- Review migration notes and confirm rollback compatibility.
- Confirm `.env.prod` values are present and production secrets are not defaults.
- Confirm Google OAuth redirect URI exactly matches the deployed callback URL.
- Confirm runtime feature flag overrides are in `/work-archive-config.js`, loaded before the React bundle, and contain no secrets.
- Before switching repository visibility to public, run `scripts/security/public-readiness-check.sh` and confirm no non-example `.env`, logs, high-confidence secrets, or personal machine paths are tracked.
- Confirm GitHub branch protection, required checks, secret scanning, push
  protection, CodeQL, and Dependabot status are recorded for the release.
- Confirm `METRICS_ENABLED=true` is used only behind an internal collector or
  allowlisted reverse-proxy path. If not reviewed, keep `METRICS_ENABLED=false`.
- Confirm public community/share flags remain disabled.
- Confirm inactive placeholder-only features such as Community and Insights are not exposed in primary navigation.

## Verification

Run:

```bash
npm run typecheck --workspace @work-archive/shared-types
npm run typecheck --workspace @work-archive/api
npm run typecheck --workspace @work-archive/web
npm run test --workspace @work-archive/api
npm run test --workspace @work-archive/web
npm run build
docker compose -f compose.prod.yml --env-file .env.prod build
```

Security scan gate, run on the official release CI/runner with Trivy installed:

```bash
npm run security:audit:prod
npm run security:audit
npm run security:scan:fs
WORK_ARCHIVE_API_IMAGE=<api-release-tag-or-digest> \
WORK_ARCHIVE_WEB_IMAGE=<web-release-tag-or-digest> \
npm run security:scan:images
```

Record Trivy version, runner name, image tag/digest, and summary counts in
`docs/security/SECURITY_SCAN_RESULTS.md`. Do not use `latest` as an image scan
artifact.

Public beta host checks:

```bash
scripts/deploy/beta-preflight.sh
BETA_BASE_URL=<beta-url> scripts/deploy/beta-smoke.sh
```

## Migration

- Review Prisma migration SQL.
- Review Dexie version migrations, if any.
- Review sync `schemaVersion` changes, if any.
- Confirm destructive migration is not present, or explicit approval exists.
- Create a fresh pre-deployment PostgreSQL backup.
- Move the backup off-host before applying migrations.
- For public beta, restore the backup once into a non-production target and
  record observed RPO/RTO in
  `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`.

## Deploy

- Apply database migration with `npm run prisma:migrate:deploy --workspace @work-archive/api`.
- Deploy API and web from the same approved release.
- Check `/health`, `/livez`, and `/readyz`.
- Confirm Redis rate limiting is connected when `REDIS_URL` is configured.
- Confirm public unauthenticated `/metrics` returns `404`.
- If metrics are enabled, confirm the reviewed internal collector path returns
  `200` only with `SMOKE_METRICS_BEARER_TOKEN`.

## Smoke Tests

- Google OAuth login and logout.
- Guest/local archive create and JSON export.
- Authenticated sync push and pull.
- If `tierBoards` is disabled, confirm tier board navigation is hidden and tier board routes redirect to `/works`.
- Confirm disabled or placeholder-only routes such as `/community` and `/insights` do not appear in the visible navigation.
- Tier board create, edit, JSON export/import, and PNG export if changed.
- Import provider diagnostics page or API response.
- Smoke-level latency baseline for `/readyz`, auth refresh rejection, sync
  push/pull, import provider status, and `/work-archive-config.js`.

## Rollback

- If no incompatible migration was applied, roll back API/web code to the previous release.
- If an irreversible migration was applied, restore from the pre-deployment backup.
- After rollback, check `/health`, `/livez`, `/readyz`, sync smoke, tier board smoke, and Google OAuth redirect.
