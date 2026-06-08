/*
  Warnings:

  - The `currency` column on the `destinations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'CAD', 'ANG', 'AWG', 'XCD', 'BSD');

-- AlterTable
ALTER TABLE "destinations" DROP COLUMN "currency",
ADD COLUMN     "currency" "Currency";
