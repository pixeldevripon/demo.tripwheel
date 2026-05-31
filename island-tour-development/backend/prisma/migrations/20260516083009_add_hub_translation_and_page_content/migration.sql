/*
  Warnings:

  - You are about to drop the `hub_content` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "hub_content" DROP CONSTRAINT "hub_content_hubId_fkey";

-- DropTable
DROP TABLE "hub_content";

-- CreateTable
CREATE TABLE "hub_translations" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hub_page_content" (
    "id" TEXT NOT NULL,
    "hubId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "hub_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hub_translations_hubId_locale_idx" ON "hub_translations"("hubId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_translations_hubId_locale_key" ON "hub_translations"("hubId", "locale");

-- CreateIndex
CREATE INDEX "hub_page_content_hubId_locale_idx" ON "hub_page_content"("hubId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "hub_page_content_hubId_locale_key" ON "hub_page_content"("hubId", "locale");

-- AddForeignKey
ALTER TABLE "hub_translations" ADD CONSTRAINT "hub_translations_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub_page_content" ADD CONSTRAINT "hub_page_content_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
