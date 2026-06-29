// DEMO SEED — editorial content for the ALREADY-SEEDED entities (destinations,
// categories, hubs): per-locale translations + page content + FAQs, plus the hub
// editorial blocks (content sections, "our picks", comparison groups).
//
// The base destination/category/hub ROWS are not recreated — only their content.

import {
  HubPickType,
  HubSectionType,
  HubStatus,
  Locale,
  Prisma,
} from '@prisma/client';
import { ALL_LOCALES, DEMO_TOUR_REF, NON_EN_LOCALES, img, log, prisma, section, stub } from './_shared';

function faqsFor(label: string): { q: string; a: string }[] {
  return [
    { q: `What is the best time to visit ${label}?`, a: `${label} is a year-round destination. The driest, sunniest months run from roughly January to August, while September to December brings warmer water and fewer crowds.` },
    { q: `Do I need to book tours in ${label} in advance?`, a: `Popular tours sell out in high season, so booking ahead is recommended. Every tour on Island Tours offers instant confirmation and free cancellation, so there is no risk in securing your spot early.` },
    { q: `Can tours be cancelled if my plans change?`, a: `Yes. Every tour includes free cancellation up to the window shown on the tour page, with no questions asked.` },
  ];
}

async function ensureFaqs(pageType: string, entityId: string, label: string): Promise<number> {
  const existing = await prisma.faq.findFirst({ where: { pageType, entityId }, select: { id: true } });
  if (existing) return 0;
  const items = faqsFor(label);
  const rows: Prisma.FaqCreateManyInput[] = [];
  items.forEach((item, idx) => {
    ALL_LOCALES.forEach((locale) => {
      const en = locale === Locale.en;
      rows.push({
        pageType,
        entityId,
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

export async function seedEntityContent(): Promise<void> {
  section('Entity content (destinations / categories / hubs)');

  // ── Destinations ──
  const destinations = await prisma.destination.findMany({ select: { id: true, slug: true, name: true } });
  let destTr = 0;
  let destPc = 0;
  let faqRows = 0;
  for (const d of destinations) {
    const overview = `Tucked into the southern Caribbean, ${d.name} pairs turquoise water and powder-soft beaches with a culture all its own. From reef snorkels to sunset sails, these are tours picked by locals who know every cove.`;
    const about = `${d.name} is one of the Caribbean’s most rewarding islands to explore. Spend your days diving vibrant reefs, cruising to hidden beaches, and tasting the island’s blend of cultures. Every experience here is run by a vetted local operator.`;
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
        metaTitle: locale === Locale.en ? `${d.name} Tours & Activities | Island Tours` : stub(locale, `${d.name} Tours & Activities | Island Tours`),
        metaDescription: locale === Locale.en ? overview : stub(locale, overview),
      })),
      skipDuplicates: true,
    });
    destPc += ALL_LOCALES.length;
    faqRows += await ensureFaqs('destination', d.id, d.name);
  }

  // ── Categories ──
  const categories = await prisma.category.findMany({ select: { id: true, slug: true, name: true } });
  let catTr = 0;
  let catPc = 0;
  for (const c of categories) {
    const overview = `Browse the best ${c.name.toLowerCase()} across the islands — each one vetted, instantly bookable, and backed by free cancellation.`;
    const about = `Looking for ${c.name.toLowerCase()}? You are in the right place. Compare options by price, duration, and traveller rating, then book the one that fits your trip.`;
    await prisma.categoryTranslation.createMany({
      data: ALL_LOCALES.map((locale) => ({
        categoryId: c.id,
        locale,
        // EN row keeps name null (falls back to Category.name); others get a stub name.
        name: locale === Locale.en ? null : stub(locale, c.name),
        overview: locale === Locale.en ? overview : stub(locale, overview),
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
        metaTitle: locale === Locale.en ? `${c.name} | Island Tours` : stub(locale, `${c.name} | Island Tours`),
        metaDescription: locale === Locale.en ? overview : stub(locale, overview),
      })),
      skipDuplicates: true,
    });
    catPc += ALL_LOCALES.length;
  }

  // ── Hubs (klein-curacao and any other seeded hub) ──
  const hubs = await prisma.hub.findMany({ select: { id: true, slug: true, name: true, destinationId: true, heroImage: true, hubType: true, status: true } });
  let hubTr = 0;
  let hubExtras = 0;
  for (const h of hubs) {
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

    const overview = `Why ${h.name}? It is the day trip islanders send every visitor on — pristine sand, calm turquoise shallows, and snorkeling over shipwrecks and turtle grounds.`;
    const tagline = 'Where islanders send their visitors';
    await prisma.hubTranslation.createMany({
      data: ALL_LOCALES.map((locale) => ({
        hubId: h.id,
        locale,
        name: h.name,
        overview: locale === Locale.en ? overview : stub(locale, overview),
        heroTagline: locale === Locale.en ? tagline : stub(locale, tagline),
        breadcrumbLabel: h.name,
        isMachineTranslated: false,
      })),
      skipDuplicates: true,
    });
    hubTr += ALL_LOCALES.length;

    const about = `${h.name} is a highlight of any trip to the island. Reachable only by boat, it rewards the early start with some of the clearest water in the Caribbean.`;
    await prisma.hubPageContent.createMany({
      data: ALL_LOCALES.map((locale) => ({
        hubId: h.id,
        locale,
        aboutText: locale === Locale.en ? about : stub(locale, about),
        metaTitle: locale === Locale.en ? `${h.name} | Island Tours` : stub(locale, `${h.name} | Island Tours`),
        metaDescription: locale === Locale.en ? overview : stub(locale, overview),
      })),
      skipDuplicates: true,
    });

    faqRows += await ensureFaqs('hub', h.id, h.name);

    // Content sections (Discover / Local Tip / Fast Fact / Editorial), per locale.
    const hasSections = await prisma.hubContentSection.findFirst({ where: { hubId: h.id }, select: { id: true } });
    if (!hasSections) {
      const sections: { type: HubSectionType; heading: string; body: string; order: number }[] = [
        { type: HubSectionType.DISCOVER, heading: 'Getting there', body: 'The crossing takes around 90 minutes by catamaran or speedboat. Most trips leave early to make the most of the calm morning water.', order: 0 },
        { type: HubSectionType.DISCOVER, heading: 'What to do', body: 'Snorkel the wrecks, swim with turtles, walk to the old lighthouse, or simply claim a patch of sand and relax.', order: 1 },
        { type: HubSectionType.LOCAL_TIP, heading: 'Local tip', body: 'Bring water shoes — the shoreline near the wrecks can be rocky. And book the earliest departure for the calmest seas.', order: 2 },
        { type: HubSectionType.FAST_FACT, heading: 'Good to know', body: 'Uninhabited · No shade beyond the boat awnings · Lunch is included on full-day trips.', order: 3 },
        { type: HubSectionType.EDITORIAL, heading: 'Why we love it', body: 'It is the closest thing to a deserted-island day you can book and still be home for dinner.', order: 4 },
      ];
      const rows: Prisma.HubContentSectionCreateManyInput[] = [];
      for (const s of sections) {
        for (const locale of ALL_LOCALES) {
          const en = locale === Locale.en;
          rows.push({ hubId: h.id, locale, sectionType: s.type, heading: en ? s.heading : stub(locale, s.heading), body: en ? s.body : stub(locale, s.body), displayOrder: s.order });
        }
      }
      await prisma.hubContentSection.createMany({ data: rows });
      hubExtras += rows.length;
    }

    // Our Picks + comparison (need tours linked to this hub).
    const hubTours = await prisma.tour.findMany({
      where: { reference: DEMO_TOUR_REF, hubs: { some: { hubId: h.id } } },
      orderBy: [{ tierRank: 'asc' }],
      take: 4,
      select: { id: true, name: true },
    });
    if (hubTours.length) {
      const pickTypes = [HubPickType.BEST_OVERALL, HubPickType.MOST_POPULAR, HubPickType.BEST_FOR_FAMILIES, HubPickType.BEST_VALUE];
      for (let i = 0; i < hubTours.length; i++) {
        const desc = `Our ${pickTypes[i].toLowerCase().replace(/_/g, ' ')} pick for ${h.name}.`;
        const pick = await prisma.hubOurPick.upsert({
          where: { hubId_tourId: { hubId: h.id, tourId: hubTours[i].id } },
          update: {},
          create: { hubId: h.id, tourId: hubTours[i].id, pickType: pickTypes[i % pickTypes.length], description: desc, displayOrder: i },
        });
        await prisma.hubOurPickTranslation.createMany({
          data: NON_EN_LOCALES.map((locale) => ({ ourPickId: pick.id, locale, description: stub(locale, desc) })),
          skipDuplicates: true,
        });
        hubExtras++;
      }

      // Comparison group.
      const hasGroup = await prisma.hubComparisonGroup.findFirst({ where: { hubId: h.id }, select: { id: true } });
      if (!hasGroup && hubTours.length >= 2) {
        const group = await prisma.hubComparisonGroup.create({ data: { hubId: h.id, groupName: 'Relaxed vs Full-day trips', displayOrder: 0 } });
        await prisma.hubComparisonGroupTranslation.createMany({ data: NON_EN_LOCALES.map((locale) => ({ groupId: group.id, locale, groupName: stub(locale, 'Relaxed vs Full-day trips') })), skipDuplicates: true });
        for (let i = 0; i < Math.min(3, hubTours.length); i++) {
          const note = i === 0 ? 'Most beach time, latest departure.' : 'More snorkeling stops along the way.';
          const ct = await prisma.hubComparisonTour.create({ data: { groupId: group.id, tourId: hubTours[i].id, standoutNote: note, displayOrder: i } });
          await prisma.hubComparisonTourTranslation.createMany({ data: NON_EN_LOCALES.map((locale) => ({ comparisonTourId: ct.id, locale, standoutNote: stub(locale, note) })), skipDuplicates: true });
          hubExtras++;
        }
      }
    }
  }

  log(`Entity content: ${destTr} dest translations / ${destPc} dest page-content, ${catTr} cat translations / ${catPc} cat page-content, ${hubTr} hub translations, ${hubExtras} hub editorial rows, ${faqRows} FAQ rows.`);
}
