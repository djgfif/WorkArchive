#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"

failures=()
warnings=()

fail() {
  failures+=("$1")
}

warn() {
  warnings+=("$1")
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

validate_unique_env_keys() {
  local duplicates=()

  mapfile -t duplicates < <(
    awk '
      /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
      {
        line = $0
        sub(/^[[:space:]]*export[[:space:]]+/, "", line)
        equals_at = index(line, "=")
        if (equals_at == 0) { next }
        key = substr(line, 1, equals_at - 1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
        if (key != "") {
          count[key] += 1
        }
      }
      END {
        for (key in count) {
          if (count[key] > 1) {
            print key
          }
        }
      }
    ' "$ENV_FILE"
  )

  for key in "${duplicates[@]}"; do
    fail "$key is defined more than once in $ENV_FILE."
  done
}

is_placeholder() {
  local value="$1"
  [[ -z "$value" || "$value" == \<*\> || "$value" == *"archive.example.com"* || "$value" == *"localhost"* || "$value" == *"local-compose"* ]]
}

require_present() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"

  if is_placeholder "$value"; then
    fail "$key must be set to a host-specific production value."
  fi
}

require_secret() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"

  if is_placeholder "$value"; then
    fail "$key must be generated for this host."
    return
  fi

  if [[ ${#value} -lt 32 ]]; then
    fail "$key must be at least 32 characters for the production preflight."
  fi
}

require_distinct_secret_values() {
  local names=("$@")
  local i j left_name right_name left_value right_value

  for ((i = 0; i < ${#names[@]}; i += 1)); do
    left_name="${names[$i]}"
    left_value="$(read_env_value "$left_name")"

    if [[ -z "$left_value" ]]; then
      continue
    fi

    for ((j = i + 1; j < ${#names[@]}; j += 1)); do
      right_name="${names[$j]}"
      right_value="$(read_env_value "$right_name")"

      if [[ -n "$right_value" && "$left_value" == "$right_value" ]]; then
        fail "$right_name must not reuse the same secret value as $left_name."
      fi
    done
  done
}

require_exact() {
  local key="$1"
  local expected="$2"
  local value
  value="$(read_env_value "$key")"

  if [[ "$value" != "$expected" ]]; then
    fail "$key must be $expected."
  fi
}

require_https_url() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"

  if [[ "$value" != https://* ]]; then
    fail "$key must be an HTTPS URL."
  fi
}

size_limit_bytes() {
  local value="$1"
  local amount unit

  if [[ ! "$value" =~ ^([1-9][0-9]*)(b|kb|mb)$ ]]; then
    return 1
  fi

  amount="${BASH_REMATCH[1]}"
  unit="${BASH_REMATCH[2]}"
  case "$unit" in
    b) echo "$amount" ;;
    kb) echo $((amount * 1024)) ;;
    mb) echo $((amount * 1024 * 1024)) ;;
  esac
}

require_size_limit() {
  local key="$1"
  local max_bytes="$2"
  local value bytes
  value="$(read_env_value "$key" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$value" ]]; then
    fail "$key must be set."
    return
  fi

  if ! bytes="$(size_limit_bytes "$value")"; then
    fail "$key must use a positive size ending in b, kb, or mb."
    return
  fi

  if ((bytes > max_bytes)); then
    fail "$key must not exceed ${max_bytes} bytes."
  fi
}

require_positive_integer_max() {
  local key="$1"
  local max="$2"
  local value
  value="$(read_env_value "$key")"

  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    fail "$key must be a positive integer."
    return
  fi

  if ((value > max)); then
    fail "$key must not exceed $max."
  fi
}

require_optional_positive_integer_max() {
  local key="$1"
  local max="$2"
  local value
  value="$(read_env_value "$key")"

  if [[ -z "$value" ]]; then
    return
  fi

  require_positive_integer_max "$key" "$max"
}

require_optional_port() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"

  if [[ -z "$value" ]]; then
    return
  fi

  if [[ ! "$value" =~ ^[1-9][0-9]*$ ]]; then
    fail "$key must be a positive integer."
    return
  fi

  if ((${#value} > 5)) || ((${#value} == 5 && 10#$value > 65535)); then
    fail "$key must be between 1 and 65535."
  fi
}

require_optional_host() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"

  if [[ -z "$value" ]]; then
    return
  fi

  if [[ "$value" =~ [[:space:]/\?#@] ]]; then
    fail "$key must be a host or IP address, not a URL."
  fi
}

require_no_whitespace() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"

  if [[ -z "$value" ]]; then
    return
  fi

  if [[ "$value" =~ [[:space:]] ]]; then
    fail "$key must not contain whitespace."
  fi
}

require_client_header_guard_mode() {
  local key="$1"
  local value
  value="$(read_env_value "$key" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$value" ]]; then
    return
  fi

  case "$value" in
    audit|enforce) ;;
    *) fail "$key must be audit or enforce in production." ;;
  esac
}

require_log_level() {
  local key="$1"
  local value
  value="$(read_env_value "$key" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$value" ]]; then
    return
  fi

  case "$value" in
    trace|debug|info|warn|error|fatal|silent) ;;
    *) fail "$key must be one of trace, debug, info, warn, error, fatal, or silent." ;;
  esac
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.prod.example to .env.prod on the beta host and fill placeholders." >&2
  exit 1
fi

echo "Running production environment preflight for $ENV_FILE"
validate_unique_env_keys

required_values=(
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  DATABASE_URL
  CORS_ORIGIN
  WEB_BASE_URL
  VITE_API_BASE_URL
  RATE_LIMIT_STORE
  REDIS_URL
  TRUST_PROXY_HOPS
  RATE_LIMIT_PREFIX
  API_GLOBAL_RATE_LIMIT_MAX
  READINESS_CHECK_TIMEOUT_MS
  API_REQUEST_TIMEOUT_MS
  API_HEADERS_TIMEOUT_MS
  API_KEEP_ALIVE_TIMEOUT_MS
  API_JSON_BODY_LIMIT
  API_URLENCODED_BODY_LIMIT
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REDIRECT_URI
)

for key in "${required_values[@]}"; do
  require_present "$key"
done

for key in JWT_ACCESS_SECRET JWT_REFRESH_SECRET EXTERNAL_API_KEY_ENCRYPTION_SECRET SECURITY_EVENT_HASH_SECRET; do
  require_secret "$key"
done

require_https_url CORS_ORIGIN
require_https_url WEB_BASE_URL
require_https_url GOOGLE_OAUTH_REDIRECT_URI
require_log_level LOG_LEVEL
require_optional_port PORT
require_optional_host HOST
require_no_whitespace RATE_LIMIT_PREFIX
require_no_whitespace METRICS_BEARER_TOKEN
require_client_header_guard_mode WORK_ARCHIVE_CLIENT_HEADER_GUARD
require_size_limit API_JSON_BODY_LIMIT $((5 * 1024 * 1024))
require_size_limit API_URLENCODED_BODY_LIMIT $((256 * 1024))
require_positive_integer_max API_GLOBAL_RATE_LIMIT_MAX 2000
require_optional_positive_integer_max AUTH_RATE_LIMIT_MAX 300
require_positive_integer_max AUTH_SENSITIVE_RATE_LIMIT_MAX 60
require_optional_positive_integer_max CATALOG_RATE_LIMIT_MAX 60
require_optional_positive_integer_max IMPORT_AUTH_RATE_LIMIT_MAX 300
require_optional_positive_integer_max IMPORT_GUEST_RATE_LIMIT_MAX 60
require_optional_positive_integer_max IMAGE_PROXY_RATE_LIMIT_MAX 600
require_optional_positive_integer_max MUTATION_RATE_LIMIT_MAX 300
require_optional_positive_integer_max NOTION_RATE_LIMIT_MAX 60
require_optional_positive_integer_max RATE_LIMIT_WINDOW_MS 300000
require_optional_positive_integer_max SYNC_RATE_LIMIT_MAX 300
require_positive_integer_max READINESS_CHECK_TIMEOUT_MS 5000
require_positive_integer_max API_REQUEST_TIMEOUT_MS 120000
require_positive_integer_max API_HEADERS_TIMEOUT_MS 30000
require_positive_integer_max API_KEEP_ALIVE_TIMEOUT_MS 15000
request_timeout_ms="$(read_env_value API_REQUEST_TIMEOUT_MS)"
headers_timeout_ms="$(read_env_value API_HEADERS_TIMEOUT_MS)"
keep_alive_timeout_ms="$(read_env_value API_KEEP_ALIVE_TIMEOUT_MS)"
if [[ "$request_timeout_ms" =~ ^[1-9][0-9]*$ && "$headers_timeout_ms" =~ ^[1-9][0-9]*$ && "$headers_timeout_ms" -gt "$request_timeout_ms" ]]; then
  fail "API_HEADERS_TIMEOUT_MS must not exceed API_REQUEST_TIMEOUT_MS."
fi
if [[ "$headers_timeout_ms" =~ ^[1-9][0-9]*$ && "$keep_alive_timeout_ms" =~ ^[1-9][0-9]*$ && "$keep_alive_timeout_ms" -ge "$headers_timeout_ms" ]]; then
  fail "API_KEEP_ALIVE_TIMEOUT_MS must be lower than API_HEADERS_TIMEOUT_MS."
fi
require_exact VITE_API_BASE_URL /api
require_exact PASSWORD_RESET_DEV_LINKS_ENABLED false
require_exact RATE_LIMIT_STORE redis
require_exact REDIS_URL redis://redis:6379
require_exact TRUST_PROXY_HOPS 1

metrics_enabled="$(read_env_value METRICS_ENABLED)"
metrics_access_reviewed="$(read_env_value METRICS_INTERNAL_ACCESS_REVIEWED)"
metrics_bearer_token="$(read_env_value METRICS_BEARER_TOKEN)"

if [[ -z "$metrics_enabled" ]]; then
  metrics_enabled="false"
fi

if [[ "$metrics_enabled" != "false" && "$metrics_enabled" != "true" ]]; then
  fail "METRICS_ENABLED must be true or false when set."
fi

if [[ -n "$metrics_access_reviewed" && "$metrics_access_reviewed" != "false" && "$metrics_access_reviewed" != "true" ]]; then
  fail "METRICS_INTERNAL_ACCESS_REVIEWED must be true or false when set."
fi

if [[ "$metrics_enabled" == "true" && "$metrics_access_reviewed" != "true" ]]; then
  fail "METRICS_INTERNAL_ACCESS_REVIEWED must be true when METRICS_ENABLED=true."
fi

if [[ "$metrics_enabled" == "true" ]]; then
  if [[ -z "$metrics_bearer_token" ]]; then
    fail "METRICS_BEARER_TOKEN must be set when METRICS_ENABLED=true."
  elif is_placeholder "$metrics_bearer_token"; then
    fail "METRICS_BEARER_TOKEN must be generated for this host."
  elif [[ ${#metrics_bearer_token} -lt 32 ]]; then
    fail "METRICS_BEARER_TOKEN must be at least 32 characters when metrics are enabled."
  fi
fi

secret_names=(
  JWT_ACCESS_SECRET
  JWT_REFRESH_SECRET
  EXTERNAL_API_KEY_ENCRYPTION_SECRET
  SECURITY_EVENT_HASH_SECRET
)
if [[ -n "$metrics_bearer_token" ]]; then
  secret_names+=(METRICS_BEARER_TOKEN)
fi
require_distinct_secret_values "${secret_names[@]}"

web_base_url="$(read_env_value WEB_BASE_URL)"
cors_origin="$(read_env_value CORS_ORIGIN)"
google_redirect_uri="$(read_env_value GOOGLE_OAUTH_REDIRECT_URI)"
expected_google_redirect="${web_base_url%/}/api/auth/google/callback"

if [[ "$cors_origin" != "$web_base_url" ]]; then
  fail "CORS_ORIGIN must match WEB_BASE_URL for the single-host beta compose deployment."
fi

if [[ "$google_redirect_uri" != "$expected_google_redirect" ]]; then
  fail "GOOGLE_OAUTH_REDIRECT_URI must be ${expected_google_redirect}."
fi

database_url="$(read_env_value DATABASE_URL)"
postgres_db="$(read_env_value POSTGRES_DB)"
postgres_user="$(read_env_value POSTGRES_USER)"

if [[ "$database_url" != postgresql://* ]]; then
  fail "DATABASE_URL must use the postgresql:// scheme."
fi

if [[ "$database_url" != *"@postgres:"* ]]; then
  fail "DATABASE_URL must point at the compose postgres service host."
fi

if [[ "$database_url" != *"/$postgres_db"* ]]; then
  fail "DATABASE_URL must reference POSTGRES_DB."
fi

if [[ "$database_url" != postgresql://"$postgres_user":* ]]; then
  fail "DATABASE_URL must reference POSTGRES_USER."
fi

if [[ "$(read_env_value IMPORT_SERVER_SEARCH_GUEST_ENABLED)" != "false" ]]; then
  fail "IMPORT_SERVER_SEARCH_GUEST_ENABLED must stay false for closed beta."
fi

if [[ "$(read_env_value IMPORT_SERVER_SEARCH_GUEST_APPROVED)" != "false" ]]; then
  fail "IMPORT_SERVER_SEARCH_GUEST_APPROVED must stay false for closed beta."
fi

if [[ "$(read_env_value KOBIS_HTTP_PROVIDER_ENABLED)" != "false" ]]; then
  fail "KOBIS_HTTP_PROVIDER_ENABLED must stay false for closed beta."
fi

if ! grep -q "SWAGGER_ENABLED: 'false'" "$COMPOSE_FILE"; then
  fail "compose.prod.yml must force SWAGGER_ENABLED=false for api."
fi

if ! grep -q "COOKIE_SECURE: 'true'" "$COMPOSE_FILE"; then
  fail "compose.prod.yml must force COOKIE_SECURE=true for api."
fi

if ! grep -q "read_only: true" "$COMPOSE_FILE"; then
  fail "compose.prod.yml must keep read_only services enabled."
fi

if [[ "$(grep -c "cpus:" "$COMPOSE_FILE")" -lt 2 ]]; then
  fail "compose.prod.yml must keep CPU limits for api and web."
fi

if [[ "$(grep -c "mem_limit:" "$COMPOSE_FILE")" -lt 2 ]]; then
  fail "compose.prod.yml must keep memory limits for api and web."
fi

if [[ "$(grep -c "pids_limit:" "$COMPOSE_FILE")" -lt 2 ]]; then
  fail "compose.prod.yml must keep PID limits for api and web."
fi

if [[ "$(grep -c "tmpfs:" "$COMPOSE_FILE")" -lt 3 ]]; then
  fail "compose.prod.yml must keep tmpfs scratch paths for read-only services."
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config >/dev/null; then
    echo "OK docker compose config validated."
  else
    fail "docker compose config failed for compose.prod.yml and .env.prod."
  fi
else
  warn "SKIP docker compose config: docker compose is not available in this environment."
fi

if ((${#warnings[@]} > 0)); then
  echo
  echo "Warnings:"
  for item in "${warnings[@]}"; do
    echo "- $item"
  done
fi

if ((${#failures[@]} > 0)); then
  echo
  echo "Preflight failed:"
  for item in "${failures[@]}"; do
    echo "- $item"
  done
  exit 1
fi

echo "OK production environment preflight passed."
