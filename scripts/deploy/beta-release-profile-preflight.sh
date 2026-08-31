#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-${ENV_FILE:-$ROOT_DIR/.env.prod}}"
BETA_RELEASE_MODE="${BETA_RELEASE_MODE:-launch}"

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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL beta release profile preflight requires an env file." >&2
  exit 1
fi

case "$BETA_RELEASE_MODE" in
  launch)
    expected_profile="community-core"
    ;;
  rollback)
    expected_profile="personal-archive"
    ;;
  *)
    echo "FAIL BETA_RELEASE_MODE must be launch or rollback." >&2
    exit 1
    ;;
esac

configured_profile="$(read_env_value PRODUCT_RELEASE_PROFILE)"
if [[ -z "$configured_profile" ]]; then
  echo "FAIL PRODUCT_RELEASE_PROFILE must be explicit for a beta launch or rollback." >&2
  exit 1
fi

if [[ "$configured_profile" != "$expected_profile" ]]; then
  echo "FAIL beta $BETA_RELEASE_MODE requires PRODUCT_RELEASE_PROFILE=$expected_profile; configured profile is not permitted." >&2
  exit 1
fi

echo "OK beta release profile preflight passed: mode=$BETA_RELEASE_MODE profile=$configured_profile."
