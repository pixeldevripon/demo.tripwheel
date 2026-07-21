-- CreateTable
CREATE TABLE "page_content_sections" (
    "id" TEXT NOT NULL,
    "pageType" "FaqPageType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "sectionGroupId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "sectionKey" TEXT,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "anchor" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "page_content_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_content_sections_pageType_entityId_locale_displayOrder_idx" ON "page_content_sections"("pageType", "entityId", "locale", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "page_content_sections_pageType_entityId_sectionGroupId_loca_key" ON "page_content_sections"("pageType", "entityId", "sectionGroupId", "locale");
