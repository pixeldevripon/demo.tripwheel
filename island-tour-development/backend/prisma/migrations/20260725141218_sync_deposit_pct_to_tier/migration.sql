-- LD24 data fix (founder 2026-07-25): deposit_pct is TIER-DRIVEN - the deposit
-- collected at checkout IS the platform commission, so it must equal the tier
-- rate. Tier changes previously updated tierKey/commissionTier/tierRank but
-- never depositPct, leaving promoted tours (e.g. premium 30%) collecting the
-- default 20% deposit and under-collecting commission. Code now syncs all four
-- on every tier write; this backfills the rows that drifted.
-- Existing BOOKINGS keep their snapshotted deposit/commission (never retroactive).
UPDATE "tours"
   SET "depositPct" = "commissionTier"
 WHERE "depositPct" <> "commissionTier";
