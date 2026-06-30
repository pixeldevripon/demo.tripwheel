#!/bin/sh
# ──────────────────────────────────────────────────────────────────────────────
# Container entrypoint for the Island Tours backend.
#
#   1. Apply pending Prisma migrations (always, idempotent).
#   2. Seed the database ONLY when RUN_SEED=true (first boot / fresh DB).
#      The prod seed (prisma/seed.ts) upserts the admin + base data; it is run
#      opt-in so routine redeploys never re-touch data.
#   3. Exec the compiled NestJS server (PID 1 -> clean SIGTERM shutdown).
# ──────────────────────────────────────────────────────────────────────────────
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
pnpm prisma:migrate:deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "[entrypoint] RUN_SEED=true -> seeding database (prisma db seed)..."
  pnpm prisma:seed
else
  echo "[entrypoint] RUN_SEED not set -> skipping seed."
fi

# nest build emits to dist/src/main.js here (prisma/*.ts in the program lifts
# the tsc rootDir to the project root). Fall back to dist/main.js just in case.
if [ -f dist/src/main.js ]; then
  MAIN=dist/src/main.js
else
  MAIN=dist/main.js
fi

echo "[entrypoint] Starting server -> node $MAIN"
exec node "$MAIN"
