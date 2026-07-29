-- Max party size becomes REQUIRED.
--
-- It was nullable, and null meant "no default departure capacity" - so a
-- schedule without its own `capacityOverride` silently materialised nothing,
-- the tour never listed, and the operator was told about it through a
-- conditional readiness check ("Capacity set (max party size or per-schedule
-- override)") that could pass for two different reasons. Making the column
-- NOT NULL deletes that whole branch: capacity always resolves.
--
-- Backfill order matters. A tour that already sells has the answer in its own
-- data, so take the widest capacity its schedules actually use before falling
-- back to the column default.
UPDATE "tours" t
SET "maxPartySize" = COALESCE(
    (
        SELECT MAX(s."capacityOverride")
        FROM "availability_schedules" s
        WHERE s."tourId" = t."id" AND s."capacityOverride" IS NOT NULL
    ),
    (
        SELECT MAX(d."capacity")
        FROM "departures" d
        WHERE d."tourId" = t."id"
    ),
    10
)
WHERE t."maxPartySize" IS NULL;

-- Never below the minimum the tour already accepts.
UPDATE "tours"
SET "maxPartySize" = "minPartySize"
WHERE "maxPartySize" < "minPartySize";

ALTER TABLE "tours" ALTER COLUMN "maxPartySize" SET DEFAULT 10;
ALTER TABLE "tours" ALTER COLUMN "maxPartySize" SET NOT NULL;
