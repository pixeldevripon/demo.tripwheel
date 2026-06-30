# syntax=docker/dockerfile:1

# ──────────────────────────────────────────────────────────────────────────────
# Island Tours - backend (NestJS 11 + Prisma 7) production image
#
# Multi-stage:
#   builder  - full deps + `prisma generate` + `nest build`
#   runner   - same node_modules (kept whole, see note) + dist + prisma schema
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

# node_modules (incl. the generated Prisma client + prisma/ts-node CLIs).
COPY --from=builder /app/node_modules ./node_modules
# Compiled app.
COPY --from=builder /app/dist ./dist
# Prisma schema + migrations + seed scripts + config (needed by migrate/seed).
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Manifests + TS config (ts-node reads tsconfig.json for the seed).
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json
# Source is required only because prisma/seed.ts imports ../src/* via ts-node.
COPY --from=builder /app/src ./src
# Entrypoint: migrate (+ optional seed) then start.
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Run as the unprivileged `node` user that ships with the base image.
RUN chown -R node:node /app
USER node

EXPOSE 5050

ENTRYPOINT ["./docker-entrypoint.sh"]
