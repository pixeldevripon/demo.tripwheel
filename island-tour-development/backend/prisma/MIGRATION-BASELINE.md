# Migration baseline (2026-08-10) — what happened and what to run

The 118-migration history was squashed into a single verified baseline,
`migrations/20260810160000_baseline`, for the fresh-VPS production deploy.

## Why this is safe (the verification, not the promise)

- Generated with `prisma migrate diff --from-empty --to-migrations` — a
  shadow-database **replay of the real history**, not the schema file, so
  enum value order and every migrated nuance match production exactly.
- Raw SQL the Prisma DSL cannot express was carried by hand (marked section
  at the end of the baseline): the `unaccent` extension + `immutable_unaccent`
  wrapper, the `departures_booked_within_capacity` CHECK, and one `NOT NULL`
  the diff engine drops on enum-array columns.
- **Equivalence gate:** a database built from the old 118-migration history
  and one built from the baseline produced IDENTICAL `pg_dump --schema-only`
  output (empty diff). The gate also caught and led to dropping two orphaned
  reverted layers (resources, iCal) before the freeze.

## Fresh database (new VPS, new dev machine, CI)

Nothing special — the normal flow just works:

```bash
pnpm prisma:migrate:deploy    # applies the single baseline
pnpm prisma:seed              # RUN_SEED=true does this in the container
```

## EXISTING database (current prod, an old dev clone)

An existing DB already HAS the schema — it must be re-pointed, never reset.
**Do this BEFORE booting the new image** (docker-entrypoint runs
`migrate deploy` at startup and will fail loudly on the old history rows):

```bash
# 1) forget the old history (rows reference deleted migration folders)
psql "$DATABASE_URL" -c 'DELETE FROM "_prisma_migrations";'
# 2) mark the baseline as already applied (computes the correct checksum)
npx prisma migrate resolve --applied 20260810160000_baseline
# 3) sanity: must print "No pending migrations to apply."
npx prisma migrate deploy
```

Run from the NEW checkout (the one whose `migrations/` contains only the
baseline), with `DATABASE_URL` pointing at the target DB. No data is touched.

## Re-baselining again someday (the procedure that was used)

1. `SHADOW_DATABASE_URL=postgresql://... npx prisma migrate diff --from-empty
   --to-migrations prisma/migrations --script > baseline.sql`
   (the optional shadow URL is wired in `prisma.config.ts`)
2. Re-append every hand-carried block from the current baseline's marked
   section — grep the history for `CREATE EXTENSION`, `ADD CONSTRAINT ...
   CHECK`, `CREATE OR REPLACE FUNCTION`; data repairs do NOT carry (fresh
   DBs have nothing to repair, existing DBs never run the baseline).
3. THE GATE: build one DB from the old history and one from the new
   baseline; `diff` their `pg_dump --schema-only --no-owner --no-privileges`
   dumps (exclude `_prisma_migrations`). Ship only on an EMPTY diff.
4. Re-point every existing environment as above.

Known deliberate residue: the `inbox_event` enum carries two values from the
reverted iCal layer (`CALENDAR_SYNC_CONFLICT`, `CALENDAR_SYNC_FAILED`) —
Postgres cannot remove enum values; they are harmless and the baseline
includes them so old and new databases stay identical.
