-- Resource layer (Phase 1). Purely additive: two new tables, two new enums.
-- Nothing existing is altered, no rows are created, and no code reads these yet.
-- Rollback is a clean drop of both tables. See
-- technical-doc/02-architecture/RESOURCE-ARCHITECTURE-REVIEW-VERDICT.md

-- CreateEnum
CREATE TYPE "resource_kind" AS ENUM ('BOAT', 'VEHICLE', 'JETSKI', 'GUIDE', 'EQUIPMENT', 'GENERIC');

-- CreateEnum
CREATE TYPE "resource_consumption" AS ENUM ('EXCLUSIVE_ON_FIRST', 'EXCLUSIVE');

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "resource_kind" NOT NULL DEFAULT 'GENERIC',
    "capacity" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_resources" (
    "tourId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "mode" "resource_consumption" NOT NULL DEFAULT 'EXCLUSIVE_ON_FIRST',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_resources_pkey" PRIMARY KEY ("tourId","resourceId")
);

-- CreateIndex
CREATE INDEX "resources_operatorId_isActive_idx" ON "resources"("operatorId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "resources_operatorId_name_key" ON "resources"("operatorId", "name");

-- CreateIndex
CREATE INDEX "tour_resources_resourceId_idx" ON "tour_resources"("resourceId");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_resources" ADD CONSTRAINT "tour_resources_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_resources" ADD CONSTRAINT "tour_resources_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

