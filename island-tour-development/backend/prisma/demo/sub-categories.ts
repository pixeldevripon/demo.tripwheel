// Demo sub-categories (V2 §3) — children of "Boat Tours & Cruises" used to
// demonstrate the category page's refine pills. Sub-categories are FILTER-ONLY:
// they carry NO slug_registry row (no standalone page), only a parentCategoryId
// and TourCategory links. Removed by the demo `clean` step (see index.ts).
//
// Must run BEFORE seedTours() so the blueprints' extraCategories slugs resolve.
import { prisma } from './_shared';

const PARENT_SLUG = 'boat-tours';

export const DEMO_SUBCATEGORY_SLUGS = [
  'catamaran-cruises',
  'sailing-trips',
  'yacht-charters',
];

const SUB_CATEGORIES = [
  { slug: 'catamaran-cruises', name: 'Catamaran Cruises', sortOrder: 1 },
  { slug: 'sailing-trips', name: 'Sailing Trips', sortOrder: 2 },
  { slug: 'yacht-charters', name: 'Yacht Charters', sortOrder: 3 },
];

export async function seedSubCategories() {
  const parent = await prisma.category.findUnique({
    where: { slug: PARENT_SLUG },
    select: { id: true },
  });
  if (!parent) {
    console.warn(
      `  Parent category "${PARENT_SLUG}" not found - skipping demo sub-categories.`,
    );
    return;
  }

  for (const sub of SUB_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: sub.slug },
      create: {
        name: sub.name,
        slug: sub.slug,
        sortOrder: sub.sortOrder,
        parentCategoryId: parent.id,
        isSeeded: false,
        createdBy: null,
      },
      update: {
        name: sub.name,
        sortOrder: sub.sortOrder,
        parentCategoryId: parent.id,
      },
    });
    // Deliberately NO slug_registry row: sub-categories are filter-only.
  }

  console.log(
    `  Seeded ${SUB_CATEGORIES.length} filter-only sub-categories under "${PARENT_SLUG}".`,
  );
}

// Which existing demo boat tours to tag with each sub-category (used by the
// standalone `--subcategories` run; the full seed does this inline via each
// blueprint's extraCategories).
const TOUR_SUB_LINKS: { tourSlug: string; subSlug: string }[] = [
  {
    tourSlug: 'klein-curacao-full-day-catamaran',
    subSlug: 'catamaran-cruises',
  },
  { tourSlug: 'klein-curacao-luxury-yacht-charter', subSlug: 'yacht-charters' },
  { tourSlug: 'sunset-sail-with-open-bar', subSlug: 'sailing-trips' },
];

/**
 * Idempotently tag existing tours with the demo sub-categories. Only needed when
 * running sub-categories standalone against an already-seeded demo DB (the full
 * demo seed tags them inline via blueprint extraCategories). Safe to re-run.
 */
export async function linkBoatSubCategoriesToExistingTours() {
  const subs = await prisma.category.findMany({
    where: { slug: { in: DEMO_SUBCATEGORY_SLUGS } },
    select: { id: true, slug: true },
  });
  const subIdBySlug = new Map(subs.map((s) => [s.slug, s.id]));

  let linked = 0;
  for (const { tourSlug, subSlug } of TOUR_SUB_LINKS) {
    const tour = await prisma.tour.findFirst({
      where: { slug: tourSlug },
      select: { id: true },
    });
    const subId = subIdBySlug.get(subSlug);
    if (!tour || !subId) continue;
    await prisma.tourCategory.createMany({
      data: [{ tourId: tour.id, categoryId: subId, isPrimary: false }],
      skipDuplicates: true,
    });
    linked++;
  }
  console.log(
    `  Linked ${linked}/${TOUR_SUB_LINKS.length} existing tour(s) to sub-categories.` +
      (linked === 0
        ? ' (No demo boat tours found - run the full `pnpm prisma:seed:demo` first.)'
        : ''),
  );
}
