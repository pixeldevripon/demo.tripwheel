-- Email programme spine (EMAIL-IMPLEMENTATION-PLAN.md §2.1–§2.3, WP-A).
-- CREATE-only by design: new enums + four new tables. No existing table or
-- type is touched (prisma/operators.prisma belongs to WP-C's migration).
--
-- Hand-written rather than `migrate dev`-generated: the schema deliberately
-- drifts from the live DB on two enums (InboxEvent CALENDAR_SYNC_*,
-- calendar_feed_kind 'channel' — leftovers of the reverted iCal layer that
-- Postgres cannot drop from an enum), so a generated diff would try to
-- rebuild those types. This file follows the baseline's SQL conventions.

-- CreateEnum
CREATE TYPE "public"."EmailTemplateKey" AS ENUM ('BK1_CONFIRMATION', 'BK2_PRE_TOUR_REMINDER', 'BK3_REVIEW_REQUEST', 'BK3R_REVIEW_REMINDER', 'MK1_NEXT_ADVENTURE', 'CX1_CANCELLATION', 'OB1_VERIFY_EMAIL', 'OB2_WELCOME_AGREEMENT', 'OB2A_APPROVED', 'OB3_FIRST_TOUR_HOWTO', 'OB4_BUILD_IT_WITH_YOU', 'OB5_TOUR_LIVE', 'OB6_CHECK_IN', 'OB7_CONNECT_CALENDAR', 'OB8_PAGE_STRONGER', 'INT1_NEW_OPERATOR', 'INT1R_PENDING_REMINDER', 'INT2_NEW_TOUR');

-- CreateEnum
CREATE TYPE "public"."EmailStream" AS ENUM ('TRANSACTIONAL', 'LIFECYCLE', 'MARKETING', 'INTERNAL');

-- CreateEnum
CREATE TYPE "public"."EmailSendStatus" AS ENUM ('SENT', 'FAILED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "public"."EmailAudience" AS ENUM ('TRAVELLER', 'OPERATOR');

-- CreateTable
CREATE TABLE "public"."email_sends" (
    "id" TEXT NOT NULL,
    "templateKey" "public"."EmailTemplateKey" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "stream" "public"."EmailStream" NOT NULL,
    "status" "public"."EmailSendStatus" NOT NULL,
    "locale" TEXT,
    "providerMessageId" TEXT,
    "suppressedReason" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_opt_outs" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "audience" "public"."EmailAudience" NOT NULL,
    "stream" "public"."EmailStream" NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_opt_outs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_consents" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_unsubscribe_tokens" (
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "audience" "public"."EmailAudience" NOT NULL,
    "stream" "public"."EmailStream" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_unsubscribe_tokens_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_templateKey_scopeId_key" ON "public"."email_sends"("templateKey" ASC, "scopeId" ASC);

-- CreateIndex
CREATE INDEX "email_sends_toEmail_createdAt_idx" ON "public"."email_sends"("toEmail" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "email_sends_scopeId_createdAt_idx" ON "public"."email_sends"("scopeId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "email_opt_outs_email_audience_stream_key" ON "public"."email_opt_outs"("email" ASC, "audience" ASC, "stream" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "email_consents_email_key" ON "public"."email_consents"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "email_unsubscribe_tokens_email_audience_stream_key" ON "public"."email_unsubscribe_tokens"("email" ASC, "audience" ASC, "stream" ASC);
