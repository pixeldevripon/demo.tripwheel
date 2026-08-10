/**
 * Booking-rush load test (hardening F7 of BOOKING-CONCURRENCY-HARDENING.md).
 * Plain k6 JavaScript - run with `k6 run` after `pnpm loadtest:seed`.
 *
 * Scenarios (pick with SCENARIO; sizes with VUS/ITERATIONS):
 *   hot     - every VU reserves on ONE departure (the 100-users-one-boat rush)
 *   spread  - VUs reserve round-robin across 100 independent departures
 *   mixed   - 80% public availability reads + 20% reserves on the hot row
 *
 *   SCENARIO=hot    VUS=100  ITERATIONS=100  k6 run scripts/loadtest/rush.js
 *   SCENARIO=hot    VUS=500  ITERATIONS=500  k6 run scripts/loadtest/rush.js
 *   SCENARIO=spread VUS=500  ITERATIONS=500  k6 run scripts/loadtest/rush.js
 *   SCENARIO=mixed  VUS=100  ITERATIONS=1000 k6 run scripts/loadtest/rush.js
 *
 * Required env: API, TOUR_ID, DEPARTURE_ID (hot/mixed), DEPARTURE_IDS (spread).
 * INTERNAL_KEY (the backend's INTERNAL_API_SECRET) bypasses the per-IP
 * ThrottlerGuard - k6 is one IP, which no real rush is. The per-DEPARTURE
 * reserve limiter (60/min) stays active on purpose: its 429s are part of the
 * system under test.
 *
 * Verdicts a rush may produce - and what they mean:
 *   201  seat claimed                          (exactly `capacity` of these)
 *   422  clean sold-out / no availability      (correct under demand > supply)
 *   429  per-departure reserve limiter         (correct fail-fast shedding)
 *   503  lock_timeout shed -> "try again"      (correct under extreme holds)
 *   5xx  ANY OTHER -> a bug. Thresholds fail the run.
 *
 * After the run: `pnpm loadtest:assert` proves the DB postconditions
 * (exact-capacity, ledger match, zero invariant violations).
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const SCENARIO = __ENV.SCENARIO || 'hot';
const VUS = Number(__ENV.VUS || 100);
const ITERATIONS = Number(__ENV.ITERATIONS || VUS);
const API = __ENV.API || 'http://localhost:5050';

const serverErrors = new Counter('server_errors_5xx');
// The verdict split IS the baseline data: how a rush was answered.
const claimed201 = new Counter('reserve_201_claimed');
const soldOut422 = new Counter('reserve_422_sold_out');
const limiter429 = new Counter('reserve_429_limiter');
const shed503 = new Counter('reserve_503_shed');

export const options = {
  scenarios: {
    rush: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: ITERATIONS,
      maxDuration: '3m',
    },
  },
  thresholds: {
    // The whole point: a rush may reject, it may NEVER break.
    server_errors_5xx: ['count==0'],
    // 503 is a correct shed, so http_req_failed is not a useful threshold
    // here; p95 is recorded as the baseline the doc asks to file.
    http_req_duration: ['p(95)<10000'],
  },
};

/** RFC4122-shaped v4 id (the DTO enforces @IsUUID(4)); offline, no jslib. */
function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const headers = { 'Content-Type': 'application/json' };
if (__ENV.INTERNAL_KEY) headers['x-internal-api-key'] = __ENV.INTERNAL_KEY;

const spreadIds = (__ENV.DEPARTURE_IDS || '').split(',').filter(Boolean);

function reserve(departureId) {
  const res = http.post(
    `${API}/api/v1/bookings`,
    JSON.stringify({
      id: uuid4(),
      tourId: __ENV.TOUR_ID,
      departureId,
      guests: 1, // party of 1, per the F7 scenario table
    }),
    { headers },
  );
  if (res.status === 201) claimed201.add(1);
  else if (res.status === 422) soldOut422.add(1);
  else if (res.status === 429) limiter429.add(1);
  else if (res.status === 503) shed503.add(1);
  else if (res.status >= 500) serverErrors.add(1);
  check(res, {
    'claimed or cleanly rejected': (r) =>
      r.status === 201 ||
      r.status === 422 ||
      r.status === 429 ||
      r.status === 503,
  });
}

function availabilityRead() {
  const res = http.post(
    `${API}/api/v1/availability/calendar`,
    JSON.stringify({
      tourId: __ENV.TOUR_ID,
      dateFrom: '2031-08-01',
      dateTo: '2031-08-31',
    }),
    { headers },
  );
  if (res.status >= 500) serverErrors.add(1);
  check(res, { 'availability read ok': (r) => r.status === 201 || r.status === 200 });
}

export default function () {
  if (SCENARIO === 'spread') {
    reserve(spreadIds[(__VU * 31 + __ITER) % spreadIds.length]);
  } else if (SCENARIO === 'mixed') {
    // 80% reads / 20% reserves - the read path must not starve the writes.
    if (__ITER % 5 === 0) reserve(__ENV.DEPARTURE_ID);
    else availabilityRead();
  } else {
    reserve(__ENV.DEPARTURE_ID);
  }
}
