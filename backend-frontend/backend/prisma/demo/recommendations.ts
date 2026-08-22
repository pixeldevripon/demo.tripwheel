// DEMO SEED — post-booking recommendations.
//
// Populates the Recommendations module with VARIETY so the dashboard list and the
// public cards have realistic content: external picks across many category enum
// values (stays, food, transport, shopping, activities, nightlife…), plus internal
// picks pointing at demo tours / destinations / collections / hubs. Idempotent
// (deterministic ids + upsert) and removable via cleanRecommendations().
//
// Run on its own:  pnpm prisma:seed:recommendations
//
// NOTE: only the facts RELEVANT to a category are set on each row (a stay has
// sleeps; a restaurant does not), because the public card renders whatever facts
// are non-null. The dashboard form enforces the same relevance on save.

import {
  Currency,
  RecommendationCategory,
  RecommendationPlacement,
  RecommendationRefType,
  RecommendationSource,
} from '@prisma/client';
import { demoId, log, photo, prisma, section } from './_shared';
import type { PhotoName } from './_shared';

const { THANK_YOU_PAGE, CONFIRMATION_EMAIL } = RecommendationPlacement;

type EnCopy = {
  title: string;
  areaLabel?: string;
  description?: string;
  eyebrow?: string;
  ctaLabel?: string;
};

