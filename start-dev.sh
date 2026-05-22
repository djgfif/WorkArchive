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

wait_for_api_container() {
  local elapsed=0
  local status=""

  while [ "$elapsed" -lt 120 ]; do
    status="$(docker inspect -f '{{.State.Health.Status}}' work-archive-api 2>/dev/null || true)"

    if [ "$status" = "healthy" ]; then
      echo "API container is healthy."
      return 0
    fi

    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo "API did not become healthy within 120 seconds."
  docker compose ps
  echo
  echo "Recent API logs:"
  docker compose logs --tail=80 api
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

    echo "[1/4] Starting Docker Compose app stack..."
    echo "Web: $COMPOSE_WEB_URL"
    echo "API: $API_URL/health"
    echo
    docker compose up -d --build

    echo "[2/4] Waiting for API health..."
    wait_for_api_container

    echo "[3/4] Checking localhost access..."
    curl -fsS --max-time 5 -o /dev/null "$COMPOSE_WEB_URL"
    curl -fsS --max-time 5 -o /dev/null "$API_URL/health"

    echo "[4/4] Opening browser when supported..."
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
