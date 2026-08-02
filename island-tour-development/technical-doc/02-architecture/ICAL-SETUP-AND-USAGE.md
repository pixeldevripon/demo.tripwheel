# iCal calendar sync — setup, routing and operation

> **Audience:** whoever deploys this and whoever supports operators using it.
> **Scope:** both halves — the feeds we **publish** (export) and the calendars we **read** (import).
> **Related:** `AVAILABILITY-AND-DEPARTURES.md` §9a/§9b (design), `ICAL-PRD-GAP-ANALYSIS.md`
> (what we adopted from the PRD and what we rejected), `NOTIFICATIONS-AND-ALERTS.md`
> (who gets told what).

---

## 0. The one rule everything else follows

**`departures` is the single source of truth for inventory.** iCal is secondary.

An imported busy block never writes to `departures` and never touches capacity. It writes an
`availability_exceptions` row with `source = ICAL`, and then asks `AvailabilityService` to
re-project departures — the same materializer every other availability change goes through.

This is not a style preference. Writing imported blocks straight into `departures` would freeze
those rows against the materializer forever, and a poll-based blocker that can never be un-blocked
is worse than no integration at all. If you are changing this code and find yourself reaching for
`prisma.departure.update`, stop.

---

## 1. What the two halves actually do

| | **Export** (we publish) | **Import** (we read) |
|---|---|---|
| Direction | Island Tours → their calendar | Their channel → Island Tours |
| Answers | "what am I running?" | "when am I busy elsewhere?" |
| Effect on inventory | none, ever | stop-sell exceptions only |
| Freshness | subscriber polls us (~hourly) | we poll them (every 15 min) |

### Three export feed kinds

| Kind | Contains | Permission | Safe to hand to an OTA? |
|---|---|---|---|
| `BOOKINGS` | every confirmed booking, **with traveller names and refs** | `VIEW_BOOKINGS` | **No. Never.** |
| `DEPARTURES` | every departure in the next 90 days + how full | `MANAGE_AVAILABILITY` | Not intended for it |
| `CHANNEL` | **dates only**, one per tour, zero PII | `MANAGE_AVAILABILITY` | **Yes — this is the one** |

`BOOKINGS` and `DEPARTURES` are for the operator's own phone. `CHANNEL` is the only kind designed
to leave the business, and the UI says so in as many words.

**How `CHANNEL` decides what to publish:** a date appears only when the tour **cannot take another
booking** — every departure that day is either `CLOSED`/`SOLD_OUT`/`CANCELLED` or has
`bookedCount >= capacity`. This is correct for a whole-boat charter and a 60-seat shared tour
without needing a setting. A day with **no departures at all** is *not* published: we simply do not
run then, which is not the same as the operator being busy.

Contiguous occupied dates merge into one all-day `VEVENT` with an **exclusive** `DTEND` (5–6 Aug
publishes as `DTSTART:20260805 / DTEND:20260807`).

---

## 2. Prerequisites

1. **`ENCRYPTION_KEY`** — exactly 64 hex characters. Subscription URLs are stored AES-256-GCM
   encrypted, because an OTA calendar URL is a bearer credential for that operator's account.
   ```bash
   openssl rand -hex 32
   ```
   Wrong length now fails at **startup** with a clear message rather than at the first save.

2. **`PUBLIC_API_URL`** — must be a **public HTTPS address** for export feeds to work anywhere but
   this machine. Google and Outlook fetch from *their* servers, not the operator's browser, so a
   `localhost` URL produces a calendar that subscribes and then stays permanently empty. The
   dashboard shows an explicit warning when the configured value is private. (Apple Calendar on the
   same Mac can still read a localhost feed — useful for local testing.)

3. **Redis** — the 15-minute poll is a BullMQ repeatable job on the shared platform queue. Without
   Redis the import half never runs on its own; manual "Sync now" still works.

4. **Migrations** — `pnpm prisma:migrate:deploy`.

