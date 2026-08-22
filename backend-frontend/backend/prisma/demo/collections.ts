// DEMO SEED — editorial collections (MANUAL ordered + DYNAMIC filter-based) with
// translations, page content, ordered membership + per-locale rationale, and the
// COLLECTION slug_registry row (same transaction, critical rule #4).

import {
  CollectionDisplayStyle,
  CollectionStatus,
  CollectionType,
  FaqPageType,
  Locale,
  Prisma,
  SlugEntityType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  ALL_LOCALES,
  DEMO_TOUR_REF,
  log,
  photo,
  type PhotoName,
  prisma,
  section,
} from './_shared';
import { tpl } from './i18n-templates';

// Topical hero per collection (what the collection is actually about).
const COLLECTION_PHOTO: Record<string, PhotoName> = {
  'best-things-to-do-in-curacao': 'willemstad',
  'family-favourites-curacao': 'friendsBeach',
  'local-legends-curacao': 'colonialStreet',
  'best-of-aruba-adventures': 'jeepTrail',
  'aruba-water-fun': 'watersports',
  'sint-maarten-highlights': 'aerialCoast',
};

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
    // Design v2 locked note (collection.html mockup, 5.6).
    curationNote: "Chosen by Islanders, in the order we'd book them.",
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

// Destination display names + signature-experience lines for the FAQ answers.
const DEST_DISPLAY: Record<string, { name: string; highlights: string }> = {
  curacao: {
    name: 'Curaçao',
    highlights:
      'Klein Curaçao day trips, reef snorkels, sunset cruises, and off-road buggy tours',
  },
  aruba: {
    name: 'Aruba',
    highlights:
      'UTV desert adventures, Palm Beach water sports, catamaran sails, and the Natural Pool',
  },
  'sint-maarten': {
    name: 'Sint Maarten',
    highlights:
      'sunset catamaran cruises, Pinel Island snorkelling, and two-nation sightseeing loops',
  },
};

/**
 * Collection-page FAQ set (Figma node 47433:2306) - 6 questions about the
 * destination's signature experiences and the booking basics. Question ORDER
 * matches the localized collFaqs templates (per-locale rows align by index).
 */
function collectionFaqsFor(def: CollectionDef): { q: string; a: string }[] {
  const dest = DEST_DISPLAY[def.destinationSlug] ?? {
    name: def.destinationSlug,
    highlights: 'boat days, reef snorkels, and island sightseeing',
  };
  return [
    {
      q: `What are the best things to do in ${dest.name}?`,
      a: `The best things to do in ${dest.name} include ${dest.highlights}. These are the island's signature experiences - a mix of offshore adventures and on-island exploration that covers everything ${dest.name} is known for.`,
    },
    {
      q: `How far in advance should I book these tours?`,
      a: `In high season the popular departures sell out weeks ahead, so book as soon as your dates are fixed. Every booking confirms instantly and cancels free up to the window on the tour page, so reserving early carries no risk.`,
    },
    {
      q: `When is the best time to visit ${dest.name}?`,
      a: `${dest.name} is a year-round destination. January to August is the driest, sunniest stretch; September to December brings warmer water and fewer crowds - and these tours run in every season.`,
    },
    {
      q: `Do these tours include hotel pickup?`,
      a: `Some include pickup or offer it as an extra; the rest list a clear meeting point with a map and check-in time on the tour page, always close to the main hotel areas.`,
    },
    {
      q: `Can I combine multiple tours in one trip?`,
      a: `Absolutely - most tours run a half or full day, so two or three experiences in a week is completely normal. Leave a rest day between long boat days and you have the perfect itinerary.`,
    },
    {
      q: `How does Island Tours choose which tours to feature?`,
      a: `Our local team picks on experience, traveller reviews, and how our own staff rate each operator on the water. A spot on this list cannot be bought - a tour earns it.`,
    },
  ];
}

/** Deterministic per-collection FAQ rows (replace on each run), all locales. */
async function seedCollectionFaqs(
  tx: Prisma.TransactionClient,
  collectionId: string,
  def: CollectionDef,
): Promise<void> {
  await tx.faq.deleteMany({
    where: { pageType: FaqPageType.collection, entityId: collectionId },
  });
  const items = collectionFaqsFor(def);
  const destName = (
    DEST_DISPLAY[def.destinationSlug] ?? { name: def.destinationSlug }
  ).name;
  const rows: Prisma.FaqCreateManyInput[] = [];
  items.forEach((item, idx) => {
    const faqGroupId = randomUUID();
    for (const locale of ALL_LOCALES) {
      const loc = tpl(locale)?.collFaqs(destName)[idx];
      rows.push({
        pageType: FaqPageType.collection,
        entityId: collectionId,
        faqGroupId,
        locale,
        question: loc?.q ?? item.q,
        answer: loc?.a ?? item.a,
        displayOrder: idx,
        isActive: true,
      });
    }
  });
  await tx.faq.createMany({ data: rows });
}

export async function seedCollections(): Promise<void> {
  section('Collections');

  const destinations = await prisma.destination.findMany({
    select: { id: true, slug: true },
  });
  const destIdBySlug = new Map(destinations.map((d) => [d.slug, d.id]));

  let created = 0;
  let refreshed = 0;

  for (const def of COLLECTIONS) {
    const destinationId = destIdBySlug.get(def.destinationSlug);
    if (!destinationId) continue;

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

    const collectionData = {
      name: def.name,
      slug: def.slug,
      collectionType: def.type,
      tourIds: memberTours.map((t) => t.id), // legacy mirror
      filterQuery: def.filterQuery ?? Prisma.JsonNull,
      // Hero intentionally not seeded (dashboard-managed); the page
      // renders its neutral fallback. OG stays topical for share cards.
      heroImage: null,
      ogImage: photo(COLLECTION_PHOTO[def.slug] ?? 'beachClassic', 1200, 630),
      sortOrder: def.sortOrder ?? 'recommended',
      status: CollectionStatus.PUBLISHED,
      displayStyle: def.displayStyle,
      isActive: true,
      isSeeded: false,
    };

    // Re-seedable: refresh an existing collection's content (including its
    // recomputed membership) instead of skipping it, so a VPS re-run picks up
    // blueprint changes. Translations and tour links are only built on first
    // create - rebuilding them would drop admin edits.
    const existing = await prisma.collection.findUnique({
      where: { destinationId_slug: { destinationId, slug: def.slug } },
      select: { id: true },
    });
    if (existing) {
      await prisma.collection.update({
        where: { id: existing.id },
        data: collectionData,
      });
      refreshed++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({
        data: { destinationId, ...collectionData },
      });

      await tx.collectionTranslation.createMany({
        data: ALL_LOCALES.map((locale) => {
          const en = locale === Locale.en;
          return {
            collectionId: collection.id,
            locale,
            name: def.name,
            overview: def.overview,
            curationNote: def.curationNote,
            eyebrowLabel: def.eyebrowLabel,
            breadcrumbLabel: def.name,
            isMachineTranslated: !en,
          };
        }),
      });

      await tx.collectionPageContent.createMany({
        data: ALL_LOCALES.map((locale) => ({
          collectionId: collection.id,
          locale,
          aboutText: def.about,
          metaTitle: `${def.name} | Island Tours`,
          metaDescription: def.overview,
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
            rationale,
          })),
        });
      }

      // FAQs about the list itself (rendered by the collection page).
      await seedCollectionFaqs(tx, collection.id, def);

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

  log(`Collections: ${created} created, ${refreshed} refreshed in place.`);
}
