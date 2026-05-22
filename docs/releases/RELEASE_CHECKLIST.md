# Release Checklist

## Preflight

- Confirm this release does not introduce Kafka, Saga orchestration, an API Gateway, Redis general caching, public community features, or email/password login.
- Review migration notes and confirm rollback compatibility.
- Confirm `.env.prod` values are present and production secrets are not defaults.
- Confirm Google OAuth redirect URI exactly matches the deployed callback URL.
- Confirm runtime feature flag overrides are in `/work-archive-config.js`, loaded before the React bundle, and contain no secrets.
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

## Migration

- Review Prisma migration SQL.
- Review Dexie version migrations, if any.
- Review sync `schemaVersion` changes, if any.
- Confirm destructive migration is not present, or explicit approval exists.
- Create a fresh pre-deployment PostgreSQL backup.

## Deploy

- Apply database migration with `npm run prisma:migrate:deploy --workspace @work-archive/api`.
- Deploy API and web from the same approved release.
- Check `/health`, `/livez`, and `/readyz`.
- Confirm Redis rate limiting is connected when `REDIS_URL` is configured.

## Smoke Tests

- Google OAuth login and logout.
- Guest/local archive create and JSON export.
- Authenticated sync push and pull.
- If `tierBoards` is disabled, confirm tier board navigation is hidden and tier board routes redirect to `/works`.
- Confirm disabled or placeholder-only routes such as `/community` and `/insights` do not appear in the visible navigation.
- Tier board create, edit, JSON export/import, and PNG export if changed.
- Import provider diagnostics page or API response.

## Rollback

- If no incompatible migration was applied, roll back API/web code to the previous release.
- If an irreversible migration was applied, restore from the pre-deployment backup.
- After rollback, check `/health`, `/livez`, `/readyz`, sync smoke, tier board smoke, and Google OAuth redirect.
