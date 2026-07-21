-- CreateEnum
CREATE TYPE "InstagramLayout" AS ENUM ('GRID', 'GALLERY');

-- AlterTable
ALTER TABLE "instagram_account" ADD COLUMN     "layout" "InstagramLayout" NOT NULL DEFAULT 'GRID';

-- AlterTable
ALTER TABLE "instagram_posts" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

