# VPS Deployment - Step by Step

A complete, copy-paste runbook to take Island Tours from zero to live:
**backend + Postgres + Redis on a Hostinger VPS** (Docker Compose, behind nginx +
TLS) and **frontend on Vercel**, with **GitHub Actions CI/CD**.

Follow the parts in order. Each part ends with a **Checkpoint** you must pass
before moving on. Replace every `your-domain.com` / `<...>` placeholder with your
real values.

> Architecture + file reference: see `DEPLOYMENT.md` in this folder. This doc is
> the hands-on sequence.

---

## What you need before starting

| Item | Notes |
| --- | --- |
| A domain | e.g. `your-domain.com` with access to its DNS records |
| Hostinger VPS | Ubuntu 22.04/24.04, root or sudo SSH access |
| GitHub repo | This codebase pushed to GitHub |
| Vercel account | For the frontend |
| Cloudinary, Resend API key | For media + transactional email |

Decide your two hostnames now:

- **Frontend:** `www.your-domain.com` (Vercel)
- **Backend API:** `api.your-domain.com` (VPS)

> **No domain? You can still deploy for free** - skip to
> [Part 1B](#part-1b---no-domain-free-hostnames) and use a free hostname. A bare
> IP alone is not enough: the HTTPS frontend can only call an HTTPS backend, and
> TLS needs a hostname. The free options below give you real Let's Encrypt TLS.

---

## Part 1 - DNS records (if you have a domain)

In your domain's DNS panel, create:

| Type | Name | Value |
| --- | --- | --- |
| A | `api` | `<your VPS IPv4>` |
| CNAME | `www` | `cname.vercel-dns.com` (Vercel shows the exact target) |

Leave the apex (`your-domain.com`) for Vercel too (it gives you an A/ALIAS target).

**Checkpoint:** `dig +short api.your-domain.com` returns your VPS IP.

---

## Part 1B - No domain? Free hostnames

You need ONE free hostname for the backend; the frontend gets a free
`*.vercel.app` URL automatically (HTTPS included). Everywhere the rest of this
doc says `api.your-domain.com`, use your free backend hostname instead.

### Backend hostname - pick one

**Option 1: DuckDNS** (recommended - stable, you choose the name)

1. Go to <https://www.duckdns.org>, sign in (GitHub/Google).
2. Create a subdomain, e.g. `islandtours` -> you get `islandtours.duckdns.org`.
3. In the "current ip" field, enter your **VPS IPv4** and click **update ip**.
4. Your backend hostname is `islandtours.duckdns.org`.

**Option 2: sslip.io** (zero signup, instant)

- Any `<label>.<your-ip>.sslip.io` resolves to that IP. With VPS IP `203.0.113.45`,
  your backend hostname is `api.203.0.113.45.sslip.io`. Nothing to register.

### Frontend hostname

- Vercel auto-assigns `https://<project>.vercel.app` when you deploy (Part 7).
  That is your public frontend URL - no domain needed.

### Use these values later

| Setting | Value (example) |
| --- | --- |
| Backend hostname (certbot, nginx) | `islandtours.duckdns.org` |
| `BETTER_AUTH_URL` | `https://islandtours.duckdns.org` |
| `NEXT_PUBLIC_BACKEND_URL` (Vercel) | `https://islandtours.duckdns.org` |
| `FRONTEND_URL` / `CORS_ORIGINS` | `https://<project>.vercel.app` |

> You can't know the exact `*.vercel.app` URL until after the first Vercel deploy.
> Do Part 7 first to learn it, then set `FRONTEND_URL` / `CORS_ORIGINS` to it and
> `docker compose up -d` to apply. Certbot in Part 6 works the same:
> `sudo certbot --nginx -d islandtours.duckdns.org` (port 80 must be open).

**Checkpoint:** `dig +short islandtours.duckdns.org` (or your sslip.io host)
returns your VPS IP.

---

## Part 2 - VPS initial setup + firewall

SSH in as root (or a sudo user):

```bash
ssh root@<your VPS IP>
```

Create a non-root deploy user and give it Docker rights later:

```bash
adduser deploy
usermod -aG sudo deploy
# copy your SSH key to the new user so you can log in as `deploy`
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Enable a basic firewall - only SSH + HTTP/HTTPS are public (Postgres/Redis stay
internal to Docker and are never exposed):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

From now on, work as `deploy`:

```bash
ssh deploy@<your VPS IP>
```

**Checkpoint:** `sudo ufw status` shows 22/80/443 allowed; you are logged in as `deploy`.

---

## Part 3 - Install Docker + Compose

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in (so the `docker` group applies), then verify:

```bash
docker run --rm hello-world
docker compose version
```

**Checkpoint:** both commands succeed without `sudo`.

---

## Part 4 - Clone the repo + create env files

```bash
sudo mkdir -p /opt/island-tours && sudo chown $USER:$USER /opt/island-tours
git clone https://github.com/<you>/<repo>.git /opt/island-tours
cd /opt/island-tours
```

Generate strong secrets (run these and copy each value):

```bash
echo "POSTGRES_PASSWORD: $(openssl rand -base64 24)"
echo "REDIS_PASSWORD:    $(openssl rand -base64 24)"
echo "BETTER_AUTH_SECRET: $(openssl rand -base64 32)"
echo "ENCRYPTION_KEY:     $(openssl rand -hex 32)"
```

Create the **compose infra** env file:

```bash
cp .env.example .env
nano .env
```

Set in `.env`:

```ini
POSTGRES_USER=island
POSTGRES_PASSWORD=<paste the generated db password>
POSTGRES_DB=island_tours
REDIS_PASSWORD=<paste the generated redis password>
BACKEND_PORT=5050
BACKEND_IMAGE_TAG=latest
RUN_SEED=true            # TRUE for the first boot only - seeds the admin user
```

Create the **backend app secrets** env file:

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

Set in `backend/.env.production` (do NOT add DATABASE_URL / REDIS_* / NODE_ENV /
PORT / RUN_SEED - compose injects those):

```ini
FRONTEND_URL=https://www.your-domain.com
CORS_ORIGINS=https://www.your-domain.com,https://your-domain.com
BETTER_AUTH_SECRET=<paste generated secret>
BETTER_AUTH_URL=https://api.your-domain.com
ENCRYPTION_KEY=<paste generated hex key>
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=<a strong password, 12+ chars>
RESEND_API_KEY=<your Resend API key (re_...)>
MAIL_FROM="Island Tours <noreply@your-domain.com>"
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>
FX_USD_TO_EUR=0.92
# Google OAuth + Meta CAPI are optional - fill in or remove.
```

**Checkpoint:** both files exist and are filled in. They are gitignored, so
`git status` shows them as untracked/ignored - they will never be committed.

---

## Part 5 - First boot (build, migrate, seed)

```bash
docker compose up -d --build
docker compose logs -f backend
```

Watch the log for, in order:

1. `Applying database migrations (prisma migrate deploy)...`
2. `RUN_SEED=true -> seeding database...`
3. `Nest application successfully started`

Press `Ctrl+C` to stop tailing (the containers keep running).

Now **turn the seed off** so future deploys never reseed:

```bash
sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env
docker compose up -d            # recreates backend with RUN_SEED=false
```

Confirm the API answers locally on the VPS:

```bash
curl -i http://127.0.0.1:5050/api/v1/destinations
```

**Checkpoint:** `docker compose ps` shows `postgres`, `redis`, `backend` all
`Up (healthy)`, and the curl returns a JSON response (or a normal 200/empty list).

---

## Part 6 - nginx reverse proxy + HTTPS

Install nginx and certbot:

```bash
sudo apt-get update && sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Install the API site config (tracked in the repo at `deploy/nginx/`):

```bash
sudo cp /opt/island-tours/deploy/nginx/island-api.conf /etc/nginx/sites-available/island-api
# edit the file and replace api.your-domain.com with your real subdomain
sudo nano /etc/nginx/sites-available/island-api
sudo ln -s /etc/nginx/sites-available/island-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Provision the TLS certificate (certbot edits the config to add HTTPS + redirect
and sets up auto-renewal):

```bash
sudo certbot --nginx -d api.your-domain.com
```

Verify renewal is armed:

```bash
sudo certbot renew --dry-run
```

**Checkpoint:** `curl -i https://api.your-domain.com/api/v1/destinations` returns
200 over HTTPS from your laptop.

---

## Part 7 - Frontend on Vercel

1. In Vercel: **Add New -> Project -> Import** your GitHub repo.
2. **Root Directory:** `frontend`. Framework preset auto-detects **Next.js**.
3. **Environment Variables** (Production + Preview):

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_BACKEND_URL` | `https://api.your-domain.com` |
   | `NEXT_PUBLIC_OPEN_WEATHER_API_KEY` | `<your key>` (if used) |

4. **Deploy.** Then add your domain under **Settings -> Domains**
   (`www.your-domain.com` + apex) and point DNS as Vercel instructs.
5. Vercel CI/CD is automatic: pushes to `main` deploy production, PRs get
   previews. No GitHub workflow needed for the frontend.

**Checkpoint:** `https://www.your-domain.com` loads and its network calls hit
`https://api.your-domain.com` with no CORS errors. (If you see CORS errors,
confirm the origin is in `CORS_ORIGINS` and `docker compose up -d` was rerun.)

---

## Part 8 - CI/CD (GitHub Actions auto-deploy)

The backend redeploys automatically on every push to `main` that touches
`backend/**` or `docker-compose.yml`, via `.github/workflows/deploy-backend.yml`.

### 8.1 Create a dedicated SSH deploy key

On your laptop:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/island_deploy -N ""
```

Add the **public** half to the VPS `deploy` user:

```bash
ssh-copy-id -i ~/.ssh/island_deploy.pub deploy@<your VPS IP>
# or paste ~/.ssh/island_deploy.pub into /home/deploy/.ssh/authorized_keys
```

### 8.2 Add GitHub repo secrets

In GitHub: **Settings -> Secrets and variables -> Actions -> New repository secret**:

| Secret | Value |
| --- | --- |
| `VPS_SSH_HOST` | your VPS IP or hostname |
| `VPS_SSH_USER` | `deploy` |
| `VPS_SSH_KEY` | contents of the **private** key `~/.ssh/island_deploy` |
| `VPS_SSH_PORT` | `22` (optional - omit to default) |
| `VPS_APP_DIR` | `/opt/island-tours` |

### 8.3 Test the pipeline

Push any backend change to `main` (or use **Actions -> Deploy backend (VPS) ->
Run workflow**). The workflow SSHes in, `git reset --hard` to the pushed commit,
rebuilds the `backend` image, and runs `docker compose up -d`. Migrations apply
automatically inside the entrypoint.

**Checkpoint:** the **Deploy backend (VPS)** action turns green and
`docker compose ps` on the VPS shows the backend recreated.

> The `ci.yml` workflow (lint + build + test, both apps) also runs on every PR
> and push - keep it green before merging.

---

## Part 9 - Final verification checklist

- [ ] `docker compose ps` -> all three services `Up (healthy)`
- [ ] `https://api.your-domain.com/api/v1/destinations` -> 200 over HTTPS
- [ ] `https://www.your-domain.com` loads, no console CORS errors
- [ ] Admin login works with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- [ ] `sudo certbot renew --dry-run` succeeds
- [ ] A test push to `main` triggers a green deploy
- [ ] `RUN_SEED=false` in `.env` (so redeploys never reseed)

---

## Part 10 - Day-2 operations

```bash
cd /opt/island-tours

# Logs
docker compose logs -f backend

# Manual redeploy (normally CI does this)
git pull && docker compose up -d --build

# Roll back to a previous commit
git reset --hard <previous-sha> && docker compose up -d --build

# Run a migration by hand
docker compose exec backend pnpm prisma:migrate:deploy

# Database backup (schedule this via cron + off-box storage)
docker compose exec -T postgres pg_dump -U island island_tours > backup-$(date +%F).sql

# Restore
cat backup.sql | docker compose exec -T postgres psql -U island -d island_tours

# Redis sanity
docker compose exec redis redis-cli -a "$(grep REDIS_PASSWORD .env | cut -d= -f2)" ping
```

---

## Appendix - Troubleshooting

| Symptom | Fix |
| --- | --- |
| `ERR max requests limit exceeded` (Redis) | You still have `UPSTASH_REDIS_URL` set somewhere. Remove it; the stack uses the self-hosted `redis` service (no quota). |
| Redis `NOAUTH` / `WRONGPASS` | `REDIS_PASSWORD` mismatch. Both the `redis` service and the backend read the same `.env` var - re-run `docker compose up -d` after editing. |
| `Environment validation failed: X is missing` | A required var is absent in `backend/.env.production`. Compare against `.env.production.example`. |
| Browser CORS error | Add the exact origin (scheme + host, no trailing slash) to `CORS_ORIGINS`, then `docker compose up -d`. |
| Auth links point to localhost | Set `BETTER_AUTH_URL=https://api.your-domain.com`. |
| 502 from nginx | Backend not healthy or not on `127.0.0.1:5050`. Check `docker compose ps` and `docker compose logs backend`. |
| certbot fails | DNS A record for `api` must resolve to the VPS and port 80 must be open (ufw) before running certbot. |
| Backend keeps restarting | Usually a failed migration - `docker compose logs backend`. Postgres must be healthy first (compose handles ordering). |
