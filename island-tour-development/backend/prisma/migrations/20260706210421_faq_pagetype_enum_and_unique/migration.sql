-- Convert faqs.pageType from text to a proper enum
CREATE TYPE "FaqPageType" AS ENUM ('category', 'hub', 'destination', 'tour', 'collection');

ALTER TABLE "faqs"
  ALTER COLUMN "pageType" TYPE "FaqPageType"
  USING ("pageType"::"FaqPageType");

-- Replace the plain (pageType, entityId, faqGroupId) index with a compound unique
-- that also includes locale: one row per locale within a FAQ group. NULL faqGroupId
-- rows (legacy) never collide because Postgres treats NULLs as distinct.
DROP INDEX IF EXISTS "faqs_pageType_entityId_faqGroupId_idx";

CREATE UNIQUE INDEX "faqs_pageType_entityId_faqGroupId_locale_key"
  ON "faqs"("pageType", "entityId", "faqGroupId", "locale");
