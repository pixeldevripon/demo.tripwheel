# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────────
# Island Tours - backend (NestJS 11 + Prisma 7) production image
#
# Multi-stage:
#   builder  - full deps + `prisma generate` + `nest build`
#   runner   - same node_modules (kept whole, see note) + dist + prisma schema
#
# Ownership is set BY EACH COPY (`--chown=node:node`), never by a trailing
# `RUN chown -R node:node /app`. That single line cost 25 MINUTES per build on
# the VPS (run #61: step 32/32 started 11:44:30, still going at the 12:09:24
# timeout, while all 31 other steps together took ~14 min) and wrote a fresh
# ~850MB layer every deploy, because chmod/chown metadata changes copy the whole
# tree into a new layer. Recursing over a full node_modules is hundreds of
# thousands of inodes; `--chown` sets ownership as the bytes land, for free.
# Do not reintroduce a recursive chown here.
#
# Why we keep the full node_modules in the runner instead of pruning to --prod:
# deploys run `prisma migrate deploy` (needs the `prisma` CLI, a devDependency)
# and an optional `prisma db seed` (needs `ts-node` + `tsconfig-paths`, also
# devDependencies). On a VPS image size is not the constraint, correctness is.
# ──────────────────────────────────────────────────────────────────────────────

ARG NODE_IMAGE=node:24-slim
ARG PNPM_VERSION=10.30.3

# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
ARG PNPM_VERSION

# Prisma needs openssl to fetch/run its engine binaries on Debian.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

ARG DATABASE_URL="postgresql://user:password@localhost:5432/db"
ENV DATABASE_URL=${DATABASE_URL}

# Install deps first (cached unless the manifest/lockfile changes).
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

# Copy the rest of the source and build.
COPY . .

# `pnpm build` = `prisma generate && nest build` (see package.json).
RUN pnpm build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
ARG PNPM_VERSION

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app
# The workdir itself - ONE directory, not a recursive walk. Its contents arrive
# already owned by node via `COPY --chown` below.
RUN chown node:node /app

# node_modules (incl. the generated Prisma client + prisma/ts-node CLIs).
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
# Compiled app.
COPY --from=builder --chown=node:node /app/dist ./dist
# Prisma schema + migrations + seed scripts + config (needed by migrate/seed).
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
# Manifests + TS config (ts-node reads tsconfig.json for the seed).
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=node:node /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=node:node /app/tsconfig.build.json ./tsconfig.build.json
# Source is required only because prisma/seed.ts imports ../src/* via ts-node.
COPY --from=builder --chown=node:node /app/src ./src
# Seed images for `home:media:seed`, vendored here because the frontend repo is
# NOT in this build context and the VPS runs no frontend (it is on Vercel).
# ~7MB, uploaded to Cloudinary once and then never read again at runtime.
COPY --from=builder --chown=node:node /app/assets ./assets
# Maintenance scripts, so `docker compose exec backend pnpm <script>` works:
#   pnpm media:backfill      backfill media-gallery metadata
#   pnpm email:icons:upload  push the email icon set to Cloudinary
#   pnpm email:preview       render a booking email to HTML
#   pnpm home:media:seed     homepage media + copy  (ALSO needs the frontend
#                            tree mounted at /frontend - see docker-compose.yml)
# They import ../src/* via ts-node, which is why src/ above is not optional.
COPY --from=builder --chown=node:node /app/scripts ./scripts
# Entrypoint: migrate (+ optional seed) then start.
COPY --from=builder --chown=node:node --chmod=755 /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Run as the unprivileged `node` user that ships with the base image.
USER node

EXPOSE 5050

ENTRYPOINT ["./docker-entrypoint.sh"]
