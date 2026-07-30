-- CreateEnum
CREATE TYPE "InboxCategory" AS ENUM ('TOURS', 'BOOKINGS', 'CANCELLATIONS', 'PAYMENTS', 'REVIEWS', 'SETTLEMENTS', 'PROMOTION', 'TEAM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InboxEvent" AS ENUM ('TOUR_SUBMITTED_FOR_REVIEW', 'TOUR_APPROVED', 'TOUR_CHANGES_REQUESTED', 'TOUR_PUBLISHED', 'TOUR_UNLISTED_NO_DEPARTURES', 'SPOTLIGHT_REQUESTED', 'SPOTLIGHT_APPROVED', 'SPOTLIGHT_REJECTED', 'TIER_DEMOTED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLATION_REQUESTED', 'BOOKING_OPERATOR_REPORTED_CANCELLATION', 'BOOKING_OPERATOR_REPORTED_NON_PAYMENT', 'BOOKING_CANCELLED', 'REVIEW_SUBMITTED', 'REVIEW_PUBLISHED', 'SETTLEMENT_STATEMENT_READY', 'TEAM_SEAT_INVITED', 'TEAM_SEAT_ACTIVATED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "inboxDigestShownAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "inbox_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT,
    "category" "InboxCategory" NOT NULL,
    "event" "InboxEvent" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "url" TEXT NOT NULL,
    "actorUserId" TEXT,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbox_notifications_userId_readAt_idx" ON "inbox_notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "inbox_notifications_userId_createdAt_idx" ON "inbox_notifications"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_notifications_userId_dedupeKey_key" ON "inbox_notifications"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_notifications" ADD CONSTRAINT "inbox_notifications_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

