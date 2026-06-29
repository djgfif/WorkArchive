# Release Checklist

## Preflight

- Confirm this release does not introduce Kafka, Saga orchestration, an API Gateway, Redis general caching, public community features, or email/password login.
- For public beta candidates, confirm
  `docs/commercial/COMMERCIAL_LAUNCH_READINESS.md` is the active gate and update
  `docs/commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md` with real run results.
- For public beta candidates, follow
  `docs/commercial/GATE_1_VALIDATION_RUNBOOK.md` and keep generated local QA
  reports separate from the operator evidence ledger until an operator copies
  observed summaries.
- For public beta approval, run
  `GATE1_EVIDENCE_STRICT=true npm run qa:gate1:evidence` after the evidence
  ledger is populated.
- Review migration notes and confirm rollback compatibility.
- Run `npm run qa:migrations` and confirm any high-risk Prisma migration has an
  approved entry in
  [`MIGRATION_RISK_REGISTER.md`](./MIGRATION_RISK_REGISTER.md).
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
npm run qa:commercial:repo
npm run qa:migrations
npm run qa:import-search
npm run qa:sync-load
docker compose -f compose.prod.yml --env-file .env.prod build
```

Security scan gate, run on the official release CI/runner with Trivy installed:

```bash
npm run security:audit:prod:high
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
high or critical production runtime dependency findings block public beta and
production release unless a vulnerability waiver records advisory id,
reachability, compensating control, owner, expiry, and the next retest command.

Public beta host checks:

```bash
scripts/deploy/beta-preflight.sh
BETA_BASE_URL=<beta-url> scripts/deploy/beta-smoke.sh
```

## Migration

- Review Prisma migration SQL.
- Run `npm run qa:migrations`.
- Review Dexie version migrations, if any.
- Review sync `schemaVersion` changes, if any.
- Confirm destructive migration is not present, or explicit approval exists in
  [`MIGRATION_RISK_REGISTER.md`](./MIGRATION_RISK_REGISTER.md).
- Create a fresh pre-deployment PostgreSQL backup.
- Prefer `BACKUP_DIR=backups npm run ops:backup` so the dump, checksum sidecar,
  and redacted `tmp/backups/prod-backup-*.md` report are created together.
- Verify the selected dump with
  `BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump npm run ops:backup:verify`.
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
- Run `npm run qa:alerts` and confirm
  `docs/operations/monitoring/work-archive-alerts.yml` is deployed or explicitly
  waived for the release.
- Run `npm run qa:slo` and confirm
  `docs/operations/monitoring/work-archive-slo-rules.yml` is deployed or
  explicitly waived for the release.
- Run `npm run qa:dashboards` and confirm
  `docs/operations/monitoring/work-archive-grafana-dashboard.json` is imported
  into Grafana or explicitly waived for the release.
- Run `npm run qa:monitoring` against the real monitoring endpoints and copy
  only the redacted summary into the release evidence ledger.

## Smoke Tests

- Google OAuth login and logout.
- Guest/local archive create and JSON export.
- Authenticated sync push and pull.
- If `tierBoards` is disabled, confirm tier board navigation is hidden and tier board routes redirect to `/works`.
- Confirm disabled or placeholder-only routes such as `/community` and `/insights` do not appear in the visible navigation.
- Tier board create, edit, JSON export/import, and PNG export if changed.
- Import provider diagnostics page or API response.
- Smoke-level latency baseline from `npm run qa:performance-smoke` for
  `/readyz`, auth refresh rejection, sync push/pull, import provider status,
  and `/work-archive-config.js`; record p50, p95, configured budget status, and
  observed rate-limit headers.

## Rollback

- If no incompatible migration was applied, roll back API/web code to the previous release.
- If an irreversible migration was applied, restore from the pre-deployment backup.
- After rollback, check `/health`, `/livez`, `/readyz`, sync smoke, tier board smoke, and Google OAuth redirect.
