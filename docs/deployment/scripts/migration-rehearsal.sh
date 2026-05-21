#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Create it on the deployment host; do not commit it." >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config >/dev/null
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm \
  --entrypoint /workspace/node_modules/.bin/prisma \
  api migrate deploy \
  --schema /workspace/apps/api/prisma/schema.prisma
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api web
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

echo "Migration rehearsal completed. Run /readyz and product smoke checks next."
