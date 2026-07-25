-- Rename the (unused) gclid store from clickId -> gclid to match master E.8 / 8.3.
-- RENAME (not drop+add) so any captured value is preserved.
ALTER TABLE "bookings" RENAME COLUMN "clickId" TO "gclid";
