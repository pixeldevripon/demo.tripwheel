-- Fill in the seeded hotel's eyebrow and button labels.
--
-- They were originally left NULL, which renders the site's own translated label
-- and is correct behaviour - but it leaves the editor showing two empty boxes,
-- and an admin cannot tell a field that is deliberately inheriting from one
-- nobody has filled in. Written out they are editable, and the AI pipeline
-- translates them into the other six locales like any other copy.
--
-- NO EMOJI in the eyebrow: the palm that opens that line is chrome, rendered by
-- the card itself in every language. It used to live in the seven i18n
-- dictionaries; it now lives in one component, so nothing stored here carries it.
--
-- Scoped to rows that are still NULL, so an admin who has already typed their own
-- labels keeps them.
UPDATE "hotel_translations" t
SET "eyebrow" = COALESCE(t."eyebrow", 'OUR APARTMENT'),
    "ctaLabel" = COALESCE(t."ctaLabel", 'See availability on Airbnb')
FROM "hotels" h
WHERE t."hotelId" = h."id"
  AND h."isSeeded" = true
  AND t."locale" = 'en'
  AND (t."eyebrow" IS NULL OR t."ctaLabel" IS NULL);
