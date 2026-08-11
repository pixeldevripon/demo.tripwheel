-- WP-G / G-02: backfill EmailConsent from historical checkout newsletter
-- opt-ins (EMAIL-IMPLEMENTATION-PLAN.md §4 WP-G-1).
--
-- `bookings.newsletterOptIn` was written at checkout since launch but read by
-- nothing; the MK-1 gate (G-11) reads `email_consents`. This lifts every
-- historical opt-in into the consent table with its provenance intact:
-- source 'checkout-newsletter-opt-in' + the booking that carried the tick.
--
-- Data-only migration - NO schema change (the table is WP-A's).
--
-- Idempotent and re-runnable by construction:
--   * ON CONFLICT ("email") DO NOTHING - re-runs and duplicate addresses
--     within one run both collapse onto the existing row;
--   * ORDER BY "createdAt" ASC - among an address's several opted-in
--     bookings, the OLDEST wins the row, so provenance points at the booking
--     where consent was FIRST given (matching the runtime upsert's
--     keep-first `update: {}` semantics);
--   * lower() mirrors the runtime write - the table is keyed on the
--     canonical lowercased address (plan §2.3).
INSERT INTO "email_consents" ("id", "email", "source", "bookingId", "createdAt")
SELECT
  gen_random_uuid(),
  lower(trim(b."contactEmail")),
  'checkout-newsletter-opt-in',
  b."id",
  b."createdAt"
FROM "bookings" b
WHERE b."newsletterOptIn" = true
  AND b."contactEmail" IS NOT NULL
  AND trim(b."contactEmail") <> ''
ORDER BY b."createdAt" ASC
ON CONFLICT ("email") DO NOTHING;
