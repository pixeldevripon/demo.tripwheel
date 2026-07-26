-- Settlements rework (founder decision 2026-07-26): the ledger records ONLY
-- paid_in_full bookings - the one model where Island Tours holds money it owes
-- the operator - and PAID_OUT is a MANUAL admin confirmation ("Mark as paid"
-- after the actual bank transfer), never a cron flip.
--
-- 1) Drop the self-settling noise rows (deposit models net ~0: the deposit IS
--    the commission, nothing ever moves; operator_full takes no platform money).
DELETE FROM "settlements"
 WHERE "paymentModel" <> 'PAID_IN_FULL';

-- 2) Every existing PAID_OUT row was flipped by the old hourly auto-release
--    cron - no human ever confirmed a transfer, so the ledger must not claim
--    one happened. Revert them to RECORDED (payout due); admins re-mark them
--    as they actually pay. REVERSED rows (cancelled bookings) stay reversed.
UPDATE "settlements"
   SET "status" = 'RECORDED',
       "operatorPayout" = NULL,
       "settledAt" = NULL
 WHERE "status" = 'PAID_OUT';
