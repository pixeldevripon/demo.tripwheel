# Demo deployment — complete runbook

Everything needed to stand up this demo from nothing: DNS, the VPS, the reverse proxy (**Caddy or
nginx — both documented**), the two Vercel projects, and the GitHub setup that makes deploys
automatic.

This file is self-contained. The two runbooks beside it — `VPS-DEPLOYMENT-CADDY.md` and
`VPS-SECOND-INSTANCE.md` — describe the **production** deployment, where all three Next.js apps run
on the VPS under PM2. That is not this demo. Read them for depth on Docker, backups and
observability; use this file for what to actually type.

---

## 1. What runs where

| Component | Directory | Hosted on | Notes |
|---|---|---|---|
| Backend API | `backend-frontend/backend` | **VPS** (Docker) | The only thing on the VPS |
| Public site | `backend-frontend/frontend` | **Vercel** | Its own project |
| Dashboard | `dashboard` | **Vercel** | Its own project. **Also carries the admin login gate** |

> There is no separate admin application. The system admin door is `/admin` inside the dashboard,
> merged in from the standalone `tripwheel-app`, which has since been deleted from the repo. Two apps
> deploy, not three — so the production runbooks' third Vercel project and third PM2 entry have no
> counterpart here.

On the VPS that means: **one** Docker stack (Postgres + Redis + the API) and **one** proxied
hostname. No PM2, and none of the `3100`/`3101`/`3102` port juggling the second-instance runbook
describes.

---

## 2. Caddy or nginx?

**You can use either.** Only one hostname is proxied on this box (`api.demo.tripwheel.io`), so
neither choice is much work. Step 8 has both; do **one** of them — they both want port 80, and
whichever starts second fails.

| | Caddy (§8a) | nginx (§8b) |
|---|---|---|
| Config for this deployment | ~6 lines | ~25 lines across 2 files |
| TLS | Automatic, renews itself, nothing to schedule | `certbot` issues, a systemd timer renews |
| Forwarded headers | Default | **You must set them** |
| Request buffering | Streams by default | **You must turn it off** |
| Body size limit | None | **Defaults to 1 MB** |
| If renewal breaks | Retries and logs | You find out when the cert expires |
| Familiarity | Fewer people know it | Almost everyone; more answers online |

### Why the docs lead with Caddy

Not preference — the three middle rows. Those three nginx defaults are each wrong for *this* API, and
each one fails in a way that looks like an application bug rather than a proxy bug:

- **Forwarded headers.** Without `X-Forwarded-For` the backend's rate limiter counts every visitor as
  one client, and Better Auth builds `http://` callback URLs. (The app trusts exactly one proxy hop —
  `trust proxy 1` in `backend/src/main.ts`.)
- **Request buffering.** Stripe webhook signature verification reads the *raw* bytes (the backend
  bootstraps with `rawBody: true`). Buffering rewrites the body and every webhook then fails
  validation — payments silently never confirm.
- **Body size.** nginx answers `413` above 1 MB, so media uploads fail at a threshold nothing in the
  app explains.

Caddy gets all three right with no configuration. nginx needs three directives you have to know
about — §8b has them, called out explicitly.

**Choose nginx if** you already run it on this box for something else (you cannot run both), you need
an nginx-only feature, or you simply want config you can read at a glance. It is a perfectly good
choice; it just has three sharp edges here.

---

## 3. Prerequisites

- A VPS running **Ubuntu 24.04**, with root SSH access. 2 GB RAM is enough — the demo only runs the
  API and its two datastores, because the Next.js builds happen on Vercel, not here.
- A domain you control. This runbook uses **`tripwheel.io`**.
- Accounts: **GitHub** (the repo), **Vercel**, **Cloudinary**, **Resend**, **Stripe** (test mode).

### Domains

The demo lives on a **different apex from production** (`tripwheel.io` vs `tripwheel.app`) so the two
instances' session cookies can never reach each other. Session cookies are named identically on every
instance and only `Domain` separates them — see `VPS-SECOND-INSTANCE.md` §3 for the full trap.

| Host | Serves | Points at |
|---|---|---|
| `api.demo.tripwheel.io` | Backend API | VPS → `127.0.0.1:5150` |
| `app.demo.tripwheel.io` | Public site | Vercel |
| `dashboard.demo.tripwheel.io` | Dashboard + admin gate | Vercel |

