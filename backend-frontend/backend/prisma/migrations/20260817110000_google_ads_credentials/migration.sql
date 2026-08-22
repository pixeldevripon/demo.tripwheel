-- AlterTable
ALTER TABLE "integrations_configuration" ADD COLUMN     "googleAdsDeveloperToken" TEXT,
ADD COLUMN     "googleAdsCustomerId" TEXT DEFAULT '',
ADD COLUMN     "googleAdsLoginCustomerId" TEXT DEFAULT '',
ADD COLUMN     "googleAdsClientId" TEXT DEFAULT '',
ADD COLUMN     "googleAdsClientSecret" TEXT,
ADD COLUMN     "googleAdsRefreshToken" TEXT,
ADD COLUMN     "googleAdsConversionActionId" TEXT DEFAULT '';
