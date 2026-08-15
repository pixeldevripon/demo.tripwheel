-- Live-tour content gate (client review #19 / dashboard #80): operator edits
-- to a LIVE tour's title, description content or photos are HELD here until
-- Island Tours approves them - travellers keep seeing the approved version.

-- CreateEnum
CREATE TYPE "PendingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "tour_pending_changes" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "status" "PendingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "reviewNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_pending_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_pending_changes_tourId_status_idx" ON "tour_pending_changes"("tourId", "status");

-- CreateIndex
CREATE INDEX "tour_pending_changes_status_submittedAt_idx" ON "tour_pending_changes"("status", "submittedAt");

-- One OPEN change set per tour (Prisma cannot express a partial unique index)
CREATE UNIQUE INDEX "tour_pending_changes_one_open_per_tour" ON "tour_pending_changes"("tourId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "tour_pending_changes" ADD CONSTRAINT "tour_pending_changes_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;
