-- AlterEnum
-- Two values, added in separate statements. Prisma warns that PostgreSQL 11 and
-- earlier cannot add more than one enum value per migration; splitting them is
-- the documented workaround and is harmless on every later version.
ALTER TYPE "InboxEvent" ADD VALUE 'CALENDAR_SYNC_CONFLICT';
ALTER TYPE "InboxEvent" ADD VALUE 'CALENDAR_SYNC_FAILED';
