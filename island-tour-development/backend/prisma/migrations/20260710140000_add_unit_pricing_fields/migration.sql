-- UNIT (whole-asset / charter) pricing: base price covers `unitIncludedGuests`
-- travelers; each additional traveler up to maxPartySize costs `extraPersonPrice`.
-- Both nullable; only set for pricingModel = UNIT.
ALTER TABLE "tours" ADD COLUMN "unitIncludedGuests" INTEGER;
ALTER TABLE "tours" ADD COLUMN "extraPersonPrice" DECIMAL(10,2);
