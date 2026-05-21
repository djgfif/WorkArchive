# Backup And Restore Drill

Run this drill before beta launch and after any infrastructure change.

Backups must leave the server. A dump stored only on the same VPS does not
protect against disk loss, account lockout, or accidental volume removal.

## Create A Gzipped Backup

On the deployment host:

```bash
mkdir -p backups
BACKUP_FILE="backups/work-archive-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"

docker exec work-archive-postgres sh -lc 'pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=plain \
  --no-owner \
  --no-privileges' \
  | gzip -9 > "$BACKUP_FILE"

ls -lh "$BACKUP_FILE"
```

Move the backup off-host immediately, for example to encrypted object storage or
a secure workstation:

```bash
scp "$BACKUP_FILE" ops@example-backup-host:/secure/work-archive/
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

gunzip -c "$BACKUP_FILE" | docker exec -i work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

docker compose -f compose.prod.yml --env-file .env.prod up -d api web
curl -i https://archive.example.com/readyz
```

Expected:

- restore exits with status 0;
- `/readyz` returns HTTP 200;
- API logs do not show migration or Prisma startup errors.

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
- Existing linked WorkRecord is not modified by tier board movement.

## Production Restore Procedure

Only run this during an approved incident window:

1. Stop web/API traffic.
2. Snapshot the current failed volume if possible.
3. Restore the selected backup into a clean PostgreSQL volume.
4. Run `prisma migrate deploy`.
5. Start API and web.
6. Check `/health`, `/livez`, `/readyz`.
7. Run Google auth, sync idempotency, and tier board smoke tests.
8. Record the backup filename, restore timestamp, operator, and result in the
   deployment readiness report.
