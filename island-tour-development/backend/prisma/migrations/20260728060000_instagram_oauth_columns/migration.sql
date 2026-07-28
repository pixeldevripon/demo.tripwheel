-- CreateEnum
CREATE TYPE "InstagramSyncStatus" AS ENUM ('OK', 'PARTIAL', 'FAILED', 'EXPIRING');

-- AlterTable
ALTER TABLE "instagram_account" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "igUserId" TEXT,
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncStatus" "InstagramSyncStatus",
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);

