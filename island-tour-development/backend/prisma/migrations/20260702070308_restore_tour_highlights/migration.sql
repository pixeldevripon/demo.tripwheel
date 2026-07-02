-- AlterEnum
ALTER TYPE "FeatureType" ADD VALUE 'HIGHLIGHT';

-- CreateTable
CREATE TABLE "tour_highlights" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_highlight_translations" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "text" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_highlight_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_highlights_tourId_displayOrder_idx" ON "tour_highlights"("tourId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tour_highlight_translations_highlightId_locale_key" ON "tour_highlight_translations"("highlightId", "locale");

-- AddForeignKey
ALTER TABLE "tour_highlights" ADD CONSTRAINT "tour_highlights_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_highlight_translations" ADD CONSTRAINT "tour_highlight_translations_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "tour_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;
