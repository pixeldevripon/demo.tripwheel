-- Why an operator closed a date or a departure (mck-15 §4). The stored status
-- stays CLOSED either way - a manual stop-sell must not reopen itself the way a
-- fill does - and the reason decides what a TRAVELLER is told:
--
--   sold_out     -> "Sold out", struck through. Only the operator reopens it.
--   not_running  -> "No departure", plain grey, no line. Nothing was ever on
--                   sale that day.
--
-- A closure with no reason is a cutoff-passed CLOSED, computed live and never
-- stored, which reads as a plain "Closed".
CREATE TYPE "closure_reason" AS ENUM ('sold_out', 'not_running');

-- Nullable with no backfill on purpose: closures written before the reason
-- existed keep reading as a plain "Closed", which is exactly what they have
-- always meant. Backfilling them to either value would invent an intent the
-- operator never expressed.
ALTER TABLE "availability_exceptions"
  ADD COLUMN "closureReason" "closure_reason";

-- Projected onto the materialized row so a public calendar read does not have
-- to re-derive it from the exception table on every request.
ALTER TABLE "departures"
  ADD COLUMN "closureReason" "closure_reason";
