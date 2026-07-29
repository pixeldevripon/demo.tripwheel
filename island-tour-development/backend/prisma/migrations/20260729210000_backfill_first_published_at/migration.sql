-- `firstPublishedAt` existed but nothing ever wrote it: `ToursService.publish`
-- stamped `publishedAt` only. Every tour published through the app therefore
-- carries NULL, which the tier engine reads as "inside the provisional window"
-- (`isInProvisionalWindow` returns true for null) and so exempts from demotion
-- indefinitely.
--
-- Backfill from the current spell's publish date, which is the closest true
-- value we hold. Tours that were never published keep NULL - that is correct.
UPDATE "tours"
SET "firstPublishedAt" = "publishedAt"
WHERE "firstPublishedAt" IS NULL
  AND "publishedAt" IS NOT NULL;
