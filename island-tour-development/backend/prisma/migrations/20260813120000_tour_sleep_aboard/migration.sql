-- "Guests sleep on board" (operator-set, whole-unit charters). Input to the
-- hub's Day/Overnight charter classification: overnight = sleepAboard OR
-- duration >= 16h. Backfill is false everywhere - existing overnight demo
-- charters are re-flagged by the demo seed, and real tours are re-saved by
-- their operators.
ALTER TABLE "tours" ADD COLUMN "sleepAboard" BOOLEAN NOT NULL DEFAULT false;
