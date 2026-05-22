# Feature-First Project Structure

| Field | Value |
| --- | --- |
| Status | `canonical` |
| Role | `architecture boundary guide` |
| Source of truth | Current `apps/web`, `apps/api`, and `packages/*` layout |
| Last verified against | `2026-05-22` working tree |
| When to update | Feature folders, module boundaries, or cross-feature dependency rules change |

Work Archive uses a feature-first monorepo layout. The root keeps operational
entrypoints, `apps/*` contains runnable applications, `packages/*` contains
shared workspace packages, and `docs/*` contains product, architecture, design,
and operations documentation.

## Web Boundaries

Web features live under `apps/web/src/features/{feature}`. A feature may keep
its internal `pages`, `components`, `hooks`, `services`, `utils`, and `db`
folders, but external feature imports should use the feature `index.ts`
entrypoint instead of reaching into deep implementation paths.
Low-level cross-feature runtime dependencies that would otherwise create
barrel import cycles may expose a narrow public sub-entrypoint, such as
`works/storage`, `sync/queue`, or `tier-boards/data`.

Current dependency direction:

- `home` and `profile` compose user-facing surfaces from `auth`, `archive`,
  `sync`, and `works`.
- `archive` and `sync` may depend on the `works` local database because IndexedDB
  is the local-first source of truth.
- `works` may depend on `auth`, `imports`, and `sync` for authenticated actions,
  quick-add search, and sync queueing.
- Shared UI/runtime utilities live under `apps/web/src/shared` and must not
  depend on feature implementation details unless the dependency is an explicit
  adapter boundary.

## API Boundaries

API features live under `apps/api/src/modules/{module}`. Each module has an
`index.ts` entrypoint for its public Nest boundary. Module internals may keep
DTOs and helpers in subfolders; other modules should prefer the module entrypoint
or the specific Nest provider only when a dependency is intentional.

Large modules are split by responsibility:

- `imports`: candidate normalization/ranking, provider contracts, diagnostics,
  credential storage, and runtime provider state.
- `sync`: request/response DTOs, entity payload DTOs, controller, and service.
- `common`, `config`, `prisma`, and `security` are platform layers and may be
  used by feature modules.

## Public Repository Layout

Keep root files focused on running and operating the project. Design references,
frontend guides, and historical planning documents belong under `docs/`. Local
runtime files, IDE state, logs, build outputs, and non-example env files must
stay ignored and uncommitted.
