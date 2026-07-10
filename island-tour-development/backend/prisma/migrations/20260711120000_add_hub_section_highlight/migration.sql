-- First-timer "tick" takeaways: a new hub content-section type feeding the
-- green-check highlights row in the "What we tell first-timers" section.
ALTER TYPE "HubSectionType" ADD VALUE IF NOT EXISTS 'HIGHLIGHT';
