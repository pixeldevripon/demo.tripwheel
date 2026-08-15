-- Pastel 81 / issue #221: the support WhatsApp line is +5999 5266046, and every
-- surface that shows a number (footer "Contact us", Help center, Track your
-- booking, the booking page, and the emails) reads it from this single row.
--
-- Two parts, and they are not the same thing:
--
-- 1. The column defaults. A fresh install used to come up with the chat off and
--    an empty number, so "the default" rendered nothing anywhere. It now comes
--    up on and pointed at the real line. `enableWhatsappChat` stays an admin
--    kill switch - every read still gates on it.
--
-- 2. The backfill. Defaults only apply to rows that do not exist yet, and
--    site_info is a singleton created long ago, so the running install keeps
--    whatever number it was seeded with until we correct it here. That is the
--    part the client actually sees.

-- AlterTable
ALTER TABLE "public"."site_info"
  ALTER COLUMN "enableWhatsappChat" SET DEFAULT true,
  ALTER COLUMN "whatsappNumber" SET DEFAULT '+5999 5266046';

-- Correct the live number. Unconditional on purpose: the client's instruction is
-- that this line is THE number, so a row already holding it is unchanged and a
-- row holding anything else was wrong.
UPDATE "public"."site_info"
SET "whatsappNumber" = '+5999 5266046';

-- Heal only rows that never had an answer. An admin who deliberately switched
-- the chat off stays switched off - correcting a number is not permission to
-- turn a channel back on.
UPDATE "public"."site_info"
SET "enableWhatsappChat" = true
WHERE "enableWhatsappChat" IS NULL;
