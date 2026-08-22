# Running a Second Instance on One VPS

> Production is already deployed and healthy at `/opt/island-tours`. This is how to add a **second,
> independent instance** — a demo or staging copy — at `/opt/demo-tripwheel` on the same server,
> without touching production.
>
> **Prerequisite:** the deploy itself is not repeated here. Read
> `VPS-DEPLOYMENT-CADDY.md` first — DNS, VPS prep, secrets, the Docker backend, the proxy, the PM2
> apps. Every step there applies to the second instance too. This document covers only what must
> **differ**, and the three places where "differ" is not optional.

**Worked example**

| | Production | Demo |
|---|---|---|
| Directory | `/opt/island-tours` | `/opt/demo-tripwheel` |
| Apex domain | `tripwheel.app` | `tripwheel.io` |
| Backend port | `5050` | `5150` |
| Next.js ports | `3000` / `3001` / `3002` | `3100` / `3101` / `3102` |

---

## The conflict map

Every collision between the two instances, in one place. The useful split is not by severity — it's
by **how it fails**.

### Loud conflicts — these are the harmless ones

They stop the deploy with a clear message. You cannot ship them by accident.

| What collides | How it fails | Fix |
|---|---|---|
| Backend host port `5050` | `docker compose up` → `Bind for 127.0.0.1:5050 failed: port is already allocated` | `BACKEND_PORT=127.0.0.1:5150` in the demo `.env` |
| Postgres loopback `5432` (only if you enabled it for GUI access) | same "port is already allocated" | `'127.0.0.1:5433:5432'` in the demo compose file |
| Next.js ports `3000`–`3002` | `Error: listen EADDRINUSE: address already in use :::3001` | explicit `-p 310x` in the PM2 args — **never** `pnpm start` |
| Duplicate hostname in the proxy | `caddy validate` rejects the duplicate site address; `nginx -t` reports a conflicting server name | unique hostnames per instance |
| PM2 app name | `pm2 start` refuses — the script is already launched under that name | distinct names (`demo-*`) in a separate ecosystem file |
| Docker network address pool | `could not find an available, non-overlapping IPv4 address pool` | `docker network prune`, or widen `default-address-pools` in `/etc/docker/daemon.json` |

### Silent conflicts — these are the ones that hurt

Nothing errors. Both instances start and look healthy. You find out later, from the data.

| What collides | What actually happens | Fix |
|---|---|---|
| **Compose project name** | The demo attaches to production's `postgres-data` volume. Its first `RUN_SEED=true` boot writes over live bookings | `COMPOSE_PROJECT_NAME` set explicitly in **both** `.env` files (§1) |
| **A shared Redis** | Both instances' workers consume the *same* queues. The demo can pick up a production job — sending a real confirmation email, firing a real CAPI conversion — and process it against the demo database | one Redis per instance. See the warning below |
| **The session cookie** | Same-apex hosts receive two cookies both named `better-auth.session_token`; the backend reads whichever the parser hands it first. Intermittent logouts on both sites | different apex per instance (§3) |
| **Stripe webhook endpoint** | Two instances registered on one Stripe account receive each other's events | separate endpoint URL per instance, test mode on the demo |
| **Cloudinary cloud** | Demo test uploads appear in the production media gallery | separate cloud |
| **Resend key / `MAIL_FROM` domain** | The demo sends real email that looks like it came from production | separate key and subdomain |
| **Backup filename** | The second `pg_dump` of the day overwrites the first | prefix the filename per instance (§9) |

> **The Redis one cannot be fixed by configuration.** `buildRedisConnection()` in
> `backend/src/common/utils/redis.util.ts` sets `host`, `port` and `password` — there is **no `db`
> index and no BullMQ `prefix` option**. The queue names are hardcoded constants shared by every
> instance: `platform-jobs`, `media-upload`, and the content-translation queue. So two instances
> pointed at one Redis share a keyspace *and* a queue, and each one's workers will happily consume
> the other's jobs.
>
> The compose stack gives each instance its own `redis` container, so this is safe by default. It
> only bites if you point both at a single shared Redis — most likely by reusing one
> `UPSTASH_REDIS_URL` across both `.env.production` files. Don't. Separating them properly would
> need a code change (a queue prefix or a `db` index in `buildRedisConnection`).

---

