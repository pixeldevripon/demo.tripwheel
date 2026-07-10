// DEMO SEED — editorial content for the ALREADY-SEEDED entities (destinations,
// categories, hubs): per-locale translations + page content + FAQs, plus the hub
// editorial blocks (content sections, "our picks", comparison groups).
//
// The base destination/category/hub ROWS are not recreated — only their content.

import {
  FaqPageType,
  HubPickType,
  HubSectionType,
  HubStatus,
  Locale,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  ALL_LOCALES,
  DEMO_TOUR_REF,
  NON_EN_LOCALES,
  img,
  log,
  prisma,
  section,
  stub,
} from './_shared';

function faqsFor(label: string): { q: string; a: string }[] {
  return [
    {
      q: `What is the best time to visit ${label}?`,
      a: `${label} is a year-round destination. The driest, sunniest months run from roughly January to August, while September to December brings warmer water and fewer crowds.`,
    },
    {
      q: `Do I need to book tours in ${label} in advance?`,
      a: `Popular tours sell out in high season, so booking ahead is recommended. Every tour on Island Tours offers instant confirmation and free cancellation, so there is no risk in securing your spot early.`,
    },
    {
      q: `Can tours be cancelled if my plans change?`,
      a: `Yes. Every tour includes free cancellation up to the window shown on the tour page, with no questions asked.`,
    },
  ];
}

function categoryFaqsFor(label: string): { q: string; a: string }[] {
  const lower = label.toLowerCase();
  return [
    {
      q: `How do I choose the right ${lower.replace(/s$/, '')} for my trip?`,
      a: `Compare ${lower} by price, duration, and traveller rating. Every listing shows exactly what is included, so you can pick the one that fits your group and budget.`,
    },
    {
      q: `Do ${lower} need to be booked in advance?`,
      a: `Popular departures sell out in high season, so booking ahead is recommended. Every tour on Island Tours confirms instantly, so there is no waiting for approval.`,
    },
    {
      q: `Can I cancel a booking if my plans change?`,
      a: `Yes. Every tour includes free cancellation up to the window shown on the tour page, with no questions asked.`,
    },
  ];
}

async function ensureFaqs(
  pageType: FaqPageType,
  entityId: string,
  label: string,
  customItems?: { q: string; a: string }[],
): Promise<number> {
  const existing = await prisma.faq.findFirst({
    where: { pageType, entityId },
    select: { id: true },
  });
  if (existing) return 0;
  const items =
    customItems ??
    (pageType === 'category' ? categoryFaqsFor(label) : faqsFor(label));
  const rows: Prisma.FaqCreateManyInput[] = [];
  items.forEach((item, idx) => {
    // One faqGroupId per logical FAQ links its per-locale rows (English is the base).
    const faqGroupId = randomUUID();
    ALL_LOCALES.forEach((locale) => {
      const en = locale === Locale.en;
      rows.push({
        pageType,
        entityId,
        faqGroupId,
        locale,
        question: en ? item.q : stub(locale, item.q),
        answer: en ? item.a : stub(locale, item.a),
        displayOrder: idx,
        isActive: true,
      });
    });
  });
  await prisma.faq.createMany({ data: rows });
  return rows.length;
}

