# OCTO real-time availability & booking — implementation checklist

> **Goal.** Build a **real-time, API-driven** availability and booking system that is OCTO-aligned,
> prevents overbooking under concurrency, and makes the booking flow smooth. **iCal is secondary**
> (export/import sync only) — the database is the single source of truth, exposed through the OCTO
> availability + booking APIs.
>
> **Stack:** NestJS 11 · Prisma 7 · PostgreSQL · BullMQ · Stripe · Resend.
> **Companions:** spec → [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md);
> overall API migration → [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md);
> frontend → [`OCTO-FRONTEND-ALIGNMENT.md`](./OCTO-FRONTEND-ALIGNMENT.md);
> business rules → [`../MASTER-CHECKLIST.md`](../MASTER-CHECKLIST.md).
>
> **Legend:** `- [ ]` to do · `- [x]` done · `⚠️` decision required.

---

## Core principles (the non-negotiables)

1. **Single source of truth** = the `departures` table (materialized inventory) in PostgreSQL. Not
   iCal, not a cache, not the operator's external calendar.
2. **Real-time** — availability reads hit live inventory (with short, safe caching only on the
   public list/calendar, never on the final reservation step).
3. **No overbooking, ever** — every seat decrement is **atomic and conditional**; concurrency is
   handled at the database, not in application memory.
4. **Reserve → confirm** (OCTO two-step) — a reservation **holds** inventory for a short window
   (`ON_HOLD`, `utcExpiresAt`); confirmation commits it; expiry releases it automatically.
5. **iCal is one-way-ish & secondary** — export a feed for operators; optionally import external
   "blocked dates", but availability decisions are made on our inventory.
6. **Event-driven** — booking/availability changes emit webhooks so operators/partners stay in sync.

---

## Inventory & concurrency model (read before building)

OCTO `Availability` maps to our **`departures`** (one bookable slot = one departure row). Each holds
`capacity` and a live `vacancies` (= OCTO `vacancies`). The whole correctness of the system rests on
how `vacancies` is mutated.

**⚠️ A1 — Concurrency strategy.** Pick the seat-claim mechanism (recommendation first):

1. **Recommended — atomic conditional UPDATE** (no explicit lock, fewest round-tours):

   ```sql
   UPDATE departures
      SET vacancies = vacancies - $units
    WHERE id = $departureId
      AND status = 'AVAILABLE'
      AND vacancies >= $units
   RETURNING id, vacancies;
   ```

   If **0 rows** returned → not enough capacity → reject `UNPROCESSABLE_ENTITY`. This is a single
   atomic statement; two concurrent requests for the last seat — exactly one wins. Run it inside the
   same `prisma.$transaction` that creates the booking + unit items, so a booking failure rolls the
   seats back.

2. **`SELECT … FOR UPDATE`** inside a transaction, then check + update. More explicit, slightly more
   locking; use if we need to read-modify-write multiple inventory rows together.

3. **Serializable isolation** with retry. Strongest guarantee, but needs retry-on-conflict handling
   and costs throughput. Reserve for complex multi-row claims.

> Default to **(1)**. It is the simplest correct option for single-departure claims and the basis of
> "no negative inventory".

**Hold accounting.** A reservation decrements `vacancies` immediately (the seat is held). If it
expires or is cancelled, `vacancies` is **incremented back** (atomic `+ $units`). Confirmation does
**not** change `vacancies` again (already decremented at hold).

**Idempotency.** Create Booking carries a client `uuid`. Enforce `UNIQUE(uuid)` so a retried request
never double-decrements. Optionally honor an `Idempotency-Key` header on POSTs.

---

## Phase 0 — Discovery & planning

- [ ] Document the flow: **Operator → inventory (departures) → OCTO API → Island Tours frontend / OTA → traveler**.
- [ ] Confirm inventory **source of truth = `departures`** (decision recorded). ⚠️
- [ ] Define the **overbooking-prevention strategy** (A1 above) and write it into `ARCHITECTURE-OVERVIEW.md`.
- [ ] Define **hold window** default (e.g. 15–30 min `expirationMinutes`) and supplier max. ⚠️
- [ ] Define **cancellation & refund** rules from `cancellationHours` (enum [24,48,72,168], default 48).
- [ ] Review OCTO availability + booking lifecycle in [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md) §4–§7.
- [ ] Document **iCal limitations** (not real-time, no atomic capacity) → iCal = secondary sync only.

