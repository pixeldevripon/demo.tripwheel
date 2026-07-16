-- Data backfill: re-anchor the per-person "From $X per person" display price on
-- the DEFAULT participant age band (the adult reference price) instead of the
-- cheapest band. Tours with no default flagged fall back to the cheapest
-- participant band (unchanged value); tours without participant bands keep
-- their basePrice-derived anchor. UNIT tours are untouched (basePrice anchor).
UPDATE "tours" t
SET "priceFrom" = anchor."price"
FROM (
    SELECT DISTINCT ON ("tourId") "tourId", "price"
    FROM "tour_age_bands"
    WHERE "participation" = 'PARTICIPANT'
    ORDER BY "tourId", "isDefault" DESC, "price" ASC
) anchor
WHERE t."id" = anchor."tourId"
  AND t."pricingModel" = 'PER_PERSON';
