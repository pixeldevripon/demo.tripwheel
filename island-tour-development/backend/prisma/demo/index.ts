// DEMO SEED — orchestrator. Runs the demo modules in dependency order, and
// provides cleanDemo() to remove the demo graph.
//
// This is NOT run by the production build. Invoke with `pnpm prisma:seed:demo`
// (the base `pnpm prisma:seed` must have run first to create the admin user,
// categories, destinations, hubs, and attribute dictionary that this depends on).

import { SlugEntityType } from '@prisma/client';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_TOUR_REF,
  DEMO_WEBHOOK_HOST,
  prisma,
} from './_shared';
import { seedUsersAndOperators } from './users-operators';
import { DEMO_SUBCATEGORY_SLUGS, seedSubCategories } from './sub-categories';
import { seedTours } from './tours';
import { seedAvailability } from './availability';
import { seedBookingsAndPayments } from './bookings-payments';
import { seedReviews } from './reviews';
import { seedDemandShowcase } from './demand-showcase';
import { COLLECTION_SLUGS, seedCollections } from './collections';
import { seedCommercial } from './commercial';
import { seedEngagement } from './engagement';
import { seedEntityContent } from './entity-content';
import { seedSettings } from './settings';
import { seedCustomers, seedReviewDemoLinks } from './customers';

async function assertBaseSeed(): Promise<void> {
  const [dest, cat] = await Promise.all([
    prisma.destination.count(),
    prisma.category.count(),
  ]);
  if (dest === 0 || cat === 0) {
    throw new Error(
      'Base seed missing (no destinations/categories). Run `pnpm prisma:seed` first, then `pnpm prisma:seed:demo`.',
    );
  }
}

export async function runDemoSeed(): Promise<void> {
  console.log(
    '\n════════════ DEMO SEED (removable; not for production) ════════════',
  );
  await assertBaseSeed();

  await seedUsersAndOperators(); // users + operators + configs
  await seedSubCategories(); // filter-only sub-categories (before tours, no slug_registry)
  await seedTours(); // tours + all children + TOUR slug_registry
  await seedAvailability(); // schedules + exceptions + departures
  await seedBookingsAndPayments(); // bookings + unit items + add-ons + payments
  await seedReviews(); // reviews + translations + aggregate recompute
  await seedDemandShowcase(); // §3.7 sellout setup + likelyToSellOut recompute (badge showcase)
  await seedCollections(); // collections + membership + COLLECTION slug_registry
  await seedCommercial(); // spotlight + force-majeure + featured experiences
  await seedEngagement(); // wishlists + notifications
  await seedEntityContent(); // dest/cat/hub translations + page content + FAQs + hub editorial
  await seedSettings(); // singletons + webhooks + media
  await seedCustomers(); // user <-> operator relationships for the customer list
  // LAST: reserves un-reviewed bookings + restores the fixed demo review links.
  // Must follow seedReviews, which would otherwise review the pool away.
  await seedReviewDemoLinks();

  console.log('\n════════════ DEMO SEED COMPLETE ════════════');
  console.log(
    `Demo login password: see DEMO_PASSWORD env (default DemoPass123!).`,
  );
  console.log(
    `Operator logins: op.<key>@${DEMO_EMAIL_DOMAIN} · Traveler logins: traveler.<key>@${DEMO_EMAIL_DOMAIN}\n`,
  );
}

export async function cleanDemo(): Promise<void> {
  console.log('\n════════════ DEMO CLEAN — removing demo graph ════════════');

  // Capture demo tour slugs before deletion (for slug_registry cleanup).
  const demoTours = await prisma.tour.findMany({
    where: { reference: DEMO_TOUR_REF },
    select: { slug: true, destination: { select: { slug: true } } },
  });

  // 1) Reviews + bookings on demo tours (cascades translations, payments, items, add-ons).
  await prisma.review.deleteMany({
    where: { tour: { reference: DEMO_TOUR_REF } },
  });
  await prisma.booking.deleteMany({
    where: { tour: { reference: DEMO_TOUR_REF } },
  });

  // 2) Collections (demo slugs) + their FAQs (polymorphic - no FK cascade) +
  //    their slug_registry rows.
  const demoCollections = await prisma.collection.findMany({
    where: { slug: { in: COLLECTION_SLUGS } },
    select: { id: true },
  });
  if (demoCollections.length) {
    await prisma.faq.deleteMany({
      where: {
        pageType: 'collection',
        entityId: { in: demoCollections.map((c) => c.id) },
      },
    });
  }
  await prisma.collection.deleteMany({
    where: { slug: { in: COLLECTION_SLUGS } },
  });
  await prisma.slugRegistry.deleteMany({
    where: {
      slug: { in: COLLECTION_SLUGS },
      entityType: SlugEntityType.COLLECTION,
    },
  });

  // 3) Demo-only commercial tables.
  await prisma.featuredExperience.deleteMany({});
  await prisma.forceMajeurePardon.deleteMany({});

  // 3b) Seeded Instagram tiles only (demo/ig- prefix). Tiles an admin curated
  //     by hand carry a media-library publicId and are deliberately left alone.
  await prisma.instagramPost.deleteMany({
    where: { imagePublicId: { startsWith: 'demo/ig-' } },
  });

  // 4) TOUR slug_registry rows, then the demo tours (cascades all tour children,
  //    schedules, exceptions, departures, spotlight requests, wishlists, etc.).
  for (const t of demoTours) {
    await prisma.slugRegistry.deleteMany({
      where: {
        destinationSlug: t.destination.slug,
        slug: t.slug,
        entityType: SlugEntityType.TOUR,
      },
    });
  }
  await prisma.tour.deleteMany({ where: { reference: DEMO_TOUR_REF } });

  // 4b) Demo sub-categories (filter-only; no slug_registry). Drop any lingering
  //     tour links first, then the category rows.
  await prisma.tourCategory.deleteMany({
    where: { category: { slug: { in: DEMO_SUBCATEGORY_SLUGS } } },
  });
  await prisma.category.deleteMany({
    where: { slug: { in: DEMO_SUBCATEGORY_SLUGS } },
  });

  // 5) Notification subscriptions (cascades deliveries) + lead webhook points.
  await prisma.notificationSubscription.deleteMany({
    where: { url: { contains: DEMO_WEBHOOK_HOST } },
  });
  await prisma.webhookPoint.deleteMany({
    where: { url: { contains: DEMO_WEBHOOK_HOST } },
  });

  // 6) Demo media - the seeded assets (demo/ prefix) plus anything a demo
  // account uploaded while testing the dashboard (blocks the user delete).
  const demoUserIds = (
    await prisma.user.findMany({
      where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
      select: { id: true },
    })
  ).map((u) => u.id);
  await prisma.mediaGallery.deleteMany({
    where: {
      OR: [
        { publicId: { startsWith: 'demo/' } },
        ...(demoUserIds.length ? [{ userId: { in: demoUserIds } }] : []),
      ],
    },
  });

  // 7) Operators (configs first; companyInfo cascades) for demo accounts.
  const demoOps = await prisma.operator.findMany({
    where: { user: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
    select: { id: true },
  });
  const opIds = demoOps.map((o) => o.id);
  if (opIds.length) {
    await prisma.operatorSocialMedia.deleteMany({
      where: { operatorId: { in: opIds } },
    });
    await prisma.operatorStripeConfig.deleteMany({
      where: { operatorId: { in: opIds } },
    });
    await prisma.operatorMollieConfig.deleteMany({
      where: { operatorId: { in: opIds } },
    });
    await prisma.operator.deleteMany({ where: { id: { in: opIds } } });
  }

  // 8) Demo users (cascades sessions, accounts, remaining wishlists).
  await prisma.user.deleteMany({
    where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } },
  });

  console.log(
    'Demo graph removed. (Entity editorial content + settings singletons left in place — they are idempotent on re-seed.)\n',
  );
}
