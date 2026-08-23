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

> **If that fails with `Permission denied (publickey)`, it is your key, not your password.** The VPS
> sets `PasswordAuthentication no`, so a password cannot log you in even when you remember it — see
> `VPS-DEPLOYMENT-CADDY.md` §3a. What the message means is that none of the keys your client offered
> was accepted, and SSH only offers `~/.ssh/id_rsa`, `id_ecdsa` and `id_ed25519` by default. A key
> saved under any other name — `laptop-to-vps`, say — is never sent. Name it:
>
> ```bash
> ssh -N -L 5434:127.0.0.1:5433 -i ~/.ssh/laptop-to-vps deploy@YOUR_VPS_IP
> ```
>
> **A `Host` block does not rescue you here.** It matches on the alias you type, not on the address
> it resolves to. So a block like `Host vps` with the right `IdentityFile` is ignored the moment you
> connect as `deploy@YOUR_VPS_IP` in full, and you silently fall back to the defaults. Either use
> the alias — `ssh -N -L 5434:127.0.0.1:5433 vps` — or pass `-i`. Confirm what SSH will really use
> with `ssh -G deploy@YOUR_VPS_IP | grep -i identityfile`, which lists the keys it intends to offer.

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
  IdentityFile ~/.ssh/laptop-to-vps
  IdentitiesOnly yes
  LocalForward 5434 127.0.0.1:5433
  ServerAliveInterval 30
  ServerAliveCountMax 3
  ExitOnForwardFailure yes
```

`IdentityFile` is the line that matters — without it you are back to the default key names above.
`IdentitiesOnly yes` stops SSH offering every other key first, which on a machine with several of
them can exhaust the server's `MaxAuthTries` before your real key is ever reached. Having set this
up, connect **by the alias** (`ssh -N demo-db`) and not by the address, or none of it applies.

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

pgAdmin is a web application in both cases; the "desktop app" is that same web app wrapped in an
Electron shell. So "in the browser" is not a different product, only a different way of starting it
— and the app you have already installed can serve it, with nothing else installed at all.

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
greyed out, `SUPPORT_SSH_TUNNEL` is off in your pgAdmin config; it is on by default in both modes.

> **The Identity file field is where this fails, and the dialog will not tell you.** pgAdmin's file
> picker hides dotfiles, so `~/.ssh` is not browsable and the field is easy to leave empty; it does
> not expand `~` either. Type the absolute path — `/Users/devripon/.ssh/laptop-to-vps`. Left empty,
> pgAdmin falls back to password authentication, which a keys-only VPS refuses, and all you get is a
> generic failure. What lands in `~/.pgadmin/pgadmin4.log` is:
>
> ```
> ERROR pgadmin: Could not establish session to SSH gateway
> sshtunnel.BaseSSHTunnelForwarderError: Could not establish session to SSH gateway
> ```
>
> That is the SSH leg failing before Postgres is ever reached, so nothing on the *Connection* tab is
> at fault and changing the port will not help. **Read that log first.**
>
> To prove the key itself is innocent, test with pgAdmin's own bundled paramiko rather than with
> `ssh` — paramiko is what the tunnel actually runs on, and it is a different implementation with
> different defaults:
>
> ```bash
> "/Applications/pgAdmin 4.app/Contents/Frameworks/Python.framework/Versions/3.13/bin/python3.13" - <<'PY'
> import paramiko
> k = paramiko.Ed25519Key.from_private_key_file('/Users/devripon/.ssh/laptop-to-vps')
> c = paramiko.SSHClient()
> c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
> c.connect('YOUR_VPS_IP', 22, username='deploy', pkey=k, timeout=12,
>           allow_agent=False, look_for_keys=False)
> print('SSH AUTH OK')
> PY
> ```
>
> `SSH AUTH OK` here with a failure in the dialog means the form is wrong, not the key. If you cannot
> make the form behave, the manual tunnel of §4a on port 5434 costs one terminal and always works.

**In a browser — run pgAdmin on the VPS, in the compose stack.** This is the recommended browser
route, and it is recommended because it deletes the hardest part of the problem rather than working
around it.

pgAdmin running inside the stack sits on `island-net` alongside Postgres, so it reaches
`postgres:5432` container to container. There is no tunnel between pgAdmin and the database, which
means no `5433` versus `5434`, no *Identity file* field, no paramiko, and no SSH leg to debug. The
only tunnel left is one forwarding pgAdmin's own HTTP port to your laptop, and nothing is published
to the internet.

The service is **already in `docker-compose.yml`**, behind a profile:

```yaml
  pgadmin:
    image: dpage/pgadmin4:latest
    profiles: ['tools']          # a plain `docker compose up -d` ignores it
    ports:
      - '127.0.0.1:8082:80'      # loopback only, same rule as postgres
    networks:
      - island-net