```ini
COOKIE_DOMAIN=.demo.tripwheel.io
```

Keep `demo` as the **parent** label — `api.demo.…`, never `demo.api.…`. The alternative forces
`COOKIE_DOMAIN=.tripwheel.io`, which sends the demo session cookie to every subdomain of your company
domain.

---

## 4. Step 1 — DNS

Three records. Note the **mixed types**: one `A` to the VPS, two `CNAME`s to Vercel.

| Type | Name | Value |
|---|---|---|
| `A` | `api.demo` | your VPS IP |
| `CNAME` | `app.demo` | `cname.vercel-dns.com` |
| `CNAME` | `dashboard.demo` | `cname.vercel-dns.com` |

Take the exact CNAME target from each Vercel project's **Domains** tab rather than assuming it —
Vercel has changed it before. You can add the CNAMEs now or after §9; the `A` record must exist
before §8, because no certificate can be issued for a name that doesn't resolve.

```bash
dig +short api.demo.tripwheel.io        # must print your VPS IP
```

**Cloudflare users:** keep the proxy **off** (grey cloud) for `api.demo`. The orange cloud adds a
second proxy hop and the backend trusts exactly one, so rate limiting would count Cloudflare's IP as
every visitor.

### Email DNS

Add your domain in Resend and paste its **DKIM / SPF / DMARC** records into the same zone. Until it
shows "verified", every booking confirmation, password reset and operator invite silently fails to
send.

---

## 5. Step 2 — the VPS

### a. A deploy user

```bash
# ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

Open a **second terminal** and confirm `ssh deploy@YOUR_VPS_IP` works *before* locking root out:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### b. Firewall — three ports

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Postgres, Redis and the API are never exposed: they live on Docker's private network or bind
`127.0.0.1`, and the proxy is the single front door.

### c. Swap

Small, but it stops the Docker build being OOM-killed on a 2 GB box.

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### d. Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Log out and back in as `deploy`, then check `docker ps` runs without `sudo`.

**No Node, no pnpm, no PM2 on this box.** The API ships inside its image, and the two Next.js apps
build on Vercel. That is the main way this differs from the production runbook.

---

## 6. Step 3 — clone the repo onto the VPS

The VPS needs read access to a private repo. This is the **first of two SSH key pairs** in this
runbook — see §10a for the second, and don't confuse them.

```bash
# as deploy, on the VPS
ssh-keygen -t ed25519 -C "demo-vps-readonly" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub
```

Add that **public** key to the repo as a deploy key: GitHub → the repo → **Settings → Deploy keys →
Add deploy key**. Leave "Allow write access" **unchecked** — the VPS only ever reads.

```bash
ssh -T git@github.com        # should greet you

sudo mkdir -p /opt/demo-tripwheel && sudo chown deploy:deploy /opt/demo-tripwheel
git clone -b main git@github.com:pixeldevripon/demo.tripwheel.git /opt/demo-tripwheel
```

One clone, not three. Note the layout — the git root and the compose directory are **different
folders**, which the deploy workflow depends on:

```
/opt/demo-tripwheel/            <- git root. This is VPS_APP_DIR.
├── .github/workflows/
├── backend-frontend/           <- docker-compose.yml lives HERE
│   ├── backend/                <- the only thing the VPS runs
│   └── frontend/               <- built by Vercel, not here
└── dashboard/                  <- built by Vercel, not here
```

---

## 7. Step 4 — secrets and env files

### a. Generate a fresh set

Run this once and keep the output. **Never copy production's values** — `ENCRYPTION_KEY` least of
all, since it decrypts the Stripe keys and operator tokens stored in the database.

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')"
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)"
echo "TRAVELER_SESSION_SECRET=$(openssl rand -base64 32)"
echo "INTERNAL_API_SECRET=$(openssl rand -base64 32)"
echo "REVALIDATE_SECRET=$(openssl rand -base64 32)"
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "ADMIN_PASSWORD=$(openssl rand -base64 18)"
```

`INTERNAL_API_SECRET` and `REVALIDATE_SECRET` must match **within** the demo — the API and both
Vercel projects — and must differ from production's.

### b. Compose env — `/opt/demo-tripwheel/backend-frontend/.env`

```bash
cd /opt/demo-tripwheel/backend-frontend
cp .env.example .env && nano .env
```

