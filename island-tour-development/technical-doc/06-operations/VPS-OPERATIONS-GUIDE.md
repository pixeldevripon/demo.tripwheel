# VPS Operations Guide — Island Tours Backend

> Practical answers for running the backend on your Hostinger VPS (Docker + SSH).
> Written by analysing the current codebase — **no code was changed.** Where a feature
> does not exist yet, this document says so and gives you the exact steps to add it.
>
> Stack recap (from `docker-compose.yml`): three containers on one bridge network
> `island-net` — `postgres` (16-alpine), `redis` (7-alpine), `backend` (NestJS 11 +
> Prisma 7). Frontend is on Vercel, not on the VPS. nginx (host, not Docker) terminates
> TLS and proxies to `127.0.0.1:5050`.

---

## Table of contents

1. [Where Postgres & Redis credentials live (and how to change them)](#1-credentials)
2. [Is my local Redis setup OK? Is it working?](#2-redis-health)
3. [Can Redis run without Docker? Can I inspect it without Docker?](#3-redis-no-docker)
4. [Run everything with Docker (dev and prod)](#4-run-with-docker)
5. [Visualize the database (GUI options)](#5-db-gui)
6. [Back up the database (and restore)](#6-db-backup)
7. [Audit logs — what exists today and how to visualize](#7-audit-logs)
8. [Set up Sentry (error monitoring)](#8-sentry)
9. [Set up OpenTelemetry (tracing/metrics)](#9-otel)
10. [Rate limiter — already built; how to tune](#10-rate-limiter)
11. [Auto-scaling — options for a single VPS](#11-autoscale)
12. [Quick command cheat-sheet](#12-cheatsheet)

---

<a name="1-credentials"></a>
## 1. Where Postgres & Redis credentials live (and how to change them)

There are **two credential layers** by design. Understanding which file owns which
variable is the key to changing them safely.

### 1a. Production (the VPS Docker stack)

Two files, read at `docker compose up`:

| File | What it holds | Notes |
|---|---|---|
| **`.env`** (repo root, on the VPS) | Infra vars that compose interpolates: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `BACKEND_PORT`, `BACKEND_IMAGE_TAG`, `RUN_SEED` | Template: `.env.example`. This is the **source of truth for DB + Redis passwords.** |
| **`backend/.env.production`** | App secrets only: `BETTER_AUTH_SECRET`, `CLOUDINARY_*`, `SMTP_*`, `ENCRYPTION_KEY`, `INTERNAL_API_SECRET`, `CORS_ORIGINS`, etc. | Template: `backend/.env.production.example` |

**Critical detail** — `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`,
`NODE_ENV`, `PORT`, `RUN_SEED` are **NOT** set in `backend/.env.production`. The
`environment:` block of the `backend` service in `docker-compose.yml` builds them
from the root `.env` and **overrides** anything in the env_file:

```yaml
# docker-compose.yml (backend service)
DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
REDIS_HOST: redis        # the compose service name, NOT localhost
REDIS_PORT: '6379'
REDIS_PASSWORD: ${REDIS_PASSWORD}
```

So on the VPS the backend talks to `postgres:5432` and `redis:6379` over the internal
Docker network — **never** to localhost or Upstash.

#### How to change the Postgres password in production

The password is baked into the Postgres data volume the first time the container
initialises. Changing the env var alone does **not** change an existing DB's password.
Pick one:

**Option A — password only, keep data (recommended):**
```bash
# on the VPS, in the repo dir
# 1. change it inside the running DB
docker compose exec postgres psql -U <current_user> -d island_tours \
  -c "ALTER USER <current_user> WITH PASSWORD 'NEW_STRONG_PASSWORD';"

# 2. update root .env so the backend's DATABASE_URL matches
#    edit POSTGRES_PASSWORD=NEW_STRONG_PASSWORD

# 3. recreate the backend so it picks up the new URL (DB stays up)
docker compose up -d --force-recreate backend
```

**Option B — full reset (DESTROYS data, only for a fresh/empty DB):**
```bash
docker compose down
# edit .env: POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
docker volume rm island-tour-development_postgres-data   # confirm name with `docker volume ls`
docker compose up -d --build
# first boot: set RUN_SEED=true in .env to recreate the admin, then back to false
```

#### How to change the Redis password in production

Redis reads its password from the launch command
(`redis-server ... --requirepass ${REDIS_PASSWORD}`), so a change just needs a
restart:
```bash
# edit root .env: REDIS_PASSWORD=NEW_REDIS_PASSWORD
docker compose up -d --force-recreate redis backend
```
Redis AOF data (`redis-data` volume) is not password-encrypted, so no data is lost.
The backend picks the new password up automatically because compose injects
`REDIS_PASSWORD` into it.

> After any secret rotation, verify with `docker compose logs -f backend` — the app
> runs `validateEnv()` on boot and will fail loudly if something is missing/malformed.

### 1b. Local development

- **`backend/.env`** is the local file. Currently it points at a **native (non-Docker)**
  setup: `DATABASE_URL=postgresql://devripon@localhost:5432/island_tours`,
  `REDIS_HOST=localhost`, `REDIS_PORT=6379`, `REDIS_PASSWORD` unset (password-less).
- `docker-compose.dev.yml` publishes Postgres on `localhost:5432` (user/pass/db all
  `island`) and Redis on `localhost:6379` (password-less). If you switch to it, update
  `DATABASE_URL` in `backend/.env` to `postgresql://island:island@localhost:5432/island_tours?schema=public`.

### 1c. How the app resolves credentials (code refs)

- **Postgres:** `backend/src/prisma/prisma.service.ts` → `new PrismaPg({ connectionString: process.env.DATABASE_URL })` (Prisma 7 `@prisma/adapter-pg` driver adapter). The URL also feeds `backend/prisma.config.ts` for migrations/seed. The `.prisma` schema has **no hardcoded URL**.
- **Redis:** `backend/src/common/utils/redis.util.ts` → `buildRedisConnection()`. If `UPSTASH_REDIS_URL` is set it parses host/port/password from it (TLS when `rediss://`); otherwise it uses `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`. Used only by **BullMQ** (media upload + notification queues + nightly workers) — there is no separate cache/session Redis.
- **Validation:** `backend/src/env.validate.ts` runs at boot (called from `main.ts`) and requires *either* `UPSTASH_REDIS_URL` *or* both `REDIS_HOST`+`REDIS_PORT`.

> ✅ **Security cleanup (resolved).** A prior version of this repo had real-looking
> secrets in tracked files. This has been addressed:
> - **Keys rotated** — the previously exposed secrets (`INTERNAL_API_SECRET`, the Upstash
>   token, DB credentials) have been regenerated, so the old values are now dead.
> - **`backend/.env.test` untracked** — it contained a real `DATABASE_URL`/`BETTER_AUTH_SECRET`;
>   it's now removed from git (kept locally, covered by `.gitignore`).
> - **`backend/.env.example` scrubbed** — the non-placeholder `DATABASE_URL` and the stray
>   `redis://pixelvega:...` line were replaced with placeholders.
> - **Only `*.example` templates remain tracked.** `backend/.env` (real secrets) was never
>   tracked; `.gitignore`/`.dockerignore` keep all real env files out of the repo and image.
>
> Remaining (optional): the old values still exist in **git history**. Since the keys are
> rotated they're harmless, but if you ever want a clean history use `git filter-repo`/BFG
> to purge the old `.env.test` blobs and force-push. Never reuse any value from these files
> in production — always generate fresh secrets.

---

<a name="2-redis-health"></a>
## 2. Is my local Redis setup OK? Is it working?

Your setup is **structurally correct** — the code path, env vars, and connection helper
all line up. "Working" you can confirm in ~30 seconds:

### Native (localhost) Redis — your current `backend/.env`
```bash
redis-cli ping                       # -> PONG  (Redis is up)
redis-cli info server | grep version # -> redis_version:7.x
redis-cli config get maxmemory       # sanity check
```
If `redis-cli` isn't installed: `brew install redis` (macOS). If `ping` hangs or errors
"Connection refused", Redis isn't running — see §3.

### Docker dev Redis (`docker-compose.dev.yml`)
```bash
docker compose -f docker-compose.dev.yml up -d redis
docker compose -f docker-compose.dev.yml exec redis redis-cli ping   # -> PONG
```

### Is the *app* actually using it?
BullMQ only connects when a queue is registered (media-gallery + notifications
modules). Confirm end-to-end:
```bash
# trigger a media upload from the app, then watch the queue keys appear:
redis-cli --scan --pattern 'bull:*'
# e.g. bull:media-upload:*  bull:notifications:*
```
No `bull:*` keys after using those features = the app isn't reaching Redis (check
`REDIS_HOST`/`REDIS_PORT`, and that the password matches if one is set).

### Common gotcha
`maxRetriesPerRequest: null` is set intentionally (BullMQ requirement) — so if Redis is
down, the app **won't crash**, it'll just keep retrying silently. Don't mistake "app
booted fine" for "Redis is connected." Always verify with the `bull:*` scan above.

---

<a name="3-redis-no-docker"></a>
## 3. Can Redis run without Docker? Can I inspect it without Docker?

**Yes to both.** Redis is a normal binary; Docker is just one way to run it.

### Run Redis natively (no Docker)

**macOS (your local machine):**
```bash
brew install redis
brew services start redis      # runs on boot, localhost:6379, password-less
# or one-off in the foreground:
redis-server
```
This matches your current `backend/.env` (`REDIS_HOST=localhost`, no password) exactly —
nothing else to change.

**Linux VPS (if you ever want it off Docker):**
```bash
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
# set a password: edit /etc/redis/redis.conf -> `requirepass YOUR_PASSWORD`, then:
sudo systemctl restart redis-server
```
> For the VPS the **Docker Redis is the better choice** — it's already isolated on the
> internal network with no public port and a password. Only go native if you have a
> specific reason.

### Inspect / "see the database" without Docker

Redis is key-value, not tables — but you have several ways to look inside:

**CLI (already covered):**
```bash
redis-cli                    # interactive shell
redis-cli --scan             # list all keys
redis-cli --scan --pattern 'bull:*'
redis-cli monitor            # live stream of every command (great for debugging)
redis-cli info               # server stats, memory, connected clients
```

**GUI tools (point them at host `localhost`, port `6379`, password if any):**
- **RedisInsight** (free, official from Redis) — best visual browser, shows BullMQ
  queues nicely. `brew install --cask redisinsight`.
- **Another Redis Desktop Manager** (free, cross-platform).
- **TablePlus** — supports Redis alongside Postgres in one app.

**Inspecting the *production* Redis (which has no public port):** open an SSH tunnel and
point a local GUI at it:
```bash
# from your laptop — forwards local 6380 to the VPS's docker redis
ssh -L 6380:localhost:6379 user@your-vps
# but the docker redis isn't on the VPS's localhost either; instead exec in:
ssh user@your-vps
docker compose exec redis redis-cli -a "$REDIS_PASSWORD"
```
Because prod Redis is only on the `island-net` Docker network, the reliable way is
`docker compose exec redis redis-cli -a <password>` on the VPS. To use a desktop GUI,
temporarily publish the port (add `ports: ['127.0.0.1:6379:6379']` to the redis service)
**or** run a tunnel through a container — keep it off the public internet either way.

---

<a name="4-run-with-docker"></a>
## 4. Run everything with Docker

### Local dev — infra in Docker, apps native (the intended workflow)
```bash
docker compose -f docker-compose.dev.yml up -d      # postgres + redis only
# update backend/.env: DATABASE_URL=postgresql://island:island@localhost:5432/island_tours?schema=public
pnpm dev:backend                                    # NestJS on :5050 (hot reload)
```

### Full production stack in Docker (the VPS)
```bash
# one-time on the VPS:
cp .env.example .env                                   # fill POSTGRES_*, REDIS_PASSWORD
cp backend/.env.production.example backend/.env.production   # fill app secrets

# first deploy against an empty DB — seed the admin:
#   set RUN_SEED=true in .env
docker compose up -d --build

# after first boot, set RUN_SEED=false in .env so redeploys don't reseed
docker compose up -d
```
On every boot the entrypoint (`backend/docker-entrypoint.sh`) runs
`prisma migrate deploy` (idempotent), optionally seeds, then starts the server. So
**redeploying = rebuild + up**; migrations apply automatically.

### Redeploy after a code change
```bash
git pull
docker compose up -d --build backend      # rebuild only the app; DB + Redis stay up
docker compose logs -f backend            # watch it migrate + boot
```

### Everyday container ops
```bash
docker compose ps                 # what's running + health status
docker compose logs -f backend    # tail app logs (see §7 — logs go to stdout)
docker compose restart backend
docker compose down               # stop all (volumes preserved)
docker compose down -v            # stop AND delete volumes (DESTROYS data)
```

> **Coolify note:** your `docker-compose.yml` header mentions Coolify's Traefik proxy and
> the backend publishes a port (not loopback-only). If you deployed via **Coolify**, use
> the Coolify dashboard for logs, redeploys, and env vars instead of raw `docker compose`
> — but the credential model in §1 is identical (Coolify just injects the same env vars).
> If you deployed **plain docker compose + host nginx**, use `deploy/nginx/island-api.conf`
> and change the port back to `127.0.0.1:5050:5050` so only nginx is public.

---

<a name="5-db-gui"></a>
## 5. Visualize the database (GUI options)

### Fastest: Prisma Studio (already wired)
The schema and script exist (`pnpm prisma:studio` → `prisma studio`). It's a web UI on
`localhost:5555` that reads your `DATABASE_URL`.

**Local:**
```bash
cd backend && pnpm prisma:studio     # opens http://localhost:5555
```

**Against production** — Prisma Studio must run where it can reach the DB. Two ways:

*Run it inside the backend container (simplest):*
```bash
ssh user@your-vps
docker compose exec backend npx prisma studio --port 5555 &
# then tunnel from your laptop:
ssh -L 5555:localhost:5555 user@your-vps
# open http://localhost:5555 locally
```

*Or SSH-tunnel Postgres and run Studio locally* (see the tunnel in §5b).

### Desktop GUI clients (Postgres)
Point any of these at your DB. Locally: `localhost:5432`. For prod, tunnel first (§5b).
- **TablePlus** — clean, fast, free tier (also does Redis).
- **DBeaver** — free, full-featured, cross-platform.
- **pgAdmin 4** — official Postgres admin.
- **Postico** (macOS).

Connection params come straight from `.env`: user = `POSTGRES_USER`,
password = `POSTGRES_PASSWORD`, db = `POSTGRES_DB`, host/port per below.

### 5b. Reaching the production DB (it has no public port — by design)
The `postgres` service publishes **no ports**, so open an SSH tunnel and expose it
through the running container's network. Simplest reliable path:
```bash
# temporarily, add to docker-compose.yml postgres service:
#   ports: ['127.0.0.1:5432:5432']
# docker compose up -d postgres
# then from your laptop:
ssh -L 5432:localhost:5432 user@your-vps
# connect your GUI to localhost:5432
```
Remove the `ports:` line again when done — **never leave Postgres publicly reachable.**
(Alternatively, keep it internal and just use `docker compose exec postgres psql -U <user> -d island_tours` on the VPS for quick queries.)

---

<a name="6-db-backup"></a>
## 6. Back up the database (and restore)

There is **no backup automation in the repo today** — you add it at the VPS level. Data
lives in the `postgres-data` Docker volume.

### Manual backup (run on the VPS)
```bash
# logical dump (portable, restorable to any PG 16):
docker compose exec -T postgres pg_dump -U <POSTGRES_USER> -d island_tours \
  --format=custom --file=/tmp/island_$(date +%F).dump
docker compose cp postgres:/tmp/island_$(date +%F).dump ./backups/

# or stream straight to the host in one line:
docker compose exec -T postgres pg_dump -U <POSTGRES_USER> -Fc island_tours \
  > ./backups/island_$(date +%F_%H%M).dump
```

### Restore
```bash
# copy the dump into the container, then:
docker compose exec -T postgres pg_restore -U <POSTGRES_USER> -d island_tours \
  --clean --if-exists /tmp/island_2026-07-05.dump
# (or pipe from host: `cat backup.dump | docker compose exec -T postgres pg_restore ...`)
```

### Automate: nightly cron on the VPS (recommended baseline)
Create `/usr/local/bin/island-backup.sh`:
```bash
#!/bin/sh
set -e
cd /path/to/island-tour-development
STAMP=$(date +%F_%H%M)
mkdir -p backups
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -Fc island_tours \
  > "backups/island_${STAMP}.dump"
# keep 14 days
find backups -name 'island_*.dump' -mtime +14 -delete
```
```bash
chmod +x /usr/local/bin/island-backup.sh
crontab -e
# run 03:15 daily:
15 3 * * * POSTGRES_USER=island /usr/local/bin/island-backup.sh >> /var/log/island-backup.log 2>&1
```

### Better: off-site + managed
- **Push dumps off the VPS** (a VPS failure shouldn't take your only backup with it):
  `rclone` / `aws s3 cp` the dump to S3/Backblaze/Cloudflare R2 in the cron script.
- **Managed Postgres** (Neon, Supabase, Railway, RDS) gives you point-in-time recovery
  and automatic backups for free — you'd just change `DATABASE_URL`. Worth considering
  once you have real bookings.
- **Test a restore** at least once. A backup you've never restored is a hope, not a backup.

### Redis backups
The `redis-data` volume has AOF persistence (`--appendonly yes`), so queue state
survives restarts. BullMQ data is transient (jobs), so it usually doesn't need backup —
but if you want one: `docker compose exec redis redis-cli -a <pw> BGSAVE` writes an RDB
snapshot into the volume.

---

<a name="7-audit-logs"></a>
## 7. Audit logs — what exists today and how to visualize

### What exists now
- **There is NO dedicated audit-log table or module.** (The only "audit" reference in the
  schema is a comment on a `requestedBy` field in `tiers.prisma` — not an audit trail.)
- **What you do have** is structured application logging. Per the project conventions,
  every service uses `private readonly logger = new Logger(<Service>.name)` and logs
  mutating admin actions. These go to **stdout/stderr**, which Docker captures.

### Visualizing today's logs (zero setup)
```bash
docker compose logs -f backend                 # live tail
docker compose logs --since 1h backend         # last hour
docker compose logs backend | grep -i "error"  # filter
docker compose logs backend > backend_$(date +%F).log   # export
```
> There is a `/api/v1/health` endpoint (`@Public() @SkipThrottle()`) but it's **shallow** —
> it returns `{ status: 'ok', timestamp, uptime }` and does **not** check Postgres or Redis
> liveness. If you wire an uptime monitor (UptimeRobot, Better Stack) to it, it only tells
> you the process is up, not that the DB is reachable. Deepening it (add DB/Redis pings via
> `@nestjs/terminus`) is a small future code task.

Docker's json-file driver keeps these; add rotation so they don't fill the disk — edit
`/etc/docker/daemon.json`:
```json
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
```
then `sudo systemctl restart docker`.

### If you want a real, queryable audit log
Two levels:

**A. Aggregate the existing stdout logs into a UI** (no code change):
- **Grafana Loki + Promtail** (lightweight, self-hosted) — ship container logs to Loki,
  browse/search in Grafana. Best fit for a single VPS.
- **Dozzle** — dead-simple real-time Docker log viewer in the browser (`docker run` one
  container, point at the socket). Great for "just let me see logs in a web UI."
- Hosted: Better Stack (Logtail), Datadog, Axiom — send stdout, get search + alerts.

**B. A true business audit trail** (who changed what, when) — needs a small code addition
later: an `audit_log` Prisma model (`actorId`, `action`, `entityType`, `entityId`,
`before`/`after` JSON, `ip`, `createdAt`) written from a NestJS interceptor on mutating
routes. This is the right approach for compliance/forensics but is a **feature to build**,
not config. Flag it for a future phase if you need it.

> Recommendation for now: turn on Docker log rotation (above) and add **Dozzle** for a
> browser view. Move to **Loki+Grafana** when you also add metrics/Sentry (§8–9) so it's
> one dashboard.

---

<a name="8-sentry"></a>
## 8. Set up Sentry (error monitoring)

**Not installed today** — no `@sentry/*` dependency in either app, no `SENTRY_DSN` env
var. This is a code + config task. Here's the exact path (NestJS 11).

> Check current setup steps against the docs before implementing — Sentry's SDK API
> moves. Use Context7 (`resolve-library-id` → `@sentry/nestjs`, then `query-docs`) or
> https://docs.sentry.io/platforms/javascript/guides/nestjs/.

### Steps (backend)
1. Create a project at sentry.io (or self-host). Copy the **DSN**.
2. Install: `cd backend && pnpm add @sentry/nestjs @sentry/profiling-node`.
3. Create `backend/src/instrument.ts` and import it **first** in `main.ts` (before
   anything else):
   ```ts
   // instrument.ts
   import * as Sentry from '@sentry/nestjs';
   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV,
     tracesSampleRate: 0.1,        // 10% perf traces
     enabled: process.env.NODE_ENV === 'production',
   });
   ```
   ```ts
   // main.ts — very first line
   import './instrument';
   ```
4. Add `SentryModule.forRoot()` to `AppModule.imports` and use the Sentry global filter
   (or keep your `AllExceptionsFilter` and call `Sentry.captureException` inside it).
5. Add `SENTRY_DSN` to `backend/.env.production` **and** to the `OPTIONAL` map in
   `env.validate.ts` so it's validated (optional → only checked if present).
6. Rebuild: `docker compose up -d --build backend`. Trigger a test error; confirm it
   lands in Sentry.

### Frontend (Vercel, Next.js)
`pnpm add @sentry/nextjs` then `npx @sentry/wizard@latest -i nextjs` — it wires config +
source maps and reads `SENTRY_DSN` from Vercel env vars. Sentry then correlates
frontend + backend errors if you propagate trace headers.

Sentry gives you error grouping, stack traces, release tracking, alerts, and (with
`tracesSampleRate`) basic performance/tracing — often enough that you may not need
full OpenTelemetry (§9) on day one.

---

<a name="9-otel"></a>
## 9. Set up OpenTelemetry (tracing / metrics)

**Not installed today** — no `@opentelemetry/*` packages. This is heavier than Sentry;
adopt it when you need distributed traces or Prometheus metrics. Two routes:

### Route A — Sentry's built-in tracing (simplest)
If you set `tracesSampleRate` in §8, Sentry already uses OpenTelemetry under the hood
for the NestJS SDK and gives you request traces with no extra infra. **Start here.**

### Route B — Full OTel stack (vendor-neutral)
> Verify package names/versions via Context7 (`@opentelemetry/sdk-node`,
> `@opentelemetry/auto-instrumentations-node`) or https://opentelemetry.io/docs/languages/js/.

1. Install:
   ```bash
   cd backend && pnpm add @opentelemetry/sdk-node \
     @opentelemetry/auto-instrumentations-node \
     @opentelemetry/exporter-trace-otlp-http
   ```
2. Create `backend/src/tracing.ts` and import it **first** in `main.ts`:
   ```ts
   import { NodeSDK } from '@opentelemetry/sdk-node';
   import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
   import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
   const sdk = new NodeSDK({
     traceExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
     instrumentations: [getNodeAutoInstrumentations()],   // auto: HTTP, Express, pg, ioredis
   });
   sdk.start();
   ```
   Auto-instrumentation covers HTTP, Express (NestJS), **Prisma/pg**, and **ioredis/BullMQ**
   with no per-route code.
3. Run a collector + backend to view traces. On a single VPS the cheap option is a
   Docker container: **Grafana Tempo** (traces) + **Grafana** (view), or **Jaeger**
   all-in-one (`jaegertracing/all-in-one`), or **SigNoz** (traces+metrics+logs in one).
   Add it as a service and set `OTEL_EXPORTER_OTLP_ENDPOINT` to it.
4. Add `OTEL_EXPORTER_OTLP_ENDPOINT` etc. to env + `env.validate.ts` OPTIONAL map.

### Recommendation
For your stage: **Sentry (§8) first** for errors + light tracing. Add full OTel only
when you're debugging cross-service latency or want Prometheus metrics. If you go OTel,
**SigNoz** self-hosted gives you logs + traces + metrics in one UI and pairs well with
the audit-log aggregation from §7.

---

<a name="10-rate-limiter"></a>
## 10. Rate limiter — already built; how to tune

**Good news: it already exists and is active** — `@nestjs/throttler` with a global
`ThrottlerGuard` registered in `backend/src/auth/auth.module.ts` (it runs *first* in the
guard chain, before auth). You don't need to "set it up"; you tune it.

### Current limits (per client IP)
```ts
// auth.module.ts — ThrottlerModule.forRoot({ throttlers: [...] })
{ name: 'short',  ttl: 1_000,     limit: 20   }   // 20 req/sec  (burst)
{ name: 'medium', ttl: 60_000,    limit: 300  }   // 300 req/min (sustained)
{ name: 'long',   ttl: 3_600_000, limit: 3000 }   // 3000 req/hr (hard cap)
```
- **Trusted-origin bypass:** `skipIf: isTrustedInternalOrigin` — your SSR/build server
  sends `x-internal-api-key` matching `INTERNAL_API_SECRET`, so Vercel prerender bursts
  aren't throttled. Everyone else is limited. **Set `INTERNAL_API_SECRET` in production**
  (both apps) or `next build` can 429 mid-prerender (the env validator warns if unset).
- **Real client IP:** `main.ts` sets `trust proxy = 1` and the nginx conf forwards
  `X-Real-IP` / `X-Forwarded-For`, so the limiter sees the actual visitor, not the proxy.
- **Auth brute-force** is *separately* handled by Better Auth's own per-path limiter
  (`auth.instance.ts` → `rateLimit.customRules`).

### How to tune
- **Global limits:** edit the `throttlers` array in `auth.module.ts`.
- **Per-route override:** `@Throttle({ short: { limit: 5, ttl: 60_000 } })` on a
  controller/route (examples are documented in `app.controller.ts`). Use this to tighten
  login/register/reset-password.
- **Skip a route:** `@SkipThrottle()` (already on `/health` and Stripe webhooks).

### Distributed rate limiting (only if you run >1 backend instance)
The default throttler stores counters **in memory** — fine for one container, but with
multiple replicas each has its own counter (so effective limits multiply). To share
across instances, swap in `@nest-lab/throttler-storage-redis` (or the community Redis
storage) pointed at your existing Redis. This becomes relevant with §11 auto-scaling.

---

<a name="11-autoscale"></a>
## 11. Auto-scaling — options for a single VPS

Honest framing: **a single Hostinger VPS does not "auto-scale"** the way a cloud
platform does. Your realistic options, cheapest first:

### Tier 1 — Vertical scaling (you're here)
Resize the VPS (more vCPU/RAM) in the Hostinger panel. Zero code change. Do this first;
one well-sized VPS handles a lot.

### Tier 2 — Horizontal scaling on the same VPS (manual)
Run multiple backend containers behind nginx/Traefik load balancing:
```yaml
# docker compose up -d --scale backend=3   (needs the published port removed / handled by proxy)
```
This is **manual**, not auto. Requirements before you do it:
- **Move rate-limit state to Redis** (§10) so limits are shared.
- **BullMQ workers**: multiple instances all process the same queues — usually fine
  (BullMQ is built for concurrency), but make sure nightly cron-style jobs
  (`workers/nightly-jobs.service.ts` via `@nestjs/schedule`) don't double-run. Use a
  Redis lock or run schedulers in exactly one instance.
- Stateless app: ✅ already (sessions are cookie/DB-backed via Better Auth, no in-memory
  session store), so replicas are safe apart from the two points above.

### Tier 3 — Real auto-scaling (platform change)
True autoscaling means a platform that spins containers up/down on load:
- **Docker Swarm** (`docker service ... --replicas` + `docker stack`) — closest to your
  current compose, adds rolling updates and simple scaling on one or several VPSs.
- **Kubernetes** (k3s is lightweight enough for a VPS) — Horizontal Pod Autoscaler scales
  on CPU/memory. Powerful but a big operational step up.
- **Managed container hosts** (Railway, Render, Fly.io, AWS ECS/Fargate, Google Cloud
  Run) — real request-based autoscaling with almost no ops. If autoscaling is a hard
  requirement, moving the **backend** here (keeping Postgres/Redis managed) is far less
  work than running k8s yourself. Your image is already a clean, migrate-on-boot
  Dockerfile, so it ports easily.

### Recommendation
For now: **right-size one VPS (Tier 1)** + set up backups (§6) + Sentry (§8). Revisit
horizontal scaling only when a single instance is genuinely saturated (watch CPU/RAM and
p95 latency — Sentry/OTel will tell you). When you get there, the smallest jump with
real autoscaling is a managed container host (Tier 3), not self-hosted k8s.

---

<a name="12-cheatsheet"></a>
## 12. Quick command cheat-sheet

```bash
# ── Containers ────────────────────────────────────────────────
docker compose ps                          # status + health
docker compose logs -f backend             # live app logs (= your audit trail today)
docker compose up -d --build backend       # redeploy backend after git pull
docker compose restart redis backend       # apply a REDIS_PASSWORD change
docker compose down                        # stop (keep data);  down -v = DELETE data

# ── Postgres ──────────────────────────────────────────────────
docker compose exec postgres psql -U $POSTGRES_USER -d island_tours   # SQL shell
docker compose exec -T postgres pg_dump -U $POSTGRES_USER -Fc island_tours > backup.dump
cd backend && pnpm prisma:studio           # DB GUI on :5555

# ── Redis ─────────────────────────────────────────────────────
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping        # -> PONG
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" --scan --pattern 'bull:*'
redis-cli ping                             # local native redis

# ── Change DB password (keep data) ────────────────────────────
docker compose exec postgres psql -U $POSTGRES_USER -d island_tours \
  -c "ALTER USER $POSTGRES_USER WITH PASSWORD 'NEW';"   # then edit .env + recreate backend
```

---

## Summary of what's already built vs. what you'd add

| Concern | Status in codebase | Action |
|---|---|---|
| Rate limiter | ✅ **Built & active** (3-tier per-IP throttle + trusted bypass) | Just tune limits; set `INTERNAL_API_SECRET` in prod |
| DB credentials | ✅ Defined (root `.env` → compose) | Change per §1 |
| Redis | ✅ Configured (BullMQ; docker + native both supported) | Verify with `bull:*` scan |
| DB GUI | ✅ Prisma Studio wired (`pnpm prisma:studio`) | Or TablePlus/DBeaver + tunnel |
| DB backups | ❌ No automation | Add cron + off-site (§6) |
| Audit log (business) | ❌ No table/module (only stdout logging) | View logs now (§7); build `audit_log` model later |
| Sentry | ❌ Not installed | Add `@sentry/nestjs` (§8) |
| OpenTelemetry | ❌ Not installed | Sentry tracing first; full OTel later (§9) |
| Auto-scaling | ❌ Single VPS, no autoscale | Vertical now; managed host later (§11) |
```
