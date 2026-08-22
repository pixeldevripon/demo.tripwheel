-- Pastel #22: the "Instant confirmation" checkbox is removed from the Booking
-- rules step and from the tour write DTOs - every tour is instant confirmation
-- (the off state never had a request-to-book flow behind it: no pending state,
-- no emails, no seat-hold rules). Heal any row switched off while the checkbox
-- existed, so no tour is left stuck in an unreachable off state that
-- contradicts the "Confirmed in seconds" promise on consumer surfaces.
-- The column stays (default true): OCTO and the derived attributes read it.
UPDATE "tours"
SET "instantConfirmation" = true
WHERE "instantConfirmation" = false;
