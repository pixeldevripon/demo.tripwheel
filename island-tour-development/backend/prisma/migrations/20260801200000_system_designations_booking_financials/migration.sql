-- Grant VIEW_BOOKING_FINANCIALS to the money-facing SYSTEM designations.
--
-- The three platform designations were seeded in 20260719180644. The permission
-- itself only arrived in 20260728022458 (conflict #7: money + traveler PII on
-- booking rows), and nothing went back to fill it in. So every seat created from
-- those templates has been short one permission ever since.
--
-- It is not a cosmetic gap. The effective set for staff is the DESIGNATION's
-- grants capped by the ceiling - the role's static list is deliberately NOT
-- unioned in (staff-permissions.service) - so the missing entry is simply
-- missing. An invited Operations Manager therefore hit:
--   * GET /analytics/dashboard  (VIEW_ANALYTICS + VIEW_BOOKING_FINANCIALS) -> 403
--     which the Overview renders as its "couldn't load" error;
--   * GET /payments, GET /settlements, GET /customers (all paired the same
--     way) -> 403, which the tables render as empty.
-- Reported 2026-08-01 (Admin pass, sections 2 and 4).
--
-- Scoped to the two designations that already hold VIEW_PAYMENTS, because that
-- is the pairing conflict #7 describes: a seat trusted with the payments screen
-- is trusted with the amounts on it. Content Editor holds neither and is left
-- alone. `NOT (... @> ...)` keeps this a no-op where the permission is already
-- present, so it never rewrites a set an admin has since curated.
UPDATE "staff_designations"
SET "permissions" = "permissions" || ARRAY['VIEW_BOOKING_FINANCIALS']::"Permission"[],
    "updatedAt" = now()
WHERE "isSystem" = true
  AND "operatorId" IS NULL
  AND "name" IN ('Operations Manager', 'Support Agent')
  AND "permissions" @> ARRAY['VIEW_PAYMENTS']::"Permission"[]
  AND NOT ("permissions" @> ARRAY['VIEW_BOOKING_FINANCIALS']::"Permission"[]);
