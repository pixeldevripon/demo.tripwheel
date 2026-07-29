-- Custom scripts: admin-pasted vendor snippets injected into every public page.
--
-- One row per snippet rather than two text blobs on site_seo, so each snippet
-- has its own name, on/off switch and order - a merged blob makes every edit a
-- diff against everyone else's vendor code and offers no way to switch a single
-- tool off while isolating a problem.

CREATE TYPE "CustomScriptPosition" AS ENUM ('HEAD', 'BODY_END');

CREATE TABLE "custom_scripts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" "CustomScriptPosition" NOT NULL DEFAULT 'BODY_END',
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_scripts_pkey" PRIMARY KEY ("id")
);

-- The public render is exactly this predicate: active rows, by position, in order.
CREATE INDEX "custom_scripts_isActive_position_displayOrder_idx"
    ON "custom_scripts"("isActive", "position", "displayOrder");
