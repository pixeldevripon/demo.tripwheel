/*
  Warnings:

  - Made the column `region` on table `destinations` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "destinations" ALTER COLUMN "region" SET NOT NULL;
