// DEMO SEED — post-booking recommendations.
//
// Populates the Recommendations module with VARIETY so the dashboard list and the
// public cards have realistic content to render: external picks (hotel, restaurant,
// car rental, shop) across several categories, plus internal picks pointing at demo
// tours / destinations / collections / hubs. Idempotent (deterministic ids, upsert)
// and removable via cleanDemo().
//
// Depends on the base seed (the "Hotels" category + destinations + hubs) and the
// demo tours + collections (run earlier in runDemoSeed).

import {
  Currency,
  RecommendationPlacement,
  RecommendationRefType,
  RecommendationSource,
} from '@prisma/client';
import { demoId, log, photo, prisma, section } from './_shared';

const { THANK_YOU_PAGE, CONFIRMATION_EMAIL } = RecommendationPlacement;

/** Demo categories (upserted by slug). Hotels already exists from the base seed. */
const DEMO_CATEGORIES = [
  { slug: 'restaurants', name: 'Restaurants', displayOrder: 1 },
  { slug: 'car-rental', name: 'Car rental', displayOrder: 2 },
  { slug: 'shops', name: 'Shops', displayOrder: 3 },
  { slug: 'experiences', name: 'Experiences', displayOrder: 4 },
] as const;

export const DEMO_REC_CATEGORY_SLUGS = DEMO_CATEGORIES.map((c) => c.slug);

type EnCopy = {
  title: string;
  areaLabel?: string;
  description?: string;
  eyebrow?: string;
  ctaLabel?: string;
};

type DemoRec = {
  key: string;
  categorySlug: string;
  source: RecommendationSource;
  isEnabled?: boolean;
  displayOrder: number;
  placements: RecommendationPlacement[];
  // external
  imageUrl?: string;
  linkUrl?: string;
  rating?: number;
  reviewCount?: number;
  sleeps?: number;
  priceAmount?: number;
  currency?: Currency;
  en?: EnCopy;
  // internal
  refType?: RecommendationRefType;
  refKind?: 'tour' | 'destination' | 'collection' | 'hub';
};

const EXTERNAL_RECS: DemoRec[] = [
  {
    key: 'ocean-view-villa',
    categorySlug: 'hotels',
    source: RecommendationSource.EXTERNAL,
    displayOrder: 5, // behind the base Palm Suite (0) so that one stays the TYP winner
    placements: [THANK_YOU_PAGE],
    imageUrl: photo('beachPalms', 1176, 758),
    linkUrl: 'https://www.airbnb.com/rooms/ocean-view-villa',
    rating: 4.7,
    reviewCount: 812,
    sleeps: 6,
    priceAmount: 210,
    currency: Currency.USD,
    en: {
      title: 'Ocean View Villa',
      areaLabel: 'Pietermaai',
      eyebrow: 'OUR VILLA',
      description:
        'Rooftop plunge pool, walk to the reef\nHosted by Island Tours',
      ctaLabel: 'See availability on Airbnb',
    },
  },
  {
    key: 'nemo-beach-restaurant',
    categorySlug: 'restaurants',
    source: RecommendationSource.EXTERNAL,
    displayOrder: 1,
    placements: [THANK_YOU_PAGE],
    imageUrl: photo('grilledFood', 1176, 758),
    linkUrl: 'https://www.example-nemo-beach.test',
    rating: 4.6,
    reviewCount: 430,
    currency: Currency.USD,
    en: {
      title: 'Nemo Beach Restaurant',
      areaLabel: 'Jan Thiel',
      eyebrow: 'WHERE TO EAT',
      description: 'Fresh catch, toes in the sand\nSunset tables fill up fast',
      ctaLabel: 'Book a table',
    },
  },
  {
    key: 'curacao-car-hire',
    categorySlug: 'car-rental',
    source: RecommendationSource.EXTERNAL,
    displayOrder: 0, // wins the confirmation-email surface (nothing was placed there)
    placements: [CONFIRMATION_EMAIL],
    imageUrl: photo('jeepTrail', 1176, 758),
    linkUrl: 'https://www.example-curacao-cars.test',
    rating: 4.4,
    reviewCount: 260,
    priceAmount: 39,
    currency: Currency.USD,
    en: {
      title: 'Curaçao Car Hire',
      areaLabel: 'Airport pickup',
      eyebrow: 'GET AROUND',
      description: 'Free airport pickup, no deposit\nCompact to 4x4',
      ctaLabel: 'Reserve a car',
    },
  },
  {
    key: 'serenas-art-factory',
    categorySlug: 'shops',
    source: RecommendationSource.EXTERNAL,
    displayOrder: 2,
    placements: [THANK_YOU_PAGE, CONFIRMATION_EMAIL],
    imageUrl: photo('fruitMarket', 1176, 758),
    linkUrl: 'https://www.example-serenas-art.test',
    rating: 4.8,
    reviewCount: 1502,
    currency: Currency.USD,
    en: {
      title: "Serena's Art Factory",
      areaLabel: 'Willemstad',
      eyebrow: 'TAKE HOME',
      description: 'Hand-painted Chichi figures\nWatch the artists at work',
      ctaLabel: 'Visit the shop',
    },
  },
];

