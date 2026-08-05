-- Accent-insensitive search (master 5.10: "Postgres full-text with trigram typo
-- tolerance"; this is the accent half).
--
-- `ILIKE` folds CASE but not ACCENTS, so a catalogue full of "Curaçao" returned
-- nothing for "curacao" - the launch island's own name, typed the way almost
-- everyone types it. `cura` matched only because it stops before the cedilla.
--
-- `unaccent` is IMMUTABLE-wrapped below so it can be used in an index later;
-- the shipped extension function is marked STABLE, which Postgres refuses to
-- index on. Nothing indexes it yet - the tour catalogue is small and the search
-- is a filter, not a hot path - but wrapping it now means adding the index is a
-- one-line migration rather than a re-do.
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
  STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;
