-- CreateTable
CREATE TABLE "integrations_configuration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "metaCapiToken" TEXT,
    "metaCapiTestCode" TEXT DEFAULT '',
    "googleTranslateApiKey" TEXT,
    "googleTranslateProjectId" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_configuration_pkey" PRIMARY KEY ("id")
);