// ── Klein Curaçao: rich, Figma-matching hub content ──────────────────────────
// Verbatim editorial from the hub design (node 48024:11145). Bound to the demo
// Klein Curaçao tour blueprints by slug (see prisma/demo/tours.ts). Used only for
// the `klein-curacao` hub; sibling hubs fall back to the generic content below.
const KLEIN = {
  // Editorial lead ("Why Klein Curaçao"): two paragraphs (blank-line separated so
  // the page splits them).
  lead: [
    "The best beach in Curaçao isn't on Curaçao. Klein Curaçao lies 10km offshore - a flat, uninhabited island where nothing stays except a lighthouse built in 1877 and sea turtles that return here to nest every year. No shops. No signal. Just one of the longest stretches of white sand in the Caribbean. A full day to disappear. We've been on every boat that makes the trip. We've never met anyone who regretted going.",
    "The crossing sails against the trade winds. Some mornings it's glass-smooth. Others, the catamaran earns its way there. Worth it. All of it.",
  ].join('\n\n'),
  tagline: 'Where islanders send their visitors',
  fastFacts: [
    { heading: 'Duration', body: 'Full day, 8 to 9h' },
    { heading: 'Crossing', body: '45min to 1.5h each way' },
    { heading: 'Distance', body: '10 km offshore' },
    { heading: 'Price', body: 'From $120' },
    { heading: 'Lunch', body: 'BBQ lunch included' },
    { heading: 'Departures', body: 'Daily' },
  ],
  // "Our Klein Curaçao" deep-dive cards (Discover), each with a photo.
  discover: [
    {
      heading: 'The White Beach',
      body: "Klein Curaçao has one of the longest white-sand beaches in the Caribbean: over a kilometre of fine, powdery sand along the calm, reef-protected south shore. The water runs in bands of turquoise to deep blue, shallow and clear right off the sand. It's the reason most people make the trip, a full day on an undeveloped beach with nothing built on it and no crowds beyond the day boats. The north shore is the opposite: rough, windswept, and where the wrecks lie.",
      imageSeed: 'hub-klein-white-beach',
    },
    {
      heading: 'History',
      body: "In 1871, British mining engineer John Godden found phosphate on Klein Curaçao, left by centuries of nesting birds. Within fifteen years, they had dug out around 90,000 tons for fertiliser and cattle feed, leaving the island around 3 metres lower and stripped bare, which is why it's flat and treeless today. In the 1700s and 1800s, the West India Company used it as a quarantine station.",
      imageSeed: 'hub-klein-history',
    },
    {
      heading: 'Sea Turtles',
      body: "Klein Curaçao is a protected nesting ground for three sea turtle species: Hawksbill, Loggerhead, and Green sea turtles. The whole island is a protected Ramsar wetland and a designated Important Bird Area. Those hatched here return year after year to the same beach to nest. While snorkeling you'll very likely see them grazing in the shallows, with the best chance during nesting season, March to October. Watch and swim alongside them, but never touch.",
      imageSeed: 'hub-klein-turtles',
    },
    {
      heading: 'Snorkeling & Diving',
      body: "Klein Curaçao's eastern reef is one of the healthiest untouched coral systems left in the Caribbean, rare in a region where bleaching has hit most reefs hard. With visibility up to 30 metres, you take in coral formations, underwater caves, and dense fish life: a real dive site, not just a snorkel stop. One operator runs the island's only dive school, and snorkel gear comes standard.",
      imageSeed: 'hub-klein-snorkeling',
    },
    {
      heading: 'The Pink Lighthouse',
      body: "Klein Curaçao's pink lighthouse, officially the Prins Hendrik tower, stands 20 metres tall in the middle of the island as its standout landmark. First built in 1850, it was destroyed by a hurricane in 1877, rebuilt in 1879, and first lit in 1913. Stairs added in 2017 let you climb to the top for a view over the whole island, though they're weathered and unmaintained now.",
      imageSeed: 'hub-klein-lighthouse',
    },
    {
      heading: 'Shipwrecks',
      body: "Klein Curaçao's north shore holds three shipwrecks. Low and hard to spot, with strong currents, the island has caught out passing boats for centuries. The most visible is the Maria Bianca Guidesman, an oil tanker stranded in 1988. Two French sailing yachts lie nearby. Wind, salt, and sand are slowly reclaiming all three. The north-shore walk takes you right past them.",
      imageSeed: 'hub-klein-shipwrecks',
    },
  ],
  // "What we tell first-timers" (Local Tips).
  localTips: [
    {
      heading: 'Sit at the back',
      body: 'Heading out, you sail straight into the trade winds, so the front of the boat takes the chop. Sit at the back, ideally back-centre, keep your eyes on the horizon, and most stomachs settle fast.',
    },
    {
      heading: 'No need to rush ashore',
      body: 'There are enough beach beds and palapas for everyone, so take your time getting off the boat. The only perk of the first dinghy is first pick of your spot for the day.',
    },
    {
      heading: 'Bring reef-safe sunscreen',
      body: 'The sun out here is fierce and bounces off the water and white sand, so reapply often. Go reef-safe: the reef is protected, and ordinary sunscreen harms the coral.',
    },
    {
      heading: 'Barely any phone signal',
      body: "Signal is weak and patchy. You'll catch a bit out on the pier or up in the watchtower, but mostly you're off the grid, so tell people at home before you sail and enjoy a full day unplugged.",
    },
    {
      heading: 'Book weeks ahead',
      body: 'This isn\'t the usual "limited availability" line: boats to Klein Curaçao genuinely sell out three to four weeks ahead, year-round. If your dates are fixed, lock it in early.',
    },
    {
      heading: 'Mind the lighthouse stairs',
      body: 'You can climb to the top for a view over the whole island, but the stairs are weathered and unmaintained. Take them slowly, watch your footing, and hold on.',
    },
  ],
  // Our Picks (Best overall / Most popular / Best for families) - bound by slug.
  picks: [
    {
      tourSlug: 'klein-curacao-super-yacht-beach-house',
      pickType: HubPickType.BEST_OVERALL,
      description:
        "The island's only dive school, a massage with a million-dollar view, and a fully equipped beach house all on a quieter stretch, set apart from the other boats.",
    },
    {
      tourSlug: 'klein-curacao-catamaran-open-bar',
      pickType: HubPickType.MOST_POPULAR,
      description:
        'The biggest catamarans on the island and the best open bar of any Klein Curaçao trip. Most-booked year after year for the ultimate Caribbean sailing vibe.',
    },
    {
      tourSlug: 'klein-curacao-family-boat-beach-house',
      pickType: HubPickType.BEST_FOR_FAMILIES,
      description:
        'A beach house with its own watch-tower and a 360° view over the whole island. A calm, steady boat. Easy and relaxed for families and friends.',
    },
  ],
  // Comparison groups (Comfort / Adventure) - columns bound by slug + standoutNote.
  comparison: [
    {
      groupName: 'Comfort trips',
      tours: [
        {
          tourSlug: 'klein-curacao-super-yacht-beach-house',
          note: 'Dive school, massage with a view',
        },
        {
          tourSlug: 'klein-curacao-family-boat-beach-house',
          note: '360° watch tower',
        },
        {
          tourSlug: 'klein-curacao-catamaran-open-bar',
          note: 'Spacious catamaran, luxury on board',
        },
      ],
    },
    {
      groupName: 'Adventure trips',
      tours: [
        {
          tourSlug: 'klein-curacao-powerboat-adventure',
          note: 'Fastest crossing, no seasickness',
        },
        {
          tourSlug: 'klein-curacao-sailing-catamaran-breakfast',
          note: 'Lowest price',
        },
        {
          tourSlug: 'klein-curacao-full-day-catamaran',
          note: 'Biggest catamarans, premium bar',
        },
      ],
    },
  ],
  faqs: [
    {
      q: 'Is Klein Curaçao worth it?',
      a: 'Yes. Most visitors call it the highlight of their trip: over a kilometre of untouched white sand, water clear enough to snorkel straight off the beach, and no development beyond a lighthouse. It is a long day on the water, but the island itself is like nowhere else on Curaçao.',
    },
    {
      q: 'How long is the boat trip to Klein Curaçao?',
      a: 'The crossing takes 45 minutes on a fast powerboat and up to about 1.5 hours by sailing catamaran, each way. Most trips leave early and give you five to six hours on the island.',
    },
    {
      q: 'What should I bring to Klein Curaçao?',
      a: 'Reef-safe sunscreen, water shoes, a hat and sunglasses, and a towel. There is no shade beyond the boat awnings and beach palapas, so sun protection matters. Snorkel gear and lunch are included on most trips.',
    },
    {
      q: 'Is there phone signal on Klein Curaçao?',
      a: 'Barely. Signal is weak and patchy across the island, so plan to be largely off the grid for the day and let people at home know beforehand.',
    },
    {
      q: 'Can you snorkel with sea turtles at Klein Curaçao?',
      a: 'Very likely. The island is a protected nesting ground for Hawksbill, Loggerhead, and Green turtles, and you will often see them grazing in the shallows. Swim alongside them but never touch.',
    },
    {
      q: 'Is Klein Curaçao suitable for families?',
      a: 'Yes. Calmer, steady boats and shaded seating make the crossing easy for children, and the reef-protected south shore is shallow and clear. Choose a family boat or catamaran rather than the fastest powerboat for the smoothest ride.',
    },
    {
      q: 'When is the best time to visit Klein Curaçao?',
      a: 'Trips run year-round. The water is calmest and clearest in the morning, and turtle nesting season (March to October) is the best window for turtle sightings. Boats sell out weeks ahead in high season, so book early.',
    },
  ],
};

