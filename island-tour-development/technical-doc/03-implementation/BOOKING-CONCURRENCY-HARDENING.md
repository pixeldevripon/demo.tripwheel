# Booking Concurrency Hardening — Fix Plan

> **Status: proposed — none of the fixes below are built yet.** Scope: the seat-claim/release
> transaction path under `backend/` and the operational settings around it (pool, sweeper,
> load verification). This plan is the outcome of an as-built audit (2026-08-10) of
> `bookings.service.ts` against `AVAILABILITY-BOOKING-ARCHITECTURE.md`,
> `AVAILABILITY-AND-DEPARTURES.md` §5, `EVENT-DRIVEN-AND-QUEUES.md` and
> `BOOKING-CHECKLIST.md`.
>
> **Line anchors are as of branch `castries` @ `1dab438`.** They drift — re-grep the named
> symbols before editing. Update `BOOKING-CHECKLIST.md` (and this file's checkboxes) in the
> same commit as each fix, per the house checklist rule.

---

## 0. Fix index — priority and implementation order

Implement top to bottom. F1–F3 are one surgical change to the same service; F4–F6 are
independent and can land in parallel; F7 is the exit gate for the whole batch.

| # | P | Fix | One-liner | Files | Effort |
|---|---|---|---|---|---|
| [ ] F1 | 🔴 P0 | Atomic `releaseSeats` | Replace read-modify-write with SQL `GREATEST` decrement | `bookings.service.ts:5861-5885` | S |
| [ ] F2 | 🔴 P0 | `claimSeats()` helper, guard in SQL | One raw guarded UPDATE (check + increment + `SOLD_OUT` flip fused), replacing 4 duplicated sites | `bookings.service.ts:591-639, 1134-1182, 2927-2990, 4683-4725` | M |
| [ ] F3 | 🔴 P0* | Claim last in the transaction | Move the guarded UPDATE to be the final statement so the hot-row lock is held for ~1 statement + commit | `bookings.service.ts` `reserve` txn | S (with F2) |
| [ ] F4 | 🟠 P1 | Idempotent replay on reserve | Honour the client-supplied `dto.id` as a real idempotency key: pre-check + P2002 catch → return the existing booking | `bookings.service.ts` `reserve` entry | M |
| [ ] F5 | 🟠 P1 | DB CHECK constraint | `0 <= "bookedCount" <= "capacity"` as a database backstop | new migration + capacity-edit paths | S/M |
| [ ] F6 | 🟠 P1 | Explicit pool + timeouts | Pool max, connect/statement/lock timeouts — today everything is node-postgres defaults (max **10**, no timeouts) | `prisma.service.ts:10-19`, `env.validate.ts`, `.env.example` | S |
| [ ] F7 | 🟠 P1 | Load test with postconditions | 100/500/1000 concurrent claims on one departure; assert exact-capacity outcome. **Gate for trusting the stack under load.** | new `scripts/loadtest/` | M |
| [ ] F8 | 🟡 P2 | Replica-safe sweeper | Hold-expiry (and materialization) must not double-run when a second app process appears | `workers/nightly-jobs.service.ts:74-87, 118-146` | S |
| [ ] F9 | 🟡 P2 | Shed doomed requests | Sold-out short-circuit before pricing/FX; short-TTL cache on availability reads; optional per-route throttle | `bookings.service.ts`, `availability.controller.ts` | S/M |
| [ ] F10 | 🟡 P2 | Resource-layer decision | Orphaned `resources`/`tour_resources` tables in prod; shared-boat cross-tour capacity is unmodeled | product decision → migration | decision |
| [ ] F11 | 🟡 P2 | Documentation truth-up | `BOOKING-AND-PAYMENTS.md` says the services are "not built"; state machine and anchors stale | `technical-doc/` | S |

\* F3 is P0 by grouping: it is nearly free while F2 rewrites the same block, and it is the
biggest single latency lever for the 100-users-one-departure rush.

---

## 1. What is already correct — do not regress

The audit confirmed these load-bearing properties. Every fix below must preserve them:

- **The overbooking backstop is a single guarded UPDATE** — capacity check fused with the
  increment (`bookings.service.ts:608-629`). Two concurrent bookings can never both claim the
  last seats. This is invariant 6 of `AVAILABILITY-BOOKING-ARCHITECTURE.md` §16.
- **Claim-before-payment is deliberate**: every bookable model claims seats at reserve, goes
  `ON_HOLD` with a TTL (default 30 min, `:168`, clamped 5–60 by the DTO), and the every-minute
  sweeper (`nightly-jobs.service.ts:74-87`) releases abandoned holds. Pay-after-expiry has a
  recovery path (`:1134-1182`). A failed Stripe intent intentionally keeps the hold
  (`payments.service.ts:645`) so the customer can retry — product decision, not a bug.
- **No external calls inside the DB transaction.** Stripe intent creation is a separate
  post-commit call, idempotent per `(bookingId, kind)` (`payments.service.ts:214-258`, key at
  `:270`). Email/OCTO/tracking ride the outbox → BullMQ relay.
- **Webhook idempotency is correct**: insert the Stripe event id before processing, P2002 →
  skip, `processedAt` stamped after, errors leave it null so Stripe retries
  (`payments.service.ts:477-539`).
- **`displayRef` is allocated outside the transaction on purpose** (`:585-589`) — a P2002 on
  a 5-char collision inside the txn would abort a valid seat claim.

### Do NOT do (each was considered and is wrong here)

- **No advisory locks in the claim path.** The row lock taken by the guarded UPDATE *is* the
  narrowest correct serialization. Advisory locks return only if/when the resource layer
  returns (F10), and even then only for cross-tour resource conflicts.
- **No Redis as inventory source of truth.** Redis is for read caching (F9) only; the final
  claim is always the Postgres UPDATE.
- **No queue in front of capacity.** `BOOKING-CHECKLIST.md:333` ("no queue for
  capacity/overbooking") stays true.
- **No bigger VPS as a contention fix.** Claims on the same departure row serialize regardless
  of cores; the levers are transaction length (F2/F3), pool behaviour (F6), and shedding (F9).

---

## 2. Defect → failure mode map

| Defect (today) | Failure mode | Fix |
|---|---|---|
| `releaseSeats` reads `bookedCount`, computes `Math.max(0, n - seats)` in JS, writes it back | Two concurrent releases lose a decrement → `bookedCount` permanently too high → phantom sold-out, lost revenue. Triggers: sweeper vs. cancel race today; two replicas tomorrow | F1 |
| Claim guard threshold is `lte: capacity - seats` where `capacity` came from an earlier in-txn read | Under READ COMMITTED a concurrent capacity *reduction* isn't observed → claim can exceed the new capacity. (The `bookedCount` race itself is safe — the UPDATE re-evaluates its WHERE) | F2 |
| `SOLD_OUT`/`soldOutAt` flip split into `recomputeStoredStatus` (extra read + write inside the txn, 4 call sites) | Longer hot-row hold per claim; duplicated logic can drift | F2 |
| `booking.create` (+ nested unit items/add-ons) runs *after* the claim, inside the row-lock window | Every waiter on a hot departure waits for the slowest part of the txn, not just the claim | F3 |
| `dto.id` is documented as the idempotency key but `reserve` never checks it; no P2002 handler anywhere (verified: nothing in `src/common/`) | Double-click / timeout retry → duplicate-key error surfaces as 500; the retry still claims + rolls back on the hot row | F4 |
| No CHECK constraint on `departures` (init migration `:213-229` has only the PK) | Invariant lives only in app code spread over 4 sites; nothing stops a future bad write path | F5 |
| Pool = node-postgres defaults: max 10, no timeouts (`prisma.service.ts:10-19`; zero `connection_limit`/pool config anywhere in the repo) | Under a rush, waiters exhaust 10 connections and everything—including the sweeper—queues; no fail-fast | F6 |
| Sweeper + materialization are in-process `@Cron` with no leader election | Second replica double-runs them (and pre-F1, corrupts counts) | F8 |

---

## F1 (P0) — make `releaseSeats` atomic

**Where:** `backend/src/bookings/bookings.service.ts:5861-5885`.
Call sites (unchanged): cancel `:2750-2758`, forfeit/restore `:3163-3170`, hold-expiry
`:3574-3579`, move `:4725`.

**Why:** the comment at `:5874-5875` promises `GREATEST(0, bookedCount - seats)` but the code
is a read-modify-write. Two transactions that both read `bookedCount = 10` and release 2 and 3
seats respectively both write from the same snapshot — the later commit wins and one decrement
is lost. Direction of failure: count too **high** (never negative, never oversell) — seats leak
until an admin notices. The exclusive branch (`:5867-5872`, absolute `bookedCount: 0`) is
already idempotent and stays.

**How:** replace the shared-branch body with a single clamped decrement; keep
`recomputeStoredStatus` after it (it re-derives `OPEN`/`SOLD_OUT`, leaves `CLOSED`/`CANCELLED`
sticky, preserves `soldOutAt` — `:5889-5921`).

```ts
// shared branch — replaces the findUnique + Math.max write at :5876-5882
await tx.$executeRaw`
  UPDATE "departures"
  SET "bookedCount" = GREATEST("bookedCount" - ${seats}, 0)
  WHERE "id" = ${departureId}`;
```

Column names are quoted camelCase (`"bookedCount"`) — the schema maps tables
(`@@map("departures")`) but **not** columns.

**Edge cases:**
- Double-release of the *same* booking is prevented by the booking-status transitions around
  each call site, not by this statement; the clamp only guards arithmetic.
- `recomputeStoredStatus` after a concurrent release can briefly leave a stale `SOLD_OUT`; it
  self-heals on the next mutation (same semantics as today — acceptable).

**Verify:** integration test (real Postgres, not a mocked Prisma): create a departure with
`bookedCount = 10`, run two parallel transactions releasing 2 and 3, assert final `= 5`.
Repeat 50× — the old code fails this within a few iterations.

---

## F2 (P0) — `claimSeats()`: one helper, guard in SQL, fused status flip

**Where:** four duplicated claim blocks —
`reserve` `:608-629` (+ capacity pre-read `:594-601`, recompute `:639`),
pay-after-expiry recovery `:1161-1175`, restore `:2971-2990`, move `:4706-4723`.

**Why raw SQL:** Prisma's `where` cannot compare two columns, which is exactly why the current
code computes `capacity - seats` in JS from a pre-read. That JS literal is the defect: under
READ COMMITTED the UPDATE re-evaluates `bookedCount` against the newest row version, but the
frozen `capacity` snapshot does not see a concurrent capacity edit. Only in-SQL
`"bookedCount" + seats <= "capacity"` closes it. Fusing the `SOLD_OUT` flip and `soldOutAt`
stamp into the same statement then deletes `recomputeStoredStatus` (a read + conditional
write) from *inside* the claim window — fewer round-trips while holding the contended row.

**How:** one private helper; all four sites call it. Postgres enum values for
`"departure_status"` are **lowercase** (`'open'`, `'sold_out'` — the Prisma enum uses `@map`);
booking statuses are a different type (`"BookingStatus"`, UPPERCASE) — do not mix them up.

```ts
/**
 * Atomic seat claim - THE overbooking backstop (master §5, invariant 6).
 * Check + increment + SOLD_OUT flip + soldOutAt stamp in ONE statement.
 * Raw SQL because the guard compares two columns, which Prisma cannot express.
 * Returns false when the claim lost (sold out, closed, or wrong tour/id).
 */
private async claimSeats(
  tx: Prisma.TransactionClient,
  args: { departureId: string; tourId: string; seats: number; exclusive: boolean },
): Promise<boolean> {
  const { departureId, tourId, seats, exclusive } = args;
  const claimed = exclusive
    ? await tx.$executeRaw`
        UPDATE "departures"
        SET "bookedCount" = "capacity",
            "status"      = 'sold_out'::"departure_status",
            "soldOutAt"   = COALESCE("soldOutAt", now())
        WHERE "id" = ${departureId} AND "tourId" = ${tourId}
          AND "status" = 'open'::"departure_status"
          AND "bookedCount" = 0`
    : await tx.$executeRaw`
        UPDATE "departures"
        SET "bookedCount" = "bookedCount" + ${seats},
            "status" = CASE WHEN "bookedCount" + ${seats} >= "capacity"
                            THEN 'sold_out'::"departure_status" ELSE "status" END,
            "soldOutAt" = CASE WHEN "bookedCount" + ${seats} >= "capacity"
                               THEN COALESCE("soldOutAt", now()) ELSE "soldOutAt" END
        WHERE "id" = ${departureId} AND "tourId" = ${tourId}
          AND "status" = 'open'::"departure_status"
          AND "bookedCount" + ${seats} <= "capacity"`;
  return claimed === 1;
}
```

**Consequential edits:**
- **Delete the in-txn capacity pre-read** (`:594-601`). Departure existence is already
  established before the txn — `loadContext` selects the departure (`ctx.departure` is used at
  `:655`). Zero rows from the claim therefore means "no availability", and the existing
  error messages (`:630-636`) keep their exact wording.
- **Claim no longer calls `recomputeStoredStatus`** (it's fused). The release path (F1) still
  does — recompute stays for the `SOLD_OUT → OPEN` reopen direction only.
- `>=` in the CASE is deliberate: with the guard in the same WHERE, equality is the only
  reachable branch; `>=` is harmless belt-and-braces.
- `capacity = 0` departures: exclusive claim flips straight to `sold_out` with 0 — same as
  today's recompute semantics.

**Verify:**
- The existing race e2e suite must stay green — race-the-last-seat, party-exceeds-remaining,
  one-guarded-update (`BOOKING-CHECKLIST.md:475-496`).
- New integration test: concurrent capacity edit — start a claim for the last 2 seats, commit a
  `capacity - 2` reduction from a second connection between the booking's pre-tx reads and the
  claim; the claim must now lose (old code: wins).
- Raw SQL is invisible to mocked-Prisma unit tests — these must run against real Postgres
  (same harness as F1).

---

## F3 (P0, rides on F2) — claim last: shrink the serialized window

**Where:** the `reserve` transaction, `bookings.service.ts:591-748`.

**Why:** the departure row lock is acquired at the claim UPDATE and held until COMMIT. Today
the order is claim (`:608`) → recompute (`:639`) → `booking.create` with nested unit items and
add-ons (`:644+`). Every rival claim on a hot departure therefore waits for the multi-row
insert too. In the 100-users-one-departure rush, this is the single biggest p95 lever.

**How:** invert the order inside the same `$transaction`:

1. `booking.create` (+ nested items/add-ons) first — nothing in it depends on the claim
   result; the FK to `departures` takes `FOR KEY SHARE`, which does **not** conflict with the
   claim's `FOR NO KEY UPDATE` row lock, so inserts don't serialize each other.
2. `claimSeats()` (F2) as the **final** statement. If it returns `false`, throw the existing
   `UnprocessableEntityException` — the rollback removes the booking rows too.

The hot-row lock window becomes one UPDATE + commit.

**Edge cases:**
- The sold-out path now does insert work that gets rolled back. That cost is paid only by
  losers, off the winner's lock window — the right trade. (F9's short-circuit sheds most of
  those losers before the txn anyway.)
- **Move/reschedule** (`:4683-4725`) touches *two* departure rows (release old + claim new).
  Two crossing moves (A→B and B→A) can in theory deadlock; Postgres resolves it by aborting
  one (`deadlock_timeout` 1s). Rare, admin-driven, acceptable — optionally touch the two rows
  in sorted-id order if it ever shows up in logs.
- Apply the reorder to `reserve` (the hot path). Recovery/restore/move are low-traffic; leave
  their order as-is to keep those diffs review-small.

**Verify:** race e2e stays green; under the F7 hot-departure run, compare p95 before/after —
expect a visible drop.

---

## F4 (P1) — idempotent replay on reserve

**Where:** `reserve` entry (`bookings.service.ts` ~`:540` onward) +
`POST /api/v1/bookings` (`bookings.controller.ts:98-99`, `@Public()`).
The key already exists in the contract: `ReserveBookingDto.id` — *"Client-supplied id —
idempotency key. Generated if omitted."* (`dto/booking.dto.ts:1399-1406`, `@IsUUID()`).

**Why:** the declared contract is not implemented. Today a retry with the same `id` (double
click, network timeout, checkout JS retry) re-runs the claim on the hot row, then
`booking.create` throws P2002, the txn rolls back (so the seat math is safe — claim and insert
share the transaction), and the client gets an unhandled 500: there is no P2002 handler in
`reserve` and none in `src/common/`. Retry storms arrive precisely when the row is busiest.

**How (two layers):**

1. **Pre-transaction replay check.** If `dto.id` is present, `findUnique({ where: { id } })`.
   Found → return the existing booking through the same response mapper as a fresh reserve
   (extract the mapper if it's currently inline). Sanity-guard key reuse: if the found
   booking's `tourId`/`departureId` don't match the payload, throw 409 (`Conflict` —
   "idempotency key already used for a different reservation") instead of silently returning
   an unrelated booking.
2. **In-flight duplicate catch.** Two same-id requests can both pass the pre-check. Wrap the
   `$transaction` call: catch Prisma P2002 where `meta.target` is the bookings PK, then
   re-fetch by `id` and return the winner's booking. (Per house convention: unique violation →
   handled, never a 500.)

**Notes:**
- Replay returns the booking in its **current** state (it may already be `CONFIRMED` or
  `EXPIRED`) — that is correct replay semantics; the client asked "what happened to this key".
- Return the same body shape both paths; keep 201 for both rather than special-casing status
  codes — simpler for the widget.
- The unused `uuid` column (`bookings.prisma:7`, commented "OCTO uuid … idempotency key") is a
  second, dormant key. Decide: either wire it (OCTO semantics) or note it as OCTO-mirror-only
  in the schema comment so nobody assumes it dedupes. This plan treats `id` as THE key.

**Verify (e2e):** (a) same `id` twice sequentially → second returns the same booking, no new
booking row, `bookedCount` unchanged; (b) same `id` twice in parallel → exactly one booking
row, both responses carry its id; (c) same `id`, different `departureId` → 409.

---

## F5 (P1) — CHECK constraint on `departures`

**Where:** new raw migration (CHECK constraints aren't expressible in Prisma schema DSL —
create with `pnpm prisma migrate dev --create-only` and paste SQL).

**Why:** `0 <= bookedCount <= capacity` is currently enforced only by app code spread over
four sites (one after F2). The DB backstop makes the invariant unbreakable by any future code
path, admin script, or console session.

**How:**

```sql
-- 1) Pre-audit (must return 0 rows; if not, repair first and find the writer):
SELECT "id", "bookedCount", "capacity"
FROM "departures"
WHERE "bookedCount" < 0 OR "bookedCount" > "capacity";

-- 2) Online-safe add (NOT VALID skips the full-table scan under ACCESS EXCLUSIVE;
--    VALIDATE takes only SHARE UPDATE EXCLUSIVE):
ALTER TABLE "departures"
  ADD CONSTRAINT "departures_booked_within_capacity"
  CHECK ("bookedCount" >= 0 AND "bookedCount" <= "capacity") NOT VALID;
ALTER TABLE "departures" VALIDATE CONSTRAINT "departures_booked_within_capacity";
```

**Capacity-edit paths must expect it.** The constraint hard-blocks reducing `capacity` below
the current `bookedCount` — which is the correct product behaviour, but the writers must fail
politely (409, not 500):

- Materializer: already safe for booked departures — it re-projects capacity only when a
  departure is unbooked (`availability-materializer.service.spec.ts:167`); confirm the
  invariant holds in `availability-materializer.service.ts` itself.
- Exception `capacityOverride` path (`availability.service.ts:301-312`) and any manual
  departure edit (`manuallyEdited` flag): add a service-level guard
  (`newCapacity >= bookedCount` → else 409) so the constraint stays a backstop, not the UX.
- Map the raw violation (Postgres `23514`, surfaced by Prisma as `P2010`/`P2004` depending on
  call shape) to 409 in the one place capacity is written.

**Ordering:** no hard dependency on F1/F2 (current writers can't exceed capacity), but land it
after them so the pre-audit runs against fixed code.

**Verify:** migration applies on a prod copy; a test asserting capacity reduction below
`bookedCount` returns 409; a direct SQL attempt to set `bookedCount = capacity + 1` fails.

---

## F6 (P1) — explicit connection pool + timeouts

**Where:** `backend/src/prisma/prisma.service.ts:10-19`; register new env vars in
`backend/src/env.validate.ts`; document in `backend/.env.example`.

**Why:** the entire repo has zero pool configuration (no `connection_limit`, no PgBouncer, no
pool options) — production runs the node-postgres defaults: **max 10 connections, no
timeouts**. Every request waiting on a hot departure row holds a pool slot; the every-minute
sweeper shares the same pool. Under a rush the 11th request queues indefinitely with no
fail-fast, and there is no bound on how long a stuck transaction can hold locks.

**How** (`PrismaPg` passes `pg.PoolConfig` straight through; `pg` is `^8.20.0`):

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 25),
  connectionTimeoutMillis: 5_000,   // waiting for a pool slot: fail fast, don't queue forever
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000,        // no single statement may run longer
  idle_in_transaction_session_timeout: 15_000, // a stuck open txn gets killed, freeing its locks
  options: '-c lock_timeout=3s',    // waiting on the hot row caps at 3s, freeing the pool slot
});
```

- Make the reserve transaction's Prisma options explicit while touching this:
  `{ maxWait: 2_000, timeout: 5_000 }` (today's implicit defaults) — tune from F7 numbers.
- Postgres side: `max_connections` must cover `DB_POOL_MAX × app processes + cron/studio
  headroom` (e.g. pool 25 × 1 process + 10 headroom on the KVM 4 box).
- A `lock_timeout` abort surfaces as a Prisma error on the claim — map it to 503/`Retry-After`
  (or a 422 "try again") rather than 500.
- Starting numbers are deliberately conservative; **F7 is what tunes them.** More connections
  than CPU can serve makes Postgres slower, not faster.

**Verify:** F7 run shows pool-wait behaviour (fail-fast 5xx-free); kill-switch test — open a
transaction and sleep → server terminates it at 15s.

---

## F7 (P1, exit gate) — load test with postcondition assertions

**Where:** new `backend/scripts/loadtest/` (k6; any equivalent works). Run against a staging
DB with prod-like data, after F1–F6.

**Scenarios:**

| Scenario | Shape | What it proves |
|---|---|---|
| `hot-100` | 100 VUs → 1 departure, capacity 20, party 1 | correctness + p95 under contention |
| `hot-500` / `hot-1000` | same, more VUs | fail-fast behaviour, pool + lock_timeout tuning |
| `spread-500` | 500 VUs → 100 departures | independent-row parallelism (should be ~flat) |
| `mixed` | 80% availability reads + 20% reserves | read path doesn't starve the write path |

**Script sketch** (`POST /api/v1/bookings` is public, keyed via `dto.id`):

```js
import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  scenarios: { rush: { executor: 'shared-iterations', vus: 500, iterations: 500, maxDuration: '2m' } },
};

