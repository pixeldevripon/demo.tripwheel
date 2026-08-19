# VPS Deployment — Hostinger + Caddy

> Deploy-day runbook: the NestJS API in Docker, all three Next.js apps under PM2, Caddy in front
> handling every domain and certificate.
>
> **Day-2 operations** (password rotation, restores, audit logs, Sentry, OTel, rate-limit tuning,
> scaling) live in `island-tour-development/technical-doc/06-operations/VPS-OPERATIONS-GUIDE.md`.
> That guide assumes **nginx** and **frontends on Vercel** — §7 and §8 below replace those two
> parts. Everything it says about Postgres, Redis, backups and monitoring still applies.
>
> Published version (nicer to read): https://claude.ai/code/artifact/6ede3526-e18f-4a13-9cb2-0021eea7f82a

---

## 0. What you're deploying

| App | Folder | How it runs | Local port |
|---|---|---|---|
| Backend API (NestJS 11 + Prisma 7) | `island-tour-development/backend` | Docker Compose (+ Postgres + Redis) | `5050` |
| Public site (travellers) | `island-tour-development/frontend` | PM2 → `next start` | `3000` |
| Dashboard (operator + admin) | `tripwheel-x-islandtours-dashboard` | PM2 → `next start` | `3001` |
| Tripwheel app (marketing + admin door) | `tripwheel-app` | PM2 → `next start` | `3002` |

### Deploy order — it's a dependency chain, not a preference

1. **DNS** — Caddy can't issue a cert for a name that doesn't resolve to the server.
2. **Backend** — must be live and answering.
3. **Caddy** — so the API is reachable over HTTPS.
4. **Next.js apps** — because `next build` fetches from that HTTPS API while prerendering.

**Sizing:** at least **4 GB RAM** plus swap. Three Next production builds get OOM-killed on 2 GB
with no useful error.

---

## 1. Pick your domains — once, carefully

**All four apps must live under one apex domain.** The backend issues the session cookie scoped to
a shared parent domain; an app on a different apex signs in successfully and then behaves as though
nobody is logged in.

This doc uses `tripwheel.app`.

| Domain | Serves | Proxies to |
|---|---|---|
| `api.tripwheel.app` | Backend API | `127.0.0.1:5050` |
| `islandtours.tripwheel.app` | Public site | `127.0.0.1:3000` |
| `dashboard.tripwheel.app` | Dashboard (operators at `/portal`) | `127.0.0.1:3001` |
| `tripwheel.app` | Tripwheel app / admin door | `127.0.0.1:3002` |
| `www.tripwheel.app` | redirect → apex | — |

```
COOKIE_DOMAIN=.tripwheel.app     # leading dot required
```

> **Inconsistency in your own example files.** `frontend/.env.production.example` sets the public
> site to `www.tripwheel.app`, while `backend/.env.production.example` sets
> `ISLAND_TOURS_URL=https://islandtours.tripwheel.app`. Both can't be the public site. This doc
> assumes `islandtours.tripwheel.app`; if you prefer `www`, swap it consistently everywhere in §13.

---

## 2. DNS

Get the VPS IP from Hostinger → VPS → Overview.

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | VPS IP | 300 |
| A | `www` | VPS IP | 300 |
| A | `api` | VPS IP | 300 |
| A | `dashboard` | VPS IP | 300 |
| A | `islandtours` | VPS IP | 300 |

Add matching `AAAA` records if the VPS has IPv6. Raise TTL to 3600 once everything works.

Verify before continuing — every one must print the VPS IP:

```bash
dig +short api.tripwheel.app
dig +short dashboard.tripwheel.app
dig +short islandtours.tripwheel.app
dig +short tripwheel.app
```

**Cloudflare:** keep the proxy **off** (grey cloud). The orange cloud adds a second proxy hop and
the backend trusts exactly one (`trust proxy 1` in `backend/src/main.ts`), so rate limiting would
count Cloudflare's IP as every visitor.

**Email DNS:** add your domain in Resend and paste its DKIM / SPF / DMARC records into the same
zone. Until it shows "verified", every booking confirmation, password reset and operator invite
silently fails to send.