> **Migration trap in this repo:** `prisma migrate dev` wants a full reset here (an old migration
> was edited after being applied). Use `migrate diff` → `db execute` → `migrate resolve`. **Every
> generated diff includes `DROP TABLE "_ig_backup2"` — an untracked backup table. Strip that line
> before applying, every time.**

---

## 3. Routing

Base: `http://localhost:5050/api/v1` · Swagger: `/api/docs` · every route below needs the
`better-auth.session_token` cookie **except** the one marked public.

### Export — `/calendar-feeds`

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/calendar-feeds` | `MANAGE_AVAILABILITY` | list the operator's feeds |
| `POST` | `/calendar-feeds` | `MANAGE_AVAILABILITY` | mint a feed (`kind`, + `tourId` for `CHANNEL`) |
| `POST` | `/calendar-feeds/:id/rotate` | `MANAGE_AVAILABILITY` | new token; **old URL dies immediately** |
| `DELETE` | `/calendar-feeds/:id` | `MANAGE_AVAILABILITY` | turn the feed off |
| `GET` | `/calendar-feeds/:token/calendar.ics` | **public** | the feed itself |

The `.ics` route is `@Public()` because no calendar client can carry a session cookie. The 256-bit
random token *is* the credential. It is looked up as a database key (so there is no string-compare
timing surface), a wrong token returns a flat `404` indistinguishable from "never existed", and
rotation genuinely invalidates the old one because the token *is* the lookup key.

### Import — `/calendar-subscriptions`

Every route requires **`MANAGE_AVAILABILITY`** and is scoped to the caller's own `operator.id`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/calendar-subscriptions/validate` | dry-run a URL before saving — fetch, parse, report |
| `GET` | `/calendar-subscriptions` | list (optionally `?tourId=`) |
| `POST` | `/calendar-subscriptions` | connect a calendar |
| `GET` | `/calendar-subscriptions/:id` | one connection |
| `PATCH` | `/calendar-subscriptions/:id` | change URL, import mode, interval |
| `POST` | `/calendar-subscriptions/:id/sync` | sync now |
| `GET` | `/calendar-subscriptions/:id/sync-logs` | paginated history |
| `DELETE` | `/calendar-subscriptions/:id` | disconnect |

> `validate` is declared **before** `:id` in the controller. NestJS matches top-to-bottom, so
> reordering them makes `/validate` resolve as an id. Do not reorder.

### Dashboard

- **Export feeds:** Settings → **iCal** (`/settings?tab=calendar`)
- **Import + channel feed:** a tour → **Schedule** step → **Import from another channel**
  (`/trips/:id/edit?step=schedule`)

---

## 4. Operator walkthrough

### A. Publish your schedule to your own calendar

1. Settings → **iCal**. Two feeds already exist.
2. Copy the **Departures** link (safe to share with a guide — no traveller details).
3. Add it in Google/Apple/Outlook. The in-product **"How to add this to your calendar"** panel has
   the exact per-app steps.
4. Expect a delay. **Google refreshes external calendars on its own schedule — often 8–24 hours,
   and there is no way to force it.** Apple can be set to hourly. This is the single most common
   "it's broken" report and it is not broken.

**Never give an OTA the Bookings link** — it carries traveller names. Give them a Channel link
(below).

### B. Give a channel your busy dates

1. Tour → Schedule → **Import from another channel** → **Create the channel link**.
2. Paste it into Airbnb/Booking.com as an *imported* calendar.
3. That channel now stops selling any date this tour cannot take another booking on.

One link per tour, because a channel listing maps to one product.

### C. Read a channel's bookings into Island Tours

1. Same section → **Connect a calendar**.
2. Pick the channel, paste its **export** link (on Airbnb: "Export calendar" — *not* the address of
   the calendar page).
3. **Check link** dry-runs it: is it reachable, is it iCal, how many events, what would change.
4. Choose what happens when that channel is busy:

| Mode | Effect | Use when |
|---|---|---|
| **Warn me only** *(default)* | nothing closes; you get an alert | **multi-capacity tours** — the safe default |
| **Close the whole day** | closes every departure that day | whole-boat / single-party tours |
| **Close overlapping departures** | closes only departures inside the busy window | you run several slots a day |
| **Ignore for now** | reads and logs, changes nothing | testing a link |

> **Why `Warn me only` is the default.** iCal carries **no seat count**. A busy block says
> "occupied", never "3 of 60 seats gone". Closing automatically would let one external booking shut
> a 60-seat catamaran for the day. So by default we tell the operator and let them decide.

5. **Connect.** First sync runs immediately, then every 15 minutes.

---

## 5. Operating it

### Poll and retry

Repeatable BullMQ tick every **15 minutes** picks up every subscription whose `nextPollAt` is due.

**BullMQ gets exactly one attempt per poll.** The retry ladder lives in the database
(`failureCount` + `nextPollAt`), not in the queue, so the two mechanisms cannot multiply:

```
1 min → 5 min → 15 min → 1 h → 4 h → then ERROR, slow-retry every 6 h
```

A **permanent** error (404, non-HTTPS, blocked host) skips the ladder and goes straight to
`INVALID_URL`.

Cheap by default: we send `If-None-Match`/`If-Modified-Since` and short-circuit on a `304` or an
identical content hash, so an unchanged feed costs almost nothing.

### Failure semantics — the rule worth remembering

**Only a successful parse may remove a block.** Every failure path keeps existing blocks and moves
only the subscription's status. A transient 500 at a channel must never reopen dates the operator
has already sold there — that is the exact moment they have least visibility and most to lose.

Disconnecting **keeps the dates by default**, converted to `MANUAL` so the operator owns them.

### Alerts

Both channels, operator only — Island Tours is deliberately not an audience (see
`NOTIFICATIONS-AND-ALERTS.md`):

| Event | Bell | Email |
|---|---|---|
| Imported block hit a **booked** departure | ✅ | ✅ |
| Feed **stopped working** | ✅ | ✅ once, on the way in |
| Feed **recovered** | ✅ | ✅ |
| Routine successful sync | — | — |

Failure email is sent on the **transition** into a broken state, then silence through every retry,
then a recovery email. A feed down overnight polls ~96 times; emailing each one teaches operators to
filter us out. Email goes to the operator's `contactEmail`, falling back to the owner's login
address, and a send failure is logged but never breaks the sync.

### Reading the history

Tour → Schedule → Import → **Sync history**, or `GET /calendar-subscriptions/:id/sync-logs`.

Outcomes: `SUCCESS` · `UNCHANGED` (304/identical) · `DRY_RUN` (a non-writing mode) · `FAILED`.

Retention is two windows, because `UNCHANGED` is ~95% of rows at a 15-minute cadence:
**`UNCHANGED` 7 days, everything else 180 days.**

---

## 6. Security

