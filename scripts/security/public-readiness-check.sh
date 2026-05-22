#!/usr/bin/env sh
set -eu

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

failed=0

fail() {
  printf '%s\n' "ERROR: $1" >&2
  failed=1
}

info() {
  printf '%s\n' "OK: $1"
}

tracked_env_files="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -Ev '(^|/)\.env(\.prod)?\.example$|(^|/)apps/[^/]+/\.env\.example$' || true)"
if [ -n "$tracked_env_files" ]; then
  printf '%s\n' "$tracked_env_files" >&2
  fail "non-example .env files are tracked"
else
  info "no non-example .env files are tracked"
fi

tracked_logs="$(git ls-files | grep -E '(^|/)(test-results|playwright-report)(/|$)|\.(log|har|sqlite|db)$' || true)"
if [ -n "$tracked_logs" ]; then
  printf '%s\n' "$tracked_logs" >&2
  fail "runtime logs, browser artifacts, or local databases are tracked"
else
  info "no runtime logs, browser artifacts, or local databases are tracked"
fi

secret_hits="$(git grep -n -I -E '(ghp_|github_pat_|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----)' -- . ':!package-lock.json' ':!scripts/security/public-readiness-check.sh' || true)"
if [ -n "$secret_hits" ]; then
  printf '%s\n' "$secret_hits" >&2
  fail "high-confidence secret patterns were found in tracked files"
else
  info "no high-confidence secret patterns found in tracked files"
fi

personal_path_hits="$(git grep -n -I -E '(/home/gkho0|/mnt/c/work/WorkArchive|C:\\Users\\gkho0|DESKTOP-K0ETFG7)' -- . ':!package-lock.json' ':!scripts/security/public-readiness-check.sh' || true)"
if [ -n "$personal_path_hits" ]; then
  printf '%s\n' "$personal_path_hits" >&2
  fail "personal machine paths were found in tracked files"
else
  info "no personal machine paths found in tracked files"
fi

if [ "$failed" -ne 0 ]; then
  printf '%s\n' "Public readiness check failed." >&2
  exit 1
fi

printf '%s\n' "Public readiness check passed."
