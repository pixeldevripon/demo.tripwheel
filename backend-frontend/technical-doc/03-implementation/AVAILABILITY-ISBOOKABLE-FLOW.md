# Availability, Schedules, Departures & `isBookable` - Full Flow

> A hands-on engineering guide to how a tour goes from "operator added a weekly
> schedule" to "tour appears in public listings". Read this before changing
> anything in `backend/src/availability/`, the tour publish path, or the nightly
> jobs. Every claim below is anchored to a `file:line` so you can jump straight
> to the code.

---

## 1. The one-sentence mental model

```
Schedules (rules)  ──materialize──▶  Departures (concrete inventory)  ──computeIsBookable──▶  tour.isBookable  ──filter──▶  public listing
```

- **Schedules** and **exceptions** are *rules* an operator authors. They are NOT
  what gets booked.
- The **materializer** projects those rules into concrete **Departure** rows
  (one per tour x date x start time). Departures are the single source of truth
  for bookable inventory.
- **`tour.isBookable`** is a cached boolean: "does this tour have at least one
  OPEN, non-cutoff departure in the next 30 days?" The public grid filters on it.
- If any link in that chain is missing, the tour is `LIVE` but "not yet listed".

---

## 2. Data model

All four tables live in `backend/prisma/availability.prisma`. Plus two fields on
`Tour`.

### 2.1 `AvailabilitySchedule` - the recurring weekly rule (`availability.prisma:6-26`)

| Field | Meaning |
|---|---|
| `weekday` | `0=Monday … 6=Sunday` (tour-local). NOT JavaScript's Sunday=0. |
| `startTime` | `@db.Time` - must be one of `Tour.startTimes[]`. |
| `capacityOverride` | `Int?` - per-rule capacity. `null` = fall back to `Tour.maxPartySize`. |
| `validFrom` / `validUntil` | Window the rule applies (validUntil `null` = open-ended). |
| `status` | `ACTIVE` (default) or `PAUSED`. Only `ACTIVE` rules materialize. |

Unique on `(tourId, weekday, startTime, validFrom)`.

### 2.2 `AvailabilityException` - date-specific deviations (`availability.prisma:30-49`)

`type` is one of (`enums.prisma`, `AvailabilityExceptionType`):
- `ADD_SLOT` - introduce a departure the weekly pattern does not produce.
- `SET_CAPACITY` - override capacity for one slot (startTime set) or the whole date (startTime null).
- `CLOSE_DATE` - stop-sell the whole date (departures kept but marked `CLOSED`).
- `CLOSE_SLOT` - stop-sell one slot.

### 2.3 `Departure` - the materialized truth (`availability.prisma:52-78`)

| Field | Meaning |
|---|---|
| `date` + `startTime` | The concrete instant (tour-local). |
| `capacity` | Resolved capacity for THIS departure. |
| `bookedCount` | Seats claimed. `>= capacity` => sold out. |
| `status` | `OPEN` / `SOLD_OUT` / `CLOSED` / `CANCELLED` (`enums.prisma`, `DepartureStatus`). |
| `source` | `SCHEDULE` / `EXCEPTION` / `API`. |
| `manuallyEdited` | `true` protects the row from re-materialization. |
| `soldOutAt` | Stamped once when it fills (feeds demand signals). |

Unique on `(tourId, date, startTime)` - this is the idempotency key the
materializer reconciles against.

### 2.4 The two `Tour` fields that matter

- **`Tour.maxPartySize`** (`prisma/tours.prisma`, `Int?`) - the DEFAULT capacity
  a schedule uses when it has no `capacityOverride`. **If both are null, the slot
  is silently skipped** (this is the classic "published but not listed" cause -
  see section 8).
- **`Tour.isBookable`** (`Boolean`) - the cached listing gate. The public grid
  reads only this; it never joins departures per-request.

---

## 3. The materialization engine

File: `backend/src/availability/availability-materializer.service.ts`.
Entry point: `materializeTour(tourId, from?, to?)` (`:51`).

Step by step:

1. **Load the tour clock + default capacity** (`:56-60`): reads `timeZone` and
   `maxPartySize`. Everything is destination-local time - "now" is the island's
   wall clock (`localNow`, `:63`).
2. **Resolve the window** (`resolveWindow`, `:102-123`): default is
   `today … today + 90 days` (`DEFAULT_HORIZON_DAYS = 90`, `:24`). Hard cap
   `365 days` (`:23`). The nightly job passes `to = today + 364d` for a rolling
   12 months.
