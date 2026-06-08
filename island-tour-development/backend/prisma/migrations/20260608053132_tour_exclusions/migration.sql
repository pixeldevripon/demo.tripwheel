-- CreateTable
CREATE TABLE "tour_exclusions" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'x',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,

    CONSTRAINT "tour_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_exclusion_translations" (
    "id" TEXT NOT NULL,
    "exclusionId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "label" TEXT NOT NULL,
    "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tour_exclusion_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_exclusions_tripId_idx" ON "tour_exclusions"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_exclusion_translations_exclusionId_locale_key" ON "tour_exclusion_translations"("exclusionId", "locale");

-- AddForeignKey
ALTER TABLE "tour_exclusions" ADD CONSTRAINT "tour_exclusions_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_exclusion_translations" ADD CONSTRAINT "tour_exclusion_translations_exclusionId_fkey" FOREIGN KEY ("exclusionId") REFERENCES "tour_exclusions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
