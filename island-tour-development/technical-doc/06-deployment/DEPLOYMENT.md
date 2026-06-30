# Deployment Guide

How Island Tours is built, run, and shipped: **frontend on Vercel**, **backend +
Postgres + Redis on a Hostinger VPS** via Docker Compose, with **GitHub Actions
CI/CD**.

---

## 1. Topology

```text
                 ┌────────────────────────┐
   travelers ───▶│  Vercel (Next.js)      │  https://www.your-domain.com
                 │  frontend, auto-deploy │
                 └───────────┬────────────┘
                             │ HTTPS  (NEXT_PUBLIC_BACKEND_URL)
                             ▼
                 ┌────────────────────────┐  https://api.your-domain.com
                 │  nginx + certbot (TLS)  │  (host, port 443 -> 127.0.0.1:5050)
                 └───────────┬────────────┘
                             │
        ┌────────────────────┴───────────────── docker compose (island-net) ──┐
        │                                                                      │
        │   backend (NestJS)  ──▶  postgres:16      redis:7 (--requirepass)    │
        │   127.0.0.1:5050         (volume)         (volume)                   │
        └──────────────────────────────────────────────────────────────────────┘
```

- The **frontend never touches the database** and has no `DATABASE_URL` - it only
  calls the backend API over HTTPS.
- Postgres and Redis are **internal to the compose network** (no published ports);
  only the backend reaches them. The backend itself binds to `127.0.0.1:5050`, so
  nothing is exposed publicly except through nginx.

### Files

| Path | Purpose |
| --- | --- |
| `backend/Dockerfile` | Multi-stage production image (build -> slim runner) |
| `backend/docker-entrypoint.sh` | `migrate deploy` (+ optional seed) then start |
| `backend/.dockerignore` | Keeps secrets/deps/tests out of the build context |
| `docker-compose.yml` | Production stack: postgres + redis + backend |
| `docker-compose.dev.yml` | Local dev infra: postgres + redis only (host ports) |
| `.env.example` | Compose infra vars (Postgres/Redis creds, image tag) |
| `backend/.env.production.example` | Backend app secrets for the prod stack |
| `.github/workflows/ci.yml` | Lint + build + test on PR/push |
| `.github/workflows/deploy-backend.yml` | SSH deploy to the VPS on push to main |

---

## 2. Local development - with OR without Docker

The backend reads Postgres from `DATABASE_URL` and Redis from `REDIS_HOST` /
`REDIS_PORT` (no `UPSTASH_REDIS_URL`). Both setups below satisfy that.

### Option A - Docker for the infra (recommended)

```bash
cp backend/.env.example backend/.env          # then fill in secrets
docker compose -f docker-compose.dev.yml up -d   # postgres + redis on host ports
pnpm install:all
pnpm prisma:migrate                            # apply migrations
pnpm prisma:seed                               # admin + base data
pnpm dev                                       # backend :5050 + frontend :3000
```

The dev compose defaults (`island/island/island_tours`, Redis on `localhost:6379`,
**no password**) match `backend/.env.example`, so it works out of the box. Leave
`REDIS_PASSWORD` blank for dev.

### Option B - natively installed Postgres + Redis (no Docker)

```bash
brew install postgresql@16 redis      # or your OS equivalent
brew services start postgresql@16
brew services start redis
createdb island_tours
# point backend/.env DATABASE_URL at your local pg, REDIS_HOST=localhost
pnpm install:all && pnpm prisma:migrate && pnpm prisma:seed && pnpm dev
```

Either way, **do not set `UPSTASH_REDIS_URL`** locally - that's what previously
exhausted the Upstash free-tier command quota via BullMQ's constant polling.

---

## 3. VPS first-time setup (Hostinger)

SSH into the VPS as a sudo user.

### 3.1 Install Docker + Compose plugin

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER       # log out/in so the group applies
docker compose version              # verify the v2 plugin is present
```

### 3.2 Clone the repo + create env files

```bash
sudo mkdir -p /opt/island-tours && sudo chown $USER /opt/island-tours
git clone https://github.com/<you>/<repo>.git /opt/island-tours
cd /opt/island-tours

cp .env.example .env                                  # compose infra vars
cp backend/.env.production.example backend/.env.production   # backend secrets
```

Fill both files in:

- `.env` - `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (`openssl rand -base64 24`),
  leave `RUN_SEED=true` **for this first deploy only**.