---

## Phase 1 — Data model (Prisma)

> Replaces the simplistic `TourSchedule` with the master's availability model.

- [ ] **`availability_schedules`** — recurring rules per tour (weekday pattern, start times, capacity,
  season start/end). Master Stage 5.
- [ ] **`availability_exceptions`** — date-specific overrides (blackout, extra departure, capacity
  change, price override).
- [ ] **`departures`** (materialized slots — the inventory):
  - [ ] `id`, `tourId`, `optionId` (synthetic DEFAULT for now), `localDateTimeStart`,
    `localDateTimeEnd`, `allDay`.
  - [ ] `capacity` (int), `vacancies` (int, the live counter), `status`
    (`AVAILABLE|LIMITED|SOLD_OUT|CLOSED|FREESALE`).
  - [ ] `utcCutoffAt` (from `bookingCutoffMinutes`), `priceOverride?`.
  - [ ] Index `(tourId, localDateTimeStart)`, `(status)`.
- [ ] **`bookings`** expansion (see [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md) §5.1):
  `uuid UNIQUE`, OCTO status, `utcExpiresAt/ConfirmedAt/RedeemedAt`, `resellerReference`,
  `supplierReference`, `currency`, contact fields, pricing, cancellation fields, `freesale`, `testMode`.
- [ ] **`booking_unit_items`** — one row per pax: `uuid`, `bookingId`, `unitId`(age band), `status`,
  contact, ticket, pricing.
- [ ] **`webhook_subscriptions`** + **`webhook_deliveries`** (Phase 6).
- [ ] **`ical_sync_logs`** (Phase 8).
- [ ] Migrate `BookingStatus` enum → OCTO set (`ON_HOLD/CONFIRMED/EXPIRED/CANCELLED/REDEEMED/PENDING/REJECTED`).
- [ ] Add `AvailabilityStatus` enum.

---

## Phase 2 — Availability materialization (the engine)

- [ ] **Materializer service**: expand `availability_schedules` + `availability_exceptions` into
  concrete `departures` for a rolling window (e.g. 12 months).
- [ ] **Nightly BullMQ job** to roll the window forward + apply exceptions; idempotent (upsert by
  `(tourId, localDateTimeStart)`).
- [ ] **Status recompute**: `vacancies == 0 → SOLD_OUT`; `vacancies <= lowThreshold → LIMITED`;
  past `utcCutoffAt` → `CLOSED`.
- [ ] **Bookability rule** (for listing/ranking): a tour is bookable iff it has ≥1 `AVAILABLE`
  departure within the next 30 days (master rule). Feeds search/ranking.

---

## Phase 3 — OCTO availability API

- [ ] `POST /availability/` — concrete slots for `tourId+optionId+date range (+units)`. Returns
  OCTO `Availability[]` (`id, localDateTimeStart/End, available, status, vacancies, capacity,
  maxUnits, utcCutoffAt`, + `unitPricing/pricing` with `octo/pricing`).
- [ ] `POST /availability/calendar` — day-level `AvailabilityCalendar[]` (aggregate departures per
  day) for month views.
- [ ] **Opaque, stable `id`** per departure that Create Booking resolves back to the row.
- [ ] **Caching policy**: calendar/list may cache briefly (e.g. 30–60s ISR/Redis); the **reservation
  path reads live** (no cache). Document it.
- [ ] Performance: index-backed range queries; avoid N+1; return arrays (OCTO shape).

---

## Phase 4 — OCTO booking lifecycle

- [ ] `POST /bookings/` — **reserve**: atomic seat claim (A1) + create `ON_HOLD` booking + unit items
  + set `utcExpiresAt`. Validate unit restrictions (age bands, accompaniedBy, option min/maxUnits).
- [ ] `POST /bookings/{uuid}/confirm` — **confirm**: reject if expired; run payment (Phase 7);
  `→ CONFIRMED`; persist contact; issue voucher/tickets; emit events.