---

## 3. Prepare the VPS (Ubuntu 24.04)

### a. Deploy user

```bash
# ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

Confirm `ssh deploy@YOUR_VPS_IP` works in a **second terminal** before locking root out:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### b. Firewall — three ports only

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### c. Swap

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### d. Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
# log out and back in as deploy, then: docker ps
```

### e. Node 22 + pnpm 10 + PM2 (for the Next.js apps only)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable && corepack prepare pnpm@10 --activate
sudo npm install -g pm2
```

### f. Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

---

## 4. Get the code onto the server

Generate a key on the VPS, add it to GitHub (Settings → SSH and GPG keys — one account key covers
all three private repos):

```bash
ssh-keygen -t ed25519 -C "tripwheel-vps" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
ssh -T git@github.com
```

```bash
sudo mkdir -p /srv/tripwheel && sudo chown deploy:deploy /srv/tripwheel
cd /srv/tripwheel

git clone -b prod git@github.com:pixeldevripon/island-tours.git island-tour-development
git clone -b main git@github.com:pixeldevripon/dashbaord-tripwheel-x-islandtours.git tripwheel-x-islandtours-dashboard
git clone -b main git@github.com:pixeldevripon/tripwheel.app.git tripwheel-app
```

The typo in `dashbaord-…` is the real repo name. Note the branches differ: `prod` for
`island-tour-development`, `main` for the other two.

---

## 5. Generate every secret once

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
echo "TRAVELER_SESSION_SECRET=$(openssl rand -base64 32)"
echo "INTERNAL_API_SECRET=$(openssl rand -base64 32)"
echo "REVALIDATE_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "ADMIN_PASSWORD=$(openssl rand -base64 18)"
echo "SYSTEM_ADMIN_PASSWORD=$(openssl rand -base64 18)"
```

| Secret | Job | If it doesn't match |
|---|---|---|
| `INTERNAL_API_SECRET` | Lets the Next servers skip the API's per-IP rate limit while rendering | Builds hit 429 mid-render; logged-in users get bounced |
| `REVALIDATE_SECRET` | Lets backend + dashboard clear the public site's page cache | Public site serves stale prices; no error anywhere |
| `ENCRYPTION_KEY` | Encrypts Stripe keys / operator tokens in the DB | Rotating it makes every stored credential unreadable |
| `BETTER_AUTH_SECRET` | Signs staff/operator/admin sessions | Changing it logs everyone out |
| `TRAVELER_SESSION_SECRET` | Signs traveller booking-lookup tokens (deliberately separate) | Booking-reference links stop working |

The backend validates its env at boot and prints exactly what's wrong. In production it **hard-fails**
without `INTERNAL_API_SECRET`. Secrets under 32 chars are rejected; anything containing `change-me`
is rejected as a placeholder.

---

## 6. Deploy the backend

### a. Compose-level env — `island-tour-development/.env`

```bash
cd /srv/tripwheel/island-tour-development
cp .env.example .env && nano .env
```

```ini
POSTGRES_USER=island
POSTGRES_PASSWORD=<from step 5>
POSTGRES_DB=island_tours

REDIS_PASSWORD=<from step 5>

# Loopback ONLY — Caddy is the front door.
BACKEND_PORT=127.0.0.1:5050
BACKEND_IMAGE_TAG=latest

# true for the FIRST boot only, then set back to false
RUN_SEED=true

# Empty on purpose: switches off the temporary --trace-deprecation debug flag
NODE_OPTIONS=
```

> **Do not skip the `127.0.0.1`.** Compose publishes `${BACKEND_PORT:-5050}:5050`. Set
> `BACKEND_PORT=5050` and Docker binds `0.0.0.0` — and **Docker's iptables rules bypass UFW**, so
> your API ends up publicly reachable on 5050 with no TLS.

### b. App env — `backend/.env.production`

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

> **First fix a typo in the example.** `backend/.env.production.example` begins with a stray word
> `the` before the first comment (`the # ────…`). Compose parses that as a malformed environment
> line and refuses to start. Delete those four characters.

