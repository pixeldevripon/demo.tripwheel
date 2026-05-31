/*
  Warnings:

  - You are about to drop the `page_content` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `translations` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "page_content";

-- DropTable
DROP TABLE "translations";

-- CreateTable
CREATE TABLE "category_page_content" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "category_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_page_content_categoryId_locale_idx" ON "category_page_content"("categoryId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "category_page_content_categoryId_locale_key" ON "category_page_content"("categoryId", "locale");

-- AddForeignKey
ALTER TABLE "category_page_content" ADD CONSTRAINT "category_page_content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
