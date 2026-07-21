-- CreateEnum
CREATE TYPE "InstagramSource" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "InstagramMediaType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM');

-- AlterTable
ALTER TABLE "site_info" DROP COLUMN "instagramWidgetId";

-- CreateTable
CREATE TABLE "instagram_account" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "username" TEXT DEFAULT '',
    "profileUrl" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_posts" (
    "id" TEXT NOT NULL,
    "source" "InstagramSource" NOT NULL DEFAULT 'MANUAL',
    "igMediaId" TEXT,
    "mediaType" "InstagramMediaType" NOT NULL DEFAULT 'IMAGE',
    "permalink" TEXT DEFAULT '',
    "caption" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "altText" TEXT,
    "postedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "destinationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_posts_igMediaId_key" ON "instagram_posts"("igMediaId");

-- CreateIndex
CREATE INDEX "instagram_posts_isActive_displayOrder_idx" ON "instagram_posts"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "instagram_posts_destinationId_idx" ON "instagram_posts"("destinationId");

-- AddForeignKey
ALTER TABLE "instagram_posts" ADD CONSTRAINT "instagram_posts_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