```ini
# ── Public URLs ──────────────────────────────────────────────
BETTER_AUTH_URL=https://api.tripwheel.app
ISLAND_TOURS_URL=https://islandtours.tripwheel.app
PORTAL_URL=https://dashboard.tripwheel.app/portal
FRONTEND_URL=https://islandtours.tripwheel.app

# Comma-separated, NO SPACES. Miss one and that app's every request fails CORS.
CORS_ORIGINS=https://islandtours.tripwheel.app,https://dashboard.tripwheel.app,https://tripwheel.app,https://www.tripwheel.app

COOKIE_DOMAIN=.tripwheel.app

# ── Secrets (step 5) ─────────────────────────────────────────
BETTER_AUTH_SECRET=<paste>
TRAVELER_SESSION_SECRET=<paste>
INTERNAL_API_SECRET=<paste>
REVALIDATE_SECRET=<paste>
ENCRYPTION_KEY=<paste — the hex one>

# ── Admin accounts (created by the seed) ─────────────────────
ADMIN_EMAIL=admin@tripwheel.app
ADMIN_PASSWORD=<paste, min 12 chars>
SYSTEM_ADMIN_EMAIL=internal-admin@tripwheel.app
SYSTEM_ADMIN_PASSWORD=<paste, min 12 chars>

# ── Email (Resend) — QUOTE the whole value ───────────────────
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
MAIL_FROM="Island Tours <noreply@tripwheel.app>"
MAIL_REPLY_TO="Island Tours <support@tripwheel.app>"

# ── Cloudinary ───────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=<your cloud>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# ── Currency ─────────────────────────────────────────────────
FX_PROVIDER=ecb
FX_USD_TO_EUR=0.92

# ── Optional: blank keeps them off ───────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TRANSLATION_PROVIDER_NAME=
TRANSLATION_API_KEY=
TRANSLATION_MODEL=
```

**Deliberately absent:** `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `NODE_ENV`, `PORT` — compose
builds those from the root `.env` and overrides anything here. Stripe keys aren't here either;
they're stored encrypted in the DB and set from Admin → Settings.

### c. Build and start

```bash
docker compose up -d --build      # first build: 10–20 min
docker compose logs -f backend
```

Healthy first boot prints:

```
[entrypoint] Applying database migrations (prisma migrate deploy)...
[entrypoint] RUN_SEED=true -> seeding database (prisma db seed)...
[entrypoint] Starting server -> node dist/src/main.js
```

### d. Turn the seed off

```bash
sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env
docker compose up -d
curl http://127.0.0.1:5050/api/v1/health
```

---

## 7. Caddy — every domain, HTTPS automatically

No certbot, nothing to schedule. Caddy obtains and renews Let's Encrypt certs itself and redirects
HTTP → HTTPS.

`sudo nano /etc/caddy/Caddyfile`:

```caddy
{
	email admin@tripwheel.app
}

api.tripwheel.app {
	encode zstd gzip

	# Optional: Swagger is served in production. Delete these 2 lines to leave it open.
	@docs path /api/docs*
	respond @docs 404

	reverse_proxy 127.0.0.1:5050
	log { output file /var/log/caddy/api.log }
}

islandtours.tripwheel.app {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
	log { output file /var/log/caddy/islandtours.log }
}

dashboard.tripwheel.app {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3001
	log { output file /var/log/caddy/dashboard.log }
}

tripwheel.app {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3002
	log { output file /var/log/caddy/tripwheel.log }
}

www.tripwheel.app {
	redir https://tripwheel.app{uri} permanent
}
```

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f          # look for "certificate obtained successfully"

curl -i https://api.tripwheel.app/api/v1/health
```

**Why Caddy needs no special tuning here.** Three things nginx would need explicit config for,
Caddy already does: it forwards `X-Forwarded-For` / `X-Forwarded-Proto` by default (rate limiting
sees real IPs), it **streams** request bodies rather than buffering (Stripe webhook signature
verification gets the raw bytes), and it has **no request body size limit** (media uploads pass
through). You don't need `proxy_set_header`, `proxy_request_buffering off` or `client_max_body_size`.

