#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-${ENV_FILE:-$ROOT_DIR/.env.prod}}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"

redact_output() {
  sed -E \
    -e "s#${ROOT_DIR}#[workspace]#g" \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's/(Basic )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's#\b(access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=([^[:space:]&;,]+)#\1=[REDACTED]#gI' \
    -e 's#(https?://)[^[:space:]/@]+(:[^[:space:]@]*)?@#\1[REDACTED]@#gI' \
    -e 's#([?&](access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^[:space:]&]+#\1[REDACTED]#gI' \
    -e 's/([A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL|REDIS_URL)[A-Za-z0-9_]*=)[^[:space:]&;,]+/\1[REDACTED]/gI' \
    -e 's#(postgresql://)[^[:space:]@]+@#\1[REDACTED]@#gI' \
    -e 's#(rediss?://)[^[:space:]@]+@#\1[REDACTED]@#gI'
}

redact_text() {
  printf '%s\n' "$1" | redact_output
}

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

is_placeholder_url() {
  local value="$1"
  [[ -z "$value" || "$value" == *"example.com"* || "$value" == *"archive.example.com"* || "$value" == *"local-compose"* ]]
}

resolve_beta_base_url() {
  local beta_base_url="${BETA_BASE_URL:-${HEALTHCHECK_BASE_URL:-${BASE_URL:-}}}"

  if [[ -z "$beta_base_url" && -f "$ENV_FILE" ]]; then
    beta_base_url="$(read_env_value WEB_BASE_URL)"
  fi

  if is_placeholder_url "$beta_base_url"; then
    local web_port="${WEB_PORT:-}"
    if [[ -z "$web_port" && -f "$ENV_FILE" ]]; then
      web_port="$(read_env_value WEB_PORT)"
    fi
    beta_base_url="http://127.0.0.1:${web_port:-8080}"
  fi

  echo "${beta_base_url%/}"
}

if ! command -v docker >/dev/null 2>&1; then
  echo "SKIP docker is not installed; commercial beta rehearsal requires Docker Compose."
  exit 0
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "SKIP docker compose is not available; commercial beta rehearsal requires Docker Compose."
  exit 0
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL $(redact_text "$ENV_FILE") does not exist."
  exit 1
fi

BETA_BASE_URL="$(resolve_beta_base_url)"

echo "1/7 production preflight"
ENV_FILE="$ENV_FILE" \
COMPOSE_FILE="$COMPOSE_FILE" \
  bash "$ROOT_DIR/scripts/deploy/beta-preflight.sh"

echo "2/7 compose config"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config >/dev/null

echo "3/7 api migration release profile"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile release run --rm api-migrate 2>&1 | redact_output

echo "4/7 stack up"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build 2>&1 | redact_output

echo "5/7 production healthcheck"
ENV_FILE="$ENV_FILE" \
COMPOSE_FILE="$COMPOSE_FILE" \
HEALTHCHECK_BASE_URL="$BETA_BASE_URL" \
  bash "$ROOT_DIR/scripts/deploy/prod-healthcheck.sh"

echo "6/7 beta smoke"
ENV_FILE="$ENV_FILE" \
COMPOSE_FILE="$COMPOSE_FILE" \
BETA_BASE_URL="$BETA_BASE_URL" \
EXPECT_GOOGLE_OAUTH_CONFIGURED="${EXPECT_GOOGLE_OAUTH_CONFIGURED:-true}" \
  bash "$ROOT_DIR/scripts/deploy/beta-smoke.sh"

echo "7/7 retention cleanup dry-run"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile maintenance run --rm -e RETENTION_CLEANUP_DRY_RUN=true retention-cleanup 2>&1 | redact_output

echo "commercial beta rehearsal passed"
