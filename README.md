# Work Archive

Milestone 0 sets up the monorepo and shared tooling for a local-first React/NestJS application.

## Workspace Layout

- `apps/web`: React + TypeScript + Vite frontend scaffold
- `apps/api`: NestJS + Prisma API scaffold targeting PostgreSQL
- `packages/shared-types`: shared TypeScript package for cross-app contracts
- `packages/eslint-config`: reusable ESLint flat configs
- `packages/tsconfig`: reusable TypeScript base configs

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop with WSL integration enabled

## Getting Started

```bash
npm install
docker compose up -d
npm run dev
```

The default PostgreSQL database runs on `localhost:5432` with:

- database: `work_archive`
- user: `postgres`
- password: `postgres`

## Root Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

## Workspace Commands

```bash
npm run dev --workspace @work-archive/web
npm run dev --workspace @work-archive/api
npm run prisma:generate --workspace @work-archive/api
```
