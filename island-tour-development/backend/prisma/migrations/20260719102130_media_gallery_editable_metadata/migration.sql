-- AlterTable
ALTER TABLE "media_gallery" ADD COLUMN     "altText" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "excludeFromIndexing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "title" TEXT;
