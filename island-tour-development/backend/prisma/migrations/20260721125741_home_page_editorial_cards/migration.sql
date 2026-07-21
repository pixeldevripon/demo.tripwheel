-- The three fanned CTA cards move from `home_page.editorialImages` (a bare
-- String[]) to a table, because a card now carries WHERE it points and WHETHER
-- it points anywhere, not just a URL.
--
-- Hand-written rather than generated so the existing photos are CARRIED OVER
-- before the column is dropped: `prisma migrate dev` would have emitted the
-- create and the drop with nothing in between, silently discarding whatever an
-- admin had already configured.

-- CreateTable
CREATE TABLE "home_page_editorial_cards" (
    "id" TEXT NOT NULL,
    "homeId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "destinationId" TEXT,
    "isLink" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "home_page_editorial_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_page_editorial_cards_homeId_displayOrder_key" ON "home_page_editorial_cards"("homeId", "displayOrder");

-- AddForeignKey
ALTER TABLE "home_page_editorial_cards" ADD CONSTRAINT "home_page_editorial_cards_homeId_fkey" FOREIGN KEY ("homeId") REFERENCES "home_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_page_editorial_cards" ADD CONSTRAINT "home_page_editorial_cards_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry existing photos across, preserving fan order. They start NOT clickable:
-- the old field held photos only, so there is no destination to link to and
-- inventing one would put a link on the page the admin never asked for.
INSERT INTO "home_page_editorial_cards" ("id", "homeId", "imageUrl", "displayOrder", "isLink")
SELECT gen_random_uuid()::text, h."id", img.url, (img.ord - 1)::int, false
FROM "home_page" h, unnest(h."editorialImages") WITH ORDINALITY AS img(url, ord);

-- DropColumn
ALTER TABLE "home_page" DROP COLUMN "editorialImages";
