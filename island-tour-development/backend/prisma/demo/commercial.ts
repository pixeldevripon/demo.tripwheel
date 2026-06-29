// DEMO SEED — commercial engine sample data: Destination Spotlight requests
// (across statuses, <=3 active per destination), a force-majeure pardon, and the
// "Top Island Experiences" FeaturedExperience rows (categories + hubs only).

import {
  FeaturedEntityType,
  Role,
  SpotlightStatus,
} from '@prisma/client';
import { DEMO_TOUR_REF, dayOffset, log, prisma, section, videoUrl } from './_shared';

async function adminUserId(): Promise<string | null> {
  const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN }, select: { id: true } });
  return admin?.id ?? null;
}

export async function seedCommercial(): Promise<void> {
  section('Commercial engine (spotlight, force-majeure, featured experiences)');

  const adminId = await adminUserId();

  // ── Destination Spotlight requests ──
  // One ACTIVE + one REQUESTED per live destination, plus one REJECTED, all on
  // top-tier demo tours. Stays within the max-3-active-per-destination rule.
  const liveDests = await prisma.destination.findMany({ where: { isActive: true }, select: { id: true, slug: true } });
  let spotlightCount = 0;
  const existingSpotlight = await prisma.spotlightRequest.count({ where: { tour: { reference: DEMO_TOUR_REF } } });
  for (const dest of existingSpotlight > 0 ? [] : liveDests) {
    const tours = await prisma.tour.findMany({
      where: { reference: DEMO_TOUR_REF, destinationId: dest.id },
      orderBy: [{ tierRank: 'asc' }, { qualityScore: 'desc' }],
      take: 3,
      select: { id: true, operatorId: true },
    });
    if (tours.length === 0) continue;

    // ACTIVE
    await prisma.spotlightRequest.create({
      data: {
        tourId: tours[0].id,
        operatorId: tours[0].operatorId,
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
    spotlightCount++;

    if (tours[1]) {
      // REQUESTED (pending admin)
      await prisma.spotlightRequest.create({
        data: {
          tourId: tours[1].id,
          operatorId: tours[1].operatorId,
          destinationId: dest.id,
          status: SpotlightStatus.REQUESTED,
          requestedStartsAt: dayOffset(14),
          requestedDurationDays: 21,
          note: 'Requested ahead of the high season.',
        },
      });
      spotlightCount++;
    }
    if (tours[2]) {
      // REJECTED
      await prisma.spotlightRequest.create({
        data: {
          tourId: tours[2].id,
          operatorId: tours[2].operatorId,
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
      const exists = await prisma.forceMajeurePardon.findFirst({ where: { destinationId: sxm.id }, select: { id: true } });
      if (!exists) {
        await prisma.forceMajeurePardon.create({
          data: {
            destinationId: sxm.id,
            startDate: dayOffset(-30),
            endDate: dayOffset(-28),
            reason: 'Tropical storm — all departures cancelled island-wide; operator cancellations pardoned.',
            createdBy: adminId,
          },
        });
        pardonCount++;
      }
    }
  }

  // ── Featured experiences ("Top Island Experiences": categories + hubs only) ──
  const featuredCategorySlugs = ['boat-tours', 'snorkeling', 'sunset-cruises', 'off-road-tours', 'scuba-diving', 'food-tours'];
  const categories = await prisma.category.findMany({ where: { slug: { in: featuredCategorySlugs } }, select: { id: true, slug: true } });
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const kleinCuracao = await prisma.hub.findFirst({ where: { slug: 'klein-curacao' }, select: { id: true } });

  let featuredCount = 0;
  let order = 0;
  for (const slug of featuredCategorySlugs) {
    const id = catBySlug.get(slug);
    if (!id) continue;
    const exists = await prisma.featuredExperience.findFirst({ where: { entityType: FeaturedEntityType.CATEGORY, entityId: id }, select: { id: true } });
    if (exists) continue;
    await prisma.featuredExperience.create({
      data: { entityType: FeaturedEntityType.CATEGORY, entityId: id, destinationId: null, videoUrl: videoUrl(), displayOrder: order++, isActive: true },
    });
    featuredCount++;
  }
  if (kleinCuracao) {
    const exists = await prisma.featuredExperience.findFirst({ where: { entityType: FeaturedEntityType.HUB, entityId: kleinCuracao.id }, select: { id: true } });
    if (!exists) {
      await prisma.featuredExperience.create({
        data: { entityType: FeaturedEntityType.HUB, entityId: kleinCuracao.id, destinationId: null, videoUrl: videoUrl(), displayOrder: order++, isActive: true },
      });
      featuredCount++;
    }
  }

  log(`Commercial: ${spotlightCount} spotlight requests, ${pardonCount} force-majeure pardon, ${featuredCount} featured experiences.`);
}
