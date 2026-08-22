# Demo deployment — this repo's actual topology

> **Read this before the two runbooks beside it.** `VPS-DEPLOYMENT-CADDY.md` and
> `VPS-SECOND-INSTANCE.md` are pulled in from the upstream three-repo workspace, and they describe a
> deployment where **all three Next.js apps run on the VPS under PM2**. That is *not* this demo.
> Everything they say about the backend, Docker, Caddy/nginx, DNS, secrets and the database still
> applies; ignore their PM2 and frontend-hosting sections and use this file instead.

---

## 1. What runs where

| Component | Directory | Hosted on | Notes |
|---|---|---|---|
| Backend API | `backend-frontend/backend` | **VPS** (Docker) | The only thing on the VPS |
| Public site | `backend-frontend/frontend` | **Vercel** | Its own Vercel project |
| Dashboard | `dashboard` | **Vercel** | Its own Vercel project. **Also carries the admin login gate** |

So on the VPS: one Docker stack (Postgres + Redis + the API) and one Caddy site. No PM2, and none of
the `3100`/`3101`/`3102` port juggling the second-instance runbook describes.

> **There is no separate admin application.** The system admin door is `/admin` inside the
> dashboard, merged in from the standalone `tripwheel-app`, which has since been deleted from the
> repo. Two apps deploy, not three - so the upstream runbooks' third Vercel project and third PM2
> entry have no counterpart here.

---

## 2. Domains

The demo lives on a different apex from production (`tripwheel.io` vs `tripwheel.app`) so the two
instances' session cookies can never reach each other. See `VPS-SECOND-INSTANCE.md` §3 for why that
matters — it is the one silent failure in this whole setup.

| Host | Serves | Points at | Record |
|---|---|---|---|
| `api.demo.tripwheel.io` | Backend API | VPS → `127.0.0.1:5150` | `A` → VPS IP |
| `app.demo.tripwheel.io` | Public site | Vercel | `CNAME` → `cname.vercel-dns.com` |
| `dashboard.demo.tripwheel.io` | Dashboard + admin gate | Vercel | `CNAME` → `cname.vercel-dns.com` |

```ini
COOKIE_DOMAIN=.demo.tripwheel.io
```

That covers all three hosts and nothing else on `tripwheel.io`. Keep `demo` as the **parent** label:
`api.demo.…`, never `demo.api.…`. The alternative forces `COOKIE_DOMAIN=.tripwheel.io`, which would
send the demo session cookie to every subdomain of the company domain.

**Mixed record types are expected here** — one `A` record to the VPS, two `CNAME`s to Vercel. Take
the exact CNAME target from each Vercel project's Domains tab; don't assume it.

---

## 3. VPS setup — backend only

Follow `VPS-DEPLOYMENT-CADDY.md` steps 2–7 with these deltas. Skip its step 8 (the PM2 apps)
entirely.

### Directory

```
/opt/demo-tripwheel/            <- git root, one repo. This is VPS_APP_DIR.
├── .github/workflows/
├── backend-frontend/           <- docker-compose.yml lives HERE, not at the git root
│   ├── backend/                <- the only thing the VPS runs
│   └── frontend/               <- built by Vercel, not here
└── dashboard/                  <- built by Vercel, not here
```

```bash
sudo mkdir -p /opt/demo-tripwheel && sudo chown deploy:deploy /opt/demo-tripwheel
git clone -b main git@github.com:pixeldevripon/demo.tripwheel.git /opt/demo-tripwheel
```

One clone, not three. The git root and the compose directory are **different folders** — that is the
main structural difference from the upstream layout, and the deploy workflow depends on it.

### Compose env — `/opt/demo-tripwheel/backend-frontend/.env`

```ini
COMPOSE_PROJECT_NAME=demo-tripwheel     # keeps the demo off production's volumes
BACKEND_PORT=127.0.0.1:5150             # production holds 5050
POSTGRES_USER=island
POSTGRES_PASSWORD=<fresh>
POSTGRES_DB=island_tours
REDIS_PASSWORD=<fresh>
BACKEND_IMAGE_TAG=latest
RUN_SEED=true                           # first boot only, then false
NODE_OPTIONS=
```

Verify the project name resolves correctly **before the first boot** — with `RUN_SEED=true`, getting
this wrong seeds over production's database:

```bash
cd /opt/demo-tripwheel/backend-frontend
docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])'
# must print: demo-tripwheel
```

### Backend app env — `backend-frontend/backend/.env.production`

Fresh secrets throughout (never copy production's — `ENCRYPTION_KEY` especially, it decrypts the
stored Stripe keys). The URL and CORS lines:

```ini
BETTER_AUTH_URL=https://api.demo.tripwheel.io
ISLAND_TOURS_URL=https://app.demo.tripwheel.io
PORTAL_URL=https://dashboard.demo.tripwheel.io/portal
FRONTEND_URL=https://app.demo.tripwheel.io

# Only the two Vercel origins — there is no third app.
CORS_ORIGINS=https://app.demo.tripwheel.io,https://dashboard.demo.tripwheel.io

COOKIE_DOMAIN=.demo.tripwheel.io
```

Demo-specific values: `NEXT_PUBLIC_ENABLE_TRACKING=false` on the Vercel side, Stripe **test** keys,
blank `META_*` and `GOOGLE_ADS_*`, a separate Cloudinary cloud, and a separate Resend key.

### Caddy — one site

