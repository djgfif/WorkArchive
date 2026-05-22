#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.prod}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/compose.prod.yml}"
RUN_CONTAINER_FS_SMOKE="${RUN_CONTAINER_FS_SMOKE:-1}"
EXPECT_GOOGLE_OAUTH_CONFIGURED="${EXPECT_GOOGLE_OAUTH_CONFIGURED:-true}"

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

resolve_base_url() {
  local base_url="${BETA_BASE_URL:-${HEALTHCHECK_BASE_URL:-}}"

  if [[ -z "$base_url" && -f "$ENV_FILE" ]]; then
    base_url="$(read_env_value WEB_BASE_URL)"
  fi

  if [[ -z "$base_url" || "$base_url" == *"archive.example.com"* ]]; then
    local web_port="${WEB_PORT:-}"
    if [[ -z "$web_port" && -f "$ENV_FILE" ]]; then
      web_port="$(read_env_value WEB_PORT)"
    fi
    base_url="http://127.0.0.1:${web_port:-8080}"
  fi

  echo "${base_url%/}"
}

request() {
  local method="$1"
  local path="$2"
  local body_file="$3"
  local header_file="$4"
  shift 4

  curl -sS \
    -X "$method" \
    -D "$header_file" \
    -o "$body_file" \
    -w "%{http_code}" \
    "$@" \
    "$BASE_URL$path"
}

expect_status() {
  local method="$1"
  local path="$2"
  local expected_status="$3"
  shift 3
  local body_file
  local header_file
  local status_code

  body_file="$(mktemp)"
  header_file="$(mktemp)"

  set +e
  status_code="$(request "$method" "$path" "$body_file" "$header_file" "$@")"
  local curl_status=$?
  set -e

  if [[ $curl_status -ne 0 || "$status_code" != "$expected_status" ]]; then
    echo "FAIL $method $path HTTP ${status_code:-000}" >&2
    if [[ -s "$body_file" ]]; then
      sed -n '1,20p' "$body_file" >&2
    fi
    fail "$method $path expected HTTP $expected_status but got ${status_code:-000}."
  else
    echo "OK $method $path HTTP $status_code"
  fi

  LAST_BODY_FILE="$body_file"
  LAST_HEADER_FILE="$header_file"
}

json_assert() {
  local expression="$1"
  local description="$2"

  if node -e '
    const fs = require("node:fs");
    const body = fs.readFileSync(process.argv[1], "utf8");
    const data = JSON.parse(body);
    const ok = Function("data", `return (${process.argv[2]});`)(data);
    process.exit(ok ? 0 : 1);
  ' "$LAST_BODY_FILE" "$expression"; then
    echo "OK $description"
  else
    fail "$description."
  fi
}

body_contains() {
  local pattern="$1"
  local description="$2"

  if grep -q "$pattern" "$LAST_BODY_FILE"; then
    echo "OK $description"
  else
    fail "$description."
  fi
}

header_contains() {
  local pattern="$1"
  local description="$2"

  if grep -qi "$pattern" "$LAST_HEADER_FILE"; then
    echo "OK $description"
  else
    fail "$description."
  fi
}

run_compose_exec() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