3. **Load ACTIVE schedules + exceptions in-window** (`:66-73`). Note the filter
   `status: 'ACTIVE'` - PAUSED schedules produce nothing.
4. **Build the desired set, one calendar day at a time** (`buildDayDepartures`,
   `:126-218`):
   - For each schedule whose `weekday` matches and whose `validFrom/validUntil`
     covers the day, add a desired departure (`:138-158`).
   - **Capacity resolution** (`:143`):
     `capacity = schedule.capacityOverride ?? tour.maxPartySize`.
     **If that is `null`, the slot is skipped with only a warning log** (`:144-149`).
   - Layer exceptions on top: `ADD_SLOT` (`:161-184`), `SET_CAPACITY` (`:187-201`),
     `CLOSE_DATE`/`CLOSE_SLOT` (`:204-217`).
   - Full capacity resolution precedence:
     `exception.capacity ?? schedule.capacityOverride ?? tour.maxPartySize`.
5. **Reconcile desired vs existing** (`reconcile`, `:221-324`):
   - **Create** departures that don't exist yet (`:262-273`).
   - **Update** capacity/status on unprotected existing rows (`:278-290`).
   - **Delete** "orphans" - existing rows no longer desired AND unprotected (`:292-302`).
   - A row is **protected** and never touched when
     `bookedCount > 0 || manuallyEdited || source === API` (`:246-253`).
   - All writes run in a single `$transaction` (`:311`).

`materializeTour` returns `{ created, updated, skipped, removed }` and logs a line
like `Materialized tour <id>: +2 ~1 skip 0 -0` (`:319-322`).

---

## 4. The listing gate (`isBookable`)

File: `backend/src/availability/availability.service.ts`.

### 4.1 `computeIsBookable(tourId)` (`:502-536`)

Returns `true` iff the tour has `>= 1` **live-OPEN** departure within the horizon:
- Horizon = `now … now + BOOKABLE_HORIZON_DAYS` where
  `BOOKABLE_HORIZON_DAYS = 30` (`availability-status.util.ts:4`).
- Query filters `status: OPEN` and the 30-day date window (`:509-522`), takes 100.
- For each candidate it computes the **live** status (`liveDepartureStatus`) and
  keeps it only if `isDepartureBookable` (i.e. still OPEN after the cutoff check)
  (`:524-535`).

### 4.2 `refreshIsBookable(tourId)` (`:544-551`)

Calls `computeIsBookable`, then persists the result to `tour.isBookable`. This is
the ONLY thing that writes the flag. Returns the new value.

### 4.3 Live status derivation (`availability-status.util.ts`)

`liveDepartureStatus` (`:41-52`) - the customer-facing status, computed at read
time (never stored):
- `CANCELLED` / `CLOSED` are sticky (operator/admin states) - returned as-is.
- Else `bookedCount >= capacity` => `SOLD_OUT`.
- Else if the booking cutoff has passed (`now >= start - bookingCutoffMinutes`)
  => `CLOSED` (the cutoff is NEVER materialized, only applied live).
- Else `OPEN`.

`isDepartureBookable` (`:55-57`) - only a live `OPEN` departure counts.

So a departure can exist and still not make a tour bookable: it's in the past,
past its cutoff, sold out, closed, or cancelled.

---

## 5. The public listing filter

`ToursService.findAll` (public grid) filters on the cached flag, NOT on a live
departures join (`tours.service.ts:570-574`):

```ts
const where: Prisma.TourWhereInput = {
  status: TourStatus.LIVE,
  isActive: true,
  isBookable: true,   // <-- the gate
};
```

