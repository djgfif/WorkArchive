#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

usage() {
  cat >&2 <<'USAGE'
Usage:
  scripts/security/release-trivy-scan.sh fs
  scripts/security/release-trivy-scan.sh images
  scripts/security/release-trivy-scan.sh all

Environment for image scans:
  WORK_ARCHIVE_API_IMAGE=<registry/repo/api:tag-or-@sha256>
  WORK_ARCHIVE_WEB_IMAGE=<registry/repo/web:tag-or-@sha256>

Do not scan a moving latest tag as the release artifact.
USAGE
}

require_trivy() {
  if ! command -v trivy >/dev/null 2>&1; then
    echo "trivy is not installed on this release runner." >&2
    exit 127
  fi
}

require_release_image_ref() {
  local name="$1"
  local value="$2"

  if [[ -z "$value" ]]; then
    echo "$name must be set to the release image tag or digest." >&2
    exit 2
  fi

  if [[ "$value" == "latest" || "$value" == *":latest" ]]; then
    echo "$name must not use the moving latest tag: $value" >&2
    exit 2
  fi

  if [[ "$value" != *@sha256:* && "$value" != *":"* ]]; then
    echo "$name must include an immutable digest or an explicit release tag: $value" >&2
    exit 2
  fi
}

scan_fs() {
  require_trivy
  trivy fs "$ROOT_DIR"
}

scan_images() {
  local api_image="${WORK_ARCHIVE_API_IMAGE:-}"
  local web_image="${WORK_ARCHIVE_WEB_IMAGE:-}"

  require_release_image_ref "WORK_ARCHIVE_API_IMAGE" "$api_image"
  require_release_image_ref "WORK_ARCHIVE_WEB_IMAGE" "$web_image"
  require_trivy

  trivy image "$api_image"
  trivy image "$web_image"
}

case "${1:-}" in
  fs)
    scan_fs
    ;;
  images)
    scan_images
    ;;
  all)
    scan_fs
    scan_images
    ;;
  *)
    usage
    exit 2
    ;;
esac
