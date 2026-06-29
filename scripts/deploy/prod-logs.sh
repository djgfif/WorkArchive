#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
TAIL_LINES="${TAIL:-200}"
FOLLOW="${FOLLOW:-true}"
RAW_LOGS="${PROD_LOGS_RAW:-false}"
RAW_CONFIRM="${PROD_LOGS_RAW_CONFIRM:-}"

fail() {
  echo "$1" >&2
  exit 1
}

normalize_bool() {
  local name="$1"
  local value="$2"

  value="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    true|false) printf '%s' "$value" ;;
    *) fail "$name must be true or false." ;;
  esac
}

redact_output() {
  sed -E \
    -e 's/(Bearer )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's/(Basic )[A-Za-z0-9._~+\/=-]+/\1[REDACTED]/gI' \
    -e 's#\b(access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=([^[:space:]&;,]+)#\1=[REDACTED]#gI' \
    -e 's#(https?://)[^[:space:]/@]+(:[^[:space:]@]*)?@#\1[REDACTED]@#gI' \
    -e 's#([?&](access[-_]?token|authorization|authorization[-_]?code|api[-_]?key|code|cookie|credential|id[-_]?token|nonce|oauth[-_]?code|password|refresh[-_]?token|secret|session|state|token)=)[^[:space:]&]+#\1[REDACTED]#gI' \
    -e 's/([A-Za-z0-9_]*(SECRET|TOKEN|PASSWORD|API_KEY|COOKIE|OAUTH|DATABASE_URL|REDIS_URL)[A-Za-z0-9_]*=)[^[:space:]&;,]+/\1[REDACTED]/gI' \
    -e 's#(postgresql://)[^[:space:]@]+@#\1[REDACTED]@#gI' \
    -e 's#(rediss?://)[^[:space:]@]+@#\1[REDACTED]@#gI'
}

if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the deployment host and fill placeholders."
fi

[[ "$TAIL_LINES" =~ ^[1-9][0-9]*$ ]] || fail "TAIL must be a positive integer."

FOLLOW="$(normalize_bool FOLLOW "$FOLLOW")"
RAW_LOGS="$(normalize_bool PROD_LOGS_RAW "$RAW_LOGS")"

follow_args=()
if [[ "$FOLLOW" == "true" ]]; then
  follow_args=(-f)
fi

if [[ "$RAW_LOGS" == "true" ]]; then
  [[ "$RAW_CONFIRM" == "show-unredacted-production-logs" ]] || fail \
    "Set PROD_LOGS_RAW_CONFIRM=show-unredacted-production-logs to print raw production logs."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail "$TAIL_LINES" "${follow_args[@]}" "$@"
else
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs --tail "$TAIL_LINES" "${follow_args[@]}" "$@" 2>&1 | redact_output
fi