## 1. Docker isolates itself — but pin it anyway

There is no `container_name` in `docker-compose.yml`, and the volumes and network are named
relatively (`postgres-data`, `redis-data`, `island-net`). Compose prefixes all three with the
**project name**, which defaults to the directory name:

| | `/opt/island-tours` | `/opt/demo-tripwheel` |
|---|---|---|
| Volume | `island-tours_postgres-data` | `demo-tripwheel_postgres-data` |
| Network | `island-tours_island-net` | `demo-tripwheel_island-net` |
| Container | `island-tours-backend-1` | `demo-tripwheel-backend-1` |

So the two databases are already separate, and the two Redis instances too. Pin the name explicitly
anyway — one line in each `.env`:

```ini
# /opt/island-tours/.env
COMPOSE_PROJECT_NAME=island-tours

# /opt/demo-tripwheel/.env
COMPOSE_PROJECT_NAME=demo-tripwheel
```

> **Why this line earns its place.** That isolation currently rests on nothing but the directory
> being named what you expect. If the project name ever collides — a renamed directory, a stray
> `COMPOSE_PROJECT_NAME` in the environment, a copy-paste of the wrong `.env` — the demo stack
> attaches to the **production `postgres-data` volume**, and the demo's first `RUN_SEED=true` boot
> runs a seed against live bookings. It is the worst outcome available in this exercise and it fails
> silently: the containers start perfectly.

Verify before the first demo boot:

```bash
cd /opt/demo-tripwheel
docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])'
docker volume ls | grep postgres-data     # expect TWO distinct volumes
```

---

## 2. Ports

Only the backend publishes a host port (`${BACKEND_PORT:-5050}:5050`). Postgres and Redis publish
nothing, unless you added the loopback line for GUI access — then they collide too. The Next.js apps
are not Docker at all; their ports come from the PM2 args.

| Service | Production | Demo |
|---|---|---|
| Backend API | `5050` | `5150` |
| Public site | `3000` | `3100` |
| Dashboard | `3001` | `3101` |
| Tripwheel app | `3002` | `3102` |
| Postgres (loopback, if enabled) | `5432` | `5433` |

In `/opt/demo-tripwheel/.env`:

```ini
BACKEND_PORT=127.0.0.1:5150
```

Check nothing is already listening before you start:

```bash
sudo ss -tlnp | grep -E ':(5150|3100|3101|3102)\b' || echo "all four free"
```

> **`pnpm start` will bind the wrong port.** The dashboard's and tripwheel-app's `package.json`
> hardcode `next start -p 3001` and `-p 3002`. Run `pnpm start` in the demo directory and you get a
> bind conflict with production — or worse, if production happens to be down, a demo app answering on
> production's port. Always use the PM2 form that calls the Next binary with an explicit `-p`
> (§5 below). That is exactly why the ecosystem file is written that way rather than as `pnpm start`.

---

## 3. Domains and the session cookie

This is the part that bites, and it fails in a way that looks like an application bug.

**The cookie is named the same on every instance.** `cookiePrefix` is not configured in
`backend/src/auth/auth.instance.ts`, so both instances use Better Auth's default name,
`better-auth.session_token`. Only the cookie's `Domain` attribute separates them — and `Domain`
matching includes subdomains at *any* depth.

### Rule 1 — put the demo on a different apex

Production is on `tripwheel.app`; the demo is on `tripwheel.io`. Those share no domain suffix, so
neither instance's cookie can ever reach the other. Nothing further is needed.

Had the demo gone on a subdomain of the production apex instead — `demo.tripwheel.app` — the
production `.tripwheel.app` cookie *would* be sent to every demo host. The browser would send two
cookies with the same name and the backend would read whichever the parser hands it first. The
symptoms are intermittent and misleading: random logouts on both sites, the demo rejecting a valid
login, production sessions appearing to die when someone opens the demo.

If you ever do need the demo under the production apex, the fix is to make the prefix env-driven
rather than to work around it:

```ts
// backend/src/auth/auth.instance.ts
advanced: {
  cookiePrefix: process.env.AUTH_COOKIE_PREFIX ?? 'better-auth',
  crossSubDomainCookies: { /* unchanged */ },
}
```

…then set `AUTH_COOKIE_PREFIX=demo-auth` on the demo only. A separate apex avoids needing it at all.

### Rule 2 — make `demo` the parent label, not a child one

`COOKIE_DOMAIN` has to be the smallest domain covering all four demo hosts. Where you put the word
`demo` decides what that domain is:

| Layout | Smallest covering domain | Verdict |
|---|---|---|
| `api.demo.tripwheel.io`, `app.demo.…`, `dashboard.demo.…` | `.demo.tripwheel.io` | Scoped to the demo instance |
| `demo.api.tripwheel.io`, `demo.app.…`, `demo.dashboard.…` | `.tripwheel.io` | Leaks to every subdomain of the company domain |

`tripwheel.io` is the company domain. A session cookie scoped to `.tripwheel.io` is sent to every
unrelated service on it. `backend/.env.production.example` warns about precisely this: scope it to
"the smallest domain that covers both the frontend and backend hosts — **NOT** a broader shared
apex, or the session cookie leaks to every unrelated sibling subdomain."

So the demo hosts are:

| Host | Serves | Proxies to |
|---|---|---|
| `api.demo.tripwheel.io` | Backend API | `127.0.0.1:5150` |
| `app.demo.tripwheel.io` | Public site | `127.0.0.1:3100` |
| `dashboard.demo.tripwheel.io` | Dashboard (operators at `/portal`) | `127.0.0.1:3101` |
| `demo.tripwheel.io` | Tripwheel app / admin door | `127.0.0.1:3102` |

```ini
COOKIE_DOMAIN=.demo.tripwheel.io
```

A `.demo.tripwheel.io` cookie is sent to `demo.tripwheel.io` itself **and** to all three of its
subdomains — so all four hosts are covered, and nothing outside the demo is.

### DNS

Four `A` records on `tripwheel.io`, all pointing at the same VPS IP:

| Type | Name | Value |
|---|---|---|
| A | `demo` | VPS IP |
| A | `api.demo` | VPS IP |
| A | `app.demo` | VPS IP |
| A | `dashboard.demo` | VPS IP |

Explicit names rather than a wildcard, so the HTTP-01 challenge works without DNS-01 credentials.

```bash
for h in demo api.demo app.demo dashboard.demo; do
  printf "%-24s %s\n" "$h.tripwheel.io" "$(dig +short $h.tripwheel.io)"
done
```

---

## 4. Environment

### Fresh secrets — do not copy production's

Run the secret generator again and use a completely new set:

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

`ENCRYPTION_KEY` is the one that matters most. It decrypts the Stripe keys and operator OAuth tokens
held in the database, so sharing it means the lower-trust demo box can read production payment
credentials.

`INTERNAL_API_SECRET` and `REVALIDATE_SECRET` still have to match **within** the demo — its backend
and its own three frontends — exactly as in the main runbook. They must not match production's.

### `/opt/demo-tripwheel/.env`

```ini
COMPOSE_PROJECT_NAME=demo-tripwheel

POSTGRES_USER=island
POSTGRES_PASSWORD=<fresh>
POSTGRES_DB=island_tours          # same name is fine — different container, different volume

REDIS_PASSWORD=<fresh>

BACKEND_PORT=127.0.0.1:5150
BACKEND_IMAGE_TAG=latest

RUN_SEED=true                     # first boot only, then false
NODE_OPTIONS=
```

### `/opt/demo-tripwheel/island-tour-development/backend/.env.production`

Only the lines that differ from the main runbook:

```ini
BETTER_AUTH_URL=https://api.demo.tripwheel.io
ISLAND_TOURS_URL=https://app.demo.tripwheel.io
PORTAL_URL=https://dashboard.demo.tripwheel.io/portal
FRONTEND_URL=https://app.demo.tripwheel.io

CORS_ORIGINS=https://app.demo.tripwheel.io,https://dashboard.demo.tripwheel.io,https://demo.tripwheel.io

COOKIE_DOMAIN=.demo.tripwheel.io
```

Everything else — the secrets, Cloudinary, Resend, FX — follows the runbook, with the demo-specific
values from the next section.

### What the demo must not share with production

| Setting | On the demo |
|---|---|
| `NEXT_PUBLIC_ENABLE_TRACKING` | `false`. This flag exists precisely for this — demo builds are also `NODE_ENV=production`, so nothing else distinguishes them from the real thing |
| Stripe keys (DB, Admin → Settings) | test keys only |
| `META_PIXEL_ID` · `META_CAPI_TOKEN` · `GOOGLE_ADS_*` | leave blank |
| Cloudinary | a separate cloud, or demo test uploads land in your production media gallery |
| `RESEND_API_KEY` · `MAIL_FROM` | separate key, demo subdomain. Demo booking flows send **real** email to whatever address gets typed in |
| `ADMIN_EMAIL` | a demo inbox, not the production one — it receives cancellation requests and review submissions |
| `CORS_ORIGINS` | the three demo origins only, never production's |
| Seeding | `RUN_SEED=true` for the first boot, then `pnpm prisma:seed:demo` for demo content |

---

## 5. Proxy, PM2, and the frontends

### Caddy

One Caddy serves both instances. Append these blocks; certificates are automatic as usual.

```caddy
api.demo.tripwheel.io {
	encode zstd gzip
	@docs path /api/docs*
	respond @docs 404
	reverse_proxy 127.0.0.1:5150
}

app.demo.tripwheel.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3100
}

dashboard.demo.tripwheel.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3101
}

demo.tripwheel.io {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3102
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

On nginx, it's four more files in `sites-available` — identical to the production blocks with the
demo hostnames and ports — plus the four demo names appended to the `certbot --nginx -d …` list.

### Frontend env files

Each demo frontend gets its own `.env.production`, pointing at the demo API. Remember these are
**build-time** values: write them before `pnpm build`.

```ini
# island-tour-development/frontend/.env.production
NEXT_PUBLIC_BACKEND_URL=https://api.demo.tripwheel.io
NEXT_PUBLIC_SITE_URL=https://app.demo.tripwheel.io
INTERNAL_API_SECRET=<demo value>
REVALIDATE_SECRET=<demo value>
NEXT_PUBLIC_ENABLE_TRACKING=false
```

```ini
# tripwheel-x-islandtours-dashboard/.env.production
NEXT_PUBLIC_BACKEND_URL=https://api.demo.tripwheel.io
INTERNAL_API_SECRET=<demo value>
COOKIE_DOMAIN=.demo.tripwheel.io
REVALIDATE_TARGET_URL=https://app.demo.tripwheel.io/api/revalidate
REVALIDATE_SECRET=<demo value>
NEXT_PUBLIC_FACING_APP_URL=https://app.demo.tripwheel.io
NEXT_PUBLIC_ADMIN_LOGIN_URL=https://demo.tripwheel.io
```

```ini
# tripwheel-app/.env.production
NEXT_PUBLIC_SITE_URL=https://demo.tripwheel.io
NEXT_PUBLIC_API_URL=https://api.demo.tripwheel.io
NEXT_PUBLIC_DASHBOARD_URL=https://dashboard.demo.tripwheel.io
NEXT_PUBLIC_HOMEPAGE=landing
```

### PM2

A **separate** ecosystem file with distinct app names. PM2 keys apps by name, so reusing
`island-public` would replace the running production process rather than add a second one.

```js
// /opt/demo-tripwheel/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'demo-public',
      cwd: '/opt/demo-tripwheel/island-tour-development/frontend',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3100',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '900M',
    },
    {
      name: 'demo-dashboard',
      cwd: '/opt/demo-tripwheel/tripwheel-x-islandtours-dashboard',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3101',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '900M',
    },
    {
      name: 'demo-app',
      cwd: '/opt/demo-tripwheel/tripwheel-app',
      script: './node_modules/next/dist/bin/next',
      args: 'start -p 3102',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
    },
  ],
};
```

```bash
pm2 start /opt/demo-tripwheel/ecosystem.config.js
pm2 save          # persists BOTH instances' process lists
pm2 status        # expect six apps
```

---

## 6. Sizing — the real constraint

Two instances means **2 Postgres + 2 Redis + 2 NestJS APIs + 6 Next.js servers**. The main runbook
asks for 4 GB for one stack; two wants **8 GB**, and the Next builds are the spike rather than steady
state.

Three things help:

- **Build one app at a time**, never in parallel across instances. Six production builds racing for
  memory is how you get an OOM kill with no useful error.
- **Ask whether the demo needs all three frontends.** A demo that is just the public site plus the
  dashboard drops a third of the footprint and two of the four hostnames.
- **Give the demo lower `max_memory_restart` values** than production, so under pressure the demo
  restarts first and production stays up.

---

## 7. The full flow, with every conflict in place

The whole deploy, in order, annotated with what collides at each step. Production stays up
throughout — nothing here touches `/opt/island-tours`.

### Step 0 — record what production is using

Do this first. Every later decision is "not that".

```bash
# Ports in use
sudo ss -tlnp | grep -E ':(5050|3000|3001|3002|5432|6379)\b'

# Compose project, volumes, networks
cd /opt/island-tours
docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])'
docker volume ls
docker network ls

# PM2 app names
pm2 list
```

**No conflict yet** — this is the baseline you'll check against.

### Step 1 — DNS

Add the four `A` records (§3), then verify before going further. A missing record surfaces later as a
certificate failure, which reads like a proxy problem rather than a DNS one.

```bash
for h in demo api.demo app.demo dashboard.demo; do
  printf "%-26s %s\n" "$h.tripwheel.io" "$(dig +short $h.tripwheel.io)"
done
```

**Conflict:** none. Different apex from production entirely.

### Step 2 — clone

```bash
sudo mkdir -p /opt/demo-tripwheel && sudo chown deploy:deploy /opt/demo-tripwheel
cd /opt/demo-tripwheel

git clone -b prod git@github.com:pixeldevripon/island-tours.git island-tour-development
git clone -b main git@github.com:pixeldevripon/dashbaord-tripwheel-x-islandtours.git tripwheel-x-islandtours-dashboard
git clone -b main git@github.com:pixeldevripon/tripwheel.app.git tripwheel-app
```

**Conflict:** none. The existing deploy key works for both; nothing is shared but the key.

### Step 3 — the compose `.env`

```bash
cd /opt/demo-tripwheel/island-tour-development
cp .env.example .env && nano .env
```

```ini
COMPOSE_PROJECT_NAME=demo-tripwheel     # <-- the silent conflict
BACKEND_PORT=127.0.0.1:5150             # <-- the loud one
POSTGRES_PASSWORD=<fresh>
REDIS_PASSWORD=<fresh>
POSTGRES_USER=island
POSTGRES_DB=island_tours
RUN_SEED=true
NODE_OPTIONS=
```

**Conflict — two of them, and they fail in opposite ways.**

`BACKEND_PORT` left at `5050` fails *loudly* on the next step: `Bind for 127.0.0.1:5050 failed: port
is already allocated`. Annoying, harmless, obvious.

`COMPOSE_PROJECT_NAME` is the one to be careful with. It fails *silently* — see step 4.

Also add the same line to production's `.env` (`COMPOSE_PROJECT_NAME=island-tours`) so the value is
declared on both sides rather than inferred on both sides. Editing that file changes nothing about
the running production stack until its next `docker compose up`, and the name it resolves to is
identical.

### Step 4 — prove the isolation BEFORE the first boot

This is the step people skip, and the only one that is unrecoverable if you get it wrong.

```bash
cd /opt/demo-tripwheel/island-tour-development
docker compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])'
# expect: demo-tripwheel
```

**Conflict:** if that prints `island-tours`, stop. Do not run `docker compose up`. The demo would
attach to production's `postgres-data` volume, and with `RUN_SEED=true` the entrypoint would seed
over live bookings. Both containers would start perfectly and report healthy.

Fix the project name, re-run the check, and only then continue.

### Step 5 — the backend app env

```bash
cp backend/.env.production.example backend/.env.production
nano backend/.env.production
```

Set the demo URLs, `COOKIE_DOMAIN=.demo.tripwheel.io`, and a **fresh** set of secrets (§4).

**Conflict:** the session cookie, if you reuse production's apex — avoided here by
`tripwheel.io`. And `ENCRYPTION_KEY`: copying production's would let the demo decrypt production's
stored Stripe keys. Neither errors.

Also make sure you did **not** carry over a `UPSTASH_REDIS_URL` pointing at the same Redis production
uses. That is the shared-queue conflict from the map, and it is invisible until the demo starts
sending real customer email.

### Step 6 — first boot

```bash
docker compose up -d --build
docker compose logs -f backend
```

Expected, in order: `prisma migrate deploy` → `RUN_SEED=true -> seeding` → `Starting server`.

```bash
# then, immediately:
sed -i 's/^RUN_SEED=true/RUN_SEED=false/' .env
docker compose up -d

curl -s http://127.0.0.1:5150/api/v1/health
```

**Conflict:** leaving `RUN_SEED=true` re-seeds on every later redeploy. Harmless on a demo, but it
will silently reset content you were mid-way through demoing.

Confirm the two stacks are genuinely separate:

```bash
docker volume ls | grep postgres-data     # expect TWO
docker compose ps                          # expect only demo-tripwheel-* containers
cd /opt/island-tours && docker compose ps  # expect only island-tours-* containers
```

### Step 7 — the proxy

Append the four blocks from §5, then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f       # watch the certificates issue
```

**Conflict:** a hostname already claimed by production makes `caddy validate` fail on the duplicate
site address — loud, and it refuses to load rather than half-applying. `reload` (not `restart`) keeps
production serving throughout, and a bad config leaves the old one running.

```bash
curl -i https://api.demo.tripwheel.io/api/v1/health     # expect 200
```

### Step 8 — the frontends

Per app: write `.env.production` **first**, then install, then build.

```bash
cd /opt/demo-tripwheel/island-tour-development/frontend
rm -f .env.local                     # would override .env.production in production too
nano .env.production
pnpm install --frozen-lockfile
pnpm build
```

Repeat for the dashboard and tripwheel-app. **One at a time** — six concurrent Next builds on one
box is how you get an OOM kill with no useful error.

**Conflict:** none at the port level yet (nothing is listening). The real risk here is a *content*
conflict — a demo frontend built with production's `NEXT_PUBLIC_BACKEND_URL` will happily talk to
the live API, and because those values are compiled in at build time, restarting won't fix it. Only
a rebuild will.

### Step 9 — PM2

```bash
nano /opt/demo-tripwheel/ecosystem.config.js     # the file from §5
pm2 start /opt/demo-tripwheel/ecosystem.config.js
pm2 save
pm2 status                                        # expect six apps
```

**Conflict:** a duplicate app name. PM2 keys by name and refuses to launch a second app under an
existing one, so this fails loudly — but the *dangerous* version is later:
`pm2 restart island-public` typed while you were thinking about the demo. Distinct `demo-*` names are
what make that mistake impossible rather than merely unlikely.

If a port is still taken, PM2 will show the app as `errored`; `pm2 logs demo-dashboard` will have
`EADDRINUSE`.

### Step 10 — verify, including production

Run the §8 smoke test. The two checks that matter most are the ones that look redundant:

- Reload **production** and confirm you're still logged in — that's the cookie-collision check.
- Create a demo booking and confirm production's booking count is unchanged — that's the
  shared-volume check.

Everything else in the deploy fails loudly. These two don't.

---

## 8. Smoke test — what actually proves the isolation

The ordinary checks from the main runbook still apply. These four are specific to running two
instances, and each one catches a failure the others don't:

- [ ] **Log into the demo dashboard, then reload.** Staying logged in proves `COOKIE_DOMAIN` is
      right.
- [ ] **Then reload production in the same browser and confirm you are still logged in there too.**
      This is the check for cookie collision — the failure mode is one instance silently signing you
      out of the other.
- [ ] **Create a booking on the demo, then confirm it does not appear in production**, and that
      production's booking count is unchanged. This is the check for a shared Postgres volume.
- [ ] **`docker volume ls | grep postgres-data`** returns two distinct volumes, and
      `docker compose ps` in each directory lists only that instance's containers.

---

## 9. Day-to-day

Every command is directory-scoped — `docker compose` acts on whichever project you are standing in,
which is a real footgun when two stacks are this similar.

```bash
# Always cd first. `docker compose down` in the wrong directory stops production.
cd /opt/demo-tripwheel && docker compose ps
cd /opt/island-tours  && docker compose ps

# PM2 is name-scoped, so it is safer:
pm2 restart demo-public
pm2 logs demo-dashboard --lines 100

# Backups: separate files, or the second dump overwrites the first.
cd /opt/demo-tripwheel
docker compose exec -T postgres pg_dump -U island island_tours \
  | gzip > ~/backups/demo_$(date +%F).sql.gz
```

A habit worth forming: set the shell prompt or use two clearly-labelled terminal tabs. The single
most likely accident here is running a destructive command in the wrong directory.
