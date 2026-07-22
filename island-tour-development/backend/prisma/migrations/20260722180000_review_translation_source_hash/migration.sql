-- LD32: translation cache invalidation.
--
-- `sourceHash` records the SHA-1 of the text a row was translated FROM, so the
-- job can distinguish "already translated" from "translated, but the source has
-- since changed". Nullable and with no backfill on purpose: existing rows were
-- written by the demo seed as per-locale copies of the same text, not as real
-- machine output, and inventing a hash for them would mark them fresh and stop
-- the first real translation pass from ever touching them.
ALTER TABLE "review_translations" ADD COLUMN "sourceHash" TEXT;
