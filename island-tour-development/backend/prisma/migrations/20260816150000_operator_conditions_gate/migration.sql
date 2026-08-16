-- Pastel #80 / MCK-20: operator-conditions gate at the checkout commit step.
-- A tour is either ungated (kind null - the whole catalog today), gated on a
-- per-operator conditions DOCUMENT, or gated on 2-6 first-person
-- ACKNOWLEDGMENT items carried by the tour itself. Acceptance evidence
-- (timestamp + document version; identity is the booking's own contact) lands
-- on the booking, and the payment-intent endpoint refuses a flagged booking
-- without it. All conditions text is placeholder pending legal workstream
-- D1/D2.

CREATE TYPE "OperatorTermsKind" AS ENUM ('DOCUMENT', 'ACKNOWLEDGMENT');

ALTER TABLE "operators"
  ADD COLUMN "termsDocument" JSONB,
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "termsEffectiveDate" TIMESTAMP(3);

ALTER TABLE "tours"
  ADD COLUMN "operatorTermsKind" "OperatorTermsKind",
  ADD COLUMN "acknowledgmentItems" JSONB;

ALTER TABLE "bookings"
  ADD COLUMN "operatorTermsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "operatorTermsVersion" TEXT;
