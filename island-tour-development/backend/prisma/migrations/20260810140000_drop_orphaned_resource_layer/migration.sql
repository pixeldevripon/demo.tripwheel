-- Hardening F10 (BOOKING-CONCURRENCY-HARDENING.md) - the product decision,
-- taken by the founder 2026-08-10: shared-resource (cross-tour boat/vehicle)
-- capacity is NOT a launch requirement, so the orphaned resource layer goes.
--
-- History: migration 20260802170000_resource_layer created these tables;
-- commit 515a0e7 reverted the entire layer the same day (models, allocation
-- util, docs) but kept the migration because prod had already run it. Since
-- then the two tables and two enums have existed with no model, no code and
-- no rows - schema drift that every future baseline would have had to carry.
--
-- The gap the layer was for still exists and is now FILED, not forgotten:
-- two tours sharing one physical boat have independent departure rows, and
-- nothing prevents selling both for the same time slot. When that becomes
-- real, re-land the layer from the reverted ADR (the cross-tour claim
-- belongs there - pg_advisory_xact_lock(resourceId) or a resource-capacity
-- ledger), rather than resurrecting these empty tables.
--
-- Both tables are empty in every environment (no code ever wrote to them);
-- DROP IF EXISTS keeps the migration replayable on databases built after a
-- future baseline squash.

-- Abort LOUDLY if either table somehow holds rows (a hand-insert this audit
-- never saw) - a failed deploy is recoverable, silently dropped data is not.
-- EXECUTE keeps the check valid on databases where the tables never existed.
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.tour_resources') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "tour_resources"' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'tour_resources holds % row(s) - investigate before dropping', n;
    END IF;
  END IF;
  IF to_regclass('public.resources') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "resources"' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'resources holds % row(s) - investigate before dropping', n;
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS "tour_resources";
DROP TABLE IF EXISTS "resources";
DROP TYPE IF EXISTS "resource_consumption";
DROP TYPE IF EXISTS "resource_kind";