export default function () {
  const res = http.post(
    `${__ENV.API}/api/v1/bookings`,
    JSON.stringify({
      id: uuidv4(),
      tourId: __ENV.TOUR_ID,
      departureId: __ENV.DEPARTURE_ID,
      items: [/* one line per age band — see ReserveBookingDto */],
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, {
    'claimed or clean sold-out': (r) => r.status === 201 || r.status === 422,
    'no 5xx': (r) => r.status < 500,
  });
}
```

**Postconditions (assert with SQL, not vibes)** — note the two enum casings:

```sql
-- The rush departure (party size 1, demand > capacity):
SELECT d."bookedCount", d."capacity",
       (SELECT COUNT(*) FROM "bookings" b
         WHERE b."departureId" = d."id"
           AND b."status" IN ('ON_HOLD', 'CONFIRMED')) AS active_bookings
FROM "departures" d WHERE d."id" = :departure_id;
-- PASS: bookedCount = capacity = active_bookings, exactly.

-- Global invariant sweep (0 rows; F5 makes violations impossible anyway):
SELECT "id" FROM "departures" WHERE "bookedCount" < 0 OR "bookedCount" > "capacity";
```

**Observe during the run:** `log_lock_waits = on`, `pg_stat_statements`,
`SELECT wait_event_type, count(*) FROM pg_stat_activity GROUP BY 1`, DB CPU, and the error
split — 422 sold-out is *correct* under a rush; any 5xx is a bug.

**Pass criteria:** exactly `capacity` successes; overflow rejected as 422; zero 5xx; p95/p99
recorded as the baseline that future changes are judged against. This test — not the VPS spec
sheet — is what says whether KVM 4 is enough.

---

## F8 (P2) — replica-safe sweeper (before any second app process)

**Where:** `workers/nightly-jobs.service.ts` — hold-expiry `@Cron(EVERY_MINUTE)` (`:74-87`);
same treatment for materialization (`:118-146`) and the settlement sweep (`:52-56`).

**Why:** in-process `@Cron` with no leader election. A second replica double-runs every tick.
After F1 a double-run is merely wasteful (idempotent recompute); *before* F1 it is exactly the
concurrent-release scenario that corrupts counts. Do this before scaling out, not after.

**How — in preference order:**

1. **BullMQ repeatable job** on the existing `platform-jobs` queue with a fixed `jobId` —
   this is the designed home (`EVENT-DRIVEN-AND-QUEUES.md:117-123` lists
   `booking.hold-expiry-sweep` and `availability.materialization` as repeatable jobs). The
   queue infra, processor, and dedup opts already exist (`workers/platform-queue.ts`).
2. **Env-gated scheduler** as a zero-infra stopgap: `CRON_ENABLED=true` on exactly one
   replica; the `@Cron` methods return early when unset.

**Anti-pattern warning:** do **not** wrap the tick in `pg_try_advisory_lock` /
`pg_advisory_unlock` via pooled Prisma calls — session-level advisory locks are
per-connection, and the pool gives lock and unlock different connections, leaking the lock.
(Transaction-scoped `pg_try_advisory_xact_lock` doesn't fit either: the sweep runs many small
per-booking transactions by design, `:3574-3593`.) If you want a DB-level guard, it's option 1.

**Verify:** run two app processes locally; assert one sweep per minute total (log line carries
the winner), and hold expiry still converges.

---

## F9 (P2) — shed doomed requests before the write path

Three independent, small changes:

1. **Sold-out short-circuit in `reserve`.** `loadContext` already selects the departure;
   check `status`/remaining fill **before** `resolvePricing` (FX snapshotting, `:563`) and
   before the transaction. In a rush on a sold-out departure this rejects ~80% of traffic for
   the cost of a comparison, and the guarded UPDATE remains the only authority — this check is
   advisory and may be stale by design.
2. **Short-TTL cache on public availability reads** (`availability.controller.ts` read
   endpoints): 10–30s TTL, keyed per tour+month. In-process is fine on one box; Redis (already
   present for BullMQ) if it must be shared. Display-only — never consulted by the claim.
   Invalidation beyond the TTL is unnecessary at these staleness windows.
3. **Optional: tighter per-route throttle** on `POST /bookings` (global guard is 20/s · 300/min
   per IP): e.g. `@Throttle({ default: { limit: 10, ttl: 60_000 } })`. Mind hotel/NAT shared
   IPs — keep it loose enough for a tour group booking from one lobby.

**Verify:** F7 `mixed` scenario before/after — reserve p95 under a sold-out rush should
collapse to the pre-check cost; cache hit ratio logged.

---

## F10 (P2) — resource layer: decide, then clean up

**Context:** migration `20260802170000_resource_layer` created `resources` and
`tour_resources` in production. Commit `515a0e7` then reverted the entire layer (Prisma
models, `resource-allocation.util.ts`, both `RESOURCE-*.md` docs); commit `465cfa1` kept the
migration because prod had already run it. **The tables exist with no model, no code, no doc.**

**The gap the layer was for still exists:** two tours sharing one physical boat/vehicle have
fully independent departure rows — per-departure claims are airtight, but nothing prevents
selling both tours' departures for the same boat at the same time. This is a *modeling* gap,
not a transaction bug, and no amount of claim hardening covers it.

**Decision fork (product call):**
- **Shared resources are a launch requirement** → re-land the layer, and only then design the
  cross-tour claim (that is where `pg_advisory_xact_lock(resourceId)` or a resource-capacity
  ledger belongs — resurrect the reverted ADR thinking).
- **Not a launch requirement** → drop migration: `DROP TABLE "tour_resources", "resources";`
  so schema matches code, and file the need as a post-launch feature.

Either way, the orphaned-tables state should not survive the decision.

---

## F11 (P2) — documentation truth-up

Bring the paper back in line with the code (each item is a one-commit doc fix; fold into the
PR that touches the area, or one docs PR):

- `BOOKING-AND-PAYMENTS.md:9` — status header claims bookings/payments/webhooks/emails are
  "not built". All are built. Rewrite the header.
- `BOOKING-AND-PAYMENTS.md:108-113` — documents a `pending_payment → confirmed → cancelled`
  machine. The real enum is `ON_HOLD | CONFIRMED | EXPIRED | CANCELLED | REDEEMED | PENDING |
  REJECTED`. Document the real one (see `AVAILABILITY-BOOKING-ARCHITECTURE.md` §11.2).
- `BOOKING-AND-PAYMENTS.md:207-217` — describes `operator_full` as live; it is rejected in v1
  at `loadContext` (`bookings.service.ts:5617`), leaving dead `operatorFull` branches in
  `reserve` (`:583, :641-643, :667-673, :757-761`). Either mark the model "modeled, disabled
  in v1" — or delete the dead branches in code and say so.
- `AVAILABILITY-BOOKING-ARCHITECTURE.md` §7 — every `file:line` anchor is stale by 400–5000
  lines; re-anchor (and update §7.2/§7.4 SQL to the F1/F2 shapes once landed).
- `BOOKING-CHECKLIST.md:147, :213-214` — after F1/F2, annotate that the claim/release now
  literally match the documented SQL (today they approximate it); add rows for F1–F9 with
  their build status, per the keep-current rule.
- `EVENT-DRIVEN-AND-QUEUES.md:85-89` — designed step 3 writes an outbox row in the reserve
  transaction; built code writes outbox rows only at confirmation/cancel. No reserve-stage
  side effects exist today, so either amend the doc or add the row when one appears.

---

## 3. PR plan

Per repo rules: branch off `pixelvega/prod`, PR base `prod`, one branch per PR, checklist
updated in the same commits.

| PR | Branch (suggested) | Contents |
|---|---|---|
| PR-1 | `booking-atomic-claim-release` | F1 + F2 + F3, integration tests (real PG), checklist rows |
| PR-2 | `booking-idempotent-replay` | F4 + e2e replay tests |
| PR-3 | `departures-check-constraint` | F5 migration + capacity-edit 409 guards |
| PR-4 | `db-pool-config` | F6 + `env.validate.ts` + `.env.example` |
| PR-5 | `booking-loadtest-harness` | F7 scripts + runbook (no prod code) |
| PR-6 | `sweeper-singleton` | F8 |
| PR-7 | `reserve-shedding` | F9 |
| — | after F10 decision | drop-tables migration **or** resource-layer re-land |
| PR-8 | `booking-docs-truthup` | F11 leftovers not folded into PR-1…7 |

**Sequencing:** PR-1 first (contains the only live bug). PR-2/3/4 are independent — parallel
is fine. Run F7 after PR-1…4 are deployed to staging; its numbers tune F6 and set the
baseline. PR-6/7 are pre-scale-out work. F10 is a product decision with no code dependency.

---

## 4. Definition of done (whole plan)

- [ ] No read-modify-write on `bookedCount` anywhere (`grep -n "bookedCount" bookings.service.ts` shows only the raw guarded statements and absolute exclusive writes).
- [ ] Exactly one `claimSeats` implementation; four call sites.
- [ ] Reserve replay with a reused `id` returns the existing booking; parallel duplicates produce one row.
- [ ] `departures_booked_within_capacity` constraint live in prod; capacity writers return 409, never 500.
- [ ] Pool size + timeouts explicit in config and `.env.example`; lock/statement timeouts observable in logs.
- [ ] F7 run recorded: exact-capacity postcondition passed, zero 5xx, baseline p95/p99 filed in this doc.
- [ ] Sweeper provably single-runner under two processes.
- [ ] Resource-layer decision recorded; orphaned tables resolved.
- [ ] `BOOKING-CHECKLIST.md` + this file's checkboxes current.
