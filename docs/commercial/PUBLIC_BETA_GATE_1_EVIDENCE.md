# Public Beta Gate 1 Evidence

Status: no public beta evidence recorded yet.

Use this file as the operator ledger for the first public beta release
candidate. Do not paste secrets, cookies, OAuth codes, access tokens, API keys,
database dumps, backup contents, raw sync payloads, or personally identifying
tester data.

## Release Candidate

- Date and timezone:
- Commit SHA:
- Host or environment:
- Operator:
- Public beta URL:
- Release notes or ticket:

## Repository Gates

- `npm run security:public`:
- `npm run check:docs-links`:
- `npm run lint`:
- `npm run typecheck`:
- `npm run test`:
- `npm run test:e2e`:
- `npm run build`:
- `docker compose -f compose.prod.yml --env-file .env.prod config`:

## GitHub Controls

- Branch protection enabled for `master`:
- Required checks:
- CodeQL result:
- Dependabot enabled:
- Secret scanning enabled:
- Push protection enabled:
- Waivers:

## Host Preflight And Smoke

- `scripts/deploy/beta-preflight.sh`:
- Migration command:
- API/web startup:
- `scripts/deploy/beta-smoke.sh`:
- `/health`:
- `/livez`:
- `/readyz`:
- `/metrics` public unauthenticated exposure result:
- `/metrics` internal collector bearer-token result:
- Google OAuth login/logout:
- Guest JSON export/import:
- Guest-to-account transfer review:
- Authenticated sync push/pull:
- Sync conflict resolution:
- Import provider failure fallback:

## Backup And Restore Drill

- Backup command:
- Backup file identifier:
- Off-host copy location:
- Restore target:
- Restore start/end time:
- Observed RPO:
- Observed RTO:
- Post-restore `/readyz`:
- Post-restore sync smoke:
- Gaps found:

## Smoke-Level Performance Baseline

Record p50/p95 or the closest available timing from the beta host. If a metric
is not measured, write `not measured` and explain why.

| Scenario                                | p50 | p95 | Notes |
| --------------------------------------- | --: | --: | ----- |
| `GET /readyz`                           |     |     |       |
| `POST /api/auth/refresh` without cookie |     |     |       |
| Google OAuth login callback             |     |     |       |
| Sync push small batch                   |     |     |       |
| Sync pull small archive                 |     |     |       |
| Import provider status                  |     |     |       |
| Web `/work-archive-config.js`           |     |     |       |

## Decision

- Public beta approved:
- Approver:
- Follow-up blockers:
- Follow-up non-blockers:
