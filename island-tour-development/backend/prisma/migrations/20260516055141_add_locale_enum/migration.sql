/*
  Warnings:

  - Changed the type of `locale` on the `category_page_content` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locale` on the `category_translations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locale` on the `faqs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locale` on the `hub_content` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locale` on the `tour_highlight_translations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locale` on the `tour_inclusion_translations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `locale` on the `trip_translations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'es', 'nl', 'pt', 'fr', 'de', 'zh');

-- AlterTable
ALTER TABLE "category_page_content" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- AlterTable
ALTER TABLE "category_translations" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- AlterTable
ALTER TABLE "faqs" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- AlterTable
ALTER TABLE "hub_content" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- AlterTable
ALTER TABLE "tour_highlight_translations" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- AlterTable
ALTER TABLE "tour_inclusion_translations" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- AlterTable
ALTER TABLE "trip_translations" DROP COLUMN "locale",
ADD COLUMN     "locale" "Locale" NOT NULL;

-- CreateIndex
CREATE INDEX "category_page_content_categoryId_locale_idx" ON "category_page_content"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_page_content_categoryId_locale_key" ON "category_page_content"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "category_translations_categoryId_locale_idx" ON "category_translations"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_translations_categoryId_locale_key" ON "category_translations"("categoryId", "locale");

-- CreateIndex
CREATE INDEX "faqs_pageType_entityId_locale_idx" ON "faqs"("pageType", "entityId", "locale");

-- CreateIndex
CREATE INDEX "hub_content_hubId_locale_idx" ON "hub_content"("hubId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_content_hubId_locale_field_key" ON "hub_content"("hubId", "locale", "field");

-- CreateIndex
CREATE UNIQUE INDEX "tour_highlight_translations_highlightId_locale_key" ON "tour_highlight_translations"("highlightId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "tour_inclusion_translations_inclusionId_locale_key" ON "tour_inclusion_translations"("inclusionId", "locale");

-- CreateIndex
CREATE INDEX "trip_translations_tripId_locale_idx" ON "trip_translations"("tripId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "trip_translations_tripId_locale_key" ON "trip_translations"("tripId", "locale");
