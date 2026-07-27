-- AlterTable
ALTER TABLE "session" ADD COLUMN     "surface" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "isSystemAccount" BOOLEAN NOT NULL DEFAULT false;
