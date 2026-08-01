-- QA report 2026-08-01 (booking cancellation): two new inbox events.
-- BOOKING_CANCELLATION_WITHDRAWN - traveller withdrew a pending request.
-- BOOKING_RESTORED - admin reversed an executed cancellation.
ALTER TYPE "InboxEvent" ADD VALUE IF NOT EXISTS 'BOOKING_CANCELLATION_WITHDRAWN';
ALTER TYPE "InboxEvent" ADD VALUE IF NOT EXISTS 'BOOKING_RESTORED';