Ignore `deploy/nginx/island-api.conf` — it's from the earlier plan. Don't install nginx alongside;
both want port 80.

---

## 8. Build and run the three Next.js apps

> **The biggest Next.js gotcha.** Every `NEXT_PUBLIC_*` value is **baked into the JS at build
> time**. `.env.production` must exist and be correct *before* `pnpm build`, and changing one later
> means a full rebuild — restarting PM2 does nothing.
>
> Also **delete any `.env.local` on the server**. Next loads it in production too and it *overrides*
> `.env.production`, so a leftover dev file quietly points production at `localhost:5050`.

### a. Public site — `island-tour-development/frontend/.env.production`

```ini
NEXT_PUBLIC_BACKEND_URL=https://api.tripwheel.app
NEXT_PUBLIC_SITE_URL=https://islandtours.tripwheel.app

# Server-only. Must equal the backend's value.
INTERNAL_API_SECRET=<same as backend>

# Server-only. Accepts a comma-separated LIST so you can rotate in two deploys.
REVALIDATE_SECRET=<same as backend>

# 'true' ONLY on the real production site — this fires live conversions.
NEXT_PUBLIC_ENABLE_TRACKING=true

NEXT_PUBLIC_COOKIEBOT_CBID=
NEXT_PUBLIC_TRUSTPILOT_REVIEW_URL=

# Leave EMPTY. '1' exposes internal error detail to visitors.
NEXT_PUBLIC_ERROR_DEBUG=
```

### b. Dashboard — `tripwheel-x-islandtours-dashboard/.env.production`

```ini
NEXT_PUBLIC_BACKEND_URL=https://api.tripwheel.app
INTERNAL_API_SECRET=<same as backend>

# MUST be byte-identical to the backend's COOKIE_DOMAIN — a mismatch is a login loop.
COOKIE_DOMAIN=.tripwheel.app

REVALIDATE_TARGET_URL=https://islandtours.tripwheel.app/api/revalidate
REVALIDATE_SECRET=<same as public site>

NEXT_PUBLIC_FACING_APP_URL=https://islandtours.tripwheel.app
NEXT_PUBLIC_ADMIN_LOGIN_URL=https://tripwheel.app
```

### c. Tripwheel app — `tripwheel-app/.env.production`

```ini
NEXT_PUBLIC_SITE_URL=https://tripwheel.app
NEXT_PUBLIC_API_URL=https://api.tripwheel.app
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.tripwheel.app

# 'landing' = marketing homepage · 'login' = the site is just the login door.
NEXT_PUBLIC_HOMEPAGE=landing
```

### Build each one

```bash
cd <app dir>
rm -f .env.local
nano .env.production
pnpm install --frozen-lockfile
pnpm build
```

A build that dies with `Killed` ran out of memory: check `free -h`, build one at a time, and if
needed `NODE_OPTIONS=--max-old-space-size=2048 pnpm build`.

### d. PM2 — `/srv/tripwheel/ecosystem.config.js`

```js
module.exports = {
  apps: [
    {
      name: 'island-public',
      cwd: '/srv/tripwheel/island-tour-development/frontend',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '900M',
    },
    {
      name: 'island-dashboard',
      cwd: '/srv/tripwheel/tripwheel-x-islandtours-dashboard',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '900M',
    },
    {
      name: 'tripwheel-app',
      cwd: '/srv/tripwheel/tripwheel-app',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
    },
  ],
};
```

```bash
cd /srv/tripwheel
pm2 start ecosystem.config.js
pm2 status && pm2 logs --lines 50

pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
# ^ prints one sudo command — run it, then `pm2 save` once more
```

> **Image optimization moved onto your CPU.** No action needed — `sharp` is an optional dependency
> of Next 16 and `pnpm install` already pulled it in. But on Vercel, resizing every tour photo was
> the platform's job; here it's your VPS's, and the public site renders a lot of Cloudinary
> imagery. If CPU sits high under real traffic, see recommendation 10 — the fix is to let
> Cloudinary resize, not to buy a bigger server.

