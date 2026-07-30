-- TEAM_SEAT_ACTIVATED is dropped: the seat activation flip lives in a Better
-- Auth login hook, outside Nest DI, and wiring it there would require a second
-- StaffPermissionsService instance - the duplicate the module explicitly
-- forbids. An event nothing emits is worse than no event, so it goes.
--
-- Postgres cannot drop a single enum value, so the type is recreated. Safe:
-- the value was added minutes ago in 20260729220000 and no row can hold it.
ALTER TYPE "InboxEvent" RENAME TO "InboxEvent_old";

CREATE TYPE "InboxEvent" AS ENUM (
  'TOUR_SUBMITTED_FOR_REVIEW', 'TOUR_APPROVED', 'TOUR_CHANGES_REQUESTED',
  'TOUR_PUBLISHED', 'TOUR_UNLISTED_NO_DEPARTURES',
  'SPOTLIGHT_REQUESTED', 'SPOTLIGHT_APPROVED', 'SPOTLIGHT_REJECTED',
  'TIER_DEMOTED',
  'BOOKING_CONFIRMED', 'BOOKING_CANCELLATION_REQUESTED',
  'BOOKING_OPERATOR_REPORTED_CANCELLATION',
  'BOOKING_OPERATOR_REPORTED_NON_PAYMENT', 'BOOKING_CANCELLED',
  'REVIEW_SUBMITTED', 'REVIEW_PUBLISHED',
  'SETTLEMENT_STATEMENT_READY',
  'TEAM_SEAT_INVITED'
);

ALTER TABLE "inbox_notifications"
  ALTER COLUMN "event" TYPE "InboxEvent" USING ("event"::text::"InboxEvent");

DROP TYPE "InboxEvent_old";
