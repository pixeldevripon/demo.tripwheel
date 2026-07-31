-- Recommendation display settings (singleton): the per-surface card caps, made
-- admin-editable so the threshold changes without a deploy. Seeds the default row
-- so the public read always has a value (thank-you 3, email 2).

CREATE TABLE "recommendation_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "thankYouPageLimit" INTEGER NOT NULL DEFAULT 3,
    "confirmationEmailLimit" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "recommendation_settings" ("id", "updatedAt")
VALUES ('default', now())
ON CONFLICT ("id") DO NOTHING;
