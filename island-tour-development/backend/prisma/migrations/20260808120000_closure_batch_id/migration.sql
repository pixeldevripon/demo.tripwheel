-- The demand signal (master §3.7) counts operator date closures as sell-out
-- evidence alongside departures that filled with us. A bulk blackout is ONE
-- operator action however many dates it spans, so every row a single
-- closeRange() call writes shares this id and the count collapses them to one
-- event. Counting per closed date would let a two-week haul-out clear the
-- three-event bar on its own and badge a tour that is not scarce at all.
--
-- Nullable with no backfill on purpose: a null means "one-date closure, its own
-- event", which is exactly how every pre-existing row should count. Rows that
-- came from a bulk blackout written before this migration therefore still count
-- per date; they age out of the rolling 60-day window on their own.
ALTER TABLE "availability_exceptions"
  ADD COLUMN "closureBatchId" TEXT;

-- The demand signal's only read of this table: whole-day closures for one tour
-- inside the 60-day window.
CREATE INDEX "availability_exceptions_tourId_type_createdAt_idx"
  ON "availability_exceptions"("tourId", "type", "createdAt");
