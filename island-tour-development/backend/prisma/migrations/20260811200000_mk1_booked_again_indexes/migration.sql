-- MK-1 sweep index support (perf review of #188, High + Medium 2).
--
-- 1) The booked-again suppression probes "another committed booking by the
--    same address, created later". contactEmail had no index at all, and the
--    probe matches case-insensitively, so every candidate paid a sequential
--    scan of bookings - linear in table size, once per candidate, eight
--    ticks a day. The EXPRESSION index serves the raw-SQL probe's
--    lower("contactEmail") = $1 AND "createdAt" > $2 shape directly.
--
--    NOTE FOR RE-BASELINING: expression indexes cannot be expressed in the
--    Prisma DSL - this CREATE INDEX must be HAND-CARRIED into any future
--    baseline (see prisma/MIGRATION-BASELINE.md, "Re-baselining" step 2).
CREATE INDEX "bookings_lower_contact_email_created_at_idx"
  ON "public"."bookings" ((lower("contactEmail")) ASC, "createdAt" ASC);

-- 2) The MK-1 candidate query's selective predicate is the tourEndDateTime
--    band (a ~17-day window); status matches most of the table and could
--    only seq-scan. Expressible in the DSL - kept in bookings.prisma too.
CREATE INDEX "bookings_tourEndDateTime_idx"
  ON "public"."bookings" ("tourEndDateTime" ASC);
