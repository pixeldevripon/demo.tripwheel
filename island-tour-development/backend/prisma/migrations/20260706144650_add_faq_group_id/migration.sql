-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "faqGroupId" TEXT;

-- CreateIndex
CREATE INDEX "faqs_pageType_entityId_faqGroupId_idx" ON "faqs"("pageType", "entityId", "faqGroupId");
