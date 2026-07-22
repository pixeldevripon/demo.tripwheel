-- Admin-controlled cadence for the post-tour review invitation.
-- `enabled` defaults to FALSE: a job that mails real customers is switched on
-- deliberately by a person, never merely by deploying the code that contains it.


-- CreateTable
CREATE TABLE "review_request_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "firstSendLocalHour" INTEGER NOT NULL DEFAULT 10,
    "firstSendDelayDays" INTEGER NOT NULL DEFAULT 1,
    "reminderAfterDays" INTEGER NOT NULL DEFAULT 5,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "giveUpAfterDays" INTEGER NOT NULL DEFAULT 30,
    "batchSize" INTEGER NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_request_settings_pkey" PRIMARY KEY ("id")
);

