#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"
COMPOSE_FILE="$ROOT_DIR/compose.prod.yml"
TAIL_LINES="${TAIL:-200}"
FOLLOW="${FOLLOW:-1}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the deployment host and fill placeholders." >&2
  exit 1
fi

follow_args=()
if [[ "$FOLLOW" == "1" || "$FOLLOW" == "true" ]]; then
  follow_args=(-f)
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail "$TAIL_LINES" "${follow_args[@]}" "$@"
