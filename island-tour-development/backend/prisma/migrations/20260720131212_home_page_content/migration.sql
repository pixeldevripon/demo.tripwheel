-- CreateTable
CREATE TABLE "home_page" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "heroImage" TEXT,
    "editorialImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "editorialDestinationId" TEXT,
    "ogImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_page_translations" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "experiencesTitle" TEXT,
    "editorialTitleLine1" TEXT,
    "editorialTitleLine2" TEXT,
    "editorialBody" TEXT,
    "editorialCta" TEXT,
    "faqTitle" TEXT,
    "faqSubtitle" TEXT,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_page_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "home_page_translations_homeId_locale_idx" ON "home_page_translations"("homeId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "home_page_translations_homeId_locale_key" ON "home_page_translations"("homeId", "locale");

-- AddForeignKey
ALTER TABLE "home_page" ADD CONSTRAINT "home_page_editorialDestinationId_fkey" FOREIGN KEY ("editorialDestinationId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_page_translations" ADD CONSTRAINT "home_page_translations_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "home_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;
