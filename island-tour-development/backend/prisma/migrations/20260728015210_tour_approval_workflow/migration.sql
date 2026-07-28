-- CreateEnum
CREATE TYPE "TourApprovalStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "approvalStatus" "TourApprovalStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- Backfill: every tour that already reached LIVE (or is paused from LIVE) was
-- de-facto approved under the old operator-self-publish regime - nothing
-- currently live is disturbed by the new gate.
UPDATE "tours"
SET "approvalStatus" = 'APPROVED'
WHERE "status" IN ('LIVE', 'PAUSED');
