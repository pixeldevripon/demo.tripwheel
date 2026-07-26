/**
 * seed-pages.ts - publishes the six legal/policy pages into the Pages system.
 *
 * Run:  pnpm pages:seed            (from backend/)
 *       pnpm pages:seed --dry-run  (list the work, touch nothing)
 *
 * WHY THIS EXISTS
 *   The legal pages were hand-authored JSX in the public frontend ("verbatim
 *   handover copy, change only through Denley"). The Pages system replaces the
 *   JSX with database rows an admin can edit through the dashboard's WYSIWYG
 *   editor - so the exact HTML those routes rendered was extracted once into
 *   `prisma/pages-content/{slug}.html` (fixture files, checked in) and this
 *   script publishes them. After it runs, the frontend's fall-through router
 *   serves the same URLs with the same content, and the static JSX routes can
 *   be deleted.
 *
 * FILL-ONLY-EMPTY: a page that already exists is left alone (its slug row is
 * simply reported), and a translation with a non-empty body is NEVER
 * overwritten - an admin's edits always beat the fixtures. Re-running is a
 * no-op, so this is safe in any environment at any time.
 *
 * The body passes through the SAME write-path sanitizer the admin routes use,
 * so seeded rows carry exactly the invariant the column promises.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Locale, PageStatus, PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { sanitizePageHtml } from '../src/common/utils/page-html.util';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const CONTENT_DIR = path.join(__dirname, '..', 'prisma', 'pages-content');

/** The six pages, in footer order. Titles are the H1s the routes rendered. */
const LEGAL_PAGES: { slug: string; title: string }[] = [
  { slug: 'privacy-policy', title: 'Privacy Policy' },
  { slug: 'cookie-policy', title: 'Cookie Policy' },
  { slug: 'terms', title: 'Terms of Service' },
  { slug: 'cancellation-policy', title: 'Cancellation and Refund Policy' },
  { slug: 'legal-notice', title: 'Legal Notice' },
  { slug: 'reviews-policy', title: 'How we handle reviews' },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  let created = 0;
  let filled = 0;
  let skipped = 0;

  try {
    for (const { slug, title } of LEGAL_PAGES) {
      const fixture = path.join(CONTENT_DIR, `${slug}.html`);
      if (!fs.existsSync(fixture)) {
        throw new Error(`Missing fixture: ${fixture}`);
      }
      const body = sanitizePageHtml(fs.readFileSync(fixture, 'utf8'));
      if (!body) throw new Error(`Fixture sanitised to nothing: ${slug}`);

      const existing = await prisma.page.findUnique({
        where: { slug },
        select: {
          id: true,
          status: true,
          translations: {
            where: { locale: Locale.en },
            select: { id: true, body: true },
          },
        },
      });

      if (!existing) {
        console.log(
          `${DRY_RUN ? '[dry] ' : ''}CREATE  ${slug}  (${body.length} bytes, PUBLISHED)`,
        );
        created++;
        if (!DRY_RUN) {
          await prisma.page.create({
            data: {
              slug,
              status: PageStatus.PUBLISHED,
              publishedAt: new Date(),
              translations: {
                create: { locale: Locale.en, title, body },
              },
            },
          });
        }
        continue;
      }

      const english = existing.translations[0];
      if (english && english.body.trim()) {
        // An admin (or an earlier run) already owns this content.
        console.log(`SKIP    ${slug}  (English body present)`);
        skipped++;
        continue;
      }

      // Page row exists but its English content is missing/empty - fill the
      // hole without touching the page's status or slug.
      console.log(
        `${DRY_RUN ? '[dry] ' : ''}FILL    ${slug}  (empty English body)`,
      );
      filled++;
      if (!DRY_RUN) {
        await prisma.pageTranslation.upsert({
          where: {
            pageId_locale: { pageId: existing.id, locale: Locale.en },
          },
          create: { pageId: existing.id, locale: Locale.en, title, body },
          update: { title, body },
        });
      }
    }

    console.log(
      `\nDone${DRY_RUN ? ' (dry run)' : ''}: ${created} created, ${filled} filled, ${skipped} skipped.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
