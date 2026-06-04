# Public Beta Gate 1 Evidence

Status: partial — local repository gates passed 2026-06-04; host/beta environment items pending.

Use this file as the operator ledger for the first public beta release
candidate. Do not paste secrets, cookies, OAuth codes, access tokens, API keys,
database dumps, backup contents, raw sync payloads, or personally identifying
tester data.

For repeatable collection, follow
[`GATE_1_VALIDATION_RUNBOOK.md`](./GATE_1_VALIDATION_RUNBOOK.md). Local helper
reports can be generated with `npm run qa:gate1:local`, import/search QA with
`npm run qa:import-search`, and sync load dry-run validation with
`npm run qa:sync-load`. Copy only observed summary results into this ledger;
leave environment-only items blank, `blocked`, or `not run` until they are run
on the required release runner, beta host, GitHub Settings page, restore target,
or disposable authenticated test account.

2026-06-04 expert feedback disposition: accepted work is search QA, sync
reliability evidence, API boundary documentation, and operational Gate 1
evidence. Public/community/social/recommendation, mobile, Tauri, i18n, and
open-source licensing changes are not part of this evidence run.

## Release Candidate

- Date and timezone: 2026-06-04 KST (local verification run)
- Commit SHA: 4d46776f74d76e0b226fdb1d673fa097d25128af + dirty working tree
- Host or environment: local development (repository gates only; beta host pending)
- Operator: gkho0
- Public beta URL: not yet assigned
- Release notes or ticket:

## Repository Gates

- `npm run security:public`: PASS — public readiness check passed (2026-06-04, dirty working tree)
- `npm run check:docs-links`: PASS — all markdown local links valid (2026-06-04)
- `npm run lint`: PASS — no ESLint errors across web/api/shared-types (2026-06-04)
- `npm run typecheck`: PASS — no TypeScript errors (2026-06-04)
- `npm run test`: PASS — API 32 suites / 366 tests, web 43 files / 304 tests, shared-types 1 file / 3 tests (2026-06-04)
- `npm run build`: PASS — shared-types `tsc`, API `tsc`, web Vite production build (2026-06-04)
- `npm run qa:import-search`: PASS — report `tmp/import-search-qa/import-search-qa-20260604T120649Z.md`, 28 offline matrix cases + focused import/search tests
- `npm run qa:sync-load`: PASS — report `tmp/sync-load/sync-load-smoke-20260604T120803Z.md`, dry-run synthetic payload validation
- `npm run test:e2e:web`: PASS — 10 Playwright tests passed across chromium and mobile-chrome (2026-06-04; ran outside sandbox because local sandbox blocks localhost bind with `EPERM`)
- `npm run test:e2e`: not run — requires beta host
- `docker compose -f compose.prod.yml --env-file .env.prod config`: not run — requires .env.prod

## GitHub Controls

- Branch protection enabled for `master`: not verified — check GitHub Settings > Branches
- Required checks: not verified — should require `validate` workflow to pass
- CodeQL result: workflow present (.github/workflows/codeql.yml); runs on push/PR/weekly schedule — confirm no alert backlog in GitHub Security tab
- Dependabot enabled: config present (.github/dependabot.yml) — npm + github-actions, weekly Monday 09:00 KST — confirm enabled in GitHub Settings > Code security
- Secret scanning enabled: not verified — enable in GitHub Settings > Code security > Secret scanning
- Push protection enabled: not verified — enable alongside secret scanning
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
| `GET /readyz`                           | not measured | not measured | beta host required |
| `POST /api/auth/refresh` without cookie | not measured | not measured | beta host required |
| Google OAuth login callback             | not measured | not measured | beta host required |
| Sync push small batch                   | not measured | not measured | beta host required |
| Sync pull small archive                 | not measured | not measured | beta host required |
| Import provider status                  | not measured | not measured | beta host required |
| Web `/work-archive-config.js`           | not measured | not measured | beta host required |

Sync load dry-run (local, no API calls): PASS — run ID 20260604T120803Z-a24c4457, 1000 synthetic records, 5 batches generated, status PASS. Live run requires beta host + disposable authenticated account.

## Decision

- Public beta approved:
- Approver:
- Follow-up blockers:
- Follow-up non-blockers:
