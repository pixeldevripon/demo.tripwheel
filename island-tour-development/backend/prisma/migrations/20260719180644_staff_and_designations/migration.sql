-- CreateEnum
CREATE TYPE "StaffSeatRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'MANAGE_STAFF';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_TEAM';

-- CreateTable
CREATE TABLE "staff_designations" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" "Permission"[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorId" TEXT,
    "seatRole" "StaffSeatRole" NOT NULL DEFAULT 'STAFF',
    "designationId" TEXT,
    "extraPermissions" "Permission"[],
    "revokedPermissions" "Permission"[],
    "status" "StaffStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" TEXT,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_designations_operatorId_idx" ON "staff_designations"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_designations_operatorId_name_key" ON "staff_designations"("operatorId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_userId_key" ON "staff_members"("userId");

-- CreateIndex
CREATE INDEX "staff_members_operatorId_idx" ON "staff_members"("operatorId");

-- CreateIndex
CREATE INDEX "staff_members_status_idx" ON "staff_members"("status");

-- CreateIndex
CREATE INDEX "staff_members_designationId_idx" ON "staff_members"("designationId");

-- AddForeignKey
ALTER TABLE "staff_designations" ADD CONSTRAINT "staff_designations_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_designationId_fkey" FOREIGN KEY ("designationId") REFERENCES "staff_designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Data migration ───────────────────────────────────────────────────────────

-- Backfill: every existing operator's login user becomes the ACTIVE OWNER seat
-- of its own team (login doc Phase 2 item 2). Admin-owned auto-provisioned
-- operator records are excluded — ADMIN users are never staff-managed.
INSERT INTO "staff_members"
    ("id", "userId", "operatorId", "seatRole", "status", "invitedAt", "activatedAt", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(), o."userId", o."id", 'OWNER', 'ACTIVE', o."createdAt", o."createdAt", now(), now()
FROM "operators" o
JOIN "user" u ON u."id" = o."userId"
WHERE u."role" = 'TOUR_OPERATOR';

-- Seed the platform (admin-side) system designations. isSystem rows cannot be
-- renamed or deleted through the API; admins can still adjust their permission
-- sets. None of these reference the enum values added above (same-transaction
-- Postgres restriction on new enum values).
INSERT INTO "staff_designations" ("id", "operatorId", "name", "description", "permissions", "isSystem", "createdAt", "updatedAt")
VALUES
    (
        gen_random_uuid(), NULL, 'Operations Manager',
        'Runs day-to-day marketplace operations: bookings, payments, cancellations and review moderation.',
        ARRAY['VIEW_BOOKINGS','EDIT_BOOKING','DELETE_BOOKING','VIEW_PAYMENTS','EDIT_PAYMENT','VIEW_REVIEWS','EDIT_REVIEW','DELETE_REVIEW','APPROVE_REVIEW','VIEW_TRIPS','VIEW_USERS','VIEW_OPERATOR_PROFILE','VIEW_ANALYTICS','EXPORT_DATA','VIEW_PROFILE','EDIT_PROFILE']::"Permission"[],
        true, now(), now()
    ),
    (
        gen_random_uuid(), NULL, 'Content Editor',
        'Maintains catalog and editorial content: destinations, categories, collections, hubs and media.',
        ARRAY['CREATE_CONTENT','VIEW_CONTENT','EDIT_CONTENT','DELETE_CONTENT','VIEW_TRIPS','VIEW_DESTINATIONS','EDIT_DESTINATION','MANAGE_HUBS','VIEW_CATEGORIES','EDIT_CATEGORY','VIEW_COLLECTIONS','CREATE_COLLECTION','EDIT_COLLECTION','VIEW_MEDIA','UPLOAD_MEDIA','MANAGE_MEDIA','VIEW_PROFILE','EDIT_PROFILE']::"Permission"[],
        true, now(), now()
    ),
    (
        gen_random_uuid(), NULL, 'Support Agent',
        'Handles traveler and operator support: bookings, enquiries and leads. Read-mostly.',
        ARRAY['VIEW_BOOKINGS','EDIT_BOOKING','VIEW_PAYMENTS','VIEW_REVIEWS','VIEW_TRIPS','VIEW_USERS','VIEW_OPERATOR_PROFILE','VIEW_ENQUIRIES','REPLY_ENQUIRY','VIEW_LEADS','EDIT_LEAD','VIEW_PROFILE','EDIT_PROFILE']::"Permission"[],
        true, now(), now()
    );
