-- Hardening F5 (BOOKING-CONCURRENCY-HARDENING.md): make 0 <= bookedCount <= capacity
-- a DATABASE invariant instead of app code spread across the claim/release sites.
-- After F1/F2 no live writer can violate it; this stops any FUTURE code path,
-- admin script, or console session from producing an oversold or negative row.

-- Bound how long the ALTER below may QUEUE behind a long-lived transaction on
-- "departures" - while queued, its ACCESS EXCLUSIVE request blocks every new
-- seat claim behind it. Better to fail the deploy and rerun at a quieter
-- moment than to stall live bookings. LOCAL: scoped to this migration's
-- transaction only.
SET LOCAL lock_timeout = '5s';

-- 1) Repair before validate. The 2026-08-10 dev audit found 3 past-dated rows
--    with bookedCount > capacity and ZERO active bookings behind them - fossils
--    of the pre-F1/F2 write paths fixed in PR #164. The repair is generic
--    (ledger-based), so any equivalent drift in prod heals the same way:
--    bookedCount is reconciled to the active-booking seat ledger (an exclusive
--    charter counts as the whole departure), clamped to [0, capacity], and the
--    stored status is re-derived from the repaired fill with sticky
--    CLOSED/CANCELLED preserved - the same semantics recomputeStoredStatus
--    applies at runtime.
UPDATE "departures" d
SET "bookedCount" = sub.new_count,
    "status" = CASE
      WHEN d."status" IN ('closed'::"departure_status", 'cancelled'::"departure_status")
        THEN d."status"
      WHEN sub.new_count >= d."capacity" THEN 'sold_out'::"departure_status"
      ELSE 'open'::"departure_status"
    END,
    -- Stamp-once on a repaired row that derives sold_out, as the runtime does.
    "soldOutAt" = CASE
      WHEN d."status" NOT IN ('closed'::"departure_status", 'cancelled'::"departure_status")
       AND sub.new_count >= d."capacity"
        THEN COALESCE(d."soldOutAt", now())
      ELSE d."soldOutAt"
    END,
    -- @updatedAt is Prisma-client-side; raw SQL must stamp it by hand (the
    -- iCal feed derives SEQUENCE/LAST-MODIFIED from this column).
    "updatedAt" = now()
FROM (
  SELECT d2."id",
         LEAST(GREATEST(
           CASE WHEN EXISTS (
                  SELECT 1 FROM "bookings" b
                  WHERE b."departureId" = d2."id"
                    AND b."status" IN ('ON_HOLD', 'CONFIRMED')
                    AND b."exclusiveDeparture"
                )
                THEN d2."capacity"
                ELSE (
                  SELECT COUNT(*)::int
                  FROM "booking_unit_items" ui
                  JOIN "bookings" b ON b."id" = ui."bookingId"
                  WHERE b."departureId" = d2."id"
                    AND b."status" IN ('ON_HOLD', 'CONFIRMED')
                )
           END, 0), d2."capacity") AS new_count
  FROM "departures" d2
  WHERE d2."bookedCount" < 0 OR d2."bookedCount" > d2."capacity"
) sub
WHERE d."id" = sub."id";

-- 2) The backstop. NOT VALID skips the full-table scan under ACCESS EXCLUSIVE;
--    VALIDATE takes only SHARE UPDATE EXCLUSIVE. Inside this migration's single
--    transaction the split is pattern hygiene more than lock relief (the table
--    is small today), but it costs nothing and stays online-safe if this shape
--    is ever replayed on a big table.
ALTER TABLE "departures"
  ADD CONSTRAINT "departures_booked_within_capacity"
  CHECK ("bookedCount" >= 0 AND "bookedCount" <= "capacity") NOT VALID;

ALTER TABLE "departures" VALIDATE CONSTRAINT "departures_booked_within_capacity";
