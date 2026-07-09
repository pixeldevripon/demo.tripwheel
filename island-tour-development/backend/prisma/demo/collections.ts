// DEMO SEED — editorial collections (MANUAL ordered + DYNAMIC filter-based) with
// translations, page content, ordered membership + per-locale rationale, and the
// COLLECTION slug_registry row (same transaction, critical rule #4).

import {
  CollectionDisplayStyle,
  CollectionStatus,
  CollectionType,
  Locale,
  Prisma,
  SlugEntityType,
} from '@prisma/client';
import {
  ALL_LOCALES,
  DEMO_TOUR_REF,
  img,
  log,
  prisma,
  section,
  stub,
} from './_shared';

interface CollectionDef {
  destinationSlug: string;
  slug: string;
  name: string;
  type: CollectionType;
  displayStyle: CollectionDisplayStyle;
  overview: string;
  curationNote: string;
  eyebrowLabel: string;
  about: string;
  // MANUAL: how to pick tours; DYNAMIC: filterQuery
  pick?: { max: number; localsOnly?: boolean; familyOnly?: boolean };
  filterQuery?: Prisma.InputJsonValue;
  sortOrder?: string;
}

const COLLECTIONS: CollectionDef[] = [
  {
    destinationSlug: 'curacao',
    slug: 'best-things-to-do-in-curacao',
    name: 'Best Things to Do in Curaçao',
    type: CollectionType.MANUAL,
    displayStyle: CollectionDisplayStyle.NUMBERED,
    overview: 'The tours our team books for visiting friends, ranked.',
    curationNote: 'Chosen by Islanders who live and play here.',
    eyebrowLabel: 'BEST THINGS TO DO',
    about:
      'A hand-ranked list of the experiences that show Curaçao at its best — from Klein Curaçao day trips to the reefs and the old town. Updated as new gems earn their place.',
    pick: { max: 8 },
  },
  {
    destinationSlug: 'curacao',
    slug: 'family-favourites-curacao',
    name: 'Family Favourites in Curaçao',
    type: CollectionType.DYNAMIC,
    displayStyle: CollectionDisplayStyle.PERSONA,
    overview: 'Easy, safe and genuinely fun for all ages.',
    curationNote: 'Parent-approved, kid-tested.',
    eyebrowLabel: 'FOR FAMILIES',
    about:
      'Calm-water snorkels, gentle boat trips and short tours that keep little ones smiling. Every tour here is family friendly.',
    filterQuery: { attributes: { family_friendly: true } },
    sortOrder: 'recommended',
  },
  {
    destinationSlug: 'curacao',
    slug: 'local-legends-curacao',
    name: "Locals' Favourites in Curaçao",
    type: CollectionType.MANUAL,
    displayStyle: CollectionDisplayStyle.PERSONA,
    overview: 'Where islanders actually send their visitors.',
    curationNote: 'The real deal, no tourist traps.',
    eyebrowLabel: "LOCALS' PICKS",
    about:
      'The experiences that locals quietly rave about — the captains, guides and spots that make Curaçao special.',
    pick: { max: 6, localsOnly: true },
  },
  {
    destinationSlug: 'aruba',
    slug: 'best-of-aruba-adventures',
    name: 'Best of Aruba Adventures',
    type: CollectionType.MANUAL,
    displayStyle: CollectionDisplayStyle.NUMBERED,
    overview: 'Aruba’s top adrenaline and off-road experiences, ranked.',
    curationNote: 'Picked by guides who run these trails daily.',
    eyebrowLabel: 'TOP ADVENTURES',
    about:
      'From UTV desert runs to the Natural Pool and Arikok safaris, these are the adventures that define an active Aruba trip.',
    pick: { max: 7 },
  },
  {
    destinationSlug: 'aruba',
    slug: 'aruba-water-fun',
    name: 'Aruba Water Fun',
    type: CollectionType.DYNAMIC,
    displayStyle: CollectionDisplayStyle.PERSONA,
    overview: 'Jet skis, parasails and everything splash.',
    curationNote: 'For sun-and-sea days on Palm Beach.',
    eyebrowLabel: 'ON THE WATER',
    about:
      'All the water sports that make Palm Beach buzz — book a morning of jet skiing or float above it all on a parasail.',
    filterQuery: { categories: ['jet-ski', 'parasailing', 'water-sports'] },
    sortOrder: 'recommended',
  },
  {
    destinationSlug: 'sint-maarten',
    slug: 'sint-maarten-highlights',
    name: 'Sint Maarten Highlights',
    type: CollectionType.MANUAL,
    displayStyle: CollectionDisplayStyle.NUMBERED,
    overview: 'The must-do experiences across both sides of the island.',
    curationNote: 'Curated by our Philipsburg crew.',
    eyebrowLabel: 'ISLAND HIGHLIGHTS',
    about:
      'Sunset sails, the Maho Beach plane spotting and both-sides sightseeing — the essential Sint Maarten / Saint-Martin shortlist.',
    pick: { max: 5 },
  },
];

