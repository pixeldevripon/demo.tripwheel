-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('BOOLEAN', 'ENUM', 'ENUM_MULTI', 'INTEGER', 'DECIMAL', 'TEXT');

-- CreateEnum
CREATE TYPE "FilterDisplayType" AS ENUM ('CHECKBOX', 'RANGE_SLIDER', 'RADIO', 'DROPDOWN');

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "dataType" "AttributeDataType" NOT NULL,
    "allowedValues" JSONB,
    "appliesToCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFilterable" BOOLEAN NOT NULL DEFAULT true,
    "isSortable" BOOLEAN NOT NULL DEFAULT false,
    "filterDisplayType" "FilterDisplayType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_attributes" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "attributeValue" VARCHAR(500) NOT NULL,

    CONSTRAINT "tour_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_key_key" ON "attribute_definitions"("key");

-- CreateIndex
CREATE INDEX "attribute_definitions_isFilterable_idx" ON "attribute_definitions"("isFilterable");

-- CreateIndex
CREATE INDEX "attribute_definitions_isActive_idx" ON "attribute_definitions"("isActive");

-- CreateIndex
CREATE INDEX "tour_attributes_attributeKey_attributeValue_idx" ON "tour_attributes"("attributeKey", "attributeValue");

-- CreateIndex
CREATE UNIQUE INDEX "tour_attributes_tripId_attributeKey_key" ON "tour_attributes"("tripId", "attributeKey");

-- AddForeignKey
ALTER TABLE "tour_attributes" ADD CONSTRAINT "tour_attributes_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