```ini
COMPOSE_PROJECT_NAME=demo-tripwheel     # keeps the demo off production's volumes
BACKEND_PORT=127.0.0.1:5150             # production holds 5050

POSTGRES_USER=island
POSTGRES_PASSWORD=<fresh>
POSTGRES_DB=island_tours                # same name is fine - different container, different volume
REDIS_PASSWORD=<fresh>

BACKEND_IMAGE_TAG=latest
RUN_SEED=true                           # FIRST boot only, then false
NODE_OPTIONS=
```

> **Two lines that matter more than they look.**
>
> `BACKEND_PORT` must keep the `127.0.0.1:` prefix. Compose publishes `${BACKEND_PORT:-5050}:5050`,
> so a bare port binds `0.0.0.0` — and **Docker writes its own iptables rules, so UFW will not
> protect you.** The API would be publicly reachable with no TLS.
>
> `COMPOSE_PROJECT_NAME` is what keeps this stack off production's data. Compose derives the project
> name from the directory, so the volumes are separate today only by accident of naming. Verify it
> before the first boot — with `RUN_SEED=true`, getting it wrong seeds over live bookings, and both
> containers start perfectly while it happens:
>
> ```bash
> docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])'
> # must print: demo-tripwheel
> docker volume ls | grep postgres-data      # if production is on this box, expect TWO
> ```

### c. Backend app env — `backend-frontend/backend/.env.production`

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

The demo-specific lines:

```ini
# ── URLs ─────────────────────────────────────────────────────
BETTER_AUTH_URL=https://api.demo.tripwheel.io
ISLAND_TOURS_URL=https://app.demo.tripwheel.io
PORTAL_URL=https://dashboard.demo.tripwheel.io/portal
FRONTEND_URL=https://app.demo.tripwheel.io

# Only the two Vercel origins - there is no third app.
CORS_ORIGINS=https://app.demo.tripwheel.io,https://dashboard.demo.tripwheel.io

COOKIE_DOMAIN=.demo.tripwheel.io

# ── Secrets from §7a ─────────────────────────────────────────
BETTER_AUTH_SECRET=<paste>
TRAVELER_SESSION_SECRET=<paste>
INTERNAL_API_SECRET=<paste>
REVALIDATE_SECRET=<paste>
ENCRYPTION_KEY=<paste - the hex one>

# ── Admin account (created by the seed) ──────────────────────
ADMIN_EMAIL=admin@demo.tripwheel.io
ADMIN_PASSWORD=<paste, min 12 chars>

# ── Email - QUOTE the whole value ────────────────────────────
RESEND_API_KEY=re_xxxxxxxxxxxx
MAIL_FROM="Island Tours Demo <noreply@demo.tripwheel.io>"

# ── Cloudinary - a SEPARATE cloud from production ────────────
CLOUDINARY_CLOUD_NAME=<demo cloud>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

FX_PROVIDER=ecb
```

> `backend/.env.production.example` begins with a stray word `the` before the first comment. Docker
> Compose reads that as a malformed environment line and refuses to start the container. Delete those
> four characters from your copy.

Leave `META_*` and `GOOGLE_ADS_*` blank. Stripe keys are **not** here — they live encrypted in the
database, set from Admin → Settings after launch, and must be **test** keys.

### d. First boot

```bash
cd /opt/demo-tripwheel/backend-frontend
docker compose up -d --build
docker compose logs -f backend
```

A healthy first boot prints, in order:

```
[entrypoint] Applying database migrations (prisma migrate deploy)...
[entrypoint] RUN_SEED=true -> seeding database (prisma db seed)...
[entrypoint] Starting server -> node dist/src/main.js
```

Then turn the seed off, or every redeploy re-runs it:

```bash
sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env
docker compose up -d
curl -s http://127.0.0.1:5150/api/v1/health
```

Optional demo content: `docker compose exec backend pnpm prisma:seed:demo`.

---

## 8. Step 5 — the reverse proxy

Do **§8a (Caddy)** or **§8b (nginx)**, not both.

### 8a. Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

`sudo nano /etc/caddy/Caddyfile` — replace the whole file:

