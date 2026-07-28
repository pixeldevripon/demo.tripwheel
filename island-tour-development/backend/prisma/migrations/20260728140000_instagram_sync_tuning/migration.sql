-- Dashboard-configurable Instagram sync tuning: how many posts each sync pulls,
-- and how often the auto-sync runs (minutes; the scheduler maps it to a cron).

-- AlterTable
ALTER TABLE "instagram_account" ADD COLUMN     "syncFetchLimit" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1440;
