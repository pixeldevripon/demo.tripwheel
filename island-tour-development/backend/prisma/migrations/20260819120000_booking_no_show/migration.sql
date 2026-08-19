-- No-show reporting (ad-conversion PRD phase 3f).
--
-- A flag, not a BookingStatus: the tour ran and the seat was consumed, so there
-- is no state transition to make. Operator REPORTS, admin CONFIRMS - the same
-- shape as the non-payment forfeit, because "they didn't come" is one party's
-- word about an event with no system trace.
--
-- Nullable with no default and no backfill: every existing booking is correctly
-- "no no-show reported", which is what NULL already means here.

-- AlterEnum
-- IF NOT EXISTS so a manual replay of this migration is idempotent. Safe inside
-- Prisma's transaction on PG >= 12 because the new value is not USED here.
ALTER TYPE "InboxEvent" ADD VALUE IF NOT EXISTS 'BOOKING_OPERATOR_REPORTED_NO_SHOW';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "utcNoShowReportedAt" TIMESTAMP(3),
ADD COLUMN     "noShowReason" TEXT,
ADD COLUMN     "utcNoShowConfirmedAt" TIMESTAMP(3);