```caddy
{
	email admin@demo.tripwheel.io
}

api.demo.tripwheel.io {
	encode zstd gzip

	# Recommended: keep the API schema off the public internet. Swagger is
	# served in production too. Delete these 2 lines to leave it open.
	@docs path /api/docs*
	respond @docs 404

	reverse_proxy 127.0.0.1:5150

	log {
		output file /var/log/caddy/api.log
	}
}
```

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f          # watch for "certificate obtained successfully"
```

That is the whole proxy. TLS is issued and renewed automatically; there is nothing to schedule.

### 8b. nginx

If Caddy is already installed, disable it first — both want port 80:

```bash
sudo systemctl disable --now caddy 2>/dev/null || true
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

**File 1** — `/etc/nginx/snippets/proxy-common.conf`:

```nginx
proxy_http_version 1.1;

# Forward real client info. Without these the backend's rate limiter sees
# nginx's own address as every visitor, and Better Auth builds http:// URLs.
# The app trusts exactly ONE proxy hop - see `trust proxy 1` in main.ts.
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

proxy_read_timeout    60s;
proxy_connect_timeout 10s;
```

**File 2** — `/etc/nginx/sites-available/demo-api`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.demo.tripwheel.io;

    # nginx defaults to 1 MB and answers 413 above it. Media uploads and
    # multipart forms need room.
    client_max_body_size 15m;

    # Recommended: keep the API schema off the public internet.
    location ^~ /api/docs {
        return 404;
    }

    location / {
        proxy_pass http://127.0.0.1:5150;
        include /etc/nginx/snippets/proxy-common.conf;

        # Stripe webhook signature verification reads the RAW request bytes
        # (the backend bootstraps with rawBody: true). Buffering rewrites the
        # body and every webhook then fails validation.
        proxy_request_buffering off;
    }
}
```

Enable it, drop the catch-all default, and test before reloading:

```bash
sudo ln -sf /etc/nginx/sites-available/demo-api /etc/nginx/sites-enabled/demo-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Always `nginx -t` first. A bad config on `reload` leaves the old one running; on `restart` it leaves
you with nothing.

**TLS with certbot:**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.demo.tripwheel.io \
  --redirect --agree-tos -m admin@demo.tripwheel.io --no-eff-email

systemctl list-timers | grep certbot     # renewal timer installed by the package
sudo certbot renew --dry-run
```

certbot rewrites the server block in place, adding the `listen 443 ssl` block, the certificate paths
and an HTTP→HTTPS redirect. Your file will look different afterwards — that's expected.

**Compression** (nginx gzips only `text/html` by default, leaving JSON uncompressed) —
`/etc/nginx/conf.d/gzip.conf`:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 5;
gzip_min_length 256;
gzip_types application/json application/javascript text/css text/plain text/xml;
```

> **The one ongoing difference from Caddy.** Renewal is a separate moving part that can break
> quietly, and you find out when the certificate expires. Add a certificate-expiry check to your
> uptime monitor — most services, UptimeRobot included, do it free.

### Verify either way

```bash
curl -i https://api.demo.tripwheel.io/api/v1/health      # expect 200
```

---

## 9. Step 6 — Vercel, two projects

Both projects point at **this same repository** and differ only in Root Directory. That setting is
what makes a monorepo work on Vercel; it cannot be set from a file in the repo.

For each of the two: **Add New → Project → import `pixeldevripon/demo.tripwheel`**, then:

| Setting | Public site | Dashboard |
|---|---|---|
| Project name | `demo-island-tours` | `demo-island-dashboard` |
| **Root Directory** | `backend-frontend/frontend` | `dashboard` |
| Framework preset | Next.js (auto-detected) | Next.js (auto-detected) |
| Production branch | `main` | `main` |
| Domain | `app.demo.tripwheel.io` | `dashboard.demo.tripwheel.io` |

### Environment variables

Set these under **Settings → Environment Variables**, scope **Production** (add Preview too if you
want working preview deploys). They are **build-time** values — changing one needs a redeploy, not a
restart.

**Public site**

```ini
NEXT_PUBLIC_BACKEND_URL=https://api.demo.tripwheel.io
NEXT_PUBLIC_SITE_URL=https://app.demo.tripwheel.io
INTERNAL_API_SECRET=<same as the backend>
REVALIDATE_SECRET=<same as the backend>
NEXT_PUBLIC_ENABLE_TRACKING=false
```

**Dashboard**