export const COLLECTION_SLUGS = COLLECTIONS.map((c) => c.slug);

export async function seedCollections(): Promise<void> {
  section('Collections');

  const destinations = await prisma.destination.findMany({
    select: { id: true, slug: true },
  });
  const destIdBySlug = new Map(destinations.map((d) => [d.slug, d.id]));

  let created = 0;
  let skipped = 0;

  for (const def of COLLECTIONS) {
    const destinationId = destIdBySlug.get(def.destinationSlug);
    if (!destinationId) continue;

    const existing = await prisma.collection.findUnique({
      where: { destinationId_slug: { destinationId, slug: def.slug } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Resolve member tours for MANUAL collections.
    let memberTours: { id: string }[] = [];
    if (def.type === CollectionType.MANUAL && def.pick) {
      memberTours = await prisma.tour.findMany({
        where: {
          reference: DEMO_TOUR_REF,
          destinationId,
          ...(def.pick.localsOnly ? { isLocalsFavourite: true } : {}),
          ...(def.pick.familyOnly ? { familyFriendly: true } : {}),
        },
        orderBy: [{ tierRank: 'asc' }, { qualityScore: 'desc' }],
        take: def.pick.max,
        select: { id: true },
      });
    }

    await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: {
          destinationId,
          name: def.name,
          slug: def.slug,
          collectionType: def.type,
          tourIds: memberTours.map((t) => t.id), // legacy mirror
          filterQuery: def.filterQuery ?? Prisma.JsonNull,
          heroImage: img(`collection-${def.slug}`, 1600, 900),
          ogImage: img(`collection-${def.slug}-og`, 1200, 630),
          sortOrder: def.sortOrder ?? 'recommended',
          status: CollectionStatus.PUBLISHED,
          displayStyle: def.displayStyle,
          isActive: true,
          isSeeded: false,
        },
      });

      await tx.collectionTranslation.createMany({
        data: ALL_LOCALES.map((locale) => {
          const en = locale === Locale.en;
          return {
            collectionId: collection.id,
            locale,
            name: en ? def.name : stub(locale, def.name),
            overview: en ? def.overview : stub(locale, def.overview),
            curationNote: en
              ? def.curationNote
              : stub(locale, def.curationNote),
            eyebrowLabel: en
              ? def.eyebrowLabel
              : stub(locale, def.eyebrowLabel),
            breadcrumbLabel: en ? def.name : stub(locale, def.name),
            isMachineTranslated: !en,
          };
        }),
      });

      await tx.collectionPageContent.createMany({
        data: ALL_LOCALES.map((locale) => ({
          collectionId: collection.id,
          locale,
          aboutText: locale === Locale.en ? def.about : stub(locale, def.about),
          metaTitle:
            locale === Locale.en
              ? `${def.name} | Island Tours`
              : stub(locale, `${def.name} | Island Tours`),
          metaDescription:
            locale === Locale.en ? def.overview : stub(locale, def.overview),
        })),
      });

      // MANUAL membership + per-locale rationale.
      for (let i = 0; i < memberTours.length; i++) {
        const ct = await tx.collectionTour.create({
          data: {
            collectionId: collection.id,
            tourId: memberTours[i].id,
            position: i,
          },
        });
        const rationale = `Ranked #${i + 1} for its mix of value, scenery and a guide who makes the day.`;
        await tx.collectionTourRationale.createMany({
          data: ALL_LOCALES.map((locale) => ({
            collectionTourId: ct.id,
            locale,
            rationale:
              locale === Locale.en ? rationale : stub(locale, rationale),
          })),
        });
      }

      // COLLECTION slug_registry row (same transaction).
      await tx.slugRegistry.upsert({
        where: {
          destinationSlug_slug: {
            destinationSlug: def.destinationSlug,
            slug: def.slug,
          },
        },
        update: {
          isActive: true,
          entityType: SlugEntityType.COLLECTION,
          entityId: collection.id,
          deletedAt: null,
        },
        create: {
          destinationSlug: def.destinationSlug,
          slug: def.slug,
          entityType: SlugEntityType.COLLECTION,
          entityId: collection.id,
          isActive: true,
        },
      });
    });
    created++;
  }

  log(`Collections: ${created} created, ${skipped} already existed.`);
}
