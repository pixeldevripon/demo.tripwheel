-- The AI-translation unit for hub content sections is keyed by
-- (hubId, locale, sectionType, displayOrder) - there is no FK group key on
-- the table, so this identity must be unique for translations to land on the
-- right block. The dashboard's save already regenerates displayOrder
-- sequentially per type; this makes the DB enforce what the design assumes.
-- (Verified duplicate-free before adding.)
CREATE UNIQUE INDEX "hub_content_sections_hubId_locale_sectionType_displayOrder_key"
ON "hub_content_sections"("hubId", "locale", "sectionType", "displayOrder");
