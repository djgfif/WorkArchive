# Production Smoke Test

This rehearsal keeps the existing architecture: NestJS API, PostgreSQL, Redis
rate limiting, Google-only auth, local-first Dexie, and syncQueue. Do not add
Kafka, Saga, API Gateway, Redis general cache, or distributed locks.

Set:

```bash
DOMAIN=https://archive.example.com
```

## Compose Boot

```bash
docker compose -f compose.prod.yml --env-file .env.prod build
docker compose -f compose.prod.yml --env-file .env.prod up -d
docker compose -f compose.prod.yml --env-file .env.prod ps
```

Expected:

- `work-archive-postgres` healthy
- `work-archive-redis` healthy
- `work-archive-api` healthy
- `work-archive-web` running

## Health Endpoints

```bash
curl -i "$DOMAIN/health"
curl -i "$DOMAIN/livez"
curl -i "$DOMAIN/readyz"
```

Expected:

- `/health`: HTTP 200, legacy health response
- `/livez`: HTTP 200 even if DB/Redis are unavailable
- `/readyz`: HTTP 200 only when config, PostgreSQL, and Redis are ready

`compose.prod.yml` intentionally checks API readiness every 30 seconds with a
45 second start period. `/readyz` opens a short Redis connection for the check,
so avoid very short intervals on small VPS hosts.

## Logs

```bash
docker logs work-archive-api --tail=100
docker logs work-archive-web --tail=100
```

Review:

- no `authorization`, `cookie`, `set-cookie`, token, OAuth code, API key, or raw
  image data in logs;
- request logs include request IDs where request context exists;
- failed provider/import/auth/sync events log safe `errorCode` values only.

## Google OAuth Production Smoke

Checklist:

- Google Console Authorized redirect URI contains
  `https://archive.example.com/api/auth/google/callback`.
- `GOOGLE_OAUTH_REDIRECT_URI` exactly matches that value.
- Open `/auth/login`.
- Click `Google로 계속하기`.
- Confirm `/api/auth/google/start` redirects to Google.
- Complete Google login.
- Confirm callback returns to `/auth/google/complete`.
- Confirm refresh cookie is set with `Secure`, `HttpOnly`, and same-site policy.
- Confirm `/api/auth/me` returns the authenticated user.
- Create or keep guest records before login and confirm guest transfer review is
  still shown after login.

## Sync Idempotency Smoke

Use browser devtools or an API client with the authenticated access token. Do not
paste tokens into logs or docs.

Work entity:

1. Create one work from the web UI.
2. Trigger account sync so the `syncQueue` item is pushed.
3. Capture the pushed request body locally and note its `clientMutationId`.
4. Re-send the same `/api/sync/push` body once.
5. Expected: response result is `applied` with `code: "already_applied"`.
6. In PostgreSQL, confirm the work row was not duplicated.
7. Confirm one `user_sync_applied_mutations` row exists for
   `(userId, clientMutationId)`.

Tier Board card:

1. Create a tier board card.
2. Trigger sync and capture the push body for `entityType: "tier_board_card"`.
3. Re-send the same body with the same `clientMutationId`.
4. Expected: `code: "already_applied"`.
5. Confirm no duplicate `user_tier_board_cards` row.

Safe DB checks:

```bash
docker exec -it work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''select "clientMutationId", count(*) from user_sync_applied_mutations group by 1 having count(*) > 1;'\'''
```

Expected: zero rows.

## Tier Board Smoke

Checklist:

- Open `/tier-boards`.
- Create a new board.
- Add a text card.
- Add an image URL card.
- Add an uploaded image card.
- Add a card from an existing work snapshot.
- Move a card from pool to lane.
- Move a card from lane back to pool.
- Export board JSON.
- Import that JSON as a new board.
- Export PNG.
- Confirm the linked `WorkRecord` was not modified by tier board movement.

Suggested read-only DB comparison:

```bash
docker exec -it work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''select id, "updatedAt", "serverVersion" from user_work_records order by "updatedAt" desc limit 10;'\'''
```

Run it before and after tier card movement for the linked work. Movement should
not bump the work record.

## Provider Circuit Breaker Smoke

Temporarily test with one intentionally invalid optional provider key in a
controlled environment, then restore the real configuration.

Expected:

- repeated provider failures produce `imports.provider.failed`;
- search diagnostics include `reasonCode: "circuit_open"` after the threshold;
- UI notice says some search sources are temporarily resting;
- Settings provider status shows the provider as temporarily paused.

## Observability Sample Review

Check API logs for:

- `requestId` on request-scoped structured events;
- `sync.push.completed`;
- `sync.push.failed` if a controlled failure was tested;
- `auth.google.failed` with only a safe `errorCode`;
- `imports.provider.failed` with no API key;
- `tier_board.import.failed` with no raw image data;
- no cookie, token, OAuth code, or authorization header values.

## Shutdown After Rehearsal

For a non-production rehearsal host:

```bash
docker compose -f compose.prod.yml --env-file .env.prod down
```

Do not remove volumes unless the rehearsal database can be discarded.
