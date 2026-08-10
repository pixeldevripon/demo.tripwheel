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

## Run — the short way (pure pnpm, e.g. on the VPS)

```bash
cd backend
pnpm loadtest:seed      # isolated fixture (own dest/operator/tour)
pnpm loadtest:full      # whole ladder: hot-100, hot-1000, spread-500, mixed
                        # + postconditions after each; stops on first failure
pnpm loadtest:cleanup   # removes everything the seed created
```

`loadtest:full` reads the fixture ids and INTERNAL_API_SECRET itself - no
exports needed. `API=https://api.example.com pnpm loadtest:full` tests
through the proxy instead of localhost. Single scenarios:
`pnpm loadtest:run hot 500` / `pnpm loadtest:run spread 500`.

## Run — the long way (manual control per scenario)

```bash
cd backend
pnpm loadtest:seed                 # isolated dest/operator/tour + departures
export API=http://localhost:5050
export TOUR_ID=...                 # printed by the seed
export DEPARTURE_ID=...            # hot departure (capacity 20)
export DEPARTURE_IDS=...           # 100 spread departures
# Never type the secret inline (shell history):
export INTERNAL_KEY=$(grep -m1 '^INTERNAL_API_SECRET' .env | cut -d'"' -f2)

# Hot scenarios assert with EXPECT_FULL=1: demand > capacity by construction,
# so a hot run that did not FILL the departure never really ran - this is the
# gate that stops a wrong TOUR_ID / dead backend from passing vacuously
# (k6 also fails itself on any status outside the verdict table).
SCENARIO=hot    VUS=100 ITERATIONS=100  k6 run scripts/loadtest/rush.js
EXPECT_FULL=1 pnpm loadtest:assert

SCENARIO=hot    VUS=500 ITERATIONS=500  k6 run scripts/loadtest/rush.js
EXPECT_FULL=1 pnpm loadtest:assert
SCENARIO=hot    VUS=1000 ITERATIONS=1000 k6 run scripts/loadtest/rush.js
EXPECT_FULL=1 pnpm loadtest:assert
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

1. k6 exits 0 (thresholds: zero unexpected 5xx, zero statuses outside the
   verdict table - including 0/4xx from a bad seed or dead backend - all
   checks green, p95 < 10s)
2. `EXPECT_FULL=1 pnpm loadtest:assert` passes on hot runs: `bookedCount ==
   capacity == active-seat ledger` exactly; every spread row (including the
   0-count ones) agrees with its ledger; invariant sweep 0 rows; no
   half-written bookings
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

| Date | Commit | Scenario | p95 | max | 201/422/429/503 | Notes |
|---|---|---|---|---|---|---|
| 2026-08-10 | prod@`4936a5c`+F6 | hot-100 (fresh, cap 20) | 277ms | 279ms | 20 claimed, exact capacity (pre-counter run) | zero 5xx; ledger exact |
| 2026-08-10 | same | hot-500 (fresh, cap 20) | 227ms | 243ms | 20/40/440/0 | limiter's 60/min = 20 claims + 40 clean 422s, rest shed |
| 2026-08-10 | same | hot-1000 (sold out) | 285ms | 310ms | 0/0/1000/0 | pure shedding, flat latency |
| 2026-08-10 | same | spread-500 (100 rows) | 970ms | 1.01s | 500/0/0/0 | all claimed; pool-25 queueing is the p95, no shed |
| 2026-08-10 | same | mixed 80/20 (hot sold out) | 351ms | 860ms | 0/0/247/0 + 753 reads OK | reads never starved |

Machine: local dev (Apple Silicon), Postgres 17.4 same host, pool 25, k6 same
host. Staging numbers on the real VPS should be re-recorded before launch -
these prove CORRECTNESS and give a relative baseline, not production capacity.
All five runs: zero unexpected 5xx across ~3,100 requests; `loadtest:assert`
passed after every scenario (hot fill == ledger == capacity exactly, invariant
sweep 0 rows, no half-written bookings).
