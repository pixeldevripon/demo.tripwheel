-- Refund status unification (2026-07-26): a settled refund is REFUNDED, not
-- SUCCEEDED, and the ORIGINAL charge row flips to REFUNDED with it - so the
-- payments list never shows a green "Succeeded" charge on a refunded booking.
-- Code now writes this convention (executeRefund / reconcileRefundRow); this
-- backfills the rows written before it.

-- 1) Settled REFUND rows written as SUCCEEDED become REFUNDED.
UPDATE "payments"
   SET "status" = 'REFUNDED'
 WHERE "kind" = 'REFUND'
   AND "status" = 'SUCCEEDED';

-- 2) Original charge rows whose refund settled: flip SUCCEEDED -> REFUNDED.
--    Matched by booking + the shared PaymentIntent id (REFUND rows carry the
--    charge's intentId).
UPDATE "payments" p
   SET "status" = 'REFUNDED'
 WHERE p."kind" <> 'REFUND'
   AND p."status" = 'SUCCEEDED'
   AND EXISTS (
     SELECT 1
       FROM "payments" r
      WHERE r."bookingId" = p."bookingId"
        AND r."kind" = 'REFUND'
        AND r."status" = 'REFUNDED'
        AND r."intentId" IS NOT DISTINCT FROM p."intentId"
   );
