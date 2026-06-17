# Backup Policy

## Objectives

- Default RPO: 24 hours
- Default RTO: 1 hour

These are baseline targets. Releases with migration risk may require a fresher manual backup immediately before deployment.

## Backup Command

Run from an environment that can reach PostgreSQL and has `pg_dump` installed:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "backups/work_archive_$(date +%Y%m%d_%H%M%S).dump"
pg_restore --list "backups/work_archive_YYYYMMDD_HHMMSS.dump" >/dev/null
cd backups
sha256sum "work_archive_YYYYMMDD_HHMMSS.dump" > "work_archive_YYYYMMDD_HHMMSS.dump.sha256"
sha256sum -c "work_archive_YYYYMMDD_HHMMSS.dump.sha256"
```

For Docker Compose production operations with the named PostgreSQL volume:

```bash
BACKUP_DIR=backups scripts/deploy/prod-backup.sh
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" scripts/deploy/prod-backup-verify.sh
```

`prod-backup.sh` writes a PostgreSQL custom-format `.dump`, validates it with
`pg_restore --list`, writes a `.sha256` sidecar, and verifies that checksum
before reporting success.

## Restore Command

Restore into an empty or intentionally replaced database:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DATABASE_URL" "backups/work_archive_YYYYMMDD_HHMMSS.dump"
```

Before restore, verify the selected backup:

```bash
BACKUP_FILE=backups/work-archive-YYYYMMDDTHHMMSSZ.dump
BACKUP_FILE="$BACKUP_FILE" scripts/deploy/prod-backup-verify.sh
```

After restore:

```bash
docker compose -f compose.prod.yml --env-file .env.prod --profile release run --rm api-migrate
curl -fsS http://localhost:18731/readyz
```

For host-based development, `npm run db:migrate:deploy` remains valid.

## Retention and Storage

- Store backups outside the application server.
- Do not keep the only backup on the same disk, VM, or container volume as PostgreSQL.
- Protect backup files as sensitive data because they may contain personal archive data and account identifiers.
- Keep enough historical backups to recover from delayed discovery of bad migrations or accidental deletion.

Server DB backups and local-first JSON exports are different tools:

- PostgreSQL backups are operational recovery artifacts. They restore accounts,
  refresh sessions, encrypted provider credentials, sync state, catalog tables,
  and private user records for the whole deployment.
- IndexedDB JSON export/import is a user-controlled archive portability and
  last-resort local recovery tool. It intentionally excludes secrets, cookies,
  OAuth tokens, provider API keys, and server operational state.
- A user JSON export cannot replace a PostgreSQL backup for incident recovery.
  A PostgreSQL backup should not be handed to an end user as a personal export.

## Deployment Rules

- A backup is required before every production deployment that includes Prisma migration, Dexie version migration, or sync schema change.
- The release owner must know the backup path and restore command before applying migrations.
- Rollback plans must state whether code rollback is enough or database restore may be required.

## Restore Drill

Run a restore drill at least once per month:

1. Restore the latest backup into a non-production database.
2. Run Prisma migration deploy if needed.
3. Start the API against the restored database.
4. Check `/health`, `/livez`, and `/readyz`.
5. Run sync and tier board smoke tests.
6. Confirm a local-first JSON export from the restored web app still imports
   into a clean browser profile without secrets.
7. Record date, operator, backup file, duration, RPO/RTO observed, and any gap
   found.

For public beta Gate 1, record the drill in
[`../commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md`](../commercial/PUBLIC_BETA_GATE_1_EVIDENCE.md)
before approving the release candidate.