- [ ] `POST /bookings/{uuid}/cancel` — release seats atomically (`vacancies + units`); compute refund
  (FULL/PARTIAL/NONE) from cancellation window; `→ CANCELLED`.
- [ ] `POST /bookings/{uuid}/extend` — push `utcExpiresAt` (only while `ON_HOLD`).
- [ ] `PATCH /bookings/{uuid}` — update unit items/contact/notes (re-validate capacity + price). ⚠️
- [ ] `GET /bookings/{uuid}` and `GET /bookings/` (filter by refs/date/tour; authZ scoped).

---

## Phase 5 — Concurrency & overbooking protection (most critical)

- [ ] Implement the **atomic conditional decrement** (A1 option 1) for every reserve.
- [ ] Wrap reserve in `prisma.$transaction` — seat claim + booking + unit items commit together or
  not at all.
- [ ] Enforce `UNIQUE(bookings.uuid)` (idempotent create); handle the unique violation → return the
  existing booking, not a duplicate.
- [ ] **Hold-expiry sweeper** (BullMQ): periodically (or via per-booking delayed job) move `ON_HOLD`
  past `utcExpiresAt` → `EXPIRED` and **restore vacancies atomically**.
- [ ] Guard against **negative inventory** with a DB `CHECK (vacancies >= 0)` constraint as a backstop.
- [ ] Cancellation/refund also restores seats atomically.
- [ ] **Concurrency tests**: fire 50 / 100 / 500 simultaneous reservations at a 1-seat and N-seat
  departure; assert exactly `capacity` succeed, the rest get `UNPROCESSABLE_ENTITY`, and final
  `vacancies == 0` (never negative).
- [ ] Load test the availability + reserve endpoints (p95 latency, error rate under burst).

---

## Phase 6 — Real-time updates & webhooks (`octo/notifications`)

> Use the **OCTO notifications** model (not ad-hoc event names) so partners/OTAs integrate to spec.
> Full contract: [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md) §5.4 +
> [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md) §5D.

- [ ] Internal: booking create/confirm/cancel/expire **updates departure status** immediately
  (LIMITED/SOLD_OUT recompute).
- [ ] **Subscription CRUD** (`/notifications/subscriptions`): `url`, `notificationTypes[]`, `headers?`.
- [ ] **OCTO event types** (the only three): `PRODUCT_UPDATE`, **`AVAILABILITY_UPDATE`** (every
  inventory change — reserve/cancel/expire/materialize/capacity edit), `BOOKING_UPDATE` (every
  status transition). Carry the specific sub-state in `data`.
- [ ] **`AVAILABILITY_UPDATE` is the real-time propagation channel** — `data` carries
  Availability-Check-compatible params so subscribers re-fetch `POST /availability/`.
- [ ] **Delivery payload**: `{ id, subscriptionId, notificationType, utcCreatedAt, data }`.
- [ ] **Delivery worker** (BullMQ): POST to each subscriber `url` with its custom `headers`; HMAC
  signature; retries with backoff; `notification_deliveries` audit; dead-letter after N attempts.
- [ ] Idempotent delivery (`id`) so partners can dedupe.

---

## Phase 7 — Payments wired into confirm/cancel

- [ ] Map OCTO confirm to the master **payment models** (operator_link/on_arrival/paid_in_full/
  operator_full). `operator_full` confirms with **no charge**.
- [ ] Stripe **PaymentIntent** on confirm (deposit or full per tier `deposit_pct`); use OCTO
  `PENDING` as the intermediate state until the webhook settles. ⚠️
- [ ] **Commission snapshot** on confirm (conversion value = `commission_amount` in **EUR**).
- [ ] Stripe **refund** on cancel per refund decision; reverse commission per rules.
- [ ] Idempotent Stripe webhook via `stripe_webhook_events`.

---

## Phase 8 — iCal (secondary only)

- [ ] **Export**: generate a per-tour (or per-operator) iCal feed of departures / blocked dates for
  operators to subscribe to. Read-only mirror of our inventory.
- [ ] **Import (optional)**: ingest external iCal "blocked dates" → write `availability_exceptions`
  (never directly mutate `vacancies`).
- [ ] **Sync logs** (`ical_sync_logs`): track failures; never let an iCal failure affect live booking.
- [ ] Make explicit in docs: **iCal is supplementary**; the API/inventory is authoritative.

