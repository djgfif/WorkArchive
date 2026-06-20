#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.prod"
COMPOSE_FILE="$ROOT_DIR/compose.prod.yml"
BASE_URL_OVERRIDE="${HEALTHCHECK_BASE_URL:-${BASE_URL:-}}"

if [[ ! -f "$ENV_FILE" && -z "$BASE_URL_OVERRIDE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the deployment host and fill placeholders." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for production health checks." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for production health response checks." >&2
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
  if [[ -f "$ENV_FILE" ]]; then
    BASE_URL="$(read_env_value WEB_BASE_URL)"
  else
    BASE_URL="${BASE_URL_OVERRIDE:-}"
  fi
fi

if [[ -z "$BASE_URL" || "$BASE_URL" == *"example.com"* ]]; then
  WEB_PORT="${WEB_PORT:-}"
  if [[ -z "$WEB_PORT" && -f "$ENV_FILE" ]]; then
    WEB_PORT="$(read_env_value WEB_PORT)"
  fi
  BASE_URL="http://127.0.0.1:${WEB_PORT:-8080}"
fi

BASE_URL="${BASE_URL%/}"
endpoints=(/health /livez /readyz)

assert_health_json() {
  local endpoint="$1"
  local body_file="$2"

  if node -e '
    const fs = require("node:fs");
    const endpoint = process.argv[2];
    let data;

    try {
      data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    } catch {
      console.error(`${endpoint} did not return valid JSON.`);
      process.exit(1);
    }

    if (data.service !== "work-archive-api" || data.status !== "ok") {
      console.error(`${endpoint} returned an unexpected health body.`);
      process.exit(1);
    }
  ' "$body_file" "$endpoint"; then
    echo "OK $endpoint health body"
  else
    sed -n '1,20p' "$body_file" >&2
    exit 1
  fi
}

echo "Checking production health endpoints at $BASE_URL"
for endpoint in "${endpoints[@]}"; do
  body_file="$(mktemp)"
  status_code="000"
  if status_code="$(curl -sS -o "$body_file" -w "%{http_code}" "$BASE_URL$endpoint")" && [[ "$status_code" == "200" ]]; then
    echo "OK $endpoint HTTP $status_code"
    assert_health_json "$endpoint" "$body_file"
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

if [[ -f "$ENV_FILE" ]]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
else
  echo "SKIP docker compose ps: $ENV_FILE is missing and HEALTHCHECK_BASE_URL/BASE_URL was provided."
fi
