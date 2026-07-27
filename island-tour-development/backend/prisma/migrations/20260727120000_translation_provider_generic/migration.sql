-- Generalize the AI-translation settings columns (provider-agnostic surface):
-- the admin now picks the provider in the dashboard, and the key/model belong
-- to whichever provider is active. Values are copied, never dropped.
ALTER TABLE "integrations_configuration"
  ADD COLUMN "translationProvider" TEXT DEFAULT '',
  ADD COLUMN "translationApiKey" TEXT,
  ADD COLUMN "translationModel" TEXT DEFAULT '';

UPDATE "integrations_configuration"
SET "translationApiKey" = "geminiApiKey",
    "translationModel"  = "geminiModel";

ALTER TABLE "integrations_configuration"
  DROP COLUMN "geminiApiKey",
  DROP COLUMN "geminiModel";