---

## 9. Smoke test

- [ ] `https://api.tripwheel.app/api/v1/health` → 200
- [ ] `https://islandtours.tripwheel.app` loads with real tours (not an empty state)
- [ ] `https://dashboard.tripwheel.app/portal` shows the operator login
- [ ] `https://tripwheel.app` loads; `www` redirects to it
- [ ] Log into the dashboard, **then reload** — staying logged in proves `COOKIE_DOMAIN` is right
- [ ] Browser console on the dashboard: zero CORS errors → `CORS_ORIGINS` is right
- [ ] Edit a tour price, save, reload the public tour page — new price within seconds proves
      `REVALIDATE_SECRET` + `REVALIDATE_TARGET_URL`
- [ ] Trigger a password reset — email arriving proves Resend + DNS
- [ ] From your laptop: `curl --max-time 5 http://YOUR_VPS_IP:5050/api/v1/health` must time out

**Two cross-repo files that must stay in sync** (neither fails to compile):
`lib/cache-tags.ts` must be byte-identical in the dashboard and public site (a drifted tag is
rejected as `unknown_tag` at runtime), and the dashboard's `lib/config/rbac.ts` must mirror the
backend's `src/config/roles.config.ts`.

---

## 10. Redeploying

**Backend**
```bash
cd /srv/tripwheel/island-tour-development
git pull && docker compose up -d --build      # migrations run automatically
docker compose logs -f backend
```

**Any Next.js app**
```bash
cd /srv/tripwheel/island-tour-development/frontend    # or the other two
git pull && pnpm install --frozen-lockfile && pnpm build
pm2 restart island-public
```

**Caddy**
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy      # reload, not restart — zero downtime
```

**Backups — set this up on day one**
```bash
mkdir -p ~/backups
cd /srv/tripwheel/island-tour-development
docker compose exec -T postgres pg_dump -U island island_tours \
  | gzip > ~/backups/island_tours_$(date +%F).sql.gz

# crontab -e — nightly 03:00
0 3 * * * cd /srv/tripwheel/island-tour-development && docker compose exec -T postgres pg_dump -U island island_tours | gzip > /home/deploy/backups/island_tours_$(date +\%F).sql.gz
```
Copy the dumps off the server — a backup that lives only on the machine it backs up is not a backup.

**Useful one-liners**
```bash
docker compose ps
docker compose logs --tail=100 backend
pm2 status
pm2 logs island-dashboard --lines 100
sudo journalctl -u caddy -n 100
df -h && free -h
```

---

## 11. Working with the database directly

Postgres runs in Docker with **no published port** — nothing on the internet can reach it. You
don't have to give that up to get a GUI.

### a. Open a loopback port (once)

`docker-compose.yml` → `postgres` service:

```yaml
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      # Loopback ONLY. Never '5432:5432' — that publishes it to the world,
      # and Docker's iptables rules bypass UFW.
      - '127.0.0.1:5432:5432'
```

```bash
docker compose up -d postgres
sudo ss -tlnp | grep 5432      # the line must start with 127.0.0.1
```

> **Never run `docker-compose.dev.yml` on the VPS.** The dev stack in the same repo publishes
> Postgres as `'5432:5432'` — bound to **all interfaces**, with default credentials
> `island`/`island`. That's deliberate for laptop development and an open database on a public
> server. Pass no `-f` flag on the VPS so compose uses `docker-compose.yml`.

### b. Tunnel it to your laptop

```bash
ssh -N -L 5433:127.0.0.1:5432 deploy@YOUR_VPS_IP
```

Port **5433** on purpose — your Mac already runs Postgres 17.4 on 5432, and reusing it would
silently connect your GUI to the wrong database.

### c. Point a GUI at it

| Field | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `5433` |
| Database | `island_tours` (underscore) |
| User | `POSTGRES_USER` from the compose `.env` |
| Password | `POSTGRES_PASSWORD` from the compose `.env` |
| SSL | disable — the tunnel already encrypts it |

- **TablePlus** — fastest on macOS, also speaks Redis, free tier is enough
- **DBeaver** — free, no limits, best if you write real SQL
- **pgAdmin 4** — the official tool, most "admin panel" of the three

### d. Prisma Studio — the schema-aware option

Shows your *model*: relations are clickable, enums are dropdowns, JSON is formatted.

```bash
# with the tunnel from (b) open, on your laptop
cd ~/devripon/tripwheel-x-islandtours/island-tour-development/backend
DATABASE_URL="postgresql://island:YOUR_PASSWORD@127.0.0.1:5433/island_tours?schema=public" \
  pnpm prisma studio        # http://localhost:5555
