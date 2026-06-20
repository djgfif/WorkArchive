# Backup And Restore Drill

Run this drill before beta launch and after any infrastructure change.

Backups must leave the server. A dump stored only on the same VPS does not
protect against disk loss, account lockout, or accidental volume removal.

## Create And Verify A Custom Backup

On the deployment host:

```bash
BACKUP_DIR=backups npm run ops:backup
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" npm run ops:backup:verify
ls -lh "$BACKUP_FILE" "$BACKUP_FILE.sha256"
```

The production backup script creates a PostgreSQL custom-format `.dump`, checks
it with `pg_restore --list`, writes a `.sha256` sidecar, and verifies the
checksum before reporting success. It writes a redacted operator report to
`tmp/backups/prod-backup-*.md`; the verification script writes
`tmp/backups/prod-backup-verify-*.md`.

Move the backup off-host immediately, for example to encrypted object storage or
a secure workstation:

```bash
scp "$BACKUP_FILE" "$BACKUP_FILE.sha256" ops@example-backup-host:/secure/work-archive/
```

Do not include OAuth secrets, API keys, or `.env.prod` in JSON export/import
files. PostgreSQL backup storage must be access-controlled because encrypted
provider credentials and user records are still sensitive.

## Restore Into A Clean Rehearsal Database

Use a rehearsal host or disposable volume. Do not overwrite production while
testing restore.

```bash
docker compose -f compose.prod.yml --env-file .env.prod down -v
docker compose -f compose.prod.yml --env-file .env.prod up -d postgres redis

BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" npm run ops:backup:verify

docker compose -f compose.prod.yml --env-file .env.prod exec -T postgres sh -lc 'pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$POSTGRES_DB"' < "$BACKUP_FILE"

docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
docker compose -f compose.prod.yml --env-file .env.prod up -d api web
curl -i https://archive.example.com/readyz
```

Expected:

- restore exits with status 0;
- `/readyz` returns HTTP 200;
- API logs do not show migration or Prisma startup errors.

The API container must not run migrations from its entrypoint. Migration is a
separate release job so app restarts and replica scaling cannot unexpectedly
mutate schema.

## Backup Scope Boundary

PostgreSQL backup restores deployment state: users, encrypted provider
credentials, refresh sessions, sync state, catalog data, and all server-side
private records.

IndexedDB JSON export/import restores a user's local-first archive data. It is
for user portability and emergency client-side recovery. It does not include
server secrets, OAuth state, cookies, provider API keys, refresh sessions, or
deployment-wide catalog/operational tables.

## Post-Restore Smoke

Checklist:

- Google login succeeds.
- Existing refresh session behavior is understood: users may need to log in
  again if the restore point predates their session.
- `/api/auth/me` succeeds after login.
- Sync page can pull existing works.
- Creating a work and syncing creates one server row.
- Re-sending the same `clientMutationId` returns `already_applied`.
- `/tier-boards` opens.
- Existing tier boards load.
- Create a tier board text card and move it between pool and lane.
- Existing source WorkRecord is not modified by tier board snapshot card movement.
- From the restored web app, export JSON for one test account and import it into
  a clean browser profile. Confirm the import preview shows archive records but
  no secrets or provider keys.

## Production Restore Procedure

Only run this during an approved incident window:

1. Stop web/API traffic.
2. Snapshot the current failed volume if possible.
3. Restore the selected backup into a clean PostgreSQL volume.
4. Run the `api-migrate` release job.
5. Start API and web.
6. Check `/health`, `/livez`, `/readyz`.
7. Run Google auth, sync idempotency, and tier board smoke tests.
8. Record the backup filename, restore timestamp, operator, and result in the
   deployment readiness report.