```caddy
api.demo.tripwheel.io {
	encode zstd gzip
	@docs path /api/docs*
	respond @docs 404
	reverse_proxy 127.0.0.1:5150
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -i https://api.demo.tripwheel.io/api/v1/health
```

### First boot

```bash
cd /opt/demo-tripwheel/backend-frontend
docker compose up -d --build
docker compose logs -f backend
# then:
sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env && docker compose up -d
```

---

## 4. Vercel setup — two projects

Both projects point at **this same repository**, differing only in Root Directory. That setting is
what makes a monorepo work on Vercel; it cannot be set from a file in the repo.

| Setting | Public site | Dashboard |
|---|---|---|
| Root Directory | `backend-frontend/frontend` | `dashboard` |
| Framework preset | Next.js | Next.js |
| Install command | *(default)* | *(default)* |
| Production branch | `main` | `main` |
| Domain | `app.demo.tripwheel.io` | `dashboard.demo.tripwheel.io` |

**Turn on "Include source files outside of the Root Directory"** if a build fails resolving something
above its root. Both apps are self-contained today, so the default should hold.

### Skip builds that don't touch the app

Without this, every backend-only push triggers two full Next builds. Set each project's
**Ignored Build Step** to a command that exits `0` when nothing relevant changed:

```bash
# Public site project
git diff --quiet HEAD^ HEAD -- backend-frontend/frontend

# Dashboard project
git diff --quiet HEAD^ HEAD -- dashboard
```

Vercel skips the build when the command exits `0`, and builds when it exits non-zero.

### Environment variables

Set these in each project (Production scope). They are **build-time** values — changing one needs a
redeploy, not a restart.

**Public site**

```ini
NEXT_PUBLIC_BACKEND_URL=https://api.demo.tripwheel.io
NEXT_PUBLIC_SITE_URL=https://app.demo.tripwheel.io
INTERNAL_API_SECRET=<demo value, matches the backend>
REVALIDATE_SECRET=<demo value>
NEXT_PUBLIC_ENABLE_TRACKING=false
```

**Dashboard**

```ini
NEXT_PUBLIC_BACKEND_URL=https://api.demo.tripwheel.io
INTERNAL_API_SECRET=<demo value, matches the backend>
COOKIE_DOMAIN=.demo.tripwheel.io
REVALIDATE_TARGET_URL=https://app.demo.tripwheel.io/api/revalidate
REVALIDATE_SECRET=<demo value, matches the public site>
NEXT_PUBLIC_FACING_APP_URL=https://app.demo.tripwheel.io
# Admin login is served by this same app, so this must NOT point elsewhere.
# Leave it unset — the login UI falls back to /portal on this origin.
```

`INTERNAL_API_SECRET` and `REVALIDATE_SECRET` must match the backend's; both are server-only and must
never carry a `NEXT_PUBLIC_` prefix.

---

## 5. CI/CD

Workflows live at the **repository root** (`.github/workflows/`). They previously sat inside
`backend-frontend/`, where GitHub never looks — nothing had ever run.

| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push/PR on `main` touching `backend-frontend/backend/**` | backend lint · build · test |
| `deploy-backend.yml` | push on `main` touching `backend-frontend/backend/**` or its `docker-compose.yml`; also `workflow_dispatch` | SSH to the VPS, rebuild the backend image, recreate the container |
| `claude-code-review.yml` | every PR | skips cleanly unless `CLAUDE_CODE_OAUTH_TOKEN` is set |
| `claude.yml` | `@claude` mentions | on demand |

Frontend and dashboard deploys are Vercel's Git integration — deliberately not duplicated in Actions.

### Repository secrets to add

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VPS_SSH_HOST` | VPS IP or hostname |
| `VPS_SSH_USER` | `deploy` |
| `VPS_SSH_KEY` | private key whose public half is in `~deploy/.ssh/authorized_keys` |
| `VPS_SSH_PORT` | optional, defaults to `22` |
| `VPS_APP_DIR` | **`/opt/demo-tripwheel`** — the git root, *not* the compose directory |
| `CLAUDE_CODE_OAUTH_TOKEN` | optional; without it code review skips |

`VPS_APP_DIR` is the one that trips people up. The workflow runs `git reset --hard` there and then
`cd`s into `backend-frontend/` for the compose commands. Point it at the compose directory and the
git step breaks.

### The image name is deliberately demo-scoped

`backend-frontend/docker-compose.yml` builds `demo-tripwheel-backend:<sha>`, not
`island-tours-backend:<sha>`. The deploy workflow prunes old tags by reference filter, keeping the
three newest. With a shared image name that prune would keep three newest **across both instances**
and delete production's rollback tags — a demo deploy reaching into the live instance. If you rename
the image, change the filter in `deploy-backend.yml` to match.

---

## 6. Still to do

- **The admin login gate is not merged yet.** `dashboard/app/(login)/` has `portal` and `staff` but
  no `admin` route. The backend already supports the surface (`x-login-surface: admin`), and
  `components/login/login-ui.tsx` still links out via `NEXT_PUBLIC_ADMIN_LOGIN_URL`. Merging the gate
  means adding the `admin` door to this app and dropping that outward link. Code work, not
  deployment.
- **The root `CLAUDE.md` is a stale copy** of the upstream three-repo workspace doc. It describes
  three separate repos pushing to a `pixelvega` remote with a `prod` base, `tripwheel-app` as a
  separate product, and ports `3000`/`3001`/`3002`. None of that is true here: one repo, `origin` →
  `demo.tripwheel`, one `main` branch, two Vercel apps and one VPS service. Anyone — or any agent —
  following it will do the wrong thing.
