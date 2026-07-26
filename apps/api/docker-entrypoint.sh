#!/bin/sh
set -eu

echo "Starting API..."
exec node /workspace/apps/api/dist/main.js
