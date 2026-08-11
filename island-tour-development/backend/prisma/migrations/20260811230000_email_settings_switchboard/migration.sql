-- WP-H (EMAIL-IMPLEMENTATION-PLAN.md §4, checklist H-01/H-02/H-08):
--   1. the email-programme switchboard singleton — every column nullable on
--      purpose (null = built-in default / env fallback, zero-risk rollout);
--   2. the [status, createdAt] index on email_sends — the email centre's
--      global activity list filters by status in SQL (the D-29 rule).

-- CreateTable
CREATE TABLE "public"."email_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "marketingEnabled" BOOLEAN,
    "onboardingEnabled" BOOLEAN,
    "calendarEmailEnabled" BOOLEAN,
    "ob8PartnerOffer" BOOLEAN,
    "salesEmail" TEXT,
    "mailReplyTo" TEXT,
    "ob6ReplyTo" TEXT,
    "ob3DelayHours" INTEGER,
    "ob4DelayDays" INTEGER,
    "ob6DelayDays" INTEGER,
    "ob7AfterLiveDays" INTEGER,
    "ob8AfterLiveDays" INTEGER,
    "pendingReminderBusinessDays" INTEGER,
    "windowWeekdays" TEXT,
    "windowStartHour" INTEGER,
    "windowEndHour" INTEGER,
    "mk1DelayHours" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_sends_status_createdAt_idx" ON "public"."email_sends"("status" ASC, "createdAt" ASC);