Real-time reads for a single tour's detail page/date picker DO read departures
directly (they don't use the cached flag):
- `checkAvailability(dto)` (`availability.service.ts:443-468`) - live-bookable
  slots with enough seats.
- `calendar(dto)` (`:470-496`) - per-day aggregate for the date picker.

---

## 6. WHEN each recompute runs (the trigger matrix)

This is the part people get wrong. `isBookable` is a cache - it is only correct
if it is refreshed on every event that could change it.

| Trigger | Code | What runs |
|---|---|---|
| Operator **creates** a schedule | `availability.service.ts:88-124` | `syncTourAvailability` = materialize + refresh (`:155-158`) |
| Operator **updates** a schedule | `:160-205` | `syncTourAvailability` |
| Operator **deletes** a schedule | `:207-227` | `syncTourAvailability` |
| Operator hits **Materialize** endpoint | `:350-364` | `materializeTour(from,to)` + `refreshIsBookable` |
| Operator **edits a departure** (cancel/sold-out/reopen) | `:397-437` | `refreshIsBookable` (`:430`) |
| Tour is **published** | `tours.service.ts:1890-1951` | `computeIsBookable` -> stored at `:1936-1943` |
| Tour is **unpaused** | `tours.service.ts:2028-2047` | `computeIsBookable` -> stored at `:2036-2039` |
| Tour's **`maxPartySize` changes** | `tours.service.ts` update, `resyncTourAvailability` | materialize + refresh (self-heal, see section 8) |
| **Nightly cron (03:00 UTC)** | `workers/nightly-jobs.service.ts:35-65` | `materializeAllLive()` then `recomputeAllBookable()` across all LIVE tours |

### 6.1 The nightly job

`NightlyJobsService.run()` (`nightly-jobs.service.ts:44-65`) does, in order:
1. `availability.materializeAllLive()` - projects a rolling 12 months for every
   LIVE+active tour (`availability.service.ts:583-605`). Per-tour failures are
   logged and skipped so one bad tour never aborts the batch.
2. `availability.recomputeAllBookable()` - refreshes `isBookable` for every
   LIVE+active tour (`:558-574`).

It is a plain `@nestjs/schedule` cron (in-process), NOT BullMQ - these are
idempotent recomputes, not a retry/concurrency queue. Both methods are public and
can be called on demand from an admin endpoint, seed, or test.

> Note: a stale comment in `availability-materializer.service.ts:42-43` still says
> "nightly BullMQ job" - that is wrong; it's `@nestjs/schedule`. Ignore it.

---

## 7. End-to-end worked example

Operator creates a Monday 09:00 schedule on a tour with `maxPartySize = 20`,
`timeZone = America/Curacao`, `bookingCutoffMinutes = 120`, today = Mon 6 Jul 2026.

1. `POST /availability/schedules` -> `createSchedule` (`availability.service.ts:88`).
2. Guards: ownership (`assertTourAccess`), start time in slot set
   (`assertStartTimeInSlotSet`), resolvable capacity (`assertResolvableCapacity` -
   passes because `maxPartySize = 20`).
3. Row inserted with `status = ACTIVE`, `validFrom = today`.
4. `syncTourAvailability` (`:118`) -> `materializeTour`:
   - Window today … +90d. For every Monday in range it creates a Departure at
     09:00, `capacity = 20` (from `maxPartySize`), `status = OPEN`, `source = SCHEDULE`.
5. `refreshIsBookable` -> `computeIsBookable`:
   - Finds OPEN departures in the next 30 days. The nearest future Monday is not
     past its 120-min cutoff => live status `OPEN` => bookable.
   - Persists `tour.isBookable = true`.
6. Public grid `findAll` now returns the tour.

If the tour were still `DRAFT`, materialization still runs on schedule create (it
does not gate on status), and `publish` later calls `computeIsBookable` so the
flag is correct the moment it goes LIVE.

---

## 8. The "PUBLISHED, NOT YET LISTED" failure (and the guard that prevents it)

### 8.1 Symptom

Dashboard banner: *"PUBLISHED, NOT YET LISTED - This tour has no availability in
the next 30 days…"*. The tour is `LIVE` but absent from public listings. Driven
by `trip.status === 'LIVE' && !trip.isBookable`
(`frontend/.../trip-edit-view.tsx`).

### 8.2 Root cause (the silent skip)

Capacity resolves as `schedule.capacityOverride ?? tour.maxPartySize`
(`availability-materializer.service.ts:143`). If **both are null**, the slot is
**skipped with only a warning** (`:144-149`) -> zero departures ->
`computeIsBookable` returns false -> `isBookable = false` -> not listed. The
schedules exist and look fine in the UI, which is why this is confusing.

### 8.3 The guards (what now prevents it)

1. **Write-time guard** - `assertResolvableCapacity(tourId, capacityOverride)`
   (`availability.service.ts`, called from `createSchedule` and `updateSchedule`).
   Rejects a schedule that has no override on a tour with no `maxPartySize`, with
   a message telling the operator exactly what to do. So you can no longer CREATE
   the broken state.
2. **Self-heal on `maxPartySize`** - when a tour's `maxPartySize` changes,
   `ToursService.update` calls `availability.resyncTourAvailability(id)`
   (materialize + refresh). So setting a Max Party Size on the Details tab
   instantly re-projects previously-skipped schedules and the tour lists.
3. **UI surfacing** - the Schedules tab shows an amber notice when the tour has no
   Max Party Size, flips the capacity field to required, and blocks submit with a
   clear toast (`frontend/.../trip-schedules-tab.tsx`). The "not yet listed"
   banner explains the capacity cause.

### 8.4 Diagnose it yourself (read-only SQL)

```sql
-- 1. Is the flag off, and does the tour even have a default capacity?
SELECT id, status, "isBookable", "maxPartySize", "timeZone", "startTimes"
FROM tours WHERE id = '<tour-id>';

-- 2. Do ACTIVE schedules exist, and do they carry their own capacity?
SELECT weekday, "startTime", "capacityOverride", status, "validFrom", "validUntil"
FROM availability_schedules WHERE "tourId" = '<tour-id>' ORDER BY weekday;

-- 3. THE decisive check: are there any departures at all?
SELECT count(*) FROM departures WHERE "tourId" = '<tour-id>';

-- 4. If departures exist, are any OPEN in the next 30 days?
SELECT date, "startTime", capacity, "bookedCount", status
FROM departures
WHERE "tourId" = '<tour-id>'
  AND status = 'OPEN'
  AND date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
ORDER BY date, "startTime";
```

Also grep the backend log for
`has no capacityOverride and tour has no maxPartySize - slot skipped`.

### 8.5 Fix decision tree

- **0 schedules** -> operator must add recurring schedules (Schedules tab).
- **Schedules exist, 0 departures, `maxPartySize` null, overrides null** -> the
  capacity bug. Set a Max Party Size on the Details tab (self-heals via
  `resyncTourAvailability`) OR set a capacity override per schedule.
- **Departures exist but none OPEN in 30 days** -> they're all in the past / past
  cutoff / sold out / closed, or `validFrom` starts beyond 30 days. Check the
  schedule window and add near-term availability.
- **Everything looks right but flag is stale** -> force a recompute: call the
  materialize endpoint for the tour, or run the nightly job body
  (`NightlyJobsService.run()`) which does `materializeAllLive` +
  `recomputeAllBookable`.

---

## 9. Invariants to preserve when you change this code

1. **`isBookable` is a cache.** Any new code path that can change a tour's
   departures MUST call `refreshIsBookable` (or `resyncTourAvailability`) after.
   Otherwise the listing goes stale.
2. **Never materialize without resolvable capacity.** Keep the write-time guard;
   a schedule that can't resolve a capacity is a silent dead end.
3. **Protected departures are sacred.** The reconciler must never overwrite a row
   with `bookedCount > 0`, `manuallyEdited`, or `source = API`.
4. **Weekday is Monday=0.** Backend, frontend, and the materializer all agree on
   this. Don't reintroduce JS's Sunday=0.
5. **Cutoff is live, never stored.** Do not materialize the cutoff into a status;
   it's applied in `liveDepartureStatus` at read time.
6. **The public grid reads `isBookable`, not departures.** Keep it that way - a
   per-request departures join across the whole catalog is the thing this cache
   exists to avoid.

---

## 10. File index (quick jump)

| Concern | File |
|---|---|
| Schedules/exceptions/departures CRUD + gate | `backend/src/availability/availability.service.ts` |
| Rule -> departure projection engine | `backend/src/availability/availability-materializer.service.ts` |
| Horizon, cutoff, live status, disclosure | `backend/src/availability/availability-status.util.ts` |
| DTOs | `backend/src/availability/dto/availability.dto.ts` |
| Routes | `backend/src/availability/availability.controller.ts` |
| Schema | `backend/prisma/availability.prisma` |
| Enums (`DepartureStatus`, exception types) | `backend/prisma/enums.prisma` |
| Publish / unpause / maxPartySize self-heal | `backend/src/tours/tours.service.ts` |
| Public grid filter (`isBookable`) | `backend/src/tours/tours.service.ts` (`findAll`) |
| Nightly cron | `backend/src/workers/nightly-jobs.service.ts` |
| "Not yet listed" banner | `frontend/components/dashboard/trips/trip-edit-view.tsx` |
| Schedules tab UI + capacity notice | `frontend/components/dashboard/trips/trip-schedules-tab.tsx` |
</content>
</invoke>
