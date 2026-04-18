# Work Archive

Work Archive is a local-first record app for novels, anime, manga, and related media. The frontend writes to IndexedDB first, guest mode works without an account, and authenticated mode unlocks protected backend storage plus manual sync.

## Workspace Layout

- `apps/web`: React + TypeScript + Vite frontend
- `apps/api`: NestJS + Prisma + PostgreSQL API
- `packages/shared-types`: shared cross-app types
- `packages/eslint-config`: shared ESLint config
- `packages/tsconfig`: shared TypeScript config

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop or Docker Engine with Compose

## Configuration Files

There are three configuration paths. Use the one that matches how you run the app.

- Root [`.env.example`](./.env.example): Docker Compose and containerized full-stack startup
- API [`apps/api/.env.example`](./apps/api/.env.example): host-based API development
- Web [`apps/web/.env.example`](./apps/web/.env.example): host-based web development

Recommended setup:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Notes:

- `apps/api/.env` is used for local `npm run dev --workspace @work-archive/api`.
- `apps/web/.env` is optional. The web app already falls back to `http://localhost:3000/api`.
- Root `.env` is used by `docker compose`.
- Local API development uses `localhost` in `apps/api/.env`, while Docker Compose uses the `postgres` service hostname from root `.env`.
- The repository currently includes a development-safe `apps/api/.env` so Prisma client generation works after install. Review it before sharing or deploying.

## Local Development

1. Install dependencies.

```bash
npm install
```

2. Start PostgreSQL.

```bash
npm run dev:db
```

3. Apply existing migrations.

```bash
npm run db:migrate:deploy
```

4. Optionally seed a demo account and sample works.

```bash
npm run db:seed
```

Default demo credentials:

- email: `demo@workarchive.local`
- password: `demo-password-123`

5. Start the web app and API together.

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:web
npm run dev:api
```

Local endpoints:

- Web app: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)
- OpenAPI JSON: [http://localhost:3000/docs/openapi.json](http://localhost:3000/docs/openapi.json)

## Docker Compose Full Stack

The repository also supports a full containerized startup for local deployment-style testing.

```bash
docker compose up --build
```

Or use the root script:

```bash
npm run compose:up
```

Default containerized endpoints:

- Web app: [http://localhost:8080](http://localhost:8080)
- API health: [http://localhost:3000/health](http://localhost:3000/health)
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)

Notes:

- Docker Compose has safe local defaults even without a root `.env`.
- Copy root `.env.example` to `.env` when you want to customize ports, CORS, API URL, or JWT secrets.
- The documented container defaults assume `API_PORT=3000` and `WEB_PORT=8080`.
- If you change `API_PORT`, also update root `VITE_API_BASE_URL`.
- If you change `WEB_PORT`, keep root `CORS_ORIGIN` aligned with the exposed web origin.
- The API container runs `prisma migrate deploy` on startup so a fresh local stack comes up with the existing schema.

## Guest And Authenticated Mode

- Guest mode is always available and stays local to the current browser/device.
- Authenticated mode uses email/password auth and switches the browser into a separate account-local IndexedDB archive.
- Signing out returns the app to the guest-local archive.
- Guest data and authenticated local data are intentionally separate in the current milestone.

## Manual Sync Basics

- Local writes happen first in IndexedDB.
- Create, update, and delete operations enqueue sync work locally.
- Manual sync is available only in authenticated mode.
- Protected backend routes require a Bearer access token.
- Expired frontend access tokens are refreshed automatically before retrying protected requests.

## Database And Prisma Workflow

Use the checked-in migrations for normal setup:

```bash
npm run db:migrate:deploy
```

Create a new migration during development only when the schema changes:

```bash
npm run db:migrate:dev
```

Seed demo data:

```bash
npm run db:seed
```

Useful API workspace commands:

```bash
npm run prisma:generate --workspace @work-archive/api
npm run prisma:migrate:deploy --workspace @work-archive/api
npm run prisma:migrate:dev --workspace @work-archive/api
npm run prisma:seed --workspace @work-archive/api
```

## Common Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Production Notes

- The web build reads `VITE_API_BASE_URL` at build time. Set it correctly before building static assets or the web image.
- Docker Compose passes `VITE_API_BASE_URL` into the web image at build time, but API `PORT`, `HOST`, and secrets remain runtime env values for the API container.
- Set real `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values outside local development.
- Set `CORS_ORIGIN` to the deployed frontend origin instead of leaving broad local defaults.
- The API health endpoint stays public at `/health`.
- Swagger stays enabled at `/docs`.

## Known Limitations

- Manual sync is still manual, not automatic.
- Guest data is not migrated into an authenticated archive yet.
- The API container applies migrations on startup for convenience; a larger production deployment would usually separate migration execution from steady-state runtime.
- No OAuth, social auth, or multi-user collaboration features are included.
