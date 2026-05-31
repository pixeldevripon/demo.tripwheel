-- CreateTable
CREATE TABLE "destination_translations" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "h1Override" TEXT,
    "breadcrumbLabel" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destination_page_content" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "aboutText" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,

    CONSTRAINT "destination_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "destination_translations_destinationId_locale_idx" ON "destination_translations"("destinationId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_destinationId_locale_key" ON "destination_translations"("destinationId", "locale");

-- CreateIndex
CREATE INDEX "destination_page_content_destinationId_locale_idx" ON "destination_page_content"("destinationId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "destination_page_content_destinationId_locale_key" ON "destination_page_content"("destinationId", "locale");

-- AddForeignKey
ALTER TABLE "destination_translations" ADD CONSTRAINT "destination_translations_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "destination_page_content" ADD CONSTRAINT "destination_page_content_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