export async function seedEntityContent(): Promise<void> {
  section('Entity content (destinations / categories / hubs)');

  // ── Destinations ──
  const destinations = await prisma.destination.findMany({
    select: { id: true, slug: true, name: true },
  });
  let destTr = 0;
  let destPc = 0;
  let faqRows = 0;
  for (const d of destinations) {
    const overview = `Tucked into the southern Caribbean, ${d.name} pairs turquoise water and powder-soft beaches with a culture all its own. From reef snorkels to sunset sails, these are tours picked by locals who know every cove.`;
    const about = `${d.name} is one of the Caribbean’s most rewarding islands to explore. Spend your days diving vibrant reefs, cruising to hidden beaches, and tasting the island’s blend of cultures. Every experience here is run by a vetted local operator.`;
    // Demo media: hero, social-share (OG), and a small gallery for the destination page.
    await prisma.destination.update({
      where: { id: d.id },
      data: {
        heroImage: img(`dest-${d.slug}`, 1600, 900),
        ogImage: img(`dest-${d.slug}-og`, 1200, 630),
        galleryImages: [
          img(`dest-${d.slug}-1`, 1200, 800),
          img(`dest-${d.slug}-2`, 1200, 800),
          img(`dest-${d.slug}-3`, 1200, 800),
        ],
      },
    });
    // Destination names are proper nouns — keep the real name, localize only the prose.
    await prisma.destinationTranslation.createMany({
      data: ALL_LOCALES.map((locale) => ({
        destinationId: d.id,
        locale,
        name: d.name,
        overview: locale === Locale.en ? overview : stub(locale, overview),
        breadcrumbLabel: d.name,
        isMachineTranslated: false,
      })),
      skipDuplicates: true,
    });
    destTr += ALL_LOCALES.length;
    await prisma.destinationPageContent.createMany({
      data: ALL_LOCALES.map((locale) => ({
        destinationId: d.id,
        locale,
        aboutText: locale === Locale.en ? about : stub(locale, about),
        metaTitle:
          locale === Locale.en
            ? `${d.name} Tours & Activities | Island Tours`
            : stub(locale, `${d.name} Tours & Activities | Island Tours`),
        metaDescription:
          locale === Locale.en ? overview : stub(locale, overview),
      })),
      skipDuplicates: true,
    });
    destPc += ALL_LOCALES.length;
    faqRows += await ensureFaqs('destination', d.id, d.name);
  }

  // ── Categories ──
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  });
  let catTr = 0;
  let catPc = 0;
  for (const c of categories) {
    const overview = `Browse the best ${c.name.toLowerCase()} across the islands — each one vetted, instantly bookable, and backed by free cancellation.`;
    const about = `Looking for ${c.name.toLowerCase()}? You are in the right place. Compare options by price, duration, and traveller rating, then book the one that fits your trip.`;
    const h1 = `Best ${c.name}`;
    // Fill the entity-level gaps the prod seed leaves empty (OG image, canonical
    // description). Icon stays null - the frontend falls back to
    // CATEGORY_ICON_BY_SLUG.
    await prisma.category.update({
      where: { id: c.id },
      data: {
        ogImage: img(`cat-${c.slug}-og`, 1200, 630),
        description: overview,
      },
    });
    await prisma.categoryTranslation.createMany({
      data: ALL_LOCALES.map((locale) => ({
        categoryId: c.id,
        locale,
        // EN row keeps name null (falls back to Category.name); others get a stub name.
        name: locale === Locale.en ? null : stub(locale, c.name),
        overview: locale === Locale.en ? overview : stub(locale, overview),
        h1Override: locale === Locale.en ? h1 : stub(locale, h1),
        breadcrumbLabel: locale === Locale.en ? null : stub(locale, c.name),
        isMachineTranslated: locale !== Locale.en,
      })),
      skipDuplicates: true,
    });
    catTr += ALL_LOCALES.length;
    await prisma.categoryPageContent.createMany({
      data: ALL_LOCALES.map((locale) => ({
        categoryId: c.id,
        locale,
        aboutText: locale === Locale.en ? about : stub(locale, about),
        metaTitle:
          locale === Locale.en
            ? `${c.name} | Island Tours`
            : stub(locale, `${c.name} | Island Tours`),
        metaDescription:
          locale === Locale.en ? overview : stub(locale, overview),
      })),
      skipDuplicates: true,
    });
    catPc += ALL_LOCALES.length;
    faqRows += await ensureFaqs('category', c.id, c.name);
  }

  // ── Hubs (klein-curacao and any other seeded hub) ──
  const hubs = await prisma.hub.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      destinationId: true,
      heroImage: true,
      hubType: true,
      status: true,
    },
  });
  let hubTr = 0;
  let hubExtras = 0;
  for (const h of hubs) {
    const isKlein = h.slug === 'klein-curacao';

    // Ensure the hub is published + has a hero (it was seeded minimal).
    await prisma.hub.update({
      where: { id: h.id },
      data: {
        heroImage: h.heroImage ?? img(`hub-${h.slug}`, 1600, 900),
        ogImage: img(`hub-${h.slug}-og`, 1200, 630),
        status: HubStatus.PUBLISHED,
        latitude: 11.985,
        longitude: -68.645,
      },
    });

    const overview = isKlein
      ? KLEIN.lead
      : `Why ${h.name}? It is the day trip islanders send every visitor on - pristine sand, calm turquoise shallows, and snorkeling over shipwrecks and turtle grounds.`;
    const tagline = KLEIN.tagline;
    // Deterministic: replace the full editorial set each run (demo re-seed safe).
    await prisma.hubTranslation.deleteMany({ where: { hubId: h.id } });
    await prisma.hubTranslation.createMany({
      data: ALL_LOCALES.map((locale) => ({
        hubId: h.id,
        locale,
        name: h.name,
        overview: locale === Locale.en ? overview : stub(locale, overview),
        heroTagline: locale === Locale.en ? tagline : stub(locale, tagline),
        // h1Override is required by the hub publish-readiness check, so seed it
        // (otherwise a force-published demo hub fails its own guard).
        h1Override: h.name,
        breadcrumbLabel: h.name,
        isMachineTranslated: false,
      })),
    });
    hubTr += ALL_LOCALES.length;

    const about = `${h.name} is a highlight of any trip to the island. Reachable only by boat, it rewards the early start with some of the clearest water in the Caribbean.`;
    await prisma.hubPageContent.deleteMany({ where: { hubId: h.id } });
    await prisma.hubPageContent.createMany({
      data: ALL_LOCALES.map((locale) => ({
        hubId: h.id,
        locale,
        aboutText: locale === Locale.en ? about : stub(locale, about),
        metaTitle:
          locale === Locale.en
            ? `${h.name} | Island Tours`
            : stub(locale, `${h.name} | Island Tours`),
        metaDescription:
          locale === Locale.en ? overview : stub(locale, overview),
      })),
    });

    // FAQs: Klein gets the 7 AEO questions from the design; siblings the generic set.
    await prisma.faq.deleteMany({ where: { pageType: 'hub', entityId: h.id } });
    faqRows += await ensureFaqs(
      'hub',
      h.id,
      h.name,
      isKlein ? KLEIN.faqs : undefined,
    );

    // ── Content sections (Fast Facts / Discover / Local Tips), per locale ──
    await prisma.hubContentSection.deleteMany({ where: { hubId: h.id } });
    const sections: {
      type: HubSectionType;
      heading: string;
      body: string;
      order: number;
      image?: string;
    }[] = isKlein
      ? [
          ...KLEIN.fastFacts.map((f, i) => ({
            type: HubSectionType.FAST_FACT,
            heading: f.heading,
            body: f.body,
            order: i,
          })),
          ...KLEIN.discover.map((d, i) => ({
            type: HubSectionType.DISCOVER,
            heading: d.heading,
            body: d.body,
            order: i,
            image: img(d.imageSeed, 1280, 854),
          })),
          ...KLEIN.localTips.map((t, i) => ({
            type: HubSectionType.LOCAL_TIP,
            heading: t.heading,
            body: t.body,
            order: i,
          })),
        ]
      : [
          {
            type: HubSectionType.DISCOVER,
            heading: 'Getting there',
            body: 'The crossing takes around 90 minutes by catamaran or speedboat. Most trips leave early to make the most of the calm morning water.',
            order: 0,
            image: img(`hub-${h.slug}-getting-there`, 1280, 854),
          },
          {
            type: HubSectionType.DISCOVER,
            heading: 'What to do',
            body: 'Snorkel the reef, walk the coast, or simply claim a patch of sand and relax.',
            order: 1,
            image: img(`hub-${h.slug}-what-to-do`, 1280, 854),
          },
          {
            type: HubSectionType.LOCAL_TIP,
            heading: 'Local tip',
            body: 'Bring water shoes and book the earliest departure for the calmest seas.',
            order: 0,
          },
          {
            type: HubSectionType.FAST_FACT,
            heading: 'Good to know',
            body: 'Uninhabited · No shade beyond the boat awnings · Lunch is included on full-day trips.',
            order: 0,
          },
        ];
    const sectionRows: Prisma.HubContentSectionCreateManyInput[] = [];
    for (const s of sections) {
      for (const locale of ALL_LOCALES) {
        const en = locale === Locale.en;
        sectionRows.push({
          hubId: h.id,
          locale,
          sectionType: s.type,
          heading: en ? s.heading : stub(locale, s.heading),
          body: en ? s.body : stub(locale, s.body),
          image: s.image ?? null,
          displayOrder: s.order,
        });
      }
    }
    await prisma.hubContentSection.createMany({ data: sectionRows });
    hubExtras += sectionRows.length;

    // ── Our Picks + comparison (need tours linked to this hub) ──
    await prisma.hubOurPick.deleteMany({ where: { hubId: h.id } });
    await prisma.hubComparisonGroup.deleteMany({ where: { hubId: h.id } });

    const hubTours = await prisma.tour.findMany({
      where: { reference: DEMO_TOUR_REF, hubs: { some: { hubId: h.id } } },
      orderBy: [{ tierRank: 'asc' }],
      select: { id: true, name: true, slug: true },
    });
    const tourBySlug = new Map(hubTours.map((t) => [t.slug, t]));

    // Our Picks: Klein binds specific tours + design copy; siblings take the
    // first few hub tours with a generic blurb.
    const pickPlan = isKlein
      ? KLEIN.picks
          .map((p) => ({
            tour: tourBySlug.get(p.tourSlug),
            pickType: p.pickType,
            description: p.description,
          }))
          .filter((p) => p.tour)
      : hubTours.slice(0, 3).map((t, i) => ({
          tour: t,
          pickType: [
            HubPickType.BEST_OVERALL,
            HubPickType.MOST_POPULAR,
            HubPickType.BEST_FOR_FAMILIES,
          ][i],
          description: `Our ${['best overall', 'most popular', 'best for families'][i]} pick for ${h.name}.`,
        }));
    for (let i = 0; i < pickPlan.length; i++) {
      const p = pickPlan[i];
      if (!p.tour) continue;
      const pick = await prisma.hubOurPick.create({
        data: {
          hubId: h.id,
          tourId: p.tour.id,
          pickType: p.pickType,
          description: p.description,
          displayOrder: i,
        },
      });
      await prisma.hubOurPickTranslation.createMany({
        data: NON_EN_LOCALES.map((locale) => ({
          ourPickId: pick.id,
          locale,
          description: stub(locale, p.description),
        })),
      });
      hubExtras++;
    }

    // Comparison: Klein builds two curated groups (Comfort / Adventure); a
    // sibling with >= 2 tours gets one generic group.
    const comparisonPlan = isKlein
      ? KLEIN.comparison.map((g) => ({
          groupName: g.groupName,
          tours: g.tours
            .map((t) => ({ tour: tourBySlug.get(t.tourSlug), note: t.note }))
            .filter((t) => t.tour),
        }))
      : hubTours.length >= 2
        ? [
            {
              groupName: 'Relaxed vs Full-day trips',
              tours: hubTours.slice(0, 3).map((t, i) => ({
                tour: t,
                note:
                  i === 0
                    ? 'Most beach time, latest departure.'
                    : 'More snorkeling stops along the way.',
              })),
            },
          ]
        : [];
    for (let gi = 0; gi < comparisonPlan.length; gi++) {
      const g = comparisonPlan[gi];
      if (g.tours.length < 2) continue;
      const group = await prisma.hubComparisonGroup.create({
        data: { hubId: h.id, groupName: g.groupName, displayOrder: gi },
      });
      await prisma.hubComparisonGroupTranslation.createMany({
        data: NON_EN_LOCALES.map((locale) => ({
          groupId: group.id,
          locale,
          groupName: stub(locale, g.groupName),
        })),
      });
      for (let i = 0; i < g.tours.length; i++) {
        const col = g.tours[i];
        if (!col.tour) continue;
        const ct = await prisma.hubComparisonTour.create({
          data: {
            groupId: group.id,
            tourId: col.tour.id,
            standoutNote: col.note,
            displayOrder: i,
          },
        });
        await prisma.hubComparisonTourTranslation.createMany({
          data: NON_EN_LOCALES.map((locale) => ({
            comparisonTourId: ct.id,
            locale,
            standoutNote: stub(locale, col.note),
          })),
        });
      }
      hubExtras++;
    }
  }

  log(
    `Entity content: ${destTr} dest translations / ${destPc} dest page-content, ${catTr} cat translations / ${catPc} cat page-content, ${hubTr} hub translations, ${hubExtras} hub editorial rows, ${faqRows} FAQ rows.`,
  );
}
