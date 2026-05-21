# Backup Policy

## Objectives

- Default RPO: 24 hours
- Default RTO: 1 hour

These are baseline targets. Releases with migration risk may require a fresher manual backup immediately before deployment.

## Backup Command

Run from an environment that can reach PostgreSQL and has `pg_dump` installed:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file "backups/work_archive_$(date +%Y%m%d_%H%M%S).dump"
```

For Docker Compose local operations, run the equivalent inside a PostgreSQL client container or host with access to the database network.

## Restore Command

Restore into an empty or intentionally replaced database:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$DATABASE_URL" "backups/work_archive_YYYYMMDD_HHMMSS.dump"
```

After restore:

```bash
npm run prisma:migrate:deploy --workspace @work-archive/api
curl -fsS http://localhost:3000/readyz
```

## Retention and Storage

- Store backups outside the application server.
- Do not keep the only backup on the same disk, VM, or container volume as PostgreSQL.
- Protect backup files as sensitive data because they may contain personal archive data and account identifiers.
- Keep enough historical backups to recover from delayed discovery of bad migrations or accidental deletion.

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
6. Record date, operator, backup file, duration, and any gap found.
