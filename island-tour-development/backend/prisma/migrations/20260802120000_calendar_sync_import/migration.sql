-- CreateEnum
CREATE TYPE "calendar_platform" AS ENUM ('airbnb', 'booking_com', 'expedia', 'vrbo', 'viator', 'getyourguide', 'makemytrip', 'google_calendar', 'other');

-- CreateEnum
CREATE TYPE "calendar_import_mode" AS ENUM ('close_dates', 'close_slots', 'warn_only', 'ignore');

-- CreateEnum
CREATE TYPE "calendar_subscription_status" AS ENUM ('pending', 'syncing', 'active', 'error', 'invalid_url', 'paused', 'disconnected');

-- CreateEnum
CREATE TYPE "ical_sync_trigger" AS ENUM ('scheduled', 'manual', 'on_connect', 'retry', 'admin');

-- CreateEnum
CREATE TYPE "ical_sync_outcome" AS ENUM ('success', 'partial', 'failed', 'unchanged', 'dry_run');

-- CreateEnum
CREATE TYPE "calendar_conflict_resolution" AS ENUM ('kept_open', 'blocked');

-- CreateEnum
CREATE TYPE "availability_exception_source" AS ENUM ('manual', 'ical');

-- AlterTable
ALTER TABLE "availability_exceptions" ADD COLUMN     "externalUid" TEXT,
ADD COLUMN     "slotKey" TEXT,
ADD COLUMN     "source" "availability_exception_source" NOT NULL DEFAULT 'manual',
ADD COLUMN     "subscriptionId" TEXT;

-- CreateTable
CREATE TABLE "calendar_subscriptions" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "platform" "calendar_platform" NOT NULL,
    "platformLabel" TEXT,
    "url" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "importMode" "calendar_import_mode" NOT NULL DEFAULT 'warn_only',
    "status" "calendar_subscription_status" NOT NULL DEFAULT 'pending',
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "nextPollAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastEtag" TEXT,
    "lastModified" TEXT,
    "lastContentHash" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventCount" INTEGER NOT NULL DEFAULT 0,
    "excludeFromExport" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disconnectedAt" TIMESTAMP(3),

    CONSTRAINT "calendar_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "externalUid" TEXT NOT NULL,
    "summary" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TIME(0),
    "endTime" TIME(0),
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "sourceTimeZone" TEXT,
    "recurrenceRule" TEXT,
    "isRecurrenceInstance" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ical_sync_logs" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "trigger" "ical_sync_trigger" NOT NULL,
    "triggeredBy" TEXT,
    "outcome" "ical_sync_outcome" NOT NULL,
    "httpStatus" INTEGER,
    "eventsFound" INTEGER NOT NULL DEFAULT 0,
    "eventsAdded" INTEGER NOT NULL DEFAULT 0,
    "eventsRemoved" INTEGER NOT NULL DEFAULT 0,
    "blocksCreated" INTEGER NOT NULL DEFAULT 0,
    "blocksRemoved" INTEGER NOT NULL DEFAULT 0,
    "conflictsDetected" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "responseSizeBytes" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ical_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_conflicts" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "departureId" TEXT,
    "conflictDate" DATE NOT NULL,
    "startTime" TIME(0),
    "bookedCount" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "resolution" "calendar_conflict_resolution" NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_conflicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_subscriptions_nextPollAt_idx" ON "calendar_subscriptions"("nextPollAt");

-- CreateIndex
CREATE INDEX "calendar_subscriptions_tourId_status_idx" ON "calendar_subscriptions"("tourId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_subscriptions_tourId_urlHash_key" ON "calendar_subscriptions"("tourId", "urlHash");

-- CreateIndex
CREATE INDEX "calendar_events_subscriptionId_lastSeenAt_idx" ON "calendar_events"("subscriptionId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_subscriptionId_externalUid_startDate_key" ON "calendar_events"("subscriptionId", "externalUid", "startDate");

-- CreateIndex
CREATE INDEX "ical_sync_logs_subscriptionId_startedAt_idx" ON "ical_sync_logs"("subscriptionId", "startedAt");

-- CreateIndex
CREATE INDEX "ical_sync_logs_tourId_startedAt_idx" ON "ical_sync_logs"("tourId", "startedAt");

-- CreateIndex
CREATE INDEX "calendar_conflicts_tourId_acknowledgedAt_idx" ON "calendar_conflicts"("tourId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "calendar_conflicts_subscriptionId_createdAt_idx" ON "calendar_conflicts"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "availability_exceptions_subscriptionId_idx" ON "availability_exceptions"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "availability_exceptions_subscriptionId_externalUid_date_slo_key" ON "availability_exceptions"("subscriptionId", "externalUid", "date", "slotKey");

-- AddForeignKey
ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "calendar_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "calendar_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ical_sync_logs" ADD CONSTRAINT "ical_sync_logs_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "calendar_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_conflicts" ADD CONSTRAINT "calendar_conflicts_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "calendar_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_conflicts" ADD CONSTRAINT "calendar_conflicts_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
