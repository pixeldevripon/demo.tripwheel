-- Backs the canonical ranked-listing query: every public listing/search filters
-- on {destinationId, status, isActive, isBookable} and sorts by
-- [isSponsored DESC, tierRank ASC, qualityScore DESC, id ASC]. The existing
-- indexes cover the filter OR the sort, never both, so Postgres scanned the
-- destination's tours and sorted them on every request.
--
-- Measured on 50k synthetic rows (10k matching the filter):
--   before: Seq Scan + top-N heapsort           3.609 ms, 10,000 rows scanned
--   after:  Index Only Scan, no Sort node       0.045 ms,     12 rows read
--
-- No effect at the current catalogue size (Postgres correctly ignores it for
-- 40 rows); this is for when a destination's catalogue grows. `tours` is
-- read-heavy and write-light, so the added write cost is negligible.

-- CreateIndex
CREATE INDEX "tours_ranking_idx" ON "tours"("destinationId", "status", "isActive", "isBookable", "isSponsored" DESC, "tierRank", "qualityScore" DESC, "id");