```

> **Studio writes are real writes and bypass every business rule.** Editing `tier_key` without
> also updating `tier_rank`, `commission_tier` and `deposit_pct` leaves a tour permanently
> mis-ranked; a confirmed booking with a null `commission_amount` is data corruption and blocks
> conversion tracking. Use Studio to **read**; make changes through the dashboard.

### e. Quick queries, no GUI

```bash
cd /srv/tripwheel/island-tour-development
docker compose exec postgres psql -U island -d island_tours
docker compose exec postgres psql -U island -d island_tours \
  -c "SELECT status, count(*) FROM bookings GROUP BY status;"
```

`\dt` lists tables, `\d bookings` describes one, `\q` quits.

### f. A browser GUI on a subdomain (convenient, riskier)

If you want `db.tripwheel.app` from any browser, run **pgweb** internally and put Caddy basic auth
in front. The trade: a database that's currently unreachable becomes one stolen password away. The
SSH tunnel is strictly safer.

```yaml
  pgweb:
    image: sosedoff/pgweb:latest
    restart: unless-stopped
    environment:
      PGWEB_DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
    ports:
      - '127.0.0.1:8081:8081'
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - island-net
```

```bash
caddy hash-password      # prompts twice, prints a $2a$... hash
```

`basic_auth` needs **Caddy 2.8+** (it was `basicauth` before). Check with `caddy version`; the apt
repo in §3 installs a current build.

```caddy
db.tripwheel.app {
	basic_auth {
		ripon $2a$14$PASTE_THE_HASH_HERE
	}
	reverse_proxy 127.0.0.1:8081
}
```

Add an `A` record for `db`, then `sudo systemctl reload caddy`.

### g. Should you use Neon instead?

|  | Postgres in Docker (this guide) | Neon |
|---|---|---|
| Cost | Included in the VPS | Free tier, then monthly |
| Query latency | Same machine, sub-millisecond | Network hop per query |
| GUI | Tunnel + client (above) | Built into their dashboard |
| Backups | The cron in §10 | Automatic, point-in-time restore |
| Setup change | None | Must edit `docker-compose.yml` |

If you switch: delete the `postgres` service **and** remove the `DATABASE_URL` line from the
backend service's `environment:` block, then put the Neon connection string in
`backend/.env.production`. That override is the catch — leave it and compose keeps pointing the app
at a container that no longer exists.

**Recommendation:** stay on Docker Postgres. This app is chatty with its database — booking flows,
ranking jobs and prerendering all issue many small queries — and same-machine latency is worth more
than a hosted SQL editor.

### Redis

The password lives in the compose `.env`, not in your shell — load it first, or `redis-cli`
authenticates with an empty string and every command returns `NOAUTH`.

```bash
cd /srv/tripwheel/island-tour-development
export $(grep '^REDIS_PASSWORD=' .env | xargs)

docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" keys 'bull:*'
```

`bull:*` keys are the background job queues (nightly ranking, email, translations). Piling up and
never draining means the worker side is stuck.

---

## 12. Recommendations

Opinions, not instructions — what I'd actually do with this stack, in the order I'd do it. Each
says why, so you can disagree with the reasoning rather than just the conclusion.

### Before you launch

**1 · Keep Postgres in Docker; reach it by SSH tunnel.**
Don't move to Neon and don't put a database GUI on a public subdomain. This app is unusually
chatty with its database — a single tour page issues many small queries, and the nightly ranking
job walks the whole catalogue — so same-machine latency is worth more than a hosted SQL editor.
The tunnel in §11b takes ten seconds to open and exposes nothing.

Revisit only if backups become the thing you keep forgetting. Neon's point-in-time restore is a
genuine advantage over a cron job you never test — but solve that by testing the cron job, not by
moving the database.

**2 · Add a healthcheck to the backend service.**
`docker-compose.yml` health-checks Postgres and Redis but not the API, so a backend that boots and
then wedges still shows `Up` and Docker never restarts it.

```yaml
    healthcheck:
      test: ['CMD-SHELL', 'node -e "fetch(\'http://127.0.0.1:5050/api/v1/health\').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 60s
```

`start_period: 60s` matters — migrations run before the server listens, and without it a slow
migration looks like a failing container.

**3 · Take the backup off the server on day one.**
The §10 cron writes dumps to the same disk as the database it's dumping — that protects you from
`DROP TABLE` and nothing else. Copy them off-box (Hostinger snapshots, S3, `rclone`). Then
**restore one** into a scratch database before launch. An untested backup is a guess. This is the
highest-value hour in this document.

**4 · Keep Swagger closed.**
The `@docs` block in §7 is written as optional — make it permanent. Swagger is served in
production by deliberate decision, which is fine on a private network and free reconnaissance on a
public one: it publishes every route, DTO field and auth header name. Run the API locally when you
need the docs.

**5 · `NEXT_PUBLIC_ENABLE_TRACKING=false` anywhere that isn't production.**
That flag exists precisely because staging also builds with `NODE_ENV=production`. Get it wrong
and test bookings land in real Google Ads and Meta conversion data — expensive to notice, worse to
unpick.

### First week

**6 · Uptime monitoring on the health endpoint.**
UptimeRobot's free tier hitting `https://api.tripwheel.app/api/v1/health` every five minutes is
enough. Add a second check on the public homepage — the API can be healthy while PM2 has the
storefront in a crash loop.

**7 · Sentry, before you need it.**
Self-hosting means no platform error dashboard. When someone reports "checkout didn't work", your
only evidence is `pm2 logs` and whatever scrolled past. Setup steps are in
`VPS-OPERATIONS-GUIDE.md` §8 — do it while things are calm.

**8 · fail2ban and unattended upgrades.**

```bash
sudo apt install -y fail2ban unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Key-only SSH already blocks brute-force; fail2ban stops the log noise and wasted CPU.

**9 · Watch disk, not just memory.**
Docker layers accumulate on every `--build`, and Hostinger VPS disks are small. A full disk takes
down Postgres in a way that reads like corruption.

```bash
df -h
docker system prune -af --filter "until=168h"
```

Not `--volumes`. Ever. That flag deletes `postgres-data`.

### When traffic grows

**10 · Push image resizing to Cloudinary before buying a bigger VPS.**
Next's image optimizer is the first thing to saturate CPU on a self-hosted storefront, and your
images already live in Cloudinary — which resizes on delivery, free, at the edge. A custom loader
emitting `.../w_800,q_auto,f_auto/...` URLs moves that work off your server entirely.

**11 · Scale vertically first, and stay single-instance while you do.**
Adding RAM and cores is a reboot. A second backend instance is a project: the rate limiter counts
in memory per process, and the BullMQ workers need explicit concurrency control before two are
safe. One well-sized server carries this workload a long way.

**12 · Split the frontends off before you split the backend.**
If one VPS stops being enough, move the three Next apps to a second box (or back to Vercel) and
leave API + Postgres + Redis together. The apps are stateless and trivially relocatable; the
database is neither. Only the Caddyfile `reverse_proxy` targets change — `CORS_ORIGINS` stays
exactly as it is, because it lists public origins, not machines.

> **If you only do three:** off-site backups you've actually restored once (3), a backend
> healthcheck (2), and uptime monitoring (6). Those turn "the site is down and I don't know why or
> for how long" into a solved problem. The rest is optimisation.

---

## 13. Env reference — what must match what

| Value | Backend | Public site | Dashboard | Tripwheel app |
|---|---|---|---|---|
| `INTERNAL_API_SECRET` | same | same | same | — |
| `REVALIDATE_SECRET` | same | same (list) | same | — |
| `COOKIE_DOMAIN` | `.tripwheel.app` | — | `.tripwheel.app` | — |
| Backend URL | — | `NEXT_PUBLIC_BACKEND_URL` | `NEXT_PUBLIC_BACKEND_URL` | `NEXT_PUBLIC_API_URL` |
| Listed in `CORS_ORIGINS` | — | required | required | required |

| Variable | Set in | Value | What breaks if wrong |
|---|---|---|---|
| `BETTER_AUTH_URL` | backend | `https://api.tripwheel.app` | Auth links in emails point nowhere |
| `ISLAND_TOURS_URL` | backend | `https://islandtours.tripwheel.app` | Traveller booking links go to the dashboard |
| `PORTAL_URL` | backend | `https://dashboard.tripwheel.app/portal` | Operator invite "set password" links 404 |
| `REVALIDATE_TARGET_URL` | dashboard | `https://islandtours.tripwheel.app/api/revalidate` | Public site serves stale prices, silently |
| `NEXT_PUBLIC_SITE_URL` | public site | `https://islandtours.tripwheel.app` | Canonical tags, sitemap, OG images point at localhost |
| `NEXT_PUBLIC_FACING_APP_URL` | dashboard | `https://islandtours.tripwheel.app` | "View public site" link is inert |
| `NEXT_PUBLIC_DASHBOARD_URL` | tripwheel app | `https://dashboard.tripwheel.app` | Admin logs in and lands nowhere |

**In the example files but not read by any code:** `NEXT_PUBLIC_OPEN_WEATHER_API_KEY` and
`NEXT_PUBLIC_PORTAL_URL`. `NEXT_PUBLIC_ADMIN_LOGIN_URL` is read **only** by the dashboard, despite
appearing in the public site's example too.

---

## 14. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Backend exits immediately, `Environment validation failed` | A required var missing, too short, or still `change-me` | The error lists every offending variable |
| `services.backend.env_file: poorly formatted environment` | The stray `the` at the top of `.env.production`, or unquoted `MAIL_FROM` | Delete the word; quote `MAIL_FROM` |
| Login succeeds then says logged out (redirect loop) | `COOKIE_DOMAIN` differs between backend and dashboard, or missing its leading dot | Make both exactly `.tripwheel.app`, rebuild the dashboard, clear cookies |
| Every dashboard request fails CORS | Origin not in `CORS_ORIGINS`, or spaces after commas | Add it, no spaces, `docker compose up -d` |
| Caddy: `could not get certificate` | DNS not resolving yet, port 80 blocked, or Cloudflare orange cloud | `dig +short <host>`, `ufw status`, grey-cloud it |
| Public site shows old prices after an edit | `REVALIDATE_SECRET` mismatch or `REVALIDATE_TARGET_URL` unset | Align secrets; check dashboard logs for a 401 from `/api/revalidate` |
| Browser API calls all 401 | Cookie not shared — an app is on a different apex | All hosts must sit under the `COOKIE_DOMAIN` apex |
| `next build` fails with 429 / timeouts | `INTERNAL_API_SECRET` mismatch, so the build is throttled as an anonymous visitor | Copy the exact backend value, rebuild |
| Build dies with `Killed` | Out of memory | Swap on, build one at a time, cap the heap |
| Bad gateway from Caddy | The app on that port isn't running | `pm2 status` / `docker compose ps` |
| No emails arriving | Resend domain unverified, or `MAIL_FROM` on an unverified domain | Finish DKIM/SPF in DNS |
| Changed a `NEXT_PUBLIC_*`, nothing happened | Compiled in at build time | `pnpm build` then `pm2 restart <app>` |

---

*Written against the repos as of 2026-08-19: NestJS 11 / Prisma 7 in Docker (Postgres 16, Redis 7),
Next.js 16.2 with Cache Components on all three frontends. Ports 5050 / 3000 / 3001 / 3002 are
pinned by the code — the cache-revalidation wiring depends on the 3000 / 3001 split.*
