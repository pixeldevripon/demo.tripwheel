# Availability & Departures — Architecture Reference

> **Canonical source:** master §E.9 (`island-tours-platform-master.html` v1.9; deep source `island-tours-availability-dev-spec.md`).
> **Purpose:** Define the three-table availability model — `availability_schedules`, `availability_exceptions`, `departures` — that **replaces** the simple `TourSchedule` model. The platform is the single source of truth for what is bookable, always current regardless of operator API status.

> **Status:** **Built.** The three-table model (`availability_schedules`, `availability_exceptions`, `departures`), the materializer, and the nightly rolling job are implemented in `backend/src/availability/` + `backend/src/workers/nightly-jobs.service.ts`; the legacy `TourSchedule` is superseded. Horizon behavior (90-day create-time default, 364-day nightly rolling window, 30-day bookability gate) is documented in [§3.1](#31-materialization-horizons-as-built). The §10 table below is the original gap analysis, kept for history.
>
> **Siblings:** [`DATA-MODEL.md`](./DATA-MODEL.md) (E.9 field tables in the consolidated model) · [`TRACKING-AND-ANALYTICS.md`](./TRACKING-AND-ANALYTICS.md) (booking flow) · [`SLUG-REGISTRY.md`](./SLUG-REGISTRY.md).

---

## 1. Principles

1. **The platform is the single source of truth.** Availability is always current regardless of operator API status. API adapters come later, are **not** a prerequisite, and upsert into this same model.
2. **Capacity lives per departure** — never on the tour, never on the weekly pattern. The `departures` table is the materialized truth.
3. **Single-day tours only** (v1, LD25). Multi-day itineraries are out of scope.
4. **All times are tour-local.** Every "(local time)" computation uses `destination.timezone` (IANA), e.g. `America/Curacao`.
5. **All party bands count toward capacity** — adults, children, and infants included (widget brief §3.3). A unit-priced private charter takes the whole departure in one booking.

---

## 2. The three tables

The model separates **intent** (a recurring weekly pattern + per-date deviations) from **truth** (materialized departures). Schedules and exceptions are inputs; a nightly job projects them into concrete `departures`, which is the only table the read path and the booking path touch.

```
availability_schedules   (weekly pattern, the recurring intent)
        +
availability_exceptions  (per-date deviations: close / add / set capacity)
        │
        ▼  nightly materialization (12 rolling months)
   departures             (the single truth: one row per tour × date × start_time)
        │
        ▼
  read contract (month map) · atomic capacity claim at booking · bookability check
```

### 2.1 `availability_schedules` — the weekly pattern

One row per tour, weekday, and start time. Defines when a tour *normally* runs.

| Field | Type | Notes |
|---|---|---|
| `id`, `tour_id` | uuid, FK | |
| `weekday` | smallint 0–6 | **Monday = 0** |
| `start_time` | time | Must exist in `tour.start_times[]` — the tour defines the slot set; the schedule switches them on per weekday |
| `capacity_override` | int nullable | `null` = tour default capacity (the `tour.max_party_size` ceiling per departure) |
| `valid_from` | date | Seasonal patterns |
| `valid_until` | date nullable | `null` = open-ended |
| `status` | enum | `active` / `paused` |
| timestamps | | |

### 2.2 `availability_exceptions` — per-date deviations

Overrides the weekly pattern for a specific date (and optionally a specific start time).

| Field | Type | Notes |
|---|---|---|
| `id`, `tour_id` | uuid, FK | |
| `date` | date | |
| `start_time` | time nullable | `null` = the whole date |
| `type` | enum | `close_date` / `close_slot` / `add_slot` / `set_capacity` |
| `capacity` | int nullable | For `set_capacity` and `add_slot` |
| `note`, `created_by` | text, FK | Operator or admin |
| timestamps | | |

- **`close_date` / `close_slot`** are the **stop-sell** actions — the one-tap daily workflow for non-API operators ("Close today", "Close this departure"). See [§7](#7-stop-sell-one-tap-workflow).
- **Blackout ranges** are bulk-inserted `close_date` rows (one per date in the range).
- **`add_slot`** introduces a departure that the weekly pattern does not produce (e.g. an extra sunset run). **`set_capacity`** raises or lowers capacity for a single date/slot.

### 2.3 `departures` — the materialized truth

One row per concrete instance. **`UNIQUE (tour_id, date, start_time)`.** This is the only table consumed by the read contract and written by the booking path.

| Field | Type | Notes |
|---|---|---|
| `id`, `tour_id` | uuid, FK | |
| `date`, `start_time` | date, time | `UNIQUE (tour_id, date, start_time)` |
| `capacity` | int | Resolved at materialization: exception, else schedule `capacity_override`, else tour default |
| `booked_count` | int default 0 | All party bands count, infants included; atomic claim at booking creation |
| `status` | enum | `open` / `closed` / `sold_out` / `cancelled` |
| `sold_out_at` | timestamptz nullable | Stamped once per fill on the transition to `sold_out`; feeds `recent_sellouts` for the §3.7 demand trigger (count per tour over the past 60 days) |
| `source` | enum | `schedule` / `exception` / `api` |
| `external_ref` | varchar nullable | The operator system's id, API-managed tours only |
| `manually_edited` | boolean default false | Protects the row from re-materialization |
| timestamps | | |

**Indexes:**
- `(tour_id, date)` — the month map read contract and the 30-day bookability check.
- `(tour_id, status, date)` — next-available lookups (`first_available_date`, alternatives).

---

## 3. Nightly materialization

A nightly job projects schedules + exceptions into `departures` for a **rolling 12-month window**.

For each tour, for each date in the window:

1. Resolve the active `availability_schedules` rows for that weekday whose `valid_from`/`valid_until` cover the date and whose `status = active`.
2. For each resulting `(date, start_time)`, resolve capacity in priority order: **exception → schedule `capacity_override` → tour default** (`max_party_size`). The last link is **NOT NULL** (`20260729190000_max_party_size_required`, default 10), so capacity **always** resolves - the old "no default and no override, so the slot is skipped and the tour silently never lists" branch cannot occur, and neither the schedule form nor the readiness checklist asks about it any more.
3. Apply exceptions: `add_slot` adds a departure; `close_date`/`close_slot` set `status = closed`; `set_capacity` overrides capacity.
4. Upsert the `departures` row keyed by `(tour_id, date, start_time)`, stamping `source = schedule` or `source = exception`.

**The job never touches a departure that has any of:**

- `booked_count > 0` (existing bookings),
- `manually_edited = true`,
- `source = api`.

This protects real-world state from being clobbered by a re-projection. A sync **never silently reopens a manual closure**.

**Edge rule:** lowering `capacity` below `booked_count` is **admin-only**, surfaces a warning, and **never auto-cancels** existing bookings. Restores (a cancellation freeing a seat, or a capacity raise) reopen the departure (`status → open`), but `sold_out_at` history is preserved for the demand signal.

### 3.1 Materialization horizons (as built)

`materializeTour(tourId, from?, to?)` (`backend/src/availability/availability-materializer.service.ts`) is driven by two callers with **different windows**. Three day-numbers are in play and must not be conflated:

| Caller | Window | Effect |
|---|---|---|
| On schedule create/update (`availability.service.ts`, `to` omitted) | today .. today + **90** days (`DEFAULT_HORIZON_DAYS`) | Immediate availability for the next 90 days |
| Nightly cron 3 AM (`nightly-jobs.service.ts` -> `materializeAllLive()`) | today .. today + **364** days | Rolling 12 months for every LIVE + active tour |

- `MAX_HORIZON_DAYS = 365` is a hard cap - any window wider than this throws.
- `BOOKABLE_HORIZON_DAYS = 30` is **unrelated** to materialization: it is the bookability/ranking gate ([§6](#6-bookability)), not a generation horizon. (30 = ranking gate, 90 = create-time default, 364 = nightly rolling horizon.)

**Rolling model.** `from` defaults to today, so each nightly run slides the window forward one day; the new far edge (today + 364) gets a departure whenever a schedule matches that weekday. Past departures (date < today) fall outside the window and are **never touched or deleted** - they persist as history. An open-ended schedule (no `valid_until`) therefore produces departures **indefinitely**, always about 12 months ahead. Generation stops extending only when `valid_until` is passed, the schedule is paused, the tour is no longer LIVE/active, or the nightly job does not run.

**Sharp edges to know:**

1. **Create-time 90 vs nightly 364 mismatch.** A brand-new schedule shows only 90 days of availability until the next 3 AM run, then jumps to 12 months. To get 12 months immediately on create, pass `to = today + 364` instead of relying on the default.
2. **The 12-month horizon depends on the nightly cron.** Nothing else extends past 90 days. If the nightly job is skipped or fails for a tour (per-tour errors are caught and logged, then it continues), that tour's far edge stops advancing and it drifts back toward the 90-day floor. This is a single point of dependence worth monitoring.

---

## 4. Read contract

The tour-detail availability widget and the calendar consume a **month map** derived from `departures`:

- **Per-date state** for each date in the requested month (`open` / `closed` / `sold_out` / no departure).
- **`remaining`** (capacity − booked_count) is **exposed only when under 5** — the "Only N left" party-selector message. Above 5, remaining is not surfaced (ethical CRO: no manufactured scarcity).
- **`cutoff_passed`** — computed **at read time** from `tour.booking_cutoff_minutes` against the departure's local datetime. A date past its cutoff renders **"Closed"** in the cell (master §6.1). Cutoff is never materialized; it is always evaluated live.
- **`first_available_date`** — the earliest date with an `open`, non-cutoff departure, used for **calendar auto-advance** (the widget opens on the first bookable month/date).

The read path is pure projection over `departures` + a live cutoff comparison. It performs no writes.

---

## 5. Atomic capacity claim at booking

Capacity is claimed on the `departures` row **atomically at booking creation**. The claim is a conditional update guarded by capacity:

```sql
UPDATE departures
   SET booked_count = booked_count + :party_size,
       status = CASE WHEN booked_count + :party_size >= capacity THEN 'sold_out' ELSE status END,
       sold_out_at = CASE WHEN booked_count + :party_size >= capacity AND sold_out_at IS NULL
                          THEN now() ELSE sold_out_at END
 WHERE id = :departure_id
   AND status = 'open'
   AND booked_count + :party_size <= capacity;
```

- A **lost race** (the conditional update affects 0 rows because the seats were taken first) returns the widget to **Step 1 with the chosen date kept**, so the customer can pick another slot without re-entering the date.
- `sold_out_at` is stamped **once per fill** on the `open → sold_out` transition.
- All party bands (adults + children + infants) sum into `party_size`.

---

## 6. Bookability

A tour is **bookable** when there **EXISTS an open departure within the next 30 days** (master §7.2). Concretely:

```sql
EXISTS (
  SELECT 1 FROM departures d
   WHERE d.tour_id = :tour_id
     AND d.status = 'open'
     AND d.date BETWEEN current_date AND current_date + INTERVAL '30 days'
)
```

This is the bookability filter input used by the [ranking/eligibility engine](./DATA-MODEL.md#e3-tours) (along with `status = active` and `is_bookable = true`). A tour with no open departure in 30 days is excluded from ranked listings even if otherwise eligible.

---

## 7. Stop-sell one-tap workflow

The daily core action for **non-API operators**. The portal exposes a one-tap **"Close today"** (and "Close this departure") that inserts an `availability_exceptions` row:

- **"Close today"** → `type = close_date`, `start_time = null`, `date = today` → on materialization (and immediately, via the same write path) every departure that day moves to `status = closed`.
- **"Close this departure"** → `type = close_slot` with `start_time` set → only that slot closes.
- **Bulk blackouts** → a range of `close_date` rows.

Stop-sell is the authoritative operator signal: it takes effect immediately on `departures` and is protected from re-materialization. **Portal stop-sell always wins** over any API sync (see [§8](#8-api-adapter-upsert-rules)).

The portal also surfaces an `availability_confirmed_at` **freshness nudge** for non-API operators (a prompt to confirm the calendar is current), plus a weekly schedule editor, an exceptions calendar, and a full audit trail.

---

## 8. All-sold-out recovery

When a tour has **no open departure in the next 30 days** (the all-sold-out dead end), the widget does not present a blank calendar. It recovers with:

- A locked headline: **"These trips still have departures this week"** (product decision 2026-07-29;
  was "These trips still have room this week" — the promise is now explicitly about a *departure*,
  which is what the rows below it actually prove).
- **2–3 same-category tours** that have an open departure **within 7 days** (alternatives).
- A **silent** GA4 `availability_dead_end` event for monitoring.

**`notify-me` is v2** (conflict log 77). The v1 dead end recovers through alternatives only — there is no `availability_notifications` table at launch.

### 8.1 How it is built (shipped 2026-07-29)

| Concern | Where |
|---|---|
| Detection (no open day in 30 days) | `frontend/lib/stores/booking-store.ts` → `availabilityDeadEnd` (+ `DEAD_END_HORIZON_DAYS`) |
| Alternatives query | `backend` `GET /tours/:id/alternatives` → `ToursService.findDeadEndAlternatives` |
| "Still has room within 7 days" | `AvailabilityService.nextBookableDateByTour(tourIds, from, to)` |
| Recovery UI | `frontend/components/frontend/tour/tour-booking-card/availability-dead-end.tsx` |
| Locked copy (7 locales) | dictionary key `tour.booking.deadEndTitle` (+ `deadEndSubtitle` / `deadEndNext` / `deadEndNoAlternatives`) |
| Silent GA4 event | `frontend/lib/tracking/availability-dead-end.ts` |

Three details the spec implies but does not spell out:

1. **Detection must distinguish "sold out" from "the fetch failed."** The widget's calendar
   read fails OPEN — an errored fetch writes an empty day map so a network blip never blanks a
   working calendar. An empty map is byte-identical to a genuinely sold-out tour, so the store
   carries a `calendarError` flag and the dead end fires only on a *successful* empty load.
2. **"Same-category" is a preference, not a hard filter.** The backend walks three widening
   rings inside the same destination — primary category → the tour's other categories →
   destination-wide — and stops as soon as it has 3. A strict same-category filter would leave
   the block empty exactly when a small category sells out together, which is the common case.
   Which ring a card came from is not exposed.
3. **The whole selector stack is replaced, not just the calendar.** With no departure in 30
   days the time chips, party steppers and Continue button are dead controls; leaving them
   mounted is what makes a blank calendar read as broken.

When the destination has nothing bookable that week the endpoint returns `[]` (200, never 404)
and the widget shows the headline plus `deadEndNoAlternatives` — the dead-end event still fires,
with `alternative_count: 0`, which is the case worth monitoring.

---

## 9. API-adapter upsert rules

Operator-system adapters (later phase) upsert into `departures` with `source = api` and the operator system's id in `external_ref`:

1. **Idempotent upsert** keyed by `(tour_id, date, start_time)` (or `external_ref` where supplied).
2. **Portal stop-sell wins.** A sync **never silently reopens a manual closure** — a `close_date`/`close_slot` exception (and any `manually_edited` row) is authoritative over inbound API state.
3. `source = api` rows are **never touched** by the nightly schedule materialization (they are owned by the adapter, not the weekly pattern).

API adapters are not required for launch; the platform runs fully on schedules + exceptions + the nightly job.

---

## 9a. Calendar export (iCal / RFC 5545) — BUILT 2026-07-29

> Delivers the export half of `APPLICATION-FEATURES-AND-TASKS.md` **Phase 8 "iCal
> (secondary)"** and honours its non-negotiable **(5)**: *"export a feed for operators
> and optionally import external blocked dates, but availability decisions are made on
> our inventory."* The `departures` table remains the single source of truth —
> **not iCal, not the operator's external calendar** (non-negotiable 1).

Operators subscribe a tokenised URL in Google / Apple / Outlook Calendar and see their
schedule beside everything else. **Export only.** Nothing in this feature writes
availability — a subscription is projected *from* the platform, never *into* it.

### Shape

| Piece | Where |
|---|---|
| `calendar_feeds` table (`CalendarFeedKind` = `bookings` \| `departures`) | `backend/prisma/calendar-feeds.prisma` |
| Module (management + public render) | `backend/src/calendar-feeds/` |
| Shared RFC 5545 writer | `backend/src/common/ics/ics.util.ts` |
| Operator UI ("Calendar sync", Settings) | dashboard `components/settings/calendar-feeds-form.tsx` |

Routes: `GET/POST /calendar-feeds`, `POST /calendar-feeds/:id/rotate`,
`DELETE /calendar-feeds/:id` (all `MANAGE_AVAILABILITY`), plus the subscribable
`GET /calendar-feeds/:token/calendar.ics` (`@Public()`).

### The decisions worth not re-litigating

1. **The token is the whole authentication.** Calendar clients cannot carry a session
   cookie. 32 random bytes, rotatable and revocable; a revoked row is **kept** so its
   token can never be minted for a different operator. Unknown, malformed and revoked
   tokens all answer a flat `404` so the response is not an oracle.
2. **Two kinds, two permission bars.** `DEPARTURES` costs `MANAGE_AVAILABILITY`;
   `BOOKINGS` additionally costs `VIEW_BOOKINGS`, because minting that URL hands
   traveller names to any link-holder. The route requires the lower bar and the
   service enforces the higher one per kind.
3. **Deliberately narrow payload.** The bookings feed carries the traveller's name,
   party size and our reference — and **not** their email, phone or pickup address.
   A leaked subscribe URL should cost an operator their schedule, not their customers'
   contact details. (Same reasoning as the traveller `.ics`, which omits the pickup
   address.)
4. **Cancellations are published, not dropped.** A cancelled booking or departure is
   emitted as `STATUS:CANCELLED`. A subscriber that has already seen an event keeps it
   forever if it merely stops appearing, so the operator would go on seeing a tour that
   is not happening.
5. **`DTSTAMP` is pinned to the data's mtime, not "now".** Otherwise every poll renders
   a different body, every ETag differs, and no client ever gets a `304`. The route
   supports `If-None-Match` and this is what makes it work.
6. **Different horizons per kind, for size.** Bookings run `-30d … +364d` (sparse, a
   few KB). Departures are the cross product of tour × date × start time — a real
   operator's year measured **6,039 events / 2.1 MB**, past what clients subscribe to
   gracefully — so departures run `-30d … +90d` (measured 1,850 events / 657 KB), which
   is also exactly the materializer's `DEFAULT_HORIZON_DAYS`.
7. **Local wall-clock is converted to a real UTC instant** via `localWallClockToUtc`
   and the tour's / booking's timezone snapshot. Departures store wall-clock; a
   calendar needs the absolute moment.

### Subscribing (the operator-facing steps)

These also ship in-product as a collapsible guide under the feed URL
(`components/settings/calendar-feed-instructions.tsx`) — that component is the copy
of record; keep the two in step. **Menu paths verified against each vendor's own
documentation on 2026-07-29** and re-check there before editing, never from memory.

| App | Steps |
|---|---|
| **Google Calendar** (computer only — not the mobile app) | Left sidebar → **+** next to *Other calendars* → **From URL** → paste → **Add calendar** |
| **Apple Calendar** (Mac) | **File → New Calendar Subscription** → paste → **Subscribe** → set **Auto-refresh** → **OK** |
| **Apple Calendar** (iPhone/iPad) | Settings → **Apps → Calendar** (older iOS: Calendar directly) → **Calendar Accounts → Add Account → Other → Add Subscribed Calendar** → paste into *Server* |
| **Outlook** (outlook.com / M365 web) | Calendar → **Add calendar** → **Subscribe from web** → paste → **Import** |

Refresh behaviour differs per vendor and **we do not control it**. We publish an
`REFRESH-INTERVAL` / `X-PUBLISHED-TTL` hint of `PT1H`, but it is only a hint: Apple is
the only one that exposes the interval to the user, Google re-reads on its own
schedule, and Microsoft's own docs say Outlook can take **more than 24 hours**. The
dashboard copy therefore promises no interval — an unkeepable promise here converts
directly into "the calendar is broken" support load.

### Not built: inbound iCal (the other half of Phase 8)

Importing an external calendar (Airbnb / Booking.com / a personal Google calendar) to
**block** dates is still open, along with the `ical_sync_logs` table the Phase 1 data
model lists for it. When it is built:

- It belongs in `availability_exceptions` (`close_date` / `close_slot` carrying an
  `ical` provenance + the external UID), **not** in `departures`. `source = api` rows
  are `isFullyManaged` and permanently frozen against the materializer (§9 rule 3),
  which is the wrong semantics for a poll-based blocker. Routing through exceptions
  also satisfies "never mutating capacity directly" and reuses §7's stop-sell path,
  including its handling of already-booked departures.
- **All-day `DTEND` is exclusive** (`0601 → 0605` means the 1st through the **4th**).
  This is the single most common iCal integration bug.
- `RRULE` will appear in Google feeds. Use a parser (`ical.js` / `node-ical` + `rrule`)
  — writing iCal is easy, reading it is not; `src/common/ics/ics.util.ts` is a writer
  and must not grow into a parser.
- An operator-supplied URL fetched by our server is textbook **SSRF**: https-only,
  reject loopback/private/link-local/metadata ranges, re-validate on every redirect,
  timeout and size-cap.
- State the caveat to operators up front, as Phase 0 requires ("document iCal's
  limitations — not real-time, no atomic capacity"): iCal is **polled, not pushed**, so
  a sale on another channel can be resold here during the lag. The atomic claim (§5)
  cannot see a channel it learns about hours late. Real-time belongs to OCTO push.

---

## 10. Current code state

> **Update (2026-07-15):** the three-table model + materializer + nightly rolling job described above are now **built** (`backend/prisma/availability.prisma`, `backend/src/availability/`, `backend/src/workers/nightly-jobs.service.ts`). The gap table below reflects the **original** analysis when only `TourSchedule` existed; treat the "Action: Build" rows as done except where noted elsewhere (e.g. quality-score/tier-eligibility TODOs in the nightly job, and API adapters which remain a later phase).

The original schema had **only** a basic `TourSchedule` model (`backend/prisma/trips.prisma`), which this three-table model **supersedes**:

```prisma
model TourSchedule {
  id             String         @id @default(uuid())
  tripId         String
  startDate      DateTime       @db.Date
  endDate        DateTime?      @db.Date   // multi-day — not in v1 scope
  startTime      String                    // 'HH:MM' string
  totalSpots     Int
  availableSpots Int
  status         ScheduleStatus @default(AVAILABLE)
  // ...
}
```

Gaps vs. the target model:

| Target concept | Current `TourSchedule` | Action |
|---|---|---|
| Weekly recurring pattern (`availability_schedules`) | Absent — only date-range rows | Build |
| Per-date deviations / stop-sell (`availability_exceptions`) | Absent | Build |
| Materialized per-departure truth (`departures`, `UNIQUE (tour_id,date,start_time)`) | Absent — capacity tracked as `availableSpots` on the range row | Build |
| Atomic per-departure capacity claim | None (count on the range row) | Build |
| `sold_out_at`, `source`, `external_ref`, `manually_edited` | None | Build |
| Nightly materialization (12 rolling months) | None | Build (BullMQ nightly job) |
| Bookability = EXISTS open departure in 30 days | Not implemented | Build |
| Single-day only | `endDate` permits multi-day | Drop multi-day in v1 |

`Booking.scheduleId` currently FKs `TourSchedule`; in the target model a booking references a `departures` row. See [`DATA-MODEL.md` §E.8/E.9](./DATA-MODEL.md#e8-bookings) for the booking-side migration.
