#!/bin/sh
set -eu

if [ -n "${POSTGRES_PRISMA_URL:-}" ] && [ -n "${POSTGRES_URL_NON_POOLING:-}" ]; then
  echo "Skipping Prisma db push on container startup to avoid destructive schema changes."
  echo "Seeding core database records..."
  ./node_modules/.bin/tsx ./src/server/prisma/seed.ts
  echo "Running database safety preflight..."
  node ./docker/db-preflight-check.mjs
else
  echo "Skipping Prisma schema sync because database environment variables are not set."
fi

node ./docker/print-model-route-summary.mjs

exec npm start
