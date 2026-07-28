-- Default the Instagram feed to the gallery layout and to being shown. These are
-- column defaults for fresh rows; existing singleton rows keep their values.

-- AlterTable
ALTER TABLE "instagram_account" ALTER COLUMN "layout" SET DEFAULT 'GALLERY';

-- AlterTable
ALTER TABLE "site_info" ALTER COLUMN "enableInstagram" SET DEFAULT true;
