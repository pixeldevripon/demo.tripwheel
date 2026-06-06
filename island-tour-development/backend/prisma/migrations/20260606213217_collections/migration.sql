-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('MANUAL', 'DYNAMIC');

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "collectionType" "CollectionType" NOT NULL,
    "tourIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterQuery" JSONB,
    "heroImage" TEXT,
    "sortOrder" TEXT NOT NULL DEFAULT 'recommended',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_translations" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_page_content" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "collection_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_destinationId_idx" ON "collections"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "collections_destinationId_slug_key" ON "collections"("destinationId", "slug");

-- CreateIndex
CREATE INDEX "collection_translations_collectionId_locale_idx" ON "collection_translations"("collectionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "collection_translations_collectionId_locale_key" ON "collection_translations"("collectionId", "locale");

-- CreateIndex
CREATE INDEX "collection_page_content_collectionId_locale_idx" ON "collection_page_content"("collectionId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "collection_page_content_collectionId_locale_key" ON "collection_page_content"("collectionId", "locale");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_translations" ADD CONSTRAINT "collection_translations_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_page_content" ADD CONSTRAINT "collection_page_content_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