---

## Phase 9 — Security & access

- [ ] OCTO auth per [`OCTO-API-MIGRATION-CHECKLIST.md`](./OCTO-API-MIGRATION-CHECKLIST.md) D1
  (cookie for our frontend v1; **bearer token / API key for operators & OTAs**).
- [ ] **Per-operator API keys** + permissions; scope bookings/availability to the owning operator.
- [ ] Rate limiting (existing `ThrottlerGuard`) tuned for the booking burst path.
- [ ] Audit logs on inventory + booking mutations.

---

## Phase 10 — Documentation

- [ ] Swagger/OpenAPI group for OCTO routes (OCTO DTOs + error shapes).
- [ ] Availability API guide + booking lifecycle guide (reserve→confirm→cancel diagrams).
- [ ] Partner integration guide + webhook guide + iCal guide.
- [ ] Keep this checklist + the migration checklist updated per commit.

---

## Phase 11 — Testing & QA

- [ ] Functional: availability, reserve, confirm, cancel, extend, expiry.
- [ ] Concurrency/overbooking (Phase 5) — the make-or-break suite.
- [ ] Load test (high traffic on calendar + reserve).
- [ ] Production readiness: monitoring, structured logging, error tracking, DB backups, alerting on
  negative-inventory attempts / expiry-sweeper lag.

---

## MVP cut (fastest path to a smooth booking)

Ship this first; defer the rest:

**Must have**

- [ ] `departures` inventory model + nightly materializer.
- [ ] `POST /availability` + `/availability/calendar` (OCTO-shaped).
- [ ] `POST /bookings` (reserve, atomic claim) → `confirm` → `cancel`, with `extend`.
- [ ] Atomic conditional decrement + `prisma.$transaction` + `UNIQUE(uuid)` + `CHECK(vacancies>=0)`.
- [ ] Hold-expiry sweeper (BullMQ).
- [ ] OCTO error shape on the OCTO namespace.
- [ ] Concurrency test proving no overbooking.

**Later**

- [ ] Webhooks / partner subscriptions.
- [ ] iCal export/import.
- [ ] Multi-option tours, pickups/dropoffs, richer unit types.
- [ ] Full pricing-capability taxes, multi-currency display.
- [ ] OTA integrations (Viator / GetYourGuide adapters).

---

## How to message this to the client (alignment)

> We're aligned: availability will be **real-time and API-driven**, with the database as the single
> source of truth and the APIs designed to the **OCTO standard** for future operator/OTA
> interoperability. **iCal will be a secondary sync** (export, optional import), not the primary
> availability source. No major blockers foreseen; the key engineering focus areas are **inventory
> synchronization across operators, concurrency control to prevent overbooking, and API
> performance/uptime** — all handled at the architecture level (atomic inventory claims,
> reserve→confirm holds, expiry release, and webhooks). We'll flag any risks proactively as we build.

---

## Learning OCTO (A→Z, for the team)

1. **Business domain first** — Operator → Supplier API → Reseller → OTA → Customer; the
   Tour / Option / Availability / Booking vocabulary.
2. **OCTO spec** — <https://docs.octo.travel/> (core + capabilities). Our captured copy:
   [`OCTO-SPECIFICATION-REFERENCE.md`](./OCTO-SPECIFICATION-REFERENCE.md).
3. **Tour vs Option vs Unit** — the catalog hierarchy (see spec §4).
4. **Availability** — capacity, vacancies, cutoff, status (spec §4.5).
5. **Booking lifecycle** — check → reserve (`ON_HOLD`) → confirm → voucher → cancel (spec §7).
   Understand **reservation (held) vs booking (confirmed)**.
6. **Inventory & concurrency** — the real engineering: atomic claims, overbooking prevention (Phase 5).
7. **Webhooks / event-driven sync** (Phase 6).
8. **OpenAPI/Swagger** — OCTO is OpenAPI-based.
9. **Reference real APIs** — Viator Partner API, GetYourGuide Supplier API (how OCTO concepts appear
   in production).
10. **Hands-on** — build the MVP above; that *is* the OCTO core (~80% of the value is availability +
    inventory + booking lifecycle + concurrency + API contract + webhooks).
