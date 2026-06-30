-- AlterTable
ALTER TABLE "tours" ADD COLUMN     "likelyToSellOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "likelyToSellOutOverride" BOOLEAN;
