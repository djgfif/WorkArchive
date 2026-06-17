# Deployment Readiness Report Template

Date:

Release/commit:

Environment:

Operator:

Scope: closed beta production rehearsal for the existing Work Archive architecture: local-first web, NestJS API, PostgreSQL, Redis rate limiting, Google-only auth, Dexie `syncQueue`, and Tier Board Maker.

Out of scope: Kafka, Saga orchestration, API Gateway, Redis general caching, public community/share feed, and email/password login.

## Summary Judgment

Status: Pending / Ready for closed beta / Not ready

Decision owner:

Notes:

## Automated Verification

| Check                                                           | Result  | Evidence / Notes |
| --------------------------------------------------------------- | ------- | ---------------- |
| `npm run typecheck --workspace @work-archive/shared-types`      | Pending |                  |
| `npm run typecheck --workspace @work-archive/api`               | Pending |                  |
| `npm run typecheck --workspace @work-archive/web`               | Pending |                  |
| `npm run test --workspace @work-archive/api`                    | Pending |                  |
| `npm run test --workspace @work-archive/web`                    | Pending |                  |
| `npm run build`                                                 | Pending |                  |
| `scripts/deploy/prod-build.sh`                                  | Pending |                  |

## Scripted Deployment Execution

- [ ] `.env.prod` created on the target host from `.env.prod.example`; secrets were not pasted into this report.
- [ ] `docker compose -f compose.prod.yml --env-file .env.prod config >/dev/null` passed.
- [ ] `scripts/deploy/prod-build.sh` passed.
- [ ] `scripts/deploy/prod-up.sh` started the stack.
- [ ] `scripts/deploy/prod-healthcheck.sh` passed for `/health`, `/livez`, and `/readyz`.
- [ ] `scripts/deploy/prod-backup.sh` created a UTC timestamped `.dump` backup and `.sha256` sidecar.
- [ ] `scripts/deploy/prod-backup-verify.sh` passed for the selected backup.
- [ ] Backup and checksum were copied off-host.
- [ ] `scripts/deploy/prod-restore.sh.example` was reviewed and restore was performed only on an approved disposable or incident target.
- [ ] `scripts/deploy/prod-logs.sh` log review found no secrets.
- [ ] `scripts/deploy/prod-down.sh` rollback/stop command was rehearsed or explicitly marked not required.

Script execution notes:

- Build timestamp/result:
- Up timestamp/result:
- Healthcheck base URL:
- Backup filename:
- Restore target/result:
- Operator notes:

## Production Compose

| Item                                                                        | Result  | Evidence / Notes            |
| --------------------------------------------------------------------------- | ------- | --------------------------- |
| `.env.prod` created from `.env.prod.example`                                | Pending | Do not paste secret values. |
| `docker compose config` succeeds                                            | Pending |                             |
| production images build                                                     | Pending |                             |
| stack starts with `up -d`                                                   | Pending |                             |
| `/work-archive-config.js` loads before React bundle and contains no secrets | Pending |                             |
| `work-archive-postgres` healthy                                             | Pending |                             |
| `work-archive-redis` healthy                                                | Pending |                             |
| `work-archive-api` healthy                                                  | Pending |                             |
| `work-archive-web` running                                                  | Pending |                             |

## Health Smoke

| Endpoint  | Result  | Evidence / Notes |
| --------- | ------- | ---------------- |
| `/health` | Pending |                  |
| `/livez`  | Pending |                  |
| `/readyz` | Pending |                  |

## Google OAuth

| Check                                                           | Result  | Evidence / Notes            |
| --------------------------------------------------------------- | ------- | --------------------------- |
| Google Console redirect URI exactly matches production callback | Pending |                             |
| `.env.prod` redirect URI exactly matches Google Console         | Pending |                             |
| `/auth/login` shows Google-only login                           | Pending |                             |
| Google start endpoint redirects to Google                       | Pending |                             |
| callback returns to `/auth/google/complete`                     | Pending |                             |
| `/api/auth/me` returns authenticated user                       | Pending |                             |
| cookies are `HttpOnly` and `Secure`                             | Pending | Do not paste cookie values. |
| email/password routes remain unavailable                        | Pending |                             |

## Backup And Restore Drill

| Check                                   | Result  | Evidence / Notes           |
| --------------------------------------- | ------- | -------------------------- |
| pre-rehearsal backup created            | Pending | Filename only; no secrets. |
| checksum verified                       | Pending | `.sha256` sidecar only.    |
| backup copied off-host                  | Pending | Destination class only.    |
| restore into disposable target succeeds | Pending |                            |
| `/readyz` passes after restore          | Pending |                            |
| Google login checked after restore      | Pending |                            |
| sync checked after restore              | Pending |                            |
| tier boards checked after restore       | Pending |                            |

## Tier Board Smoke

| Check                                                                        | Result  | Evidence / Notes |
| ---------------------------------------------------------------------------- | ------- | ---------------- |
| `tierBoards` flag-off hides nav and redirects tier-board routes, if disabled | Pending |                  |
| `/tier-boards` opens                                                         | Pending |                  |
| board created                                                                | Pending |                  |
| text card added                                                              | Pending |                  |
| image URL card added                                                         | Pending |                  |
| uploaded image card added                                                    | Pending |                  |
| work snapshot card added                                                     | Pending |                  |
| pool-to-lane move works                                                      | Pending |                  |
| lane-to-pool move works                                                      | Pending |                  |
| JSON export/import works                                                     | Pending |                  |
| PNG export works or documented fallback appears                              | Pending |                  |
| source WorkRecord not modified by snapshot card movement                     | Pending |                  |
| public share/community remains disabled                                      | Pending |                  |

## Sync Idempotency Smoke

| Check                                                           | Result  | Evidence / Notes |
| --------------------------------------------------------------- | ------- | ---------------- |
| duplicate work `clientMutationId` is already applied            | Pending |                  |
| no duplicate work row                                           | Pending |                  |
| duplicate tier board card `clientMutationId` is already applied | Pending |                  |
| no duplicate tier board card row                                | Pending |                  |
| no duplicate applied mutation row per user/mutation             | Pending |                  |

## Log Redaction Review

| Check                                                   | Result  | Evidence / Notes |
| ------------------------------------------------------- | ------- | ---------------- |
| no OAuth code/token values                              | Pending |                  |
| no authorization header values                          | Pending |                  |
| no cookie or refresh token values                       | Pending |                  |
| no provider API key values                              | Pending |                  |
| no database password values                             | Pending |                  |
| no raw image data or full data URLs                     | Pending |                  |
| safe `errorCode` and `requestId` present where expected | Pending |                  |

## Open Risks

-

## Follow-Up Before Closed Beta

-

## Approval

Approved by:

Approved at:
