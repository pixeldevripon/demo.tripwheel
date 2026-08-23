# Database GUI access — TablePlus, pgAdmin 4, Prisma Studio

How to browse the demo database from your Mac, in a desktop app or in a browser. Everything here
also works for the local dev database; that is §7, and it needs no tunnel at all.

**Nothing in this document requires a change to the deployment.** The one thing it depends on — a
loopback port on the VPS — is already committed. See §1.

> The authority for deploying this stack is `DEMO-DEPLOYMENT.md`. Its §12 is the short version of
> this document; where the two disagree, the compose file wins and this document is the defect.

---

## 1. The one thing that makes any of this work

`backend-frontend/docker-compose.yml` publishes Postgres on the VPS **loopback only**:

```yaml
  postgres:
    ports:
      - '127.0.0.1:5433:5432'
```

That is the whole mechanism. The port answers only to processes already on the VPS, so the single
way in from your laptop is an SSH tunnel. There is no password-guessing surface exposed to the
internet, because there is no listener on a public interface.

Confirm it is up after any deploy that recreated the container:

```bash
ssh deploy@YOUR_VPS_IP
cd /opt/demo-tripwheel/backend-frontend
docker compose up -d postgres
sudo ss -tlnp | grep 5433        # the line MUST start with 127.0.0.1
```

If that line starts with `0.0.0.0` or `*`, stop and fix it before connecting anything. A bare port
binds every interface, and Docker writes its own iptables rules ahead of UFW, so the firewall will
not save you.

---

## 2. Ports — why each number is what it is

Four different Postgres instances can be in play on one laptop. They are deliberately on different
numbers so a misconfigured client fails to connect instead of silently editing the wrong database.

| | VPS loopback | Your tunnel's local port |
|---|---|---|
| **Demo** | `5433` | **`5434`** |
| Production | `5432` | `5433` |
| Local dev (`docker-compose.dev.yml`) | — | `5432` (published directly, no tunnel) |
| Postgres 17.4 installed on your Mac | — | `5432` |

The demo's local port is **5434** and not 5433, because 5433 is what a production tunnel already
uses. Getting this wrong is the single most common failure, and it does not error — it connects you
to a real database that is not the one you meant.

> **Rule of thumb:** on your Mac, `5434` is always the demo. Nothing else uses it.

---

## 3. Credentials

They live in `backend-frontend/.env` on the VPS, not in the repo:

```bash
ssh deploy@YOUR_VPS_IP 'grep ^POSTGRES /opt/demo-tripwheel/backend-frontend/.env'
```

| Field | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `5434` (through the tunnel — see §4) |
| Database | `island_tours` (underscore, not a hyphen) |
| User | `POSTGRES_USER`, default `island` |
| Password | `POSTGRES_PASSWORD` |
| SSL mode | **disable** — SSH already encrypts the whole channel |

Turning SSL on is the second most common failure. The Postgres container has no certificate; a
client that insists on TLS is refused, and the error names TLS rather than the real cause.

---

## 4. The tunnel

Two ways. Pick one per client — never both at once, or you will have two listeners fighting over
5434.

### a. A terminal you leave open (works for every client)

```bash
ssh -N -L 5434:127.0.0.1:5433 deploy@YOUR_VPS_IP
```

`-N` means "no remote command, just forward". It prints nothing and does not return — that is
success. Close it with Ctrl+C when you are done.

Reading it right to left: connect to the VPS, and on the far side reach `127.0.0.1:5433`, which is
the port from §1. Offer it locally as `5434`.

To keep it alive through a laptop sleep or a flaky network, add keepalives and auto-restart:

```bash
ssh -N -L 5434:127.0.0.1:5433 \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes \
  deploy@YOUR_VPS_IP
```

Or put it in `~/.ssh/config` once and then just run `ssh -N demo-db`:

```sshconfig
Host demo-db
  HostName YOUR_VPS_IP
  User deploy
  LocalForward 5434 127.0.0.1:5433
  ServerAliveInterval 30
  ServerAliveCountMax 3
  ExitOnForwardFailure yes
```

### b. Let the client build the tunnel

TablePlus and pgAdmin can both open the SSH connection themselves, which survives reconnects and
needs no spare terminal. **The port you enter changes when you do this** — see each section below.
It is the difference between "which port on my Mac" and "which port on the VPS", and mixing them up
is why a client-managed tunnel usually fails on the first attempt.

| | Host / port you enter | Resolved from |
|---|---|---|
| Manual tunnel (§4a) | `127.0.0.1:5434` | your Mac |
| Client-managed tunnel (§4b) | `127.0.0.1:5433` | the VPS |

---

## 5. The three clients

### a. TablePlus — Mac desktop

Fastest of the three on macOS, and it speaks Redis too, so one app covers both services.

**With a manual tunnel (§4a):** new connection → PostgreSQL → host `127.0.0.1`, port `5434`,
user `island`, the password from §3, database `island_tours`, SSL `DISABLED`. Test, then Connect.

**With TablePlus's own tunnel (§4b):** in the same dialog turn on **Over SSH** and fill the SSH
section with server `YOUR_VPS_IP`, port `22`, user `deploy`, and your private key. Then set the
database port to **`5433`**, because it is now resolved on the VPS.

There is no browser version of TablePlus. For a browser, use §5b or §5c.

### b. pgAdmin 4 — Mac desktop *and* browser

pgAdmin is a web application in both cases; the "desktop app" is that same web app wrapped in a
runtime. So "in the browser" is not a different product, only a different way of starting it.

**Desktop app.** Install it, then Register → Server:

- *General* tab: name it something you will recognise, e.g. `demo.tripwheel`.
- *Connection* tab: host `127.0.0.1`, port `5434`, database `island_tours`, user `island`, password
  from §3. Leave SSL mode at `prefer` — it falls back cleanly, unlike `require`.
- Leave the *SSH Tunnel* tab off, and keep the terminal from §4a open.

**Desktop app, letting pgAdmin tunnel for you.** On the *SSH Tunnel* tab: switch on **Use SSH
tunneling**, tunnel host `YOUR_VPS_IP`, tunnel port `22`, username `deploy`, Authentication →
**Identity file** → your key, and set **Keep alive** to `60` so a NAT timeout does not silently drop
it. Then go back to the *Connection* tab and change the port to **`5433`**.

pgAdmin passes your host and port to the forwarder as its `remote_bind_address`, which is evaluated
on the VPS — that is the whole reason the number changes. If the **Use SSH tunneling** switch is
greyed out, `SUPPORT_SSH_TUNNEL` is off in your pgAdmin config; it defaults on in desktop mode.

**In a browser, running pgAdmin natively.** Server mode serves the same UI over HTTP:

```bash
pip install pgadmin4
pgadmin4        # then open the URL it prints, usually http://127.0.0.1:5050
```

Connect exactly as above. Note the clash: pgAdmin's own default is `5050`, which is also the
backend's local dev port. If you run both, start pgAdmin on another port by setting
`DEFAULT_SERVER_PORT` in its config file.

**In a browser, running pgAdmin in Docker.** Works, with one trap:

```bash
docker run --rm -p 5050:80 \
  -e PGADMIN_DEFAULT_EMAIL=you@example.com \
  -e PGADMIN_DEFAULT_PASSWORD=choose-something \
  dpage/pgadmin4
```

Inside that container `127.0.0.1` is **the container**, not your Mac, so the tunnel from §4a is
invisible to it. Either use `host.docker.internal` as the host with port `5434`, or use pgAdmin's
own SSH tunnel (§4b) with your key mounted into the container.

### c. Prisma Studio — Mac, in a browser, always

Studio is the schema-aware option: it shows your *model* rather than raw tables, so relations are
clickable and enums are dropdowns. Better than either client above for eyeballing a booking together
with its tour and operator.

It is browser-only by nature — there is no desktop build. It starts a local server and opens a tab.

With the tunnel from §4a open:

```bash
cd "/Users/devripon/devripon/Final & Running Project/demo.tripwheel/backend-frontend/backend"

pnpm prisma studio --url="postgresql://island:YOUR_PASSWORD@127.0.0.1:5434/island_tours?schema=public"
# opens http://localhost:5555
```

`--url` overrides `prisma.config.ts`, whose datasource reads `DATABASE_URL`. Passing it explicitly
is what stops your local `.env` from quietly pointing Studio at the dev database instead: the config
calls `import 'dotenv/config'`, and dotenv does not overwrite variables that are already set, so an
inline `DATABASE_URL=... pnpm prisma:studio` works too — but `--url` says what it means.

Useful flags — `--port` and `--browser` are the only others that affect the network or the tab:

```bash
pnpm prisma studio --port 5556                  # if 5555 is taken
pnpm prisma studio --browser none               # start it, do not open a tab
```

**You cannot run Studio in a container and reach it from your browser.** Its HTTP server is started
with no hostname argument, so it binds `127.0.0.1` inside whatever it is running in, and no port
publish will expose it. Run it natively on the Mac. There is no `--host` or `--hostname` flag to
change this.

> **Studio writes are real writes, and they bypass every business rule in the API.** Editing
> `tier_key` without also updating `tier_rank`, `commission_tier` and `deposit_pct` leaves a tour
> permanently mis-ranked. A confirmed booking with a null `commission_amount` is data corruption and
> blocks conversion tracking. **Use Studio to read. Make changes through the dashboard.** The same
> warning applies to TablePlus and pgAdmin, which do not even have Studio's relation awareness.

---

## 6. Redis, while you are here

TablePlus speaks Redis as well. Tunnel it the same way — the demo's Redis has no published port
either, so you would need to add one first, which is not currently committed. For the occasional
look, do it on the VPS instead:

```bash
cd /opt/demo-tripwheel/backend-frontend
export $(grep '^REDIS_PASSWORD=' .env | xargs)

docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" keys 'bull:*'
```

`bull:*` keys are the background job queues. Piling up and never draining means the worker side is
stuck.

---

## 7. The local dev database — no tunnel, different credentials

`docker-compose.dev.yml` publishes Postgres straight to your Mac, so none of §4 applies:

```bash
cd "/Users/devripon/devripon/Final & Running Project/demo.tripwheel/backend-frontend"
docker compose -f docker-compose.dev.yml up -d
```

| Field | Value |
|---|---|
| Host | `127.0.0.1` |
| Port | `5432` |
| Database | `island_tours` |
| User | `island` |
| Password | `island` |
| SSL | disable |

Prisma Studio against it is just:

```bash
cd backend && pnpm prisma:studio
```

which picks up `DATABASE_URL` from `backend/.env`.

> **Never run `docker-compose.dev.yml` on the VPS.** It publishes `'5432:5432'` — bound to **all
> interfaces** — with the default credentials `island`/`island`. That is deliberate and fine on a
> laptop, and an open database on a public server. On the VPS pass no `-f` flag, so compose uses
> `docker-compose.yml`.

---

## 8. No GUI at all

Often faster than any of the above:

```bash
ssh deploy@YOUR_VPS_IP
cd /opt/demo-tripwheel/backend-frontend

docker compose exec postgres psql -U island -d island_tours

docker compose exec postgres psql -U island -d island_tours \
  -c "SELECT status, count(*) FROM bookings GROUP BY status;"
```

`\dt` lists tables, `\d bookings` describes one, `\x` toggles readable wide output, `\q` quits.

---

## 9. What is deliberately not set up

**A GUI served from the VPS on a subdomain** — `db.demo.tripwheel.io` in any browser, no tunnel. It
is possible: run pgweb or pgAdmin in the compose stack on a loopback port and put Caddy basic auth
in front of it. `DEMO-DEPLOYMENT.md` §12f sketches the pgweb version.

It is not set up because of what it trades. Today the database is unreachable without an SSH key.
With a browser GUI it becomes reachable by anyone holding one password, from anywhere, with no
second factor — and the demo database holds real email addresses typed into booking flows. The
tunnel costs one terminal and is strictly safer.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Connection refused` on 5434 | No tunnel running | Start §4a; it must stay open in its own terminal |
| `Connection refused` and the tunnel *is* open | Loopback port missing on the VPS — usually a deploy recreated the container | §1, then `ss -tlnp \| grep 5433` |
| Tunnel exits instantly with `bind: Address already in use` | Something already holds 5434, often a second tunnel | `lsof -nP -iTCP:5434 -sTCP:LISTEN` then kill it |
| Connects, but the data is wrong or the tables are empty | Wrong database — you are on local dev (5432) or production (5433) | Demo is **5434** on your Mac. See §2 |
| `no pg_hba.conf entry ... no encryption` / TLS errors | SSL enabled in the client | Set SSL to disable, or pgAdmin's mode to `prefer` |
| `password authentication failed for user "island"` | Credentials read from the repo, not from the VPS | §3 — the real values are in `backend-frontend/.env` on the server |
| `database "island-tours" does not exist` | Hyphen instead of underscore | `island_tours` |
| pgAdmin's **Use SSH tunneling** switch is greyed out | `SUPPORT_SSH_TUNNEL` off in its config | Use the manual tunnel (§4a) with port 5434 |
| pgAdmin in Docker cannot see the tunnel | `127.0.0.1` is the container | `host.docker.internal:5434`, or §4b |
| Prisma Studio in Docker unreachable from the browser | Studio binds `127.0.0.1` inside the container and has no host flag | Run it natively on the Mac |
| Studio opens against the wrong database | `DATABASE_URL` from `backend/.env` won | Pass `--url` explicitly (§5c) |
| Tunnel dies after a while | Idle timeout or laptop sleep | Add the keepalive options in §4a |
