-- One curation table, two surfaces. The hero's "Popular" line and the search
-- field's zero-state panel (master 5.10) both curate the same three page types
-- (category / hub / collection) out of the island's flat namespace, so they
-- share the row shape, the render-time re-gating and the replace-all save
-- instead of each growing its own table.
CREATE TYPE "PopularLinkPlacement" AS ENUM ('HERO_POPULAR', 'SEARCH_PANEL');

-- DEFAULT 'HERO_POPULAR' backfills every existing row to the placement it was
-- written for, so the hero row on a curated island is byte-identical after this
-- migration.
ALTER TABLE "destination_popular_links"
  ADD COLUMN "placement" "PopularLinkPlacement" NOT NULL DEFAULT 'HERO_POPULAR';

-- Slot numbers restart at zero per placement, so the uniqueness that keeps two
-- concurrent saves from interleaving has to be scoped to the placement too.
-- Without this the first SEARCH_PANEL row would collide with hero slot 0.
DROP INDEX "destination_popular_links_destinationId_displayOrder_key";

CREATE UNIQUE INDEX "destination_popular_links_destinationId_placement_displayOr_key"
  ON "destination_popular_links"("destinationId", "placement", "displayOrder");

-- Every read is "this island's rows for THIS placement", never all of them.
DROP INDEX "destination_popular_links_destinationId_idx";

CREATE INDEX "destination_popular_links_destinationId_placement_idx"
  ON "destination_popular_links"("destinationId", "placement");
