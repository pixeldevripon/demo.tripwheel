# Booking load test — runbook (hardening F7)

The exit gate of `technical-doc/03-implementation/BOOKING-CONCURRENCY-HARDENING.md`:
proof that the seat-claim stack holds under a rush, and the baseline every future
change is judged against. **This test — not the VPS spec sheet — is what says
whether the box is enough.**

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) — `brew install k6`
- A running backend pointing at a **disposable** database (local dev or a prod
  copy on staging — never live prod: the rush writes thousands of bookings)
- The backend's `INTERNAL_API_SECRET` (bypasses the per-IP throttle — k6 is one
  IP, which no real rush is; the per-departure reserve limiter stays active on
  purpose, its 429s are part of the system under test)

## Run

```bash
cd backend
pnpm loadtest:seed                 # isolated dest/operator/tour + departures
export API=http://localhost:5050
export TOUR_ID=...                 # printed by the seed
export DEPARTURE_ID=...            # hot departure (capacity 20)
export DEPARTURE_IDS=...           # 100 spread departures
export INTERNAL_KEY=...            # backend INTERNAL_API_SECRET

SCENARIO=hot    VUS=100 ITERATIONS=100  k6 run scripts/loadtest/rush.js
pnpm loadtest:assert               # DB postconditions after EVERY scenario

SCENARIO=hot    VUS=500 ITERATIONS=500  k6 run scripts/loadtest/rush.js
pnpm loadtest:assert
SCENARIO=hot    VUS=1000 ITERATIONS=1000 k6 run scripts/loadtest/rush.js
pnpm loadtest:assert
SCENARIO=spread VUS=500 ITERATIONS=500  k6 run scripts/loadtest/rush.js
pnpm loadtest:assert
SCENARIO=mixed  VUS=100 ITERATIONS=1000 k6 run scripts/loadtest/rush.js
pnpm loadtest:assert

pnpm loadtest:cleanup              # removes everything the seed created
```

Re-seed between hot scenarios if you want a fresh (unsold) hot departure —
`cleanup` then `seed` — otherwise later rushes hit an already-sold-out row
(which is itself a useful shedding measurement, just a different one).

## What each scenario proves

| Scenario | Shape | Proves |
|---|---|---|
| `hot` 100 | 100 VUs → 1 departure, capacity 20, party 1 | correctness + p95 under contention |
| `hot` 500/1000 | same, more VUs | fail-fast behaviour; pool + lock_timeout tuning |
| `spread` 500 | 500 VUs → 100 departures | independent rows don't serialize (should be ~flat) |
| `mixed` | 80% availability reads + 20% reserves | the read path doesn't starve the write path |

## Verdict table (what statuses mean under a rush)

- `201` seat claimed — exactly `capacity` of these across a hot run
- `422` clean sold-out / no availability — **correct** when demand > supply
- `429` per-departure reserve limiter (60/min) — correct fail-fast shedding
- `503` lock_timeout shed → "try again" (F6) — correct under extreme holds
- any other `5xx` — **a bug**; the k6 threshold fails the run on the spot

## Pass criteria (the doc's, verbatim in spirit)

1. k6 exits 0 (thresholds: zero unexpected 5xx, p95 < 10s)
2. `pnpm loadtest:assert` passes: hot `bookedCount == capacity == active-seat
   ledger` exactly; global invariant sweep returns 0 rows; no half-written
   bookings
3. Record p95/p99 below — the baseline future changes are judged against

## Observe during the run

```sql
-- who's waiting on what
SELECT wait_event_type, count(*) FROM pg_stat_activity GROUP BY 1;
-- lock waits in the log (needs log_lock_waits = on)
-- pg_stat_statements for the claim UPDATE's timing distribution
```

Watch DB CPU and the backend's pool behaviour (`connectionTimeoutMillis`
breaches surface as 5s failures — if you see them, the pool is the bottleneck,
not Postgres).

## Baseline (fill in per run; keep history)

| Date | Commit | Scenario | p95 | p99 | 201/422/429/503 | Notes |
|---|---|---|---|---|---|---|
| _pending first staging run_ | | | | | | |
