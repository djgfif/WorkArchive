#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"
COMPOSE_FILE="$ROOT_DIR/compose.prod.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the deployment host and fill placeholders." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for production health checks." >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  awk -v wanted_key="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line = $0
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      equals_at = index(line, "=")
      if (equals_at == 0) { next }
      key = substr(line, 1, equals_at - 1)
      value = substr(line, equals_at + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      if (key == wanted_key) {
        if ((substr(value, 1, 1) == "\"" && substr(value, length(value), 1) == "\"") ||
            (substr(value, 1, 1) == "\047" && substr(value, length(value), 1) == "\047")) {
          value = substr(value, 2, length(value) - 2)
        }
        print value
        exit
      }
    }
  ' "$ENV_FILE"
}

BASE_URL="${HEALTHCHECK_BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  BASE_URL="$(read_env_value WEB_BASE_URL)"
fi

if [[ -z "$BASE_URL" || "$BASE_URL" == *"example.com"* ]]; then
  WEB_PORT="${WEB_PORT:-$(read_env_value WEB_PORT)}"
  BASE_URL="http://127.0.0.1:${WEB_PORT:-8080}"
fi

BASE_URL="${BASE_URL%/}"
endpoints=(/health /livez /readyz)

echo "Checking production health endpoints at $BASE_URL"
for endpoint in "${endpoints[@]}"; do
  body_file="$(mktemp)"
  status_code="000"
  if status_code="$(curl -fsS -o "$body_file" -w "%{http_code}" "$BASE_URL$endpoint")"; then
    echo "OK $endpoint HTTP $status_code"
  else
    echo "FAIL $endpoint HTTP $status_code" >&2
    if [[ -s "$body_file" ]]; then
      sed -n '1,20p' "$body_file" >&2
    fi
    rm -f "$body_file"
    exit 1
  fi
  rm -f "$body_file"
done

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
