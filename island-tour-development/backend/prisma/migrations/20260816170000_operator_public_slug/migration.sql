-- Pastel #80 / MCK-20 §3: the canonical per-operator conditions page lives at
-- /{locale}/operators/{slug}/conditions. IF NOT EXISTS on both statements: a
-- dev database may already carry this column from a parallel feature branch's
-- local migrations (the drifted-baseline playbook), and the statement must be
-- a clean no-op there while still creating it on production.
ALTER TABLE "operators" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "operators_slug_key" ON "operators"("slug");