type DemoRec = {
  key: string;
  category: RecommendationCategory;
  source: RecommendationSource;
  isEnabled?: boolean;
  displayOrder: number;
  placements: RecommendationPlacement[];
  // external
  photo?: PhotoName;
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

const C = RecommendationCategory;

// External picks - each carries only the facts that fit its category.
const EXTERNAL_RECS: DemoRec[] = [
  {
    key: 'ocean-view-villa',
    category: C.VILLA,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 1,
    placements: [THANK_YOU_PAGE],
    photo: 'beachPalms',
    linkUrl: 'https://www.airbnb.com/rooms/ocean-view-villa',
    rating: 4.7,
    reviewCount: 812,
    sleeps: 6,
    priceAmount: 210,
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
    key: 'pietermaai-loft',
    category: C.APARTMENT,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 2,
    placements: [THANK_YOU_PAGE],
    photo: 'colonialStreet',
    linkUrl: 'https://www.example-loft.test',
    rating: 4.6,
    reviewCount: 340,
    sleeps: 3,
    priceAmount: 130,
    en: {
      title: 'Pietermaai Loft',
      areaLabel: 'Pietermaai',
      description: 'Restored townhouse, steps from the bars',
      ctaLabel: 'Book your stay',
    },
  },
  {
    key: 'nemo-beach-restaurant',
    category: C.RESTAURANT,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 3,
    placements: [THANK_YOU_PAGE],
    photo: 'grilledFood',
    linkUrl: 'https://www.example-nemo-beach.test',
    rating: 4.6,
    reviewCount: 430,
    priceAmount: 45,
    en: {
      title: 'Nemo Beach Restaurant',
      areaLabel: 'Jan Thiel',
      eyebrow: 'WHERE TO EAT',
      description: 'Fresh catch, toes in the sand\nSunset tables fill up fast',
      ctaLabel: 'Book a table',
    },
  },
  {
    key: 'mundo-bizarro-bar',
    category: C.BAR,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 4,
    placements: [THANK_YOU_PAGE],
    photo: 'cocktails',
    linkUrl: 'https://www.example-mundo.test',
    rating: 4.5,
    reviewCount: 280,
    priceAmount: 12,
    en: {
      title: 'Mundo Bizarro',
      areaLabel: 'Pietermaai',
      description: 'Cuban cocktails and live music',
      ctaLabel: 'See what’s on',
    },
  },
  {
    key: 'coffee-and-dreams',
    category: C.CAFE,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 5,
    placements: [THANK_YOU_PAGE],
    photo: 'colonialStreet',
    linkUrl: 'https://www.example-cafe.test',
    rating: 4.7,
    reviewCount: 190,
    priceAmount: 6,
    en: {
      title: 'Coffee & Dreams',
      areaLabel: 'Willemstad',
      description: 'Flat whites and fresh pastries',
      ctaLabel: 'Find it on the map',
    },
  },
  {
    key: 'curacao-car-hire',
    category: C.CAR_RENTAL,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 0, // top of the email surface
    placements: [CONFIRMATION_EMAIL],
    photo: 'jeepTrail',
    linkUrl: 'https://www.example-curacao-cars.test',
    rating: 4.4,
    reviewCount: 260,
    priceAmount: 39,
    en: {
      title: 'Curaçao Car Hire',
      areaLabel: 'Airport pickup',
      eyebrow: 'GET AROUND',
      description: 'Free airport pickup, no deposit\nCompact to 4x4',
      ctaLabel: 'Reserve a car',
    },
  },
  {
    key: 'island-airport-transfer',
    category: C.TRANSFER,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 1,
    placements: [CONFIRMATION_EMAIL],
    photo: 'aerialIsland',
    linkUrl: 'https://www.example-transfer.test',
    rating: 4.8,
    priceAmount: 25,
    en: {
      title: 'Island Airport Transfer',
      areaLabel: 'Hato Airport',
      description: 'Private ride to your hotel',
      ctaLabel: 'Book a transfer',
    },
  },
  {
    key: 'serenas-art-factory',
    category: C.SHOP,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 6,
    placements: [THANK_YOU_PAGE, CONFIRMATION_EMAIL],
    photo: 'fruitMarket',
    linkUrl: 'https://www.example-serenas-art.test',
    rating: 4.8,
    reviewCount: 1502,
    en: {
      title: "Serena's Art Factory",
      areaLabel: 'Willemstad',
      eyebrow: 'TAKE HOME',
      description: 'Hand-painted Chichi figures\nWatch the artists at work',
      ctaLabel: 'Visit the shop',
    },
  },
  {
    key: 'baoase-spa',
    category: C.SPA,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 7,
    placements: [THANK_YOU_PAGE],
    photo: 'lagoonPool',
    linkUrl: 'https://www.example-spa.test',
    rating: 4.9,
    reviewCount: 210,
    priceAmount: 90,
    en: {
      title: 'Baoase Spa',
      areaLabel: 'Jan Thiel',
      description: 'Beachfront massages and day passes',
      ctaLabel: 'Book a treatment',
    },
  },
  {
    key: 'cabana-beach-club',
    category: C.BEACH_CLUB,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 8,
    placements: [THANK_YOU_PAGE],
    photo: 'beachChairs',
    linkUrl: 'https://www.example-cabana.test',
    rating: 4.6,
    reviewCount: 640,
    priceAmount: 20,
    en: {
      title: 'Cabana Beach Club',
      areaLabel: 'Mambo Beach',
      description: 'Day beds, DJs and a swim-up bar',
      ctaLabel: 'Reserve a bed',
    },
  },
  {
    key: 'sea-aquarium',
    category: C.ATTRACTION,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 9,
    placements: [THANK_YOU_PAGE],
    photo: 'turtleReef',
    linkUrl: 'https://www.example-aquarium.test',
    rating: 4.3,
    reviewCount: 900,
    priceAmount: 21,
    en: {
      title: 'Curaçao Sea Aquarium',
      areaLabel: 'Bapor Kibra',
      description: 'Swim with dolphins and feed the rays',
      ctaLabel: 'Get tickets',
    },
  },
  {
    key: 'mambo-nightlife',
    category: C.NIGHTLIFE,
    source: RecommendationSource.EXTERNAL,
    displayOrder: 10,
    placements: [THANK_YOU_PAGE],
    photo: 'sunsetBeach',
    linkUrl: 'https://www.example-mambo.test',
    rating: 4.4,
    reviewCount: 510,
    priceAmount: 15,
    en: {
      title: 'Mambo Beach After Dark',
      areaLabel: 'Mambo Beach',
      description: 'Open-air clubs right on the sand',
      ctaLabel: 'See tonight’s lineup',
    },
  },
];

const INTERNAL_RECS: DemoRec[] = [
  {
    key: 'internal-tour',
    category: C.ACTIVITY,
    source: RecommendationSource.INTERNAL,
    displayOrder: 11,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.TOUR,
    refKind: 'tour',
  },
  {
    key: 'internal-destination',
    category: C.ACTIVITY,
    source: RecommendationSource.INTERNAL,
    displayOrder: 2,
    placements: [CONFIRMATION_EMAIL],
    refType: RecommendationRefType.DESTINATION,
    refKind: 'destination',
  },
  {
    key: 'internal-collection',
    category: C.ACTIVITY,
    source: RecommendationSource.INTERNAL,
    displayOrder: 12,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.COLLECTION,
    refKind: 'collection',
  },
  {
    key: 'internal-hub',
    category: C.ACTIVITY,
    source: RecommendationSource.INTERNAL,
    isEnabled: false, // one switched-off row, so the list shows that status too
    displayOrder: 13,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.HUB,
    refKind: 'hub',
  },
];

/** All demo recommendation ids, for cleanRecommendations(). */
const DEMO_RECOMMENDATION_IDS = [...EXTERNAL_RECS, ...INTERNAL_RECS].map((r) =>
  demoId('recommendation', r.key),
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
      // destinations ship without one, so backfill a demo photo when missing
      // (never overwrites an admin-set hero) - otherwise the pick sits incomplete.
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

  // External picks (carry their own copy). Only the category-appropriate facts.
  for (const r of EXTERNAL_RECS) {
    const id = demoId('recommendation', r.key);
    const base = {
      source: r.source,
      category: r.category,
      isEnabled: r.isEnabled ?? true,
      displayOrder: r.displayOrder,
      placements: r.placements,
      imageUrl: r.photo ? photo(r.photo, 1176, 758) : null,
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
  log(
    `External picks: ${EXTERNAL_RECS.length} across ${new Set(EXTERNAL_RECS.map((r) => r.category)).size} categories.`,
  );

  // Internal picks (drawn live from the referenced entity). Skip any whose target
  // is not seeded in this database.
  let internalCount = 0;
  for (const r of INTERNAL_RECS) {
    if (!r.refType || !r.refKind) continue;
    const refId = await resolveRefId(r.refKind);
    if (!refId) {
      log(`Skipped internal ${r.refKind} pick - no seeded ${r.refKind} found.`);
      continue;
    }
    const id = demoId('recommendation', r.key);
    const base = {
      source: r.source,
      category: r.category,
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
 * Remove the demo recommendations (fixed ids). The base "Palm Suite Apartment"
 * (seeded in prisma/seed.ts) is left in place.
 */
export async function cleanRecommendations(): Promise<void> {
  section('Recommendations (clean)');
  const recs = await prisma.recommendation.deleteMany({
    where: { id: { in: DEMO_RECOMMENDATION_IDS } },
  });
  log(`Removed ${recs.count} recommendation(s).`);
}
