# Migration Playbook

## Principles

- Back up before every production migration.
- Prefer expand/migrate/contract over one-step breaking changes.
- Do not ship destructive migrations without explicit approval.
- Treat Dexie, sync payloads, and Prisma as one compatibility surface.
- A migration that cannot be rolled back must be called out in the release checklist and approved before deployment.

## Prisma Migration Rules

- Generate migrations from reviewed Prisma schema changes.
- Review generated SQL before merge.
- Avoid `DROP COLUMN`, `DROP TABLE`, destructive enum rewrites, and mass updates in the same deploy that changes application behavior.
- Add nullable columns or defaults first, deploy code that writes both old and new shapes, backfill safely, then contract later.
- Add indexes concurrently where supported by the deployment path, or schedule maintenance when locks are expected.
- Never repair production by editing `_prisma_migrations` unless a written incident plan explicitly requires it.

## Dexie Version Migration Rules

- Dexie version upgrades must preserve existing local records and queued sync mutations.
- Migrations must be deterministic and safe to re-open after browser interruption.
- Never clear object stores as a shortcut.
- Keep export paths available before and after migration.
- Test representative old local data before release.

## Sync `schemaVersion` Change Rules

- Bump sync schema version only when payload compatibility changes.
- The API should reject unsupported versions with a clear client-actionable error.
- The web app should keep queued mutations idempotent through `clientMutationId`.
- Include contract tests for push, pull, conflict, and duplicate mutation delivery.
- Coordinate schema version changes with Dexie migrations when local shape changes.

## Expand/Migrate/Contract Strategy

1. Expand: add new nullable columns, tables, indexes, or payload fields without removing old ones.
2. Migrate: deploy code that reads old and new shapes, writes the new shape, and backfills if needed.
3. Contract: after compatibility is proven and old code is no longer running, remove obsolete fields in a later release.

## Destructive Migration Policy

Destructive migrations are forbidden by default. This includes dropping columns/tables, irreversible data rewrites, destructive enum changes, and clearing client stores.

If a destructive migration is unavoidable:

- Document the affected data.
- Take and verify a backup.
- State why expand/migrate/contract is not sufficient.
- Get explicit approval before deployment.
- Include restore steps and expected data loss boundaries.

## Rollback Guidance

- Code rollback is allowed only when the previous code can run against the current schema.
- If rollback crosses an irreversible migration, restore from the pre-deployment backup.
- Do not downgrade Dexie stores by deleting local data. Provide JSON export guidance first.
