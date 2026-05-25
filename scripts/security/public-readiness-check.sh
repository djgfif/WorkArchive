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

print_hits() {
  if [ -n "$1" ]; then
    printf '%s\n' "$1" >&2
  fi
}

tracked_root_files="$(git ls-files | awk 'index($0, "/") == 0 {print}' | sed '/^$/d')"
allowed_root_regex='^(\.dockerignore|\.env\.compose\.example|\.env\.example|\.env\.host\.example|\.env\.prod\.example|\.gitattributes|\.gitignore|\.nvmrc|\.prettierignore|\.prettierrc\.json|CONTRIBUTING\.md|README\.md|SECURITY\.md|compose\.prod\.yml|compose\.yml|orval\.config\.ts|package-lock\.json|package\.json|playwright\.config\.ts)$'
root_offenders="$(printf '%s\n' "$tracked_root_files" | grep -Ev "$allowed_root_regex" || true)"
if [ -n "$root_offenders" ]; then
  print_hits "$root_offenders"
  fail "unexpected files are tracked at the repository root"
else
  info "repository root contains only approved public-facing files"
fi

root_launcher_hits="$(git ls-files | grep -E '^(start-dev|stop-dev)\.(sh|bat)$' || true)"
if [ -n "$root_launcher_hits" ]; then
  print_hits "$root_launcher_hits"
  fail "development launcher wrappers must not be tracked at the repository root"
else
  info "no development launcher wrappers are tracked at the repository root"
fi

docs_root_files="$(git ls-files docs | awk -F/ 'NF == 2 {print $2}' | sed '/^$/d')"
docs_root_offenders="$(printf '%s\n' "$docs_root_files" | grep -Ev '^README\.md$' || true)"
if [ -n "$docs_root_offenders" ]; then
  print_hits "$docs_root_offenders"
  fail "docs root should contain only README.md plus approved documentation folders"
else
  info "docs root contains only the documentation hub file"
fi

docs_dirs="$(git ls-files docs | awk -F/ 'NF > 2 {print $2}' | sort -u)"
allowed_docs_dirs='^(archive|architecture|getting-started|management|operations|project|security)$'
docs_dir_offenders="$(printf '%s\n' "$docs_dirs" | grep -Ev "$allowed_docs_dirs" || true)"
if [ -n "$docs_dir_offenders" ]; then
  print_hits "$docs_dir_offenders"
  fail "unexpected top-level docs folders are tracked"
else
  info "top-level docs folders match the public information architecture"
fi

tracked_ignored_files="$(git ls-files -ci --exclude-standard || true)"
if [ -n "$tracked_ignored_files" ]; then
  print_hits "$tracked_ignored_files"
  fail "tracked files now match .gitignore rules"
else
  info "no tracked files are hidden by .gitignore"
fi

tracked_env_files="$(git ls-files | grep -E '(^|/)\.env($|\.)' | grep -Ev '(^|/)\.env(\.[^/]+)*\.example$' || true)"
if [ -n "$tracked_env_files" ]; then
  print_hits "$tracked_env_files"
  fail "non-example .env files are tracked"
else
  info "no non-example .env files are tracked"
fi

env_secret_hits="$(git grep -n -I -E '(ghp_|github_pat_|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----)' -- '*env*.example' ':(exclude)package-lock.json' || true)"
if [ -n "$env_secret_hits" ]; then
  print_hits "$env_secret_hits"
  fail "example env files contain values that look like real secrets"
else
  info "example env files contain no high-confidence real secret values"
fi

tracked_artifacts="$(git ls-files | grep -E '(^|/)(test-results|playwright-report|blob-report|coverage|dist|build|\.vite|\.cache|\.turbo|logs|tmp|temp|backups|backup)(/|$)|\.(log|har|sqlite|sqlite3|db|db-journal|db-wal|db-shm|dump|bak|backup|zip|tar|tgz|tar\.gz|7z|rar|trace|webm|mp4|mov)$' || true)"
if [ -n "$tracked_artifacts" ]; then
  print_hits "$tracked_artifacts"
  fail "runtime logs, browser artifacts, local databases, or archives are tracked"
else
  info "no runtime logs, browser artifacts, local databases, or archives are tracked"
fi

tracked_tool_files="$(git ls-files | grep -E '(^|/)\.codex($|/)|(^|/)\.agents(/|$)|(^|/)\.idea(/|$)|(^|/)\.cursor(/|$)|(^|/)\.history(/|$)|(^|/)\.vscode(/|$)' | grep -Ev '^\.vscode/tasks\.json$' || true)"
if [ -n "$tracked_tool_files" ]; then
  print_hits "$tracked_tool_files"
  fail "personal tool or IDE state files are tracked"
else
  info "no personal tool or IDE state files are tracked"
fi

secret_hits="$(git grep -n -I -E '(ghp_|github_pat_|AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----)' -- . ':(exclude)package-lock.json' ':(exclude)scripts/security/public-readiness-check.sh' || true)"
if [ -n "$secret_hits" ]; then
  print_hits "$secret_hits"
  fail "high-confidence secret patterns were found in tracked files"
else
  info "no high-confidence secret patterns found in tracked files"
fi

current_user="$(id -un 2>/dev/null || true)"
current_host="$(hostname 2>/dev/null || true)"
personal_path_pattern='(/home/gkho0|/mnt/c/work/WorkArchive|C:\\Users\\gkho0|DESKTOP-K0ETFG7)'

if [ -n "$current_user" ]; then
  escaped_user="$(printf '%s' "$current_user" | sed 's/[][\/.^$*+?{}()|]/\\&/g')"
  personal_path_pattern="${personal_path_pattern}|(/home/${escaped_user}|C:\\\\Users\\\\${escaped_user})"
fi

if [ -n "$current_host" ]; then
  escaped_host="$(printf '%s' "$current_host" | sed 's/[][\/.^$*+?{}()|]/\\&/g')"
  personal_path_pattern="${personal_path_pattern}|${escaped_host}"
fi

personal_path_hits="$(git grep -n -I -E "$personal_path_pattern" -- . ':(exclude)package-lock.json' ':(exclude)scripts/security/public-readiness-check.sh' || true)"
if [ -n "$personal_path_hits" ]; then
  print_hits "$personal_path_hits"
  fail "personal machine paths were found in tracked files"
else
  info "no personal machine paths found in tracked files"
fi

large_media_hits="$(
  git ls-files | while IFS= read -r path; do
    case "$path" in
      *.png|*.jpg|*.jpeg|*.gif|*.webp|*.svg|*.pdf|*.mp4|*.mov|*.webm)
        if [ -f "$path" ]; then
          size="$(wc -c < "$path" | tr -d ' ')"
          if [ "$size" -gt 10485760 ]; then
            printf '%s (%s bytes)\n' "$path" "$size"
          fi
        fi
        ;;
    esac
  done
)"
if [ -n "$large_media_hits" ]; then
  print_hits "$large_media_hits"
  fail "large tracked media files require explicit review before public release"
else
  info "no oversized tracked media files found"
fi

if [ "$failed" -ne 0 ]; then
  printf '%s\n' "Public readiness check failed." >&2
  exit 1
fi

printf '%s\n' "Public readiness check passed."
