#!/usr/bin/env bash
#
# Full-stack build, in the ONLY order that works:
#
#   1. build the backend
#   2. START it and wait until it actually answers
#   3. build the frontend
#   4. stop the backend we started
#
# Why it cannot be `build:backend && build:frontend`:
#
# - The frontend build PRERENDERS every destination, category, hub, collection
#   and tour (`generateStaticParams` + `'use cache'` loaders). Those loaders call
#   the live API, and `publicGetStrict` THROWS on a transport error by design -
#   so with no backend listening the export aborts on the first slug it cannot
#   resolve, with `BackendUnavailableError: ... fetch failed`.
# - `build:backend` is `prisma generate && nest build`, which rewrites `dist/`
#   and the generated Prisma client underneath any backend that is already
#   running. A `start:dev` watcher does not survive that - it dies with
#   `MODULE_NOT_FOUND`. So the backend must be (re)started AFTER its build, not
#   before it.
#
# Both halves of that are why the two builds can never run concurrently either.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-5050}"
HEALTH="http://localhost:${PORT}/api/v1/health"
SERVER_LOG="${ROOT}/backend/build-server.log"
READY_TIMEOUT_SECONDS="${BACKEND_READY_TIMEOUT:-120}"

server_pid=''

cleanup() {
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    echo "==> Stopping the build's backend (pid ${server_pid})"
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

backend_answers() {
  curl -fsS --max-time 3 "$HEALTH" >/dev/null 2>&1
}

if backend_answers; then
  echo "==> NOTE: something is already serving :${PORT}."
  echo "    'prisma generate && nest build' is about to rewrite dist/ under it,"
  echo "    which kills a start:dev watcher. It will be replaced for this build."
fi

echo "==> [1/3] Building backend"
pnpm build:backend

echo "==> [2/3] Starting backend on :${PORT}"
if backend_answers; then
  echo "    Already answering - reusing it, will not stop it on exit."
else
  # `nest build` emits to dist/src/main.js, not dist/main.js: prisma/*.ts and
  # scripts/*.ts are in the TS program (tsconfig.build.json excludes neither),
  # which lifts tsc's rootDir to the project root. docker-entrypoint.sh already
  # works around this; `pnpm start:prod` ("node dist/main") does NOT and is
  # broken today. Resolve it the same way the entrypoint does.
  if [ -f "$ROOT/backend/dist/src/main.js" ]; then
    MAIN='dist/src/main.js'
  elif [ -f "$ROOT/backend/dist/main.js" ]; then
    MAIN='dist/main.js'
  else
    echo "!!! No compiled entrypoint under backend/dist - did build:backend run?" >&2
    exit 1
  fi

  # Run node directly (not `pnpm start:prod`) so $! is the server itself and the
  # EXIT trap can actually stop it - killing pnpm would orphan the node child.
  (cd "$ROOT/backend" && exec node "$MAIN") >"$SERVER_LOG" 2>&1 &
  server_pid=$!

  deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
  until backend_answers; do
    if ! kill -0 "$server_pid" 2>/dev/null; then
      echo "!!! Backend exited during startup. Last 30 lines of ${SERVER_LOG}:" >&2
      tail -30 "$SERVER_LOG" >&2
      exit 1
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "!!! Backend did not answer ${HEALTH} within ${READY_TIMEOUT_SECONDS}s." >&2
      tail -30 "$SERVER_LOG" >&2
      exit 1
    fi
    sleep 2
  done
  echo "    Backend is answering (pid ${server_pid}, log: ${SERVER_LOG})"
fi

echo "==> [3/3] Building frontend"
pnpm build:frontend

echo "==> Build complete."
