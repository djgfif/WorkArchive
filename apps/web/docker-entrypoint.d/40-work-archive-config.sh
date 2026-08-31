#!/bin/sh
set -eu

profile="${PRODUCT_RELEASE_PROFILE:-personal-archive}"
output="${WORK_ARCHIVE_CONFIG_OUTPUT:-/tmp/work-archive-config.js}"

case "$profile" in
  personal-archive|community-reflection-alpha|community-social-experiment|community-core|community-full)
    ;;
  *)
    echo "Invalid PRODUCT_RELEASE_PROFILE: $profile" >&2
    exit 1
    ;;
esac

printf '%s\n' \
  '/* global window */' \
  'window.__WORK_ARCHIVE_CONFIG__ = window.__WORK_ARCHIVE_CONFIG__ || {};' \
  "window.__WORK_ARCHIVE_CONFIG__.productReleaseProfile = '$profile';" \
  > "$output"
