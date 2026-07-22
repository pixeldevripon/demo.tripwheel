-- Reviews Phase 1: moderation backbone (master E.7 expansion + LD36 / LD37).
--
-- HAND-WRITTEN, NOT GENERATED. `prisma migrate diff` proposed DROP COLUMN for
-- `operatorResponse` / `operatorRespondedAt` and ADD COLUMN for
-- `responseText` / `responseAt`, which would have destroyed 44 published
-- operator responses. This file RENAMEs them instead and backfills the new
-- `responseAuthor` discriminator. Everything else matches the generated diff.

-- ─── Enums ───────────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "ReviewerType" AS ENUM ('COUPLE', 'FAMILY', 'FRIENDS', 'SOLO');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('NATIVE', 'IMPORTED_OPERATOR', 'IMPORTED_THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ReviewResponseAuthor" AS ENUM ('PLATFORM', 'OPERATOR');

-- CreateEnum
CREATE TYPE "ReviewFlagReason" AS ENUM ('FAKE', 'ABUSIVE', 'OFF_TOPIC', 'PERSONAL_DATA', 'NOT_A_CUSTOMER');

-- CreateEnum
CREATE TYPE "ReviewFlagStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "ReviewModerationStatus" ADD VALUE 'HELD';

-- ─── reviews: rename the response columns, preserving their data ─────────────

-- AlterTable (rename, NOT drop-and-add)
ALTER TABLE "reviews" RENAME COLUMN "operatorResponse" TO "responseText";
ALTER TABLE "reviews" RENAME COLUMN "operatorRespondedAt" TO "responseAt";

-- AlterTable
ALTER TABLE "reviews"
ADD COLUMN     "departureId" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responseAuthor" "ReviewResponseAuthor",
ADD COLUMN     "reviewerType" "ReviewerType",
ADD COLUMN     "source" "ReviewSource" NOT NULL DEFAULT 'NATIVE',
ADD COLUMN     "themeTags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill the authorship discriminator for responses that predate it. Every
-- existing response was written through the old operator-or-admin endpoint, so
-- OPERATOR is the honest label; LD37 makes PLATFORM the default going forward.
-- Rows with no response keep a NULL author, which is what "no response" means.
UPDATE "reviews" SET "responseAuthor" = 'OPERATOR' WHERE "responseText" IS NOT NULL;

-- ─── review_moderation_logs ──────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "review_moderation_logs" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" "ReviewModerationStatus",
    "toStatus" "ReviewModerationStatus",
    "isDeletion" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_moderation_logs_pkey" PRIMARY KEY ("id")
);

-- Seed one genesis row per existing review so the audit trail is not silently
-- empty for pre-Phase-1 records. `actorId` is NULL and `fromStatus` is NULL:
-- we genuinely do not know who set these or what they were before, and
-- inventing an actor would be worse than recording the gap.
INSERT INTO "review_moderation_logs" ("id", "reviewId", "actorId", "fromStatus", "toStatus", "isDeletion", "reason", "createdAt")
SELECT gen_random_uuid()::text, "id", NULL, NULL, "moderationStatus", false,
       'Backfilled at Phase 1 migration; pre-audit-trail state', "createdAt"
FROM "reviews";

-- ─── review_flags ────────────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "review_flags" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "flaggedByUserId" TEXT NOT NULL,
    "reason" "ReviewFlagReason" NOT NULL,
    "note" TEXT,
    "status" "ReviewFlagStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_flags_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

-- CreateIndex
CREATE INDEX "review_moderation_logs_reviewId_createdAt_idx" ON "review_moderation_logs"("reviewId", "createdAt");

-- CreateIndex
CREATE INDEX "review_moderation_logs_actorId_idx" ON "review_moderation_logs"("actorId");

-- CreateIndex
CREATE INDEX "review_flags_status_createdAt_idx" ON "review_flags"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_flags_reviewId_flaggedByUserId_key" ON "review_flags"("reviewId", "flaggedByUserId");

-- CreateIndex
CREATE INDEX "reviews_moderationStatus_createdAt_idx" ON "reviews"("moderationStatus", "createdAt");

-- CreateIndex
CREATE INDEX "reviews_departureId_idx" ON "reviews"("departureId");

-- ─── Foreign keys ────────────────────────────────────────────────────────────

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_departureId_fkey" FOREIGN KEY ("departureId") REFERENCES "departures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_moderation_logs" ADD CONSTRAINT "review_moderation_logs_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_flags" ADD CONSTRAINT "review_flags_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
