-- CreateTable
CREATE TABLE "platform_reviews_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT,
    "apiKey" TEXT DEFAULT '',
    "businessId" TEXT DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "displayPages" JSONB NOT NULL DEFAULT '["homepage"]',
    "cachedPayload" JSONB,
    "fetchedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_reviews_config_pkey" PRIMARY KEY ("id")
);
