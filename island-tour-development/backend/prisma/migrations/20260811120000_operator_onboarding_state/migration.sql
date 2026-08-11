-- WP-C operator onboarding state (EMAIL-IMPLEMENTATION-PLAN §2.4).
-- Three nullable timestamp columns on operators ONLY — no new tables, no enum
-- changes (WP-A owns the email tables; the verification enum already exists).
ALTER TABLE "operators"
  ADD COLUMN "verificationDecidedAt" TIMESTAMP(3),
  ADD COLUMN "firstTourLiveAt" TIMESTAMP(3),
  ADD COLUMN "salesPendingReminderAt" TIMESTAMP(3);
