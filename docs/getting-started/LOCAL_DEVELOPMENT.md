# Local Development

This guide covers local setup only. Production deployment and incident response
live under [`../operations/`](../operations/).

## Prerequisites

- Node.js `22+`
- npm `10+`
- Docker Desktop or Docker Engine with Compose

## Environment Files

Copy only example files. Do not commit real `.env` files.

```bash
npm install
npm run security:install-hooks
cp .env.compose.example .env.compose
cp .env.host.example .env.host
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

| Path                                                   | Use                        |
| ------------------------------------------------------ | -------------------------- |
| [`.env.compose.example`](../../.env.compose.example)   | Docker Compose local stack |
| [`.env.host.example`](../../.env.host.example)         | host-based API development |
| [`apps/api/.env.example`](../../apps/api/.env.example) | API workspace defaults     |
| [`apps/web/.env.example`](../../apps/web/.env.example) | web workspace defaults     |

The installed `pre-commit` hook runs `npm run security:secrets`; the installed
`pre-push` hook runs `npm run security:public`. Both checks redact findings and
must not print secret values. Re-run `npm run security:install-hooks` after
cloning or after replacing `.git/hooks`.

## Docker Compose Mode

Compose mode is the default. It runs PostgreSQL, migrations, API, and web in one
Docker network and publishes the web and API ports to localhost.

```bash
npm install
npm run dev:start
```

Stop services:

```bash
npm run dev:stop
```

Default endpoints:

- Web: [http://localhost:18730](http://localhost:18730)
- API health: [http://localhost:18731/health](http://localhost:18731/health)
- API readiness: [http://localhost:18731/readyz](http://localhost:18731/readyz)
- Swagger UI: [http://localhost:18731/docs](http://localhost:18731/docs)

## Host Watch Mode

Host mode is optional and is intended for Vite/API watch-mode development. It
requires PostgreSQL from Docker Compose to be reachable at `127.0.0.1:18732`.

```bash
npm run dev:start:host
```

Manual equivalent:

```bash
npm install
npm run dev:db
npm run db:migrate:deploy
npm run dev
```

Host mode endpoints:

- Web: [http://localhost:18730](http://localhost:18730)
- API health: [http://localhost:18731/health](http://localhost:18731/health)
- Swagger UI: [http://localhost:18731/docs](http://localhost:18731/docs)

## Local Browser Storage Origin

Use [http://localhost:18730](http://localhost:18730) as the only local web
origin. IndexedDB is scoped by browser origin, so records created on a different
port, such as `http://localhost:5173`, do not appear in the `18730` archive.

If old data exists on a legacy local port, export it from that origin and import
it into the standard app:

```bash
npm run storage:export-legacy-origin
```

Then open [http://localhost:5173](http://localhost:5173) in the same browser
profile that contains the old records, download the JSON backup, and import that
file from [http://localhost:18730/account/settings](http://localhost:18730/account/settings)
under **데이터와 백업**. If port `5173` is already occupied, stop the old dev
server before running the export bridge.

## Integration Tests

PostgreSQL-backed API integration tests must never reset the normal development
database. `npm run test:integration` prepares and uses a separate
`work_archive_integration` database on the local Compose PostgreSQL port
(`127.0.0.1:18732`) when `DATABASE_URL` is unset or points at the ordinary
development database.

```bash
npm run dev:db
npm run test:integration
```

If `DATABASE_URL` is set explicitly, it must include `test` or `integration` in
the database name. The test reset guard refuses any other target.

## Windows Helpers

The official cross-platform entrypoints are npm scripts:

```bat
npm run dev:start
npm run dev:start:host
npm run dev:stop
```

Optional Windows WSL helper files live under [`../../scripts/windows/`](../../scripts/windows/):

- `Start Work Archive.cmd`
- `Stop Work Archive.cmd`
- `Install Work Archive Shortcuts.cmd`

These wrappers exist for Explorer/desktop shortcut workflows and delegate back
to [`../../scripts/dev/`](../../scripts/dev/).

## External Search Providers

Logged-in users can store user-scoped provider keys for Aladin, TMDB, Naver,
Kakao, Brave Search, Tavily Search, and KOBIS. Values are encrypted in the
server database. AniList, Google Books, Open Library, TVmaze, Wikidata, and the
manual provider can run without user keys.

Do not expose user-scoped provider keys to guest traffic. KOBIS uses an upstream
HTTP endpoint with a query-string key, so enable it only behind a reviewed
network boundary.
