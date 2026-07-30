-- Island Tours' own apartment: the promo card at the bottom of the thank-you
-- page, moving from hardcoded frontend constants to admin-managed content.
--
-- The row is SEEDED HERE rather than only in prisma/seed.ts. Two reasons:
--   1. `seed.ts` does not run on production deploys (`prisma migrate deploy`
--      only applies migrations), so a migration-only environment would ship the
--      dynamic card with nothing in it and the section would silently vanish.
--   2. "Pre-seeded" is the whole point of the feature request: an admin edits
--      existing content, never authors it from an empty form before the section
--      works at all.
--
-- The values below are exactly what the frontend used to hardcode in
-- `lib/thank-you/thank-you.ts` (APARTMENT_PROMO), so this migration is
-- visually a no-op on the public page.

CREATE TABLE "hotel" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "bookingUrl" TEXT,
    "rating" DECIMAL(2,1),
    "reviewCount" INTEGER,
    "sleeps" INTEGER,
    "pricePerNight" DECIMAL(10,2),
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hotel_translations" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "eyebrow" TEXT,
    "areaLabel" TEXT,
    "title" TEXT,
    "description" TEXT,
    "ctaLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "sourceHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hotel_translations_hotelId_locale_key"
    ON "hotel_translations"("hotelId", "locale");

CREATE INDEX "hotel_translations_hotelId_locale_idx"
    ON "hotel_translations"("hotelId", "locale");

ALTER TABLE "hotel_translations"
    ADD CONSTRAINT "hotel_translations_hotelId_fkey"
    FOREIGN KEY ("hotelId") REFERENCES "hotel"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Pre-seed ────────────────────────────────────────────────────────────────
-- ON CONFLICT DO NOTHING on both inserts so a re-run (or a database that has
-- already been seeded by prisma/seed.ts) never overwrites an admin's edits.

INSERT INTO "hotel" (
    "id", "isEnabled", "imageUrl", "bookingUrl",
    "rating", "reviewCount", "sleeps", "pricePerNight", "currency",
    "createdAt", "updatedAt"
) VALUES (
    'default', true,
    'https://picsum.photos/seed/typ-apartment/1176/758',
    'https://www.airbnb.com',
    4.8, 1738, 4, 160.00, 'USD',
    now(), now()
)
ON CONFLICT ("id") DO NOTHING;

-- `eyebrow` and `ctaLabel` are deliberately left NULL: the bundled dictionary
-- already carries "🌴 OUR APARTMENT" and "See availability on Airbnb" in all 7
-- locales, and a NULL here means "keep that translated default" - which is
-- strictly better than seeding one English string over six good translations.
INSERT INTO "hotel_translations" (
    "id", "hotelId", "locale",
    "eyebrow", "areaLabel", "title", "description", "ctaLabel",
    "isMachineTranslated", "updatedAt"
) VALUES (
    gen_random_uuid()::text, 'default', 'en',
    NULL,
    'Jan Thiel',
    'Palm Suite Apartment',
    E'Quiet, modern, 5min from the beach\nOwned and hosted by Island Tours',
    NULL,
    false, now()
)
ON CONFLICT ("hotelId", "locale") DO NOTHING;
