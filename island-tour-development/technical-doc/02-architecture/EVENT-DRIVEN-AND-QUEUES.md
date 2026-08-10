# Event-Driven Architecture & Queues

> Canonical source: master v1.9 (§8 tracking, §6 booking/email, §7 commercial jobs). This note is an
> engineering derivation; on any disagreement the master wins.
> Companion docs: [../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md](../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md) · [BOOKING-AND-PAYMENTS.md](./BOOKING-AND-PAYMENTS.md) · [SETTLEMENT-AND-PAYOUTS.md](./SETTLEMENT-AND-PAYOUTS.md) · [TRACKING-AND-ANALYTICS.md](./TRACKING-AND-ANALYTICS.md) · [AVAILABILITY-AND-DEPARTURES.md](./AVAILABILITY-AND-DEPARTURES.md)

Purpose: answer one architecture question - "do we need a queue and an event-driven system to handle
overbooking, race conditions, and edge cases?" - and specify the pattern we actually adopt. The short
version: a queue is the **wrong** tool for capacity/overbooking, and the **right** tool for everything
that happens after the seat and money are settled. BullMQ is already in the stack; this note makes its
use deliberate.

> **Status (2026-07-25, B6/#51): BUILT.** `OutboxEvent` (§5.2) + the `platform-jobs` queue are live:
> `booking.confirmed` commits with the finalize guard and fans out to the confirmation-email /
> operator-notice / CAPI jobs + a delayed pre-tour reminder; `booking.refund-owed` commits in the
> cancel transaction and drives the durable refund retry. Relay: `workers/outbox-relay.service.ts`;
> consumers: `workers/platform-jobs.processor.ts` -> idempotent `run*Job` methods (per-booking guard
> columns). Hold-expiry sweep, payout release, and the nightly commercial jobs remain in-process
> `@nestjs/schedule` crons - they are idempotent recomputes, already durable by rerun.
>
> **Founder amendment (same day): confirm-time EMAILS also send INLINE** for immediate delivery -
> `finalizeConfirmation` invokes the email job methods directly (swallowing failures); the queued
> jobs act as the durable retry BACKSTOP via the shared guard columns (inline success -> job no-ops;
> inline failure -> job retries). CAPI and the pre-tour reminder are queue-only.

---

## 1. Decision summary

| Concern | Correct mechanism | Queue? |
|---|---|---|
| Overbooking / two travelers race for the last seats | Single atomic guarded `UPDATE departures` (row-level lock) | **No** |
| Booking create + unit items + add-ons + settlement row | One DB transaction (synchronous) | **No** |
| Payment intent creation | Idempotent per `(bookingId, kind)` (synchronous) | **No** |
| Confirmation / operator-balance email | BullMQ job, retryable, idempotent | **Yes** |
| Server-side Meta CAPI conversion | BullMQ job, idempotent by event id | **Yes** |
| Hold expiry (release seats at `utcExpiresAt`) | BullMQ delayed/repeatable sweeper | **Yes** |
| Scheduled `paid_in_full` payout after cancellation window | BullMQ delayed job | **Yes** |
| Pre-tour reminder (24h before start) | BullMQ delayed job | **Yes** |
| Affiliate postback (on-hold, approve after window) | BullMQ delayed job | **Yes** |
| Nightly quality_score / eligibility / materialization | BullMQ repeatable (cron) | **Yes** |

Rule of thumb: **synchronous transactional core, asynchronous edges.**

---

## 2. Overbooking and race conditions: no queue

The canonical mechanism is already in [BOOKING-FLOW-DESIGN-GUIDE.md](../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md) §8 - one guarded atomic update:

```sql
UPDATE departures
   SET booked_count = booked_count + :seats,
       status = CASE WHEN booked_count + :seats >= capacity THEN 'sold_out' ELSE status END,
       ...
 WHERE id = :departure_id
   AND tour_id = :tour_id
   AND status = 'open'
   AND booked_count + :seats <= capacity;
```

If the update affects zero rows, the booking fails. That is the concurrency control. PostgreSQL takes a
row-level lock on the conditional `UPDATE`, so when two travelers race for the last seats, exactly one
wins - atomically, at the database, with no extra infrastructure.

Why a queue is the wrong tool here:

- It does not remove the need for the atomic update - you would still run it inside the consumer, so you
  would have both.
- It serializes bookings, which fights the master's **instant booking** requirement by adding latency and
  a new failure surface.
- The only case where a queue or virtual waiting room helps overbooking is true flash-sale hot inventory
  (thousands of buyers hitting one SKU in the same second). A tour departure has ~20 to 40 seats and a
  handful of concurrent bookers; the atomic update handles that trivially. Do not build for contention we
  will not have.

**Keep the atomic guarded update. That is the overbooking and race-condition answer.**

---

## 3. The pattern: synchronous core, asynchronous edges

### Stays synchronous and transactional (the critical path)

Inside one DB transaction (as built - truth-up 2026-08-10):

1. Create `Booking` (+ `BookingUnitItem`, `BookingAddOn`) FIRST - the insert
   does not contend on the hot departure row.
2. Atomic seat claim LAST (raw guarded `UPDATE departures ... WHERE
   "bookedCount" + :seats <= "capacity"`, `SOLD_OUT` flip fused) - hardening
   F3 inverted the designed order so the contended row's lock spans ~one
   statement + commit instead of the whole insert.
3. Outbox rows are written at CONFIRMATION and CANCELLATION, not at reserve -
   no reserve-stage side effects exist (an ON_HOLD booking emits nothing
   durable until it either confirms or dies). The `Settlement` row is also a
   confirmation-time write. This section previously described a designed
   reserve-stage outbox write that was never built; if a reserve-stage event
   ever appears, it belongs in this transaction per §5.2.

Then, outside the transaction:

4. Create the payment intent (idempotent per `(bookingId, kind)`) - except `operator_full`, which is
   confirmed at commit with no charge.

`operator_full` is dropped in v1 (see [SETTLEMENT-AND-PAYOUTS.md](./SETTLEMENT-AND-PAYOUTS.md)); the note
above is the v2 behavior.

### Goes async (BullMQ jobs)

Everything that is a side effect of a state change - email, conversion, payout, reminder, nightly
recompute. These are retryable, idempotent, and sometimes delayed. They must never block the booking
response and must never be lost if a process crashes.

---

## 4. Job inventory

The durable jobs the platform runs. All of these are already required by the master; this consolidates
them onto one deliberate pattern instead of ad-hoc timers.

| Job | Trigger | Type | Idempotency key |
|---|---|---|---|
| `booking.confirmation-email` | `booking.confirmed` | standard | `bookingId:confirmation` |
| `booking.operator-balance-email` | `booking.confirmed` and `operator_link` | standard | `bookingId:operator-balance` |
| `tracking.capi-conversion` | `booking.confirmed` (EUR commission present) | standard | `bookingId:capi` (dedup by event id) |
| `booking.hold-expiry-sweep` | schedule | repeatable (cron) | run-window guarded |
| `settlement.paid-in-full-payout` | `booking.confirmed` and `paid_in_full`, released after cancellation window | delayed | `bookingId:payout` |
| `booking.pre-tour-reminder` | `booking.confirmed`, fire 24h before start | delayed | `bookingId:reminder` |
| `affiliate.postback` | `booking.confirmed` with attribution, approve after window | delayed | `bookingId:affiliate` |
| `commercial.quality-score` | nightly | repeatable (cron) | run-date guarded |
| `commercial.eligibility-enforce` | nightly | repeatable (cron) | run-date guarded |
| `availability.materialization` | nightly | repeatable (cron) | run-date guarded |

---

## 5. Reliability rules (these matter more than the queue itself)

The queue does not tame edge cases by itself. These four rules do.

### 5.1 Idempotent consumers

Durable queues redeliver on retry, so every job must be safe to run twice. Two layers:

- **Queue-level dedup** via a custom `jobId`: BullMQ ignores a second `add()` with an existing `jobId` and
  emits a `duplicated` event. Use a deterministic key (for example `bookingId:confirmation`).
  Caveat: `removeOnComplete` / `removeOnFail` remove the job from the queue, after which the same `jobId`
  is no longer seen as a duplicate. Do not rely on `jobId` dedup alone for correctness.
- **DB-level guard** is the real backstop, matching what the master already mandates: `conversion_fired_at`
  is stamped before the conversion payload is exposed (mark-first), and Stripe events are recorded in
  `stripe_webhook_events` before processing. Each consumer checks and sets its own guard.

### 5.2 Transactional outbox

The one place teams lose events is the gap between committing to Postgres and enqueuing the job (commit
succeeds, process dies before `queue.add`; or enqueue succeeds and the transaction rolls back). Fix it by
writing the event to an `outbox` table **inside the same transaction** as the booking, then a relay
publishes outbox rows to BullMQ and marks them dispatched.

```prisma
model OutboxEvent {
  id           String   @id @default(uuid())
  aggregate    String   // 'booking'
  aggregateId  String   // bookingId
  type         String   // 'booking.confirmed' | 'booking.cancelled' | 'payment.succeeded' | 'hold.expired'
  payload      Json
  dispatchedAt DateTime?
  createdAt    DateTime @default(now())

  @@index([dispatchedAt])
  @@map("outbox_events")
}
```

This guarantees "booking confirmed" always eventually fires its email, conversion, and payout - exactly
once in effect. For a payments system this is worth doing.

### 5.3 Retries and backoff

Configure attempts with exponential backoff so a transient email/provider failure retries instead of
dropping. BullMQ delay grows as `2^(attempt-1) * delay`.

```typescript
await queue.add(
  'booking.confirmation-email',
  { bookingId },
  {
    jobId: `${bookingId}:confirmation`,
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, 8s, 16s
    removeOnComplete: 1000,
    removeOnFail: false, // keep failures for inspection / DLQ
  },
);
```

### 5.4 Delayed and scheduled jobs

- **Delayed** (fire once, later): the scheduled `paid_in_full` payout and the pre-tour reminder use
  `{ delay: msUntilTarget }`. Compute the delay from tour-local time (payout: after the cancellation
  window closes; reminder: 24h before start). Re-check state in the consumer, because the booking may have
  been cancelled or refunded in the meantime.
- **Repeatable / cron** (hold-expiry sweep, nightly jobs): use the Job Scheduler.

```typescript
await queue.upsertJobScheduler(
  'nightly-quality-score',
  { pattern: '0 15 3 * * *' }, // 03:15 daily
  {
    name: 'commercial.quality-score',
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnFail: 1000 },
  },
);
```

Delayed and repeatable jobs need the BullMQ scheduler running (the modern `upsertJobScheduler` API
supersedes the older `QueueScheduler` + `repeat` pattern).

### 5.5 Failed jobs

Do not silently drop. Keep failed jobs (`removeOnFail: false` or a numeric retention) and surface them
(Bull Board or an admin view) so a stuck payout/conversion is visible. A confirmed booking with a null
`commission_amount` is data corruption (master §8): the conversion job must fail loudly, not fire.

---

## 6. Implementation notes (BullMQ + NestJS)

BullMQ is Redis-backed; register it once and add a queue per bounded concern (or one queue with named
jobs for v1 simplicity). Use `@nestjs/bullmq`.

```typescript
// worker: cap concurrency so one worker does not starve the pool
new Worker('platform', processor, { connection, concurrency: 10 });
```

- **One Redis, one connection config**, mirroring the "only one Prisma instance per process" rule.
- **Producers** are services that, after commit, publish outbox rows (the relay calls `queue.add`).
- **Consumers** are `@Processor` classes; each is idempotent (§5.1) and re-validates booking state before
  acting.
- Keep the critical booking path (seat claim, booking create, payment intent) off the queue entirely.

---

## 6b. The dashboard inbox is NOT a queue

The in-app notification system (`backend/src/inbox` - bell, sidebar badges, login digest) writes its
rows **synchronously and fire-and-forget** from the service that caused the event. It is deliberately
not a job.

Fan-out is two indexed reads (resolve the audience, filter by effective permission) and one
`createMany`. None of the three reasons to reach for a queue apply: it is not slow, not external, and
not retryable in any way the caller cares about. Putting it behind BullMQ would add Redis as a
failure mode for a bell.

What it borrows from this document instead:

- **Idempotent consumers (§5.1)** - a `UNIQUE (userId, dedupeKey)` plus `skipDuplicates`, so a repeated
  call writes nothing rather than duplicating a row.
- **Never break the caller** - `notify()` returns `void` and swallows its own errors. A notification
  can never roll back the booking, the verdict or the payout that produced it.

Naming: `src/inbox` is the human dashboard inbox. `src/notifications` is the **OCTO webhook** system -
subscriptions, signing secrets, HTTP delivery to OTA partners, and a real BullMQ queue. They share a
word and nothing else; do not merge them.

---

## 7. What NOT to do

- **Do not** route bookings through a queue to prevent overbooking. The atomic guarded update is the
  correct and sufficient tool.
- **Do not** adopt Kafka, SNS, or event sourcing. BullMQ + a lightweight domain-event/outbox layer is
  correctly sized for a tour marketplace. A heavy event bus is complexity we would pay for and not use.
- **Do not** use an in-process emitter (`@nestjs/event-emitter`) for anything that must not be lost. It is
  not durable and disappears on crash. It is fine only for non-critical, best-effort in-process fan-out;
  everything money- or customer-facing goes through the durable queue + outbox.
- **Do not** rely on `jobId` dedup alone once `removeOnComplete`/`removeOnFail` are set - keep the DB-level
  idempotency guard.

---

## 8. Mapping to the booking-flow edge cases

The master's edge cases ([BOOKING-FLOW-DESIGN-GUIDE.md](../03-implementation/BOOKING-FLOW-DESIGN-GUIDE.md) §17) resolve cleanly under this pattern:

| Edge case | Handled by |
|---|---|
| Two users race for last seats | Atomic guarded update - one winner (§2) |
| Departure closes / cutoff passes after calendar read | Atomic update `WHERE status='open'` fails the claim |
| Payment intent retried | Provider idempotency key + `(bookingId, kind)` |
| Webhook redelivered | `stripe_webhook_events` ledger before processing (§5.1) |
| Payment succeeds after hold expired | Consumer re-validates state; prefer refund/void over confirming an expired hold |
| TYP refresh / email revisit double-fires conversion | Mark-first `conversion_fired_at` DB guard (§5.1) |
| Cancellation refunded after operator was paid | Payout is delayed until after the cancellation window (§5.4), so this cannot happen for `paid_in_full` |

---

## References

- [BullMQ: retrying failing jobs (attempts + exponential backoff)](https://docs.bullmq.io/guide/retrying-failing-jobs)
- [BullMQ: job schedulers (repeatable/cron via upsertJobScheduler)](https://docs.bullmq.io/guide/job-schedulers)
- [BullMQ: delayed jobs](https://docs.bullmq.io/guide/jobs/delayed)
- [BullMQ: job ids and duplicate prevention](https://docs.bullmq.io/guide/jobs/job-ids)
- [BullMQ: idempotence and auto-removal caveat](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs)
- [BullMQ: worker concurrency](https://docs.bullmq.io/guide/workers/concurrency)
- [NestJS: Queues (BullMQ)](https://docs.nestjs.com/techniques/queues)
- [Transactional outbox pattern (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html)
