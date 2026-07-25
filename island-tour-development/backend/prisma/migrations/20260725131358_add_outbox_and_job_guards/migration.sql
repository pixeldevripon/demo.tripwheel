-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "utcConfirmationEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "utcOperatorNoticeSentAt" TIMESTAMP(3),
ADD COLUMN     "utcReminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbox_events_dispatchedAt_idx" ON "outbox_events"("dispatchedAt");