const INTERNAL_RECS: DemoRec[] = [
  {
    key: 'internal-tour',
    categorySlug: 'experiences',
    source: RecommendationSource.INTERNAL,
    displayOrder: 3,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.TOUR,
    refKind: 'tour',
  },
  {
    key: 'internal-destination',
    categorySlug: 'experiences',
    source: RecommendationSource.INTERNAL,
    displayOrder: 4,
    placements: [CONFIRMATION_EMAIL],
    refType: RecommendationRefType.DESTINATION,
    refKind: 'destination',
  },
  {
    key: 'internal-collection',
    categorySlug: 'experiences',
    source: RecommendationSource.INTERNAL,
    displayOrder: 5,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.COLLECTION,
    refKind: 'collection',
  },
  {
    key: 'internal-hub',
    categorySlug: 'experiences',
    source: RecommendationSource.INTERNAL,
    isEnabled: false, // one switched-off row, so the list shows that status too
    displayOrder: 6,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.HUB,
    refKind: 'hub',
  },
];

/** All demo recommendation ids, for cleanDemo(). */
export const DEMO_RECOMMENDATION_IDS = [...EXTERNAL_RECS, ...INTERNAL_RECS].map(
  (r) => demoId('recommendation', r.key),
);

/** Resolve an internal ref to a live entity id, or null when it is not seeded. */
async function resolveRefId(
  kind: NonNullable<DemoRec['refKind']>,
): Promise<string | null> {
  switch (kind) {
    case 'tour': {
      const t = await prisma.tour.findFirst({
        where: {
          destination: { slug: 'curacao' },
          status: 'LIVE',
          isActive: true,
          isBookable: true,
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      return t?.id ?? null;
    }
    case 'destination': {
      const d = await prisma.destination.findUnique({
        where: { slug: 'curacao' },
        select: { id: true, heroImage: true },
      });
      if (!d) return null;
      // An internal DESTINATION card needs a hero image to render. Base
      // destinations ship without one, so backfill a demo photo when it is
      // missing (only then - never overwrites an admin-set hero). Otherwise the
      // pick would sit "incomplete" forever and the demo would look broken.
      if (!d.heroImage) {
        await prisma.destination.update({
          where: { id: d.id },
          data: { heroImage: photo('willemstad', 1280, 854) },
        });
      }
      return d.id;
    }
    case 'collection': {
      const c = await prisma.collection.findFirst({
        where: { status: 'PUBLISHED', isActive: true },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      return c?.id ?? null;
    }
    case 'hub': {
      const h = await prisma.hub.findFirst({
        where: { slug: 'klein-curacao' },
        select: { id: true },
      });
      return h?.id ?? null;
    }
  }
}

export async function seedRecommendations(): Promise<void> {
  section('Recommendations (post-booking promo)');

  // 1) Categories (upsert by slug; Hotels already exists from the base seed).
  const categoryIdBySlug = new Map<string, string>();
  categoryIdBySlug.set('hotels', 'rec-cat-hotel');
  for (const c of DEMO_CATEGORIES) {
    const row = await prisma.recommendationCategory.upsert({
      where: { slug: c.slug },
      create: {
        id: demoId('rec-category', c.slug),
        slug: c.slug,
        name: c.name,
        displayOrder: c.displayOrder,
      },
      update: { name: c.name, displayOrder: c.displayOrder },
      select: { id: true },
    });
    categoryIdBySlug.set(c.slug, row.id);
  }
  log(`Categories: ${DEMO_CATEGORIES.length} demo (+ base Hotels).`);

  // 2) External recommendations (carry their own copy).
  for (const r of EXTERNAL_RECS) {
    const id = demoId('recommendation', r.key);
    const categoryId = categoryIdBySlug.get(r.categorySlug) ?? null;
    const base = {
      source: r.source,
      categoryId,
      isEnabled: r.isEnabled ?? true,
      displayOrder: r.displayOrder,
      placements: r.placements,
      imageUrl: r.imageUrl ?? null,
      linkUrl: r.linkUrl ?? null,
      rating: r.rating ?? null,
      reviewCount: r.reviewCount ?? null,
      sleeps: r.sleeps ?? null,
      priceAmount: r.priceAmount ?? null,
      currency: r.currency ?? Currency.USD,
    };
    await prisma.recommendation.upsert({
      where: { id },
      create: {
        id,
        ...base,
        translations: r.en
          ? {
              create: {
                locale: 'en',
                title: r.en.title,
                areaLabel: r.en.areaLabel ?? null,
                description: r.en.description ?? null,
                eyebrow: r.en.eyebrow ?? null,
                ctaLabel: r.en.ctaLabel ?? null,
              },
            }
          : undefined,
      },
      update: base,
    });
  }
  log(`External picks: ${EXTERNAL_RECS.length}.`);

  // 3) Internal recommendations (drawn live from the referenced entity). Skip any
  //    whose target is not seeded in this database.
  let internalCount = 0;
  for (const r of INTERNAL_RECS) {
    if (!r.refType || !r.refKind) continue;
    const refId = await resolveRefId(r.refKind);
    if (!refId) {
      log(`Skipped internal ${r.refKind} pick - no seeded ${r.refKind} found.`);
      continue;
    }
    const id = demoId('recommendation', r.key);
    const categoryId = categoryIdBySlug.get(r.categorySlug) ?? null;
    const base = {
      source: r.source,
      categoryId,
      isEnabled: r.isEnabled ?? true,
      displayOrder: r.displayOrder,
      placements: r.placements,
      refType: r.refType,
      refId,
    };
    await prisma.recommendation.upsert({
      where: { id },
      create: { id, ...base },
      update: base,
    });
    internalCount++;
  }
  log(`Internal picks: ${internalCount}.`);
}

/**
 * Remove the demo recommendations (fixed ids) + demo categories (by slug). The
 * base "Hotels" category and its Palm Suite row are left in place. refId is a plain
 * string (no FK), so this is order-independent.
 */
export async function cleanRecommendations(): Promise<void> {
  section('Recommendations (clean)');
  const recs = await prisma.recommendation.deleteMany({
    where: { id: { in: DEMO_RECOMMENDATION_IDS } },
  });
  const cats = await prisma.recommendationCategory.deleteMany({
    where: { slug: { in: DEMO_REC_CATEGORY_SLUGS } },
  });
  log(`Removed ${recs.count} recommendation(s) + ${cats.count} categor(ies).`);
}
