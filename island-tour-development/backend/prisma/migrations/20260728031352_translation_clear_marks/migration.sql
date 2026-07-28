-- CreateTable
CREATE TABLE "translation_clear_marks" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "unitKey" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "clearedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_clear_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translation_clear_marks_entityType_entityId_idx" ON "translation_clear_marks"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "translation_clear_marks_entityType_entityId_unitKey_locale_key" ON "translation_clear_marks"("entityType", "entityId", "unitKey", "locale");