```ini
NEXT_PUBLIC_BACKEND_URL=https://api.demo.tripwheel.io
INTERNAL_API_SECRET=<same as the backend>
COOKIE_DOMAIN=.demo.tripwheel.io
REVALIDATE_TARGET_URL=https://app.demo.tripwheel.io/api/revalidate
REVALIDATE_SECRET=<same as the public site>
NEXT_PUBLIC_FACING_APP_URL=https://app.demo.tripwheel.io
```

`INTERNAL_API_SECRET` and `REVALIDATE_SECRET` are server-only and must **never** carry a
`NEXT_PUBLIC_` prefix. Do **not** set `NEXT_PUBLIC_ADMIN_LOGIN_URL` — it is retired; admin login is
`/admin` on the dashboard itself.

`NEXT_PUBLIC_ENABLE_TRACKING=false` matters: demo builds are also `NODE_ENV=production`, so this flag
is the only thing keeping demo test bookings out of real Google Ads, GA4 and Meta conversion data.

### Skip builds that don't touch the app

Without this, every backend-only push triggers two full Next builds. Under
**Settings → Git → Ignored Build Step**, choose *Custom* and enter:

```bash
# Public site project
git diff --quiet HEAD^ HEAD -- backend-frontend/frontend

# Dashboard project
git diff --quiet HEAD^ HEAD -- dashboard
```

Vercel **skips** the build when the command exits `0`, and builds when it exits non-zero.

### Add the domains

Per project: **Settings → Domains → Add**, enter the hostname, and Vercel shows the exact CNAME
target. Put that in your DNS (§4) and wait for it to verify.

---

## 10. Step 7 — GitHub setup

The workflows are already in the repo at `.github/workflows/` (repo root — GitHub reads them nowhere
else). They need secrets before they can do anything.

| Workflow | Fires on | Does |
|---|---|---|
| `ci.yml` | push/PR to `main` touching `backend-frontend/backend/**` | backend lint · build · test |
| `deploy-backend.yml` | push to `main` touching `backend-frontend/backend/**` or its `docker-compose.yml`; also manual | SSH to the VPS, rebuild the API, recreate the container |
| `claude-code-review.yml` | every PR | skips cleanly unless a token is set |
| `claude.yml` | `@claude` mentions | on demand |

Frontend deploys are Vercel's Git integration, deliberately not duplicated here — Vercel already runs
`next build` as a required check.

### a. The deploy SSH key — the second key pair

This is **not** the key from §6. That one lets the VPS read GitHub; this one lets GitHub Actions log
into the VPS. Two different pairs, opposite directions. Generate it **on your laptop**:

```bash
ssh-keygen -t ed25519 -C "github-actions-demo-deploy" -f ~/.ssh/demo_deploy -N ""
```

Install the **public** half on the VPS:

```bash
ssh-copy-id -i ~/.ssh/demo_deploy.pub deploy@YOUR_VPS_IP
# or: cat ~/.ssh/demo_deploy.pub | ssh deploy@YOUR_VPS_IP 'cat >> ~/.ssh/authorized_keys'
```

Confirm it works before wiring it into CI, so a failure later is unambiguous:

```bash
ssh -i ~/.ssh/demo_deploy deploy@YOUR_VPS_IP 'echo ok && cd /opt/demo-tripwheel && git status -sb'
```

### b. Repository secrets

GitHub → the repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `VPS_SSH_HOST` | your VPS IP or hostname |
| `VPS_SSH_USER` | `deploy` |
| `VPS_SSH_KEY` | the **private** key: `cat ~/.ssh/demo_deploy` — the whole file, including the `BEGIN`/`END` lines |
| `VPS_SSH_PORT` | optional; omit for `22` |
| `VPS_APP_DIR` | **`/opt/demo-tripwheel`** |
| `CLAUDE_CODE_OAUTH_TOKEN` | optional; without it code review skips instead of failing |

> **`VPS_APP_DIR` is the git root, not the compose directory.** The workflow runs `git reset --hard`
> there and then `cd`s into `backend-frontend/` itself. Point it at `backend-frontend/` and the git
> step breaks.

### c. First deploy

Trigger it by hand rather than waiting for a push: **Actions → Deploy backend (VPS) → Run workflow →
main**.

A green run ends with `docker compose ps` output. Common first-run failures:

| Log line | Cause |
|---|---|
| `Error: missing server host` | `VPS_SSH_HOST` not set |
| `Permission denied (publickey)` | `VPS_SSH_KEY` is the wrong half, truncated, or not in `authorized_keys` |
| `not a git repository` | `VPS_APP_DIR` points at `backend-frontend/` instead of the git root |
| `Bind for 127.0.0.1:5150 failed` | something already holds the port |

After that, every push to `main` that touches backend code deploys itself.

### d. Optional: protect `main`

**Settings → Branches → Add rule** for `main`: require a pull request, and require the
**`Backend (lint · build · test)`** check. Note that `claude-code-review` only reports a status when
the token is set, so don't make it required until then.

---

## 11. Step 8 — smoke test

- [ ] `https://api.demo.tripwheel.io/api/v1/health` returns `200`
- [ ] `https://app.demo.tripwheel.io` loads and shows real tours, not an empty state
- [ ] `https://dashboard.demo.tripwheel.io/portal` shows the operator login
- [ ] `https://dashboard.demo.tripwheel.io/admin` shows the **admin** door
- [ ] Sign in at `/admin` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, **then reload** — staying signed in
      is what proves `COOKIE_DOMAIN` is right
- [ ] Browser console on the dashboard: zero CORS errors → `CORS_ORIGINS` is right
- [ ] Edit a tour price, save, reload the public tour page — the new price appearing proves
      `REVALIDATE_SECRET` and `REVALIDATE_TARGET_URL`
- [ ] Trigger a password reset — the email arriving proves Resend and your DNS records
- [ ] From your laptop: `curl --max-time 5 http://YOUR_VPS_IP:5150/api/v1/health` must **time out**
- [ ] If production shares this box: sign in there and confirm you are still signed in after the
      demo login, and that a demo booking does not appear in production

---

## 12. Redeploying

**Backend** — push to `main`, or run the workflow manually. By hand on the VPS:

```bash
cd /opt/demo-tripwheel && git pull
cd backend-frontend && docker compose up -d --build
docker compose logs -f backend
```

**Frontends** — push to `main`; Vercel builds whichever app changed. Or **Deployments → Redeploy**.

**Proxy config**

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
# nginx:
sudo nginx -t && sudo systemctl reload nginx
```

**Backups — set this up on day one**

```bash
mkdir -p ~/backups
cd /opt/demo-tripwheel/backend-frontend
docker compose exec -T postgres pg_dump -U island island_tours \
  | gzip > ~/backups/demo_$(date +%F).sql.gz
```

Prefix the filename with `demo_` if production also backs up to this box, or the second dump of the
day overwrites the first. Copy them off the server, and restore one before you rely on them.

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Container exits, `Environment validation failed` | A required var missing, too short, or still `change-me` | The error names every offending variable |
| `poorly formatted environment` | The stray `the` atop `.env.production`, or an unquoted `MAIL_FROM` | Delete the word; quote the value |
| Login works, next page says signed out | `COOKIE_DOMAIN` mismatch between the API and the dashboard, or missing its leading dot | Make both `.demo.tripwheel.io`, redeploy the dashboard, clear cookies |
| Every dashboard request CORS-fails | Origin missing from `CORS_ORIGINS`, or spaces after the commas | Add it, no spaces, `docker compose up -d` |
| `could not get certificate` / `Challenge failed` | DNS not resolving yet, port 80 blocked, or Cloudflare orange cloud | `dig +short`, `ufw status`, grey-cloud it |
| Public site shows stale prices | `REVALIDATE_SECRET` mismatch or `REVALIDATE_TARGET_URL` unset | Align them; check for a `401` from `/api/revalidate` |
| Stripe webhooks all fail signature verification | nginx only: `proxy_request_buffering off` missing | §8b, file 2 |
| Uploads fail at ~1 MB | nginx only: `client_max_body_size` left at default | §8b, file 2 |
| Rate limiting throttles everyone at once | nginx only: `X-Forwarded-For` not set | §8b, file 1 |
| `502 Bad Gateway` | The API container isn't running | `docker compose ps`, then its logs |
| Changed a `NEXT_PUBLIC_*` on Vercel, nothing happened | Baked in at build time | Redeploy, not restart |
| Vercel build can't find files | Root Directory wrong | §9 (Root Directory) |

---

## 14. Still to do

- **`ONBOARDING.md` is stale.** Its product tour is good; its repo and deployment sections still
  describe the three-repo production workspace.
