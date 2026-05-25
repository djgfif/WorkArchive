# Local Development

This guide covers local setup only. Production deployment and incident response
live under [`../operations/`](../operations/) and [`../deployment/`](../deployment/).

## Prerequisites

- Node.js `22+`
- npm `10+`
- Docker Desktop or Docker Engine with Compose

## Environment Files

Copy only example files. Do not commit real `.env` files.

```bash
cp .env.compose.example .env.compose
cp .env.host.example .env.host
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

| Path | Use |
| --- | --- |
| [`.env.compose.example`](../../.env.compose.example) | Docker Compose local stack |
| [`.env.host.example`](../../.env.host.example) | host-based API development |
| [`apps/api/.env.example`](../../apps/api/.env.example) | API workspace defaults |
| [`apps/web/.env.example`](../../apps/web/.env.example) | web workspace defaults |

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

- Web: [http://localhost:8080](http://localhost:8080)
- API health: [http://localhost:3000/health](http://localhost:3000/health)
- API readiness: [http://localhost:3000/readyz](http://localhost:3000/readyz)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)

## Host Watch Mode

Host mode is optional and is intended for Vite/API watch-mode development. It
requires PostgreSQL from Docker Compose to be reachable at `127.0.0.1:5432`.

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

- Web: [http://127.0.0.1:53173](http://127.0.0.1:53173)
- API health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)

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
