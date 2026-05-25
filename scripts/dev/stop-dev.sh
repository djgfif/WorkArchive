#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_ENV_FILE="${WORK_ARCHIVE_COMPOSE_ENV_FILE:-.env.compose}"

if [ -f "$COMPOSE_ENV_FILE" ]; then
  docker_compose=(docker compose --env-file "$COMPOSE_ENV_FILE")
elif [ -f ".env" ]; then
  docker_compose=(docker compose --env-file ".env")
else
  docker_compose=(docker compose)
fi

echo "Stopping Docker Compose services..."
"${docker_compose[@]}" stop web api postgres
echo "Done."
