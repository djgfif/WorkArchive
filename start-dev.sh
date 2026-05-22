#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

MODE="${1:-compose}"
HOST_WEB_URL="http://127.0.0.1:53173"
COMPOSE_WEB_URL="http://localhost:8080"
API_URL="http://localhost:3000"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "$1 was not found on PATH."
    exit 1
  fi
}

wait_for_container_health() {
  local container_name="$1"
  local label="$2"
  local log_services="$3"
  local elapsed=0
  local status=""

  while [ "$elapsed" -lt 120 ]; do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || true)"

    if [ "$status" = "healthy" ]; then
      echo "$label container is healthy."
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "$label did not become healthy within 120 seconds."
  docker compose ps

  for service in $log_services; do
    echo
    echo "Recent $service logs:"
    docker compose logs --tail=80 "$service"
  done

  exit 1
}

open_url() {
  local url="$1"

  if [ "${WORK_ARCHIVE_SKIP_OPEN:-}" = "1" ]; then
    return 0
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

case "$MODE" in
  compose)
    require_command docker

    echo "[1/6] Starting PostgreSQL..."
    echo "Web: $COMPOSE_WEB_URL"
    echo "API readiness: $API_URL/readyz"
    echo
    docker compose up -d postgres

    echo "[2/6] Waiting for PostgreSQL readiness..."
    wait_for_container_health "work-archive-postgres" "PostgreSQL" "postgres"

    echo "[3/6] Applying Prisma migrations..."
    docker compose rm -f -s api-migrate >/dev/null 2>&1 || true
    docker compose up --build --force-recreate --no-deps api-migrate

    echo "[4/6] Starting API and web containers..."
    docker compose up -d --build --force-recreate --no-deps api web

    echo "[5/6] Waiting for API readiness..."
    wait_for_container_health "work-archive-api" "API" "api-migrate api"

    echo "[6/6] Waiting for web readiness..."
    wait_for_container_health "work-archive-web" "Web" "web api"

    echo "Checking localhost access..."
    curl -fsS --max-time 5 -o /dev/null "$COMPOSE_WEB_URL"
    curl -fsS --max-time 5 -o /dev/null "$API_URL/health"
    curl -fsS --max-time 5 -o /dev/null "$API_URL/readyz"

    echo "Opening browser when supported..."
    open_url "$COMPOSE_WEB_URL"
    echo "Docker Compose app stack is running. Use ./stop-dev.sh to stop it."
    ;;
  host)
    require_command docker
    require_command npm

    echo "[1/5] Starting PostgreSQL container..."
    docker compose up -d postgres

    echo "[2/5] Installing dependencies if needed..."
    if [ ! -d node_modules ] && [ -f package-lock.json ]; then
      npm ci
    else
      npm install
    fi

    echo "[3/5] Applying Prisma migrations..."
    npm run db:migrate:deploy

    echo "[4/5] Opening browser when supported..."
    open_url "$HOST_WEB_URL"

    echo "[5/5] Starting host-based web and api dev servers..."
    echo "Web: $HOST_WEB_URL"
    echo "API: $API_URL/health"
    npm run dev
    ;;
  *)
    echo "Unknown dev mode: $MODE"
    echo "Usage:"
    echo "  ./start-dev.sh       Starts the full Docker Compose app stack."
    echo "  ./start-dev.sh host  Starts host-based Vite/API dev servers."
    exit 1
    ;;
esac
