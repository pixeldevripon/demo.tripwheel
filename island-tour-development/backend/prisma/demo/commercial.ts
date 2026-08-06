// DEMO SEED — commercial engine sample data: Destination Spotlight requests
// (across statuses, <=3 active per destination), a force-majeure pardon, and the
// "Top Island Experiences" FeaturedExperience cards (standalone label + media -
// purely presentational, no category/hub reference).

import { Role, SpotlightStatus } from '@prisma/client';
import {
  DEMO_TOUR_REF,
  dayOffset,
  log,
  prisma,
  section,
  videoUrl,
} from './_shared';

async function adminUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: { id: true },
  });
  return admin?.id ?? null;
}

export async function seedCommercial(): Promise<void> {
  section('Commercial engine (spotlight, force-majeure, featured experiences)');

  const adminId = await adminUserId();

  // ── Destination Spotlight requests ──
  // One ACTIVE + one REQUESTED per live destination, plus one REJECTED, all on
  // top-tier demo tours. Stays within the max-3-active-per-destination rule.
  const liveDests = await prisma.destination.findMany({
    where: { isActive: true },
    select: { id: true, slug: true },
  });
  let spotlightCount = 0;
  const existingSpotlight = await prisma.spotlightRequest.count({
    where: { tour: { reference: DEMO_TOUR_REF } },
  });
  // The ACTIVE spotlight per destination lands on the badge-showcase "Sponsored"
  // lead (an isLocalsFavourite tour, so it shows in the grid). This mirrors the
  // production flow: an ACTIVE Destination Spotlight is what sets tour.isSponsored
  // -> the "Sponsored" badge (master §3.6 "paid placements"). REQUESTED/REJECTED go
  // on other top tours to populate the admin queue.
  const SPOTLIGHT_ACTIVE_SLUG: Record<string, string> = {
    curacao: 'full-day-catamaran',
    aruba: 'utv-off-road-desert-and-beach-adventure',
    'sint-maarten': 'sunset-catamaran-cruise-with-drinks',
  };
  for (const dest of existingSpotlight > 0 ? [] : liveDests) {
    const activeTour = await prisma.tour.findFirst({
      where: {
        reference: DEMO_TOUR_REF,
        destinationId: dest.id,
        slug: SPOTLIGHT_ACTIVE_SLUG[dest.slug],
      },
      select: { id: true, operatorId: true },
    });
    // Other top tours (excluding the ACTIVE one) for the REQUESTED/REJECTED samples.
    const others = await prisma.tour.findMany({
      where: {
        reference: DEMO_TOUR_REF,
        destinationId: dest.id,
        NOT: { slug: SPOTLIGHT_ACTIVE_SLUG[dest.slug] },
      },
      orderBy: [{ tierRank: 'asc' }, { qualityScore: 'desc' }],
      take: 2,
      select: { id: true, operatorId: true },
    });
    if (!activeTour) continue;

    // ACTIVE - and mirror onto the tour exactly as runSpotlightLifecycle does in prod.
    await prisma.spotlightRequest.create({
      data: {
        tourId: activeTour.id,
        operatorId: activeTour.operatorId,
        destinationId: dest.id,
        status: SpotlightStatus.ACTIVE,
        approvedAt: dayOffset(-7),
        approvedBy: adminId,
        startsAt: dayOffset(-5),
        endsAt: dayOffset(25),
        requestedStartsAt: dayOffset(-7),
        requestedDurationDays: 30,
        note: 'Approved for the summer push.',
      },
    });
    await prisma.tour.update({
      where: { id: activeTour.id },
      data: { isSponsored: true },
    });
    spotlightCount++;

    if (others[0]) {
      // REQUESTED (pending admin)
      await prisma.spotlightRequest.create({
        data: {
          tourId: others[0].id,
          operatorId: others[0].operatorId,
          destinationId: dest.id,
          status: SpotlightStatus.REQUESTED,
          requestedStartsAt: dayOffset(14),
          requestedDurationDays: 21,
          note: 'Requested ahead of the high season.',
        },
      });
      spotlightCount++;
    }
    if (others[1]) {
      // REJECTED
      await prisma.spotlightRequest.create({
        data: {
          tourId: others[1].id,
          operatorId: others[1].operatorId,
          destinationId: dest.id,
          status: SpotlightStatus.REJECTED,
          requestedStartsAt: dayOffset(3),
          requestedDurationDays: 14,
          rejectionReason: 'Spotlight slots for this window are already full.',
        },
      });
      spotlightCount++;
    }
  }

  // ── Force-majeure pardon (e.g. a storm window on Sint Maarten) ──
  let pardonCount = 0;
  if (adminId) {
    const sxm = liveDests.find((d) => d.slug === 'sint-maarten');
    if (sxm) {
      const exists = await prisma.forceMajeurePardon.findFirst({
        where: { destinationId: sxm.id },
        select: { id: true },
      });
      if (!exists) {
        await prisma.forceMajeurePardon.create({
          data: {
            destinationId: sxm.id,
            startDate: dayOffset(-30),
            endDate: dayOffset(-28),
            reason:
              'Tropical storm — all departures cancelled island-wide; operator cancellations pardoned.',
            createdBy: adminId,
          },
        });
        pardonCount++;
      }
    }
  }

  // ── Featured experiences ("Top Island Experiences": standalone cards) ──
  // Purely presentational: a label + poster + video, no category/hub link.
  // Posters ride the category heroes purely as topical stock; the card does
  // not reference the category. Titles are the dedupe key on re-runs.
  const FEATURED_CARDS = [
    { title: 'Boat Tours & Cruises', posterSlug: 'boat-tours' },
    { title: 'Snorkeling', posterSlug: 'snorkeling' },
    { title: 'Sunset Cruises', posterSlug: 'sunset-cruises' },
    { title: 'Off-Road Tours', posterSlug: 'off-road-tours' },
    { title: 'Scuba Diving', posterSlug: 'scuba-diving' },
    { title: 'Food & Drink Tours', posterSlug: 'food-tours' },
    { title: 'Klein Curaçao', posterSlug: null },
  ];
  const posterCategories = await prisma.category.findMany({
    where: { slug: { in: FEATURED_CARDS.flatMap((c) => c.posterSlug ?? []) } },
    select: { slug: true, heroImage: true, ogImage: true },
  });
  const posterBySlug = new Map(
    posterCategories.map((c) => [c.slug, c.heroImage ?? c.ogImage ?? null]),
  );
  const kleinCuracaoHub = await prisma.hub.findFirst({
    where: { slug: 'klein-curacao' },
    select: { heroImage: true, ogImage: true },
  });

  let featuredCount = 0;
  let order = 0;
  for (const card of FEATURED_CARDS) {
    const exists = await prisma.featuredExperience.findFirst({
      where: { title: card.title },
      select: { id: true },
    });
    if (exists) {
      order++;
      continue;
    }
    const posterUrl = card.posterSlug
      ? (posterBySlug.get(card.posterSlug) ?? null)
      : (kleinCuracaoHub?.heroImage ?? kleinCuracaoHub?.ogImage ?? null);
    await prisma.featuredExperience.create({
      data: {
        title: card.title,
        posterUrl,
        videoUrl: videoUrl(),
        displayOrder: order++,
        isActive: true,
      },
    });
    featuredCount++;
  }

  log(
    `Commercial: ${spotlightCount} spotlight requests, ${pardonCount} force-majeure pardon, ${featuredCount} featured experiences.`,
  );
}
