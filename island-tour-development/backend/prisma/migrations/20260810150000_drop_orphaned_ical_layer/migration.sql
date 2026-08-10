-- Drop the orphaned iCal-sync layer (founder decision 2026-08-10, the F10
-- pattern applied a second time).
--
-- History: migration 20260802120000_calendar_sync_import created the iCal
-- import layer (4 tables, 7 enum types, extra columns on two live tables);
-- the feature was reverted the same day - models, services, docs - but the
-- migration stayed because environments had run it. The pre-VPS baseline
-- squash's equivalence check (schema-from-migrations vs schema-from-DSL)
-- exposed the drift; F8's review had already found its orphaned scheduler
-- ('calendar.ical-poll-tick', pruned by the F8 registration).
--
-- Everything dropped here was verified: zero rows in all four tables, zero
-- non-null values in the orphan columns on the two LIVE tables, zero code
-- references. The stray values the layer added to the inbox_event enum
-- (CALENDAR_SYNC_CONFLICT / CALENDAR_SYNC_FAILED) STAY - Postgres cannot
-- remove enum values without recreating the type, they are harmless, and
-- the baseline carries them knowingly.
--
-- Abort LOUDLY if any assumption is wrong - a failed deploy is recoverable,
-- silently dropped data is not.
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('public.calendar_subscriptions') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "calendar_subscriptions"' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'calendar_subscriptions holds % row(s) - investigate before dropping', n; END IF;
  END IF;
  IF to_regclass('public.calendar_events') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "calendar_events"' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'calendar_events holds % row(s) - investigate before dropping', n; END IF;
  END IF;
  IF to_regclass('public.ical_sync_logs') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "ical_sync_logs"' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'ical_sync_logs holds % row(s) - investigate before dropping', n; END IF;
  END IF;
  IF to_regclass('public.calendar_conflicts') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM "calendar_conflicts"' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'calendar_conflicts holds % row(s) - investigate before dropping', n; END IF;
  END IF;
  -- Orphan columns on LIVE tables must be unused everywhere.
  IF to_regclass('public.availability_exceptions') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'availability_exceptions' AND column_name = 'subscriptionId') THEN
    EXECUTE 'SELECT COUNT(*) FROM "availability_exceptions" WHERE "subscriptionId" IS NOT NULL OR "externalUid" IS NOT NULL OR "slotKey" IS NOT NULL OR "source"::text <> ''manual''' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'availability_exceptions has % row(s) using iCal columns - investigate', n; END IF;
  END IF;
  -- Tightening calendar_feeds unique (operatorId, kind, scopeKey) -> (operatorId, kind)
  -- must not collide on real rows.
  IF to_regclass('public.calendar_feeds') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'calendar_feeds' AND column_name = 'scopeKey') THEN
    EXECUTE 'SELECT COUNT(*) - COUNT(DISTINCT ("operatorId", kind)) FROM "calendar_feeds"' INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'calendar_feeds has % duplicate (operatorId, kind) pair(s) - the tightened unique would fail', n; END IF;
  END IF;
END $$;

-- Children first (FKs into calendar_subscriptions), then the parent.
DROP TABLE IF EXISTS "calendar_conflicts";
DROP TABLE IF EXISTS "calendar_events";
DROP TABLE IF EXISTS "ical_sync_logs";

-- Live-table orphan columns. Dropping a column drops its indexes and FKs.
ALTER TABLE "availability_exceptions"
  DROP COLUMN IF EXISTS "subscriptionId",
  DROP COLUMN IF EXISTS "externalUid",
  DROP COLUMN IF EXISTS "slotKey",
  DROP COLUMN IF EXISTS "source";

DROP TABLE IF EXISTS "calendar_subscriptions";

-- calendar_feeds: back to the modeled shape (operatorId, kind) unique.
DROP INDEX IF EXISTS "calendar_feeds_operatorId_kind_scopeKey_key";
ALTER TABLE "calendar_feeds"
  DROP COLUMN IF EXISTS "scopeKey",
  DROP COLUMN IF EXISTS "tourId";
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_feeds_operatorId_kind_key"
  ON "calendar_feeds"("operatorId", "kind");

-- The layer's enum types, now unreferenced.
DROP TYPE IF EXISTS "ical_sync_trigger";
DROP TYPE IF EXISTS "ical_sync_outcome";
DROP TYPE IF EXISTS "calendar_subscription_status";
DROP TYPE IF EXISTS "calendar_platform";
DROP TYPE IF EXISTS "calendar_import_mode";
DROP TYPE IF EXISTS "calendar_conflict_resolution";
DROP TYPE IF EXISTS "availability_exception_source";
