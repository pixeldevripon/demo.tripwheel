-- MCK-16 change 10: actor-side attribution + soft-retired reopens on
-- availability_exceptions.
--
-- createdBySide: which side of the marketplace wrote the row (operator vs
-- Island Tours). Backfilled from the creating user's CURRENT role - the best
-- available evidence for historical rows; from now on it is stamped at write
-- time.
--
-- retiredAt/retiredBy/retiredBySide: a reopen/undo now retires the row instead
-- of deleting it, so the Date changes register keeps both the closure and its
-- reopening. Every "what is in force" read filters retiredAt IS NULL.

-- CreateEnum
CREATE TYPE "public"."actor_side" AS ENUM ('operator', 'platform');

-- AlterTable
ALTER TABLE "public"."availability_exceptions"
  ADD COLUMN "createdBySide" "public"."actor_side",
  ADD COLUMN "retiredAt" TIMESTAMP(3),
  ADD COLUMN "retiredBy" TEXT,
  ADD COLUMN "retiredBySide" "public"."actor_side";

-- Backfill: attribute existing rows by the creating user's role. Rows whose
-- creator is unknown (null createdBy, or a deleted account) stay null and
-- render without a side label.
UPDATE "public"."availability_exceptions" e
SET "createdBySide" = CASE
  WHEN u."role" = 'ADMIN' THEN 'platform'::"public"."actor_side"
  ELSE 'operator'::"public"."actor_side"
END
FROM "public"."user" u
WHERE u."id" = e."createdBy";
