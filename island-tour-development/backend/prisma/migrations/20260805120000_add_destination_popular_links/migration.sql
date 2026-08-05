-- Admin-curated "Popular" quick links under the destination hero search (mck-02).
-- At most four per island; each row names exactly one page in that island's flat
-- /{destination}/{slug} namespace - a hub, a collection or a category - the same
-- polymorphic-with-FKs shape home_page_editorial_cards uses.
--
-- Curation rather than ranking: no order over live data reproduces the founder's
-- four, because Off-Road Tours is fifth by sortOrder and joint-fourth by tour
-- count and so fell outside a row of four however it was sorted.
--
-- Every link is still re-gated at render against its target's own visibility
-- rule, so curation chooses WHICH pages, never whether one exists.
--
-- CASCADE, not SET NULL: a link whose target is gone has nothing to degrade to,
-- unlike an editorial CARD, which keeps its photo.
CREATE TABLE "destination_popular_links" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "hubId" TEXT,
    "collectionId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_popular_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "destination_popular_links_destinationId_idx"
  ON "destination_popular_links"("destinationId");

-- One target per slot. Deliberately NOT unique on the target: the resolver
-- dedupes, so a mid-edit save can never be rejected by the database.
CREATE UNIQUE INDEX "destination_popular_links_destinationId_displayOrder_key"
  ON "destination_popular_links"("destinationId", "displayOrder");

ALTER TABLE "destination_popular_links"
  ADD CONSTRAINT "destination_popular_links_destinationId_fkey"
  FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "destination_popular_links"
  ADD CONSTRAINT "destination_popular_links_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "destination_popular_links"
  ADD CONSTRAINT "destination_popular_links_hubId_fkey"
  FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "destination_popular_links"
  ADD CONSTRAINT "destination_popular_links_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