run_container_fs_smoke() {
  if [[ "$RUN_CONTAINER_FS_SMOKE" != "1" && "$RUN_CONTAINER_FS_SMOKE" != "true" ]]; then
    warn "SKIP container filesystem smoke: RUN_CONTAINER_FS_SMOKE=$RUN_CONTAINER_FS_SMOKE."
    return
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    warn "SKIP container filesystem smoke: missing $ENV_FILE."
    return
  fi

  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    warn "SKIP container filesystem smoke: docker compose is not available in this environment."
    return
  fi

  echo "Checking read_only/tmpfs paths in running containers"

  if run_compose_exec exec -T api sh -lc 'touch /tmp/work-archive-smoke && rm -f /tmp/work-archive-smoke && ! touch /workspace/work-archive-smoke 2>/dev/null'; then
    echo "OK api read_only root with writable /tmp"
  else
    fail "api read_only/tmpfs smoke failed."
  fi

  if run_compose_exec exec -T web sh -lc 'touch /tmp/work-archive-smoke /var/cache/nginx/work-archive-smoke /var/run/work-archive-smoke && rm -f /tmp/work-archive-smoke /var/cache/nginx/work-archive-smoke /var/run/work-archive-smoke && ! touch /usr/share/nginx/html/work-archive-smoke 2>/dev/null'; then
    echo "OK web read_only root with writable nginx tmpfs paths"
  else
    fail "web read_only/tmpfs smoke failed."
  fi

  if run_compose_exec --profile maintenance run --rm --no-deps --entrypoint sh retention-cleanup -lc 'touch /tmp/work-archive-smoke && rm -f /tmp/work-archive-smoke && ! touch /workspace/work-archive-smoke 2>/dev/null'; then
    echo "OK retention-cleanup read_only root with writable /tmp"
  else
    fail "retention-cleanup read_only/tmpfs smoke failed."
  fi
}

run_operator_sync_smoke() {
  if [[ -z "${SMOKE_ACCESS_TOKEN:-}" ]]; then
    warn "SKIP sync failed_validation smoke: set SMOKE_ACCESS_TOKEN for an operator-only/dev authenticated check."
    return
  fi

  local payload_file
  payload_file="$(mktemp)"
  cat >"$payload_file" <<'JSON'
{
  "schemaVersion": 5,
  "changes": [
    {
      "queueId": "11111111-1111-4111-8111-111111111111",
      "clientMutationId": "22222222-2222-4222-8222-222222222222",
      "entityType": "work",
      "entityId": "33333333-3333-4333-8333-333333333333",
      "operation": "create",
      "createdAt": "2026-05-22T00:00:00.000Z",
      "payload": []
    }
  ]
}
JSON

  expect_status POST /api/sync/push 200 \
    -H "Authorization: Bearer ${SMOKE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    --data-binary "@${payload_file}"
  json_assert 'data.results && data.results[0] && data.results[0].status === "failed" && data.results[0].code === "failed_validation"' "sync malformed payload returns failed_validation"
}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for beta smoke tests." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required for beta smoke JSON assertions." >&2
  exit 1
fi

BASE_URL="$(resolve_base_url)"
echo "Running beta smoke tests against $BASE_URL"

expect_status GET /health 200
json_assert 'data.service === "work-archive-api" && data.status === "ok"' "/health reports api ok"

expect_status GET /livez 200
json_assert 'data.service === "work-archive-api" && data.status === "ok"' "/livez reports api ok"

expect_status GET /readyz 200
json_assert 'data.service === "work-archive-api" && data.status === "ok"' "/readyz reports api ok"

expect_status GET /api/auth/google/status 200
json_assert 'typeof data.configured === "boolean"' "Google OAuth status shape is exposed"
if [[ "$EXPECT_GOOGLE_OAUTH_CONFIGURED" == "1" || "$EXPECT_GOOGLE_OAUTH_CONFIGURED" == "true" ]]; then
  json_assert 'data.configured === true' "Google OAuth is configured"
fi

expect_status GET / 200
body_contains '<div id="root"></div>' "web static index is served"

expect_status GET /work-archive-config.js 200
body_contains '__WORK_ARCHIVE_CONFIG__' "runtime web config is served"
header_contains '^cache-control:.*no-store' "runtime web config is not cached"

expect_status POST /api/auth/refresh 401
if grep -qi '^set-cookie:' "$LAST_HEADER_FILE"; then
  fail "POST /api/auth/refresh without OAuth must not set a refresh cookie."
else
  echo "OK refresh endpoint rejects missing cookie without setting a cookie"
fi

run_operator_sync_smoke
run_container_fs_smoke

if ((${#warnings[@]} > 0)); then
  echo
  echo "Warnings:"
  for item in "${warnings[@]}"; do
    echo "- $item"
  done
fi

if ((${#failures[@]} > 0)); then
  echo
  echo "Smoke failed:"
  for item in "${failures[@]}"; do
    echo "- $item"
  done
  exit 1
fi

echo "OK beta smoke tests passed."
