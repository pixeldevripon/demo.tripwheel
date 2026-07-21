/*
  Warnings:

  - You are about to drop the column `destinationId` on the `home_page_editorial_cards` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "home_page_editorial_cards" DROP CONSTRAINT "home_page_editorial_cards_destinationId_fkey";

-- AlterTable
ALTER TABLE "home_page_editorial_cards" DROP COLUMN "destinationId",
ADD COLUMN     "categoryId" TEXT;

-- AddForeignKey
ALTER TABLE "home_page_editorial_cards" ADD CONSTRAINT "home_page_editorial_cards_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