```

`profiles: ['tools']` is what makes this safe to commit. The deploy workflow runs a plain
`docker compose up -d`, which skips profiled services entirely — so pgAdmin never starts itself,
never costs the demo box its ~200 MB, and never becomes one more thing running unattended.

Set a password once, in `backend-frontend/.env` on the VPS:

```ini
PGADMIN_PASSWORD=<something long>
```

Then start it only when you want it:

```bash
ssh vps
cd /opt/demo-tripwheel/backend-frontend
docker compose --profile tools up -d pgadmin
```

And from your laptop, forward pgAdmin's port rather than the database's:

```bash
ssh -N -L 8082:127.0.0.1:8082 vps
# then open http://127.0.0.1:8082
```

Log in with `PGADMIN_DEFAULT_EMAIL` and the password you set. The demo server is **already
registered** — `pgadmin-servers.json` is mounted into the container and pre-fills it, with
`"Host": "postgres"`, the compose service name. There is nothing to fill in and no port to get
wrong. You will be asked for the database password on first connect; it is `POSTGRES_PASSWORD` from
the same `.env`.

Stop it when you are done, so it is not running unattended:

```bash
docker compose --profile tools stop pgadmin
```

Three things worth understanding about this arrangement:

- **The `127.0.0.1:` prefix is the security boundary**, exactly as it is for Postgres. A bare
  `'8082:80'` puts a pgAdmin login on the public internet, and Docker's iptables rules mean UFW will
  not stop it. pgAdmin is a large attack surface; keeping it on loopback behind SSH is what makes
  running it acceptable at all.
- **It is still server mode**, so there is a login account — but the container's environment creates
  it for you. None of the `setup-db`, `DATA_DIR` or bundled-Python work that a local server-mode
  install needs applies here.
- **`pgadmin-data` persists its state.** Without that volume you would re-register the server and
  redo every preference on each restart.

> **Do not put it on a subdomain.** `db.demo.tripwheel.io` behind basic auth is possible and is
> described in §9, but it converts a database reachable only with an SSH key into one that is a
> single stolen password away, from anywhere, with no second factor. The tunnel costs one terminal.

**In a browser, on your Mac instead.** Two local routes exist and neither is worth the work now that
the compose service is there. `pip install pgadmin4` needs a Homebrew Python and a venv on macOS,
because the system Python is 3.9 from the Xcode command line tools. Running pgAdmin's *desktop* app
in server mode off its bundled Python avoids that install, but needs a `config_distro.py` overriding
`DATA_DIR` — server mode defaults it to `/var/lib/pgadmin`, which does not exist on a Mac — plus a
launcher script, a `setup.py setup-db` run and a master password. Both end up where the compose
service starts.

**A `docker run` on your Mac does not work at all.** Inside the container `127.0.0.1` is the
container, and `ssh -L` binds only `127.0.0.1` and `[::1]` on the host, so `host.docker.internal`
is refused. Making it reachable means `ssh -L 0.0.0.0:5434:…`, which publishes the demo database to
your whole LAN. Run pgAdmin on the VPS instead — that is what the section above is.

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
| `Permission denied (publickey)` | Your VPS key is not one of SSH's default names, so it was never offered | `-i ~/.ssh/<key>`, or connect by the `Host` alias. §4a |
| `Permission denied (publickey)` and you have a `Host` block with the right key | You connected by address, not by the alias — the block never matched | Use the alias. Check with `ssh -G <target> \| grep -i identityfile` |
| `Could not resolve hostname deploy:1.2.3.4` | A colon instead of `@` between user and host | `deploy@1.2.3.4` |
| Asked for a password you don't have | You don't need one — the VPS is keys-only, and the password is for `sudo` alone | Fix the key (rows above), not the password |
| `Connection refused` on 5434 | No tunnel running | Start §4a; it must stay open in its own terminal |
| `Connection refused` and the tunnel *is* open | Loopback port missing on the VPS — usually a deploy recreated the container | §1, then `ss -tlnp \| grep 5433` |
| Tunnel exits instantly with `bind: Address already in use` | Something already holds 5434, often a second tunnel | `lsof -nP -iTCP:5434 -sTCP:LISTEN` then kill it |
| Connects, but the data is wrong or the tables are empty | Wrong database — you are on local dev (5432) or production (5433) | Demo is **5434** on your Mac. See §2 |
| `no pg_hba.conf entry ... no encryption` / TLS errors | SSL enabled in the client | Set SSL to disable, or pgAdmin's mode to `prefer` |
| `password authentication failed for user "island"` | Credentials read from the repo, not from the VPS | §3 — the real values are in `backend-frontend/.env` on the server |
| `database "island-tours" does not exist` | Hyphen instead of underscore | `island_tours` |
| pgAdmin's **Use SSH tunneling** switch is greyed out | `SUPPORT_SSH_TUNNEL` off in its config | Use the manual tunnel (§4a) with port 5434 |
| `Could not establish session to SSH gateway` in `~/.pgadmin/pgadmin4.log` | pgAdmin's SSH leg failed, almost always an empty *Identity file* — the picker hides `~/.ssh` — so it fell back to password auth | Absolute path to the key, no `~`. §5b |
| `docker compose up -d pgadmin` says no such service | The profile was not named | `docker compose --profile tools up -d pgadmin`. §5b |
| pgAdmin container exits immediately | `PGADMIN_PASSWORD` unset in `backend-frontend/.env` | Set it, then start the profile again. §5b |
| `http://127.0.0.1:8082` refuses the connection | The port-forward is not open, or pgAdmin is not started | `ssh -N -L 8082:127.0.0.1:8082 vps`, and check `docker compose ps` on the VPS |
| pgAdmin runs but the server list is empty | `pgadmin-servers.json` did not mount | Confirm the bind mount path; a missing file mounts as an empty directory |
| A `docker run` of pgAdmin on your Mac cannot see the tunnel | `127.0.0.1` is the container, and `ssh -L` binds loopback only, so `host.docker.internal` is refused | Run pgAdmin on the VPS instead. §5b |
| Prisma Studio in Docker unreachable from the browser | Studio binds `127.0.0.1` inside the container and has no host flag | Run it natively on the Mac |
| Studio opens against the wrong database | `DATABASE_URL` from `backend/.env` won | Pass `--url` explicitly (§5c) |
| Tunnel dies after a while | Idle timeout or laptop sleep | Add the keepalive options in §4a |