**SSRF.** Operators paste arbitrary URLs and we fetch them server-side, which is textbook SSRF. The
guard (`src/common/net/`) enforces HTTPS only, rejects credentials in the URL, blocks every private
/ loopback / link-local / CGNAT range **and the cloud metadata endpoint (`169.254.169.254`)`**,
unwraps IPv4-mapped IPv6, caps redirects at 3 and re-validates **every hop**, caps the body at 5 MB
(checked on `Content-Length` *and* while streaming, because the header lies), and — the part that
matters most — **pins the TCP connection to the exact IP it validated**, closing the DNS-rebinding
window where a hostname resolves benignly during the check and to `127.0.0.1` a millisecond later.

Enforced server-side on `validate`, `create` **and** `update` — not just in the UI.

**Parse limits.** Untrusted `.ics` is capped at 5,000 events **during collection, not after**, so a
feed of many small recurring events cannot multiply into millions of blocks on the request thread.
Single rules cap at 200 instances; events longer than 730 days are dropped.

**Output escaping.** Every text field is RFC 5545-escaped, including bare carriage returns, and C0
control characters are stripped — a traveller name cannot inject properties into an operator's
calendar.

**Imported blocks are protected from hand-editing.** `PATCH`/`DELETE /availability/exceptions/:id`
refuse rows with `source = ICAL` (409). Without that guard, deleting one would write no sync-log
entry and the next poll would silently recreate it — the operator would watch a date reopen and then
re-close minutes later. Disconnect the subscription instead; that converts its blocks to `MANUAL`
and hands them back.

---

## 7. Testing locally

**The SSRF guard blocks `localhost` — that is correct, and it means you cannot point a subscription
at a local fixture server.** Options:

1. **Unit tests** — parser, mapper, reconciler, IP guard and HTTP guard all have their own suites.
2. **The e2e** — `backend/test/calendar-sync.e2e-spec.ts` drives the whole chain against a real
   Postgres and asserts real departures flip:
   ```bash
   cd backend
   NODE_OPTIONS='--experimental-vm-modules' npx jest --config ./test/jest-e2e.json \
     --testPathPatterns calendar-sync --runInBand --forceExit
   ```
   Only `FeedFetcherService` and `MailService` are stubbed. Everything below the network is real.
3. **A real feed** — an actual Airbnb/Google export URL over HTTPS works in local dev, since only
   the *outbound* address is restricted.

To watch the export side end to end, `curl` the `.ics` route directly and check that a second
request with `If-None-Match` returns `304`.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Google shows an empty calendar | `PUBLIC_API_URL` is a private address | set it to a public HTTPS origin |
| Google hasn't updated | Google's own refresh cadence (8–24 h) | wait; nothing to fix |
| "This address cannot be used" | SSRF guard rejected it | must be public **HTTPS**; not `localhost`/LAN |
| Connected but nothing closes | mode is **Warn me only** (the default) | intended — change the mode if you want closures |
| Dates closed one day too many | feed publishes an **inclusive** `DTEND` | ours is exclusive per RFC 5545; check the source feed |
| "Sync already in progress" | status stuck at `SYNCING` | the tick reaps stuck rows automatically |
| Blocks stayed after a failure | **working as designed** | only a successful parse may remove a block |
| Can't reopen a closed date | it is `source = ICAL` | change the mode, or disconnect (converts to `MANUAL`) |
| Startup: "must be exactly 64 hex characters" | bad `ENCRYPTION_KEY` | `openssl rand -hex 32` |

---

## 9. Code map

```
backend/src/
├── calendar-feeds/          EXPORT — feed CRUD, token lookup, .ics render
├── calendar-sync/           IMPORT
│   ├── calendar-sync.service.ts       CRUD + fetch→parse→map→reconcile→log + retry ladder
│   ├── calendar-poll.service.ts       15-min tick, stuck-sync recovery
│   ├── calendar-reconciler.service.ts the diff; scoped to source=ICAL + this subscription
│   ├── ical-parser.util.ts            .ics → BusyBlock[] (ical.js)
│   ├── block-mapper.util.ts           BusyBlock[] → exceptions, per import mode
│   └── calendar-sync-mail.util.ts     alert copy (pure)
└── common/
    ├── net/                 SSRF guard + the injectable fetch seam
    └── ics/ics.util.ts      shared RFC 5545 WRITER (import uses ical.js instead)

backend/prisma/
├── calendar-feeds.prisma    CalendarFeed (BOOKINGS | DEPARTURES | CHANNEL)
├── calendar-sync.prisma     CalendarSubscription · CalendarEvent · IcalSyncLog · CalendarConflict
└── availability.prisma      AvailabilityException + source/subscriptionId/externalUid/slotKey
```

Dashboard: `components/trips/trip-calendar-import.tsx` ·
`components/settings/calendar-feeds-form.tsx` · `hooks/calendar-sync/`
