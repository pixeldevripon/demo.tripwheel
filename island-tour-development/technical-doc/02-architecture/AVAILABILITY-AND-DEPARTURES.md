# Availability & Departures — Architecture Reference

> **Canonical source:** master §E.9 (`island-tours-platform-master.html` v1.9; deep source `island-tours-availability-dev-spec.md`).
> **Purpose:** Define the three-table availability model — `availability_schedules`, `availability_exceptions`, `departures` — that **replaces** the simple `TourSchedule` model. The platform is the single source of truth for what is bookable, always current regardless of operator API status.

> **Status:** Target architecture. **Not yet built.** The current code has only a basic `TourSchedule` (see [§9](#9-current-code-state)). This document describes what supersedes it.
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
2. For each resulting `(date, start_time)`, resolve capacity in priority order: **exception → schedule `capacity_override` → tour default** (`max_party_size`).
3. Apply exceptions: `add_slot` adds a departure; `close_date`/`close_slot` set `status = closed`; `set_capacity` overrides capacity.
4. Upsert the `departures` row keyed by `(tour_id, date, start_time)`, stamping `source = schedule` or `source = exception`.

**The job never touches a departure that has any of:**

- `booked_count > 0` (existing bookings),
- `manually_edited = true`,
- `source = api`.

This protects real-world state from being clobbered by a re-projection. A sync **never silently reopens a manual closure**.

**Edge rule:** lowering `capacity` below `booked_count` is **admin-only**, surfaces a warning, and **never auto-cancels** existing bookings. Restores (a cancellation freeing a seat, or a capacity raise) reopen the departure (`status → open`), but `sold_out_at` history is preserved for the demand signal.

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

- A locked headline: **"These trips still have room this week"**.
- **2–3 same-category tours** that have an open departure **within 7 days** (alternatives).
- A **silent** GA4 `availability_dead_end` event for monitoring.

**`notify-me` is v2** (conflict log 77). The v1 dead end recovers through alternatives only — there is no `availability_notifications` table at launch.

---

## 9. API-adapter upsert rules

Operator-system adapters (later phase) upsert into `departures` with `source = api` and the operator system's id in `external_ref`:

1. **Idempotent upsert** keyed by `(tour_id, date, start_time)` (or `external_ref` where supplied).
2. **Portal stop-sell wins.** A sync **never silently reopens a manual closure** — a `close_date`/`close_slot` exception (and any `manually_edited` row) is authoritative over inbound API state.
3. `source = api` rows are **never touched** by the nightly schedule materialization (they are owned by the adapter, not the weekly pattern).

API adapters are not required for launch; the platform runs fully on schedules + exceptions + the nightly job.

---

## 10. Current code state

The current schema has **only** a basic `TourSchedule` model (`backend/prisma/trips.prisma`), which this three-table model **supersedes**:

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
