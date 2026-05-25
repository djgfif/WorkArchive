# Migration Rehearsal

Run this before production deploys that include Prisma migrations.

The current target is to prove:

- fresh database `prisma migrate deploy` succeeds;
- existing database `prisma migrate deploy` succeeds;
- tier board tables and sync idempotency tables are created without damaging
  existing `user_work_records`;
- legacy `WorkRecord.tier` data is not used by Tier Board Maker and is not
  mutated by tier board migrations;
- restore is available if migration fails.

## Fresh DB Scenario

Use an isolated rehearsal host or disposable Docker volume.

```bash
docker compose -f compose.prod.yml --env-file .env.prod down -v
docker compose -f compose.prod.yml --env-file .env.prod up -d postgres redis
docker compose -f compose.prod.yml --env-file .env.prod run --rm \
  --entrypoint /workspace/node_modules/.bin/prisma \
  api migrate deploy \
  --schema /workspace/apps/api/prisma/schema.prisma
docker compose -f compose.prod.yml --env-file .env.prod up -d
curl -i https://archive.example.com/readyz
```

Expected:

- all migrations apply once;
- API reaches healthy readiness;
- no manual SQL edits are needed.

## Existing DB Scenario

Start from a copy of a real backup, never the only production volume.

```bash
docker compose -f compose.prod.yml --env-file .env.prod up -d postgres redis
docker compose -f compose.prod.yml --env-file .env.prod run --rm \
  --entrypoint /workspace/node_modules/.bin/prisma \
  api migrate deploy \
  --schema /workspace/apps/api/prisma/schema.prisma
docker compose -f compose.prod.yml --env-file .env.prod up -d
curl -i https://archive.example.com/readyz
```

Expected:

- deploy is idempotent when migrations are already applied;
- no duplicate migration rows are created;
- existing user records are still readable after API boot.

## Tier Board Data Safety Checks

Before migration:

```bash
docker exec -it work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''select count(*) as work_count from user_work_records;'\'''

docker exec -it work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\''select id, "updatedAt", "serverVersion" from user_work_records order by "updatedAt" desc limit 20;'\'''
```

After migration, run the same checks. Counts should match unless the rehearsal
also intentionally created records through the UI.

Tier Board Maker stores board/lane/card/asset data separately from
`user_work_records`. Moving cards between pool and lanes must not update
`user_work_records.updatedAt` or `serverVersion`.

## WorkRecord.tier Review

The old catalog `tier` field, if present in historical migrations, belongs to
legacy catalog compatibility. Tier Board Maker does not migrate from or write
back to that field. Verify no migration step updates `user_work_records` solely
for tier board creation.

Suggested check:

```bash
docker exec -it work-archive-postgres sh -lc \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select table_name, column_name from information_schema.columns where column_name = '\''tier'\'' order by table_name;"'
```

If a legacy `tier` column exists on catalog compatibility tables, leave it
unchanged unless a dedicated data migration is written and rehearsed separately.

## Rollback And Restore

Prisma migrations are forward-only. If migration fails:

1. Stop the API so no partial writes continue.
2. Preserve logs:
   `docker logs work-archive-api --tail=200 > migration-failure-api.log`.
3. Restore the latest verified PostgreSQL backup into a clean volume.
4. Re-run `/readyz`.
5. Re-run Google login, sync, and tier board smoke checks.

Do not manually delete rows from `_prisma_migrations` in production unless a
separate database recovery plan has been reviewed.

## Script

An operator skeleton is available at
`docs/operations/deployment/scripts/migration-rehearsal.sh`. It requires a real `.env.prod`
on the host and does not include secrets.
