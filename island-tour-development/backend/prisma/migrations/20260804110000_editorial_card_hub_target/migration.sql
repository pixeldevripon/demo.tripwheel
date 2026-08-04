-- Homepage editorial CTA cards can now advertise a HUB as well as a category
-- (founder, 2026-08-04). At most one of (categoryId, hubId) is set - the
-- service normalizes the pair. SetNull mirrors the category FK: deleting the
-- hub degrades the card to a plain photo, never deletes the slot.
ALTER TABLE "home_page_editorial_cards" ADD COLUMN "hubId" TEXT;

ALTER TABLE "home_page_editorial_cards"
  ADD CONSTRAINT "home_page_editorial_cards_hubId_fkey"
  FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