- `backend/.env.production` - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`),
  `ENCRYPTION_KEY` (`openssl rand -hex 32`), `BETTER_AUTH_URL=https://api.your-domain.com`,
  `FRONTEND_URL` / `CORS_ORIGINS` = your Vercel domain(s), Cloudinary, SMTP,
  `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

These two files are gitignored and live only on the VPS; `git reset --hard`
during deploys never touches them (they're untracked).

### 3.3 First boot

```bash
docker compose up -d --build
docker compose logs -f backend      # watch: migrate deploy -> seed -> "Nest application successfully started"
```

Once it's healthy, **set `RUN_SEED=false` in `.env`** so future redeploys don't
re-run the seed, then `docker compose up -d` again to apply.

---

## 4. nginx reverse proxy + TLS

Point an `api.your-domain.com` DNS A record at the VPS, then:

```bash
sudo apt-get install -y nginx
```

`/etc/nginx/sites-available/island-api` :

```nginx
server {
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5050;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Stripe webhooks need the raw body intact - nginx passes it through as-is.
    client_max_body_size 15m;   # room for media uploads
}
```

```bash
sudo ln -s /etc/nginx/sites-available/island-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com     # provisions + auto-renews TLS
```

The backend already trusts one proxy hop (`trust proxy: 1` in `main.ts`), so
`ThrottlerGuard` and Better Auth see the real client IP / HTTPS scheme.

---

## 5. Frontend on Vercel

1. Import the repo in Vercel; set **Root Directory = `frontend`**.
2. Framework preset: **Next.js** (build/output autodetected).
3. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_BACKEND_URL = https://api.your-domain.com`
   - `NEXT_PUBLIC_OPEN_WEATHER_API_KEY = ...` (if used)
4. Add your custom domain(s) in Vercel and update DNS.
5. **CI/CD is automatic** - Vercel builds + deploys on every push (production on
   `main`, preview on PRs). No GitHub workflow needed for the frontend.

After the domain is live, confirm it's listed in the backend's `CORS_ORIGINS`
and `FRONTEND_URL` (in `backend/.env.production`), then redeploy the backend.

---

## 6. CI/CD

### GitHub Actions

- **`ci.yml`** - on every PR and push to `main`: lint, build, and unit-test both
  apps. No DB needed (unit specs are mocked).
- **`deploy-backend.yml`** - on push to `main` touching `backend/**` or
  `docker-compose.yml`: SSHes into the VPS, `git reset --hard` to the pushed SHA,
  rebuilds the `backend` image, and `docker compose up -d`. Migrations run
  automatically inside `docker-entrypoint.sh`.

### Required GitHub repo secrets (Settings -> Secrets -> Actions)

| Secret | Value |
| --- | --- |
| `VPS_SSH_HOST` | VPS IP / hostname |
| `VPS_SSH_USER` | deploy user (in the `docker` group) |
| `VPS_SSH_KEY` | private key whose public half is in the user's `~/.ssh/authorized_keys` |
| `VPS_SSH_PORT` | SSH port (optional, defaults to 22) |
| `VPS_APP_DIR` | e.g. `/opt/island-tours` |

> **Image registry alternative.** The default builds on the VPS (simplest, no
> registry). If the VPS is small, switch to building + pushing to GHCR in CI and
> only `docker compose pull && up -d` on the VPS instead.

---

## 7. Operations

```bash
# Logs
docker compose logs -f backend

# Apply a new migration manually (normally automatic on deploy)
docker compose exec backend pnpm prisma:migrate:deploy

# Re-run the seed deliberately
docker compose run --rm -e RUN_SEED=true backend true   # or set RUN_SEED + up -d

# Postgres backup / restore
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backup-$(date +%F).sql
cat backup.sql | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

# Redis sanity check
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping     # -> PONG
```

Data survives container/image rebuilds via the `postgres-data` and `redis-data`
named volumes. Schedule the `pg_dump` above off-box (cron + object storage).

---

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `ERR max requests limit exceeded` (Redis) | You're still on Upstash free tier. Unset `UPSTASH_REDIS_URL`; use the self-hosted `redis` service (no quota). |
| `Environment validation failed: ... is missing` | A required var is absent. Check `backend/.env.production` against `*.example`; compose injects `DATABASE_URL`/`REDIS_*`. |
| Redis `NOAUTH`/`WRONGPASS` | `REDIS_PASSWORD` in `.env` must match the `redis` service `--requirepass`. They're wired from the same var, so re-`up -d` after editing. |
| CORS error in browser | Add the exact Vercel origin to `CORS_ORIGINS` (comma-separated, no spaces, scheme included), redeploy backend. |
| Better Auth links point at localhost | Set `BETTER_AUTH_URL=https://api.your-domain.com` in `backend/.env.production`. |
| Stripe webhook signature fails | Ensure nginx forwards the raw body (no buffering middleware); the app uses `rawBody: true`. |
| backend container restarts on boot | Usually a failed `migrate deploy` - `docker compose logs backend`. Postgres must be healthy first (compose `depends_on` handles ordering). |
