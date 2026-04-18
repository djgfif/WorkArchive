#!/bin/sh
set -eu

echo "Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy --schema /workspace/apps/api/prisma/schema.prisma

echo "Starting API..."
exec node /workspace/apps/api/dist/main.js
