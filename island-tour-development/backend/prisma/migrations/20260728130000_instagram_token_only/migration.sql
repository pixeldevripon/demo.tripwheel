-- Instagram feed is now token-only: the admin pastes a long-lived access token
-- in the dashboard (configAccessToken), and there is no OAuth flow. The App ID /
-- Secret / Redirect URI columns that backed the removed OAuth connect are dropped.

-- AlterTable
ALTER TABLE "instagram_account" DROP COLUMN "configAppId",
DROP COLUMN "configAppSecret",
DROP COLUMN "configRedirectUri";
