#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.prod.yml}"
WEB_HEALTH_URL="${WEB_HEALTH_URL:-http://127.0.0.1:${WEB_PORT:-8080}/work-archive-config.js}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3000}"

if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP docker is not installed; commercial beta rehearsal requires Docker Compose."
  exit 0
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "SKIP docker compose is not available; commercial beta rehearsal requires Docker Compose."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL $ENV_FILE does not exist."
  exit 1
fi

echo "1/8 compose config"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config >/dev/null

echo "2/8 api migration release profile"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile release run --rm api-migrate

echo "3/8 stack up"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "4/8 api health"
curl -fsS "$API_BASE_URL/health" >/dev/null
curl -fsS "$API_BASE_URL/livez" >/dev/null
curl -fsS "$API_BASE_URL/readyz" >/dev/null

echo "5/8 web static health"
curl -fsS "$WEB_HEALTH_URL" >/dev/null

echo "6/8 google oauth status"
curl -fsS "$API_BASE_URL/api/auth/google/status" >/dev/null

echo "7/8 import providers"
curl -fsS "$API_BASE_URL/api/imports/providers" >/dev/null

echo "8/8 retention cleanup dry-run"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile maintenance run --rm -e RETENTION_CLEANUP_DRY_RUN=true retention-cleanup

echo "commercial beta rehearsal passed"
