-- Access matrix v1.7 (availability review §5.1): staff seats may close/reopen
-- (stop-sell) without holding the full MANAGE_AVAILABILITY setup grant.
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'STOP_SELL';
