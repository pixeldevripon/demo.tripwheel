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
  log,
  photo,
  type PhotoName,
  prisma,
  section,
} from './_shared';
import { categoryName, tpl } from './i18n-templates';
import {
  DEST_SECTIONS,
  DEST_SECTIONS_I18N,
  ISLAND_FACTS,
} from './dest-sections';

// Destination-page FAQ set (Figma node 47361:19834): trust-focused questions
// about booking with Island Tours, with the island name woven in.
function faqsFor(label: string): { q: string; a: string }[] {
  return [
    {
      q: `Can I cancel if my plans change?`,
      a: `Most tours can be cancelled up to 24h before the tour starts for a full refund. No forms, no questions asked. Cancel straight from your confirmation email.`,
    },
    {
      q: `Do I have to pay in full now?`,
      a: `No. On most tours you pay as little as 20% today to lock in your spot and settle the rest closer to your trip. The exact split is shown on each tour page before you book.`,
    },
    {
      q: `Who is behind Island Tours?`,
      a: `We are locals. We grew up on these islands, we know every operator on ${label} personally, and we only list tours we would send our own friends and family on.`,
    },
    {
      q: `What if my tour gets cancelled?`,
      a: `If an operator has to cancel - usually for weather or safety - you choose between a full refund or a free rebooking on the next available departure. We message you as soon as anything changes.`,
    },
  ];
}

// Category-page FAQ pattern (Figma node 47070:2456): what's included, how to
// choose between the options, kids, and the swim/experience question - with
// per-category specifics so every category reads like it was hand-written.
interface CategoryFaqDetail {
  /** Answer to "What's included on a typical X?" */
  included: string;
  compareQ: string;
  compareA: string;
  skillsQ: string;
  skillsA: string;
}

const CATEGORY_FAQ_DETAIL: Record<string, CategoryFaqDetail> = {
  'boat-tours': {
    included:
      'A skipper and crew, fuel, snorkel gear on most boats, and drinks or a BBQ lunch on full-day trips. Each tour page lists its exact inclusions.',
    compareQ: "What's the difference between catamaran and speedboat?",
    compareA:
      'Catamarans are stable, spacious, and relaxed - the classic full-day choice. Speedboats cut the crossing time in half and suit travellers who want maximum time on shore.',
    skillsQ: 'Do I need to know how to swim?',
    skillsA:
      'No - you can enjoy the whole trip from the deck. For swim and snorkel stops, crews hand out flotation vests and stay close.',
  },
  snorkeling: {
    included:
      'Mask, snorkel and fins, a guide who knows the reef, and boat transport on offshore trips. Many tours add drinks and a light lunch.',
    compareQ: 'Shore snorkel or boat snorkel - which should I pick?',
    compareA:
      'Shore trips are cheaper and great for first-timers; boat trips reach clearer water, wrecks, and turtle grounds you cannot swim to from the beach.',
    skillsQ: 'Do I need to know how to swim?',
    skillsA:
      'Basic swimming is enough. Guides carry flotation vests, brief everyone before entering the water, and stay with the group throughout.',
  },
  'scuba-diving': {
    included:
      'All equipment, a certified instructor or divemaster, tank fills, and boat transport to the site.',
    compareQ: 'Can I dive without a certification?',
    compareA:
      'Yes - discover-dives take complete beginners to shallow reefs one-on-one with an instructor. Certified divers can book two-tank reef, wreck, and night dives.',
    skillsQ: 'Do I need to know how to swim?',
    skillsA:
      'Yes, comfortable swimming is required for all dives. Intro dives need nothing else; certified dives require your certification card.',
  },
  'sunset-cruises': {
    included:
      'Drinks (often an open bar), snacks or dinner bites, and a route timed so you are on the water for golden hour.',
    compareQ: 'Sailing catamaran or motor yacht for sunset?',
    compareA:
      'Sailing catamarans are quiet and romantic; motor yachts fit bigger groups and steadier stomachs. Both chase the same sunset.',
    skillsQ: 'What should I bring along?',
    skillsA:
      'Just a light layer for the breeze after sundown and your camera. Everything else is on board.',
  },
  'sightseeing-tours': {
    included:
      'Air-conditioned transport, a local guide, and entry to the stops on the route.',
    compareQ: 'Small-group or private sightseeing - what is the difference?',
    compareA:
      'Small groups are social and cost less; private tours set their own pace and route. Same guides, same highlights.',
    skillsQ: 'How much walking is involved?',
    skillsA:
      'Light walking at each stop - comfortable shoes are all you need. Tours with real hikes say so clearly on the tour page.',
  },
  'day-trips': {
    included:
      'Round-trip transport, a guide, and usually lunch - a day trip bundles the logistics so you do not have to plan anything.',
    compareQ: 'How do I pick the right day trip?',
    compareA:
      'Start with how you like to travel: on the water (boat days), on wheels (island loops), or on foot (nature days) - then match the departure day to your itinerary.',
    skillsQ: 'Do I need any experience to join?',
    skillsA:
      'None - day trips are built for everyone, and each page notes the pace so you know what you are signing up for.',
  },
  'off-road-tours': {
    included:
      'The vehicle, fuel, helmets and goggles, and a lead guide who knows every trail.',
    compareQ: 'UTV, buggy or jeep - which should I choose?',
    compareA:
      'UTVs and buggies put you behind the wheel for the dusty, hands-on version; jeep safaris seat the whole family while a driver-guide does the work.',
    skillsQ: 'Do I need a licence to drive?',
    skillsA:
      "Drivers need a standard driver's licence; passengers just need to hold on and enjoy. Minimum driver ages are on each tour page.",
  },
  'jet-ski': {
    included:
      'The jet ski, fuel, life vests, and a guide leading the route with photo stops along the way.',
    compareQ: 'Can two people share a jet ski?',
    compareA:
      'Yes - most skis seat two and you can swap drivers at the stops. Solo riders get the same route with more throttle time.',
    skillsQ: 'Do I need experience to ride?',
    skillsA:
      'No - the briefing covers everything, and guides set a pace everyone can follow. Drivers usually need to be 16-18+ with ID.',
  },
  parasailing: {
    included:
      'Harness, the boat ride out, and 10-15 minutes in the air per flight.',
    compareQ: 'Can we fly together?',
    compareA:
      'Yes - tandem and even triple flights are standard, weather permitting and within the combined weight limit shown on the tour page.',
    skillsQ: 'Will I get wet?',
    skillsA:
      'Barely - take-off and landing happen from the boat deck. Some captains offer a gentle toe-dip on request.',
  },
  'water-sports': {
    included:
      'All gear for the activity, a safety briefing, and instructors or spotters on the water.',
    compareQ: 'Which water sport is easiest for beginners?',
    compareA:
      'Tubing and banana boats need zero skill; paddleboarding and kayaking take minutes to learn; flyboarding rewards a lesson - which is exactly what the beginner sessions are.',
    skillsQ: 'Do I need to know how to swim?',
    skillsA:
      'For most activities yes, at a basic level - life vests are always provided. Each tour page lists its own age, weight, and swim requirements.',
  },
  'fishing-trips': {
    included:
      'Rods, tackle, bait, fishing licences, and a crew that will clean and fillet your catch.',
    compareQ: 'Deep-sea or reef fishing - what is the difference?',
    compareA:
      'Deep-sea trips chase mahi-mahi, tuna, and marlin offshore; reef trips stay in calmer water with steadier action - better for kids and first-timers.',
    skillsQ: 'Do I need fishing experience?',
    skillsA:
      'None - crews rig, bait, and coach you through every catch. Seasoned anglers are welcome to bring their own gear.',
  },
  'nature-wildlife-tours': {
    included: 'A naturalist guide, park fees, and transport between spots.',
    compareQ: 'What wildlife can I actually expect to see?',
    compareA:
      'Sea turtles, flamingos, iguanas, and seasonal seabirds are the reliable stars; dolphins and rays make regular guest appearances offshore.',
    skillsQ: 'Do I need any experience to join?',
    skillsA:
      'None - routes are gentle and guides adapt the pace to the group. Bring binoculars if you have them.',
  },
  'hiking-tours': {
    included:
      'A local guide, trail fees, drinking water, and often a swim stop at the end.',
    compareQ: 'How hard are the hikes?',
    compareA:
      'Most island hikes run 1.5-3 hours, with the heat being the real challenge - every tour page grades its difficulty honestly.',
    skillsQ: 'What fitness level do I need?',
    skillsA:
      'A reasonable base level and closed shoes. Guides set a pace the whole group can hold and build in shade breaks.',
  },
  'adventure-tours': {
    included: 'All activity gear, safety equipment, and certified guides.',
    compareQ: 'How do I know an adventure tour is safe?',
    compareA:
      'Every operator is vetted, licensed, and insured, with maintained equipment and a briefing before anything begins - thrill is the point, risk is not.',
    skillsQ: 'Do I need any experience to join?',
    skillsA:
      'Each tour lists its own age, health, and fitness requirements - read them before booking and you will be fine.',
  },
  'cultural-tours': {
    included:
      'A local guide with real stories, entry fees, and tastings where the route includes them.',
    compareQ: 'What makes these different from a guidebook walk?',
    compareA:
      'The guides grew up here - you get family history, backstreets, and context no plaque will give you, plus your questions answered on the spot.',
    skillsQ: 'How much walking is involved?',
    skillsA:
      'An easy stroll with plenty of stops - comfortable shoes and curiosity are all you need.',
  },
  'food-tours': {
    included:
      '5-8 tastings across multiple stops, a local foodie guide, and drink pairings on most routes.',
    compareQ: 'Will there be enough food to count as a meal?',
    compareA:
      'Yes - come hungry. Most guests skip the meal before a tour; the tastings add up to more than a full plate.',
    skillsQ: 'Can dietary requirements be accommodated?',
    skillsA:
      'Almost always - flag allergies or preferences at booking and the guide arranges alternatives at each stop.',
  },
  'attraction-tickets': {
    included: 'Skip-the-line entry and everything listed on the ticket page.',
    compareQ: 'Do tickets have a fixed date and time?',
    compareA:
      'Some are timed, many are flexible open tickets valid for a window - each ticket page states which before you book.',
    skillsQ: 'Do I need to print anything?',
    skillsA:
      'No - show the ticket on your phone at the entrance and you are in.',
  },
  'luxury-experiences': {
    included:
      'Premium vessels or venues, a dedicated crew, and food and drink a clear step above the standard tours.',
    compareQ: 'What makes an experience "luxury" here?',
    compareA:
      'Smaller guest counts, better boats, real service - we list an experience as luxury only when the difference is obvious on board, not just in the price.',
    skillsQ: 'Is there a dress code?',
    skillsA:
      'Resort casual covers everything - the crew will tell you if a specific experience calls for more.',
  },
  'workshops-classes': {
    included:
      'All materials, hands-on instruction, and something to take home.',
    compareQ: 'Do I need any prior experience?',
    compareA:
      'No - classes assume complete beginners, and instructors adjust the moment they see the group.',
    skillsQ: 'Can children join the classes?',
    skillsA:
      'Many classes welcome kids from around 6-8 years old - the exact minimum age is on each class page.',
  },
};

function categoryFaqsFor(
  label: string,
  slug?: string,
): { q: string; a: string }[] {
  const lower = label.toLowerCase();
  const singular = lower.split('&')[0].trim().replace(/s$/, '');
  const d = (slug && CATEGORY_FAQ_DETAIL[slug]) || {
    included:
      'Everything you need for the activity, a local guide or crew, and any listed extras - each tour page shows its exact inclusions.',
    compareQ: `How do I choose the right ${singular} for my trip?`,
    compareA: `Compare ${lower} by price, duration, and traveller rating. Every listing shows exactly what is included, so you can pick the one that fits your group and budget.`,
    skillsQ: 'Do I need any experience to join?',
    skillsA:
      'None for most tours - requirements, when they exist, are listed clearly on the tour page.',
  };
  return [
    { q: `What's included on a typical ${singular}?`, a: d.included },
    { q: d.compareQ, a: d.compareA },
    {
      q: `Are ${lower} suitable for children?`,
      a: `Many are - check the age limits on each tour page. Tours carrying the "family friendly" label are the safest bet for younger kids.`,
    },
    { q: d.skillsQ, a: d.skillsA },
  ];
}

async function ensureFaqs(
  pageType: FaqPageType,
  entityId: string,
  label: string,
  customItems?: { q: string; a: string }[],
  /**
   * Localized item set per non-EN locale (index-aligned with the EN set so the
   * shared faqGroupId links the right rows). Falls back to the English text
   * when absent or shorter than the EN set - real English beats a fake stub.
   */
  localizedItems?: (locale: Locale) => { q: string; a: string }[],
): Promise<number> {
  // Deterministic: replace this entity's FAQ set each run (re-seed safe).
  await prisma.faq.deleteMany({ where: { pageType, entityId } });
  const items =
    customItems ??
    (pageType === 'category' ? categoryFaqsFor(label) : faqsFor(label));
  const localized = new Map<Locale, { q: string; a: string }[]>();
  if (localizedItems) {
    for (const locale of NON_EN_LOCALES)
      localized.set(locale, localizedItems(locale));
  }
  const rows: Prisma.FaqCreateManyInput[] = [];
  items.forEach((item, idx) => {
    // One faqGroupId per logical FAQ links its per-locale rows (English is the base).
    const faqGroupId = randomUUID();
    ALL_LOCALES.forEach((locale) => {
      const loc =
        locale === Locale.en ? undefined : localized.get(locale)?.[idx];
      rows.push({
        pageType,
        entityId,
        faqGroupId,
        locale,
        question: loc?.q ?? item.q,
        answer: loc?.a ?? item.a,
        displayOrder: idx,
        isActive: true,
      });
    });
  });
  await prisma.faq.createMany({ data: rows });
  return rows.length;
}

/**
 * Seed the three About-band sections for one destination, in all 7 locales.
 *
 * Same grouping trick as `ensureFaqs`: one sectionGroupId per logical section
 * links its per-locale rows, and each locale's set is INDEX-ALIGNED with
 * DEST_SECTIONS so `sectionKey` never has to be threaded through a translation.
 *
 * Every locale is authored (DEST_SECTIONS_I18N covers all 7), so unlike the FAQ
 * seed there is no English-stub fallback here - a missing locale would be a bug,
 * not an expected gap. Islands absent from ISLAND_FACTS are SKIPPED rather than
 * seeded with another island's landmarks; the frontend then falls back to its
 * bundled dictionary labels, which is the correct empty state.
 */
async function ensureContentSections(
  destinationId: string,
  destinationSlug: string,
  destinationName: string,
): Promise<number> {
  const facts = ISLAND_FACTS[destinationSlug];
  if (!facts) return 0;

  // Deterministic: replace this destination's section set each run (re-seed safe).
  await prisma.pageContentSection.deleteMany({
    where: { pageType: 'destination', entityId: destinationId },
  });

  const byLocale = new Map(
    ALL_LOCALES.map((locale) => [
      locale,
      DEST_SECTIONS_I18N[locale](destinationName, facts),
    ]),
  );

  const rows: Prisma.PageContentSectionCreateManyInput[] = [];
  DEST_SECTIONS.forEach((section, idx) => {
    const sectionGroupId = randomUUID();
    ALL_LOCALES.forEach((locale) => {
      const s = byLocale.get(locale)![idx];
      rows.push({
        pageType: 'destination',
        entityId: destinationId,
        sectionGroupId,
        sectionKey: section.key,
        locale,
        heading: s.heading,
        body: s.body,
        displayOrder: idx,
        isActive: true,
      });
    });
  });

  await prisma.pageContentSection.createMany({ data: rows });
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
      photoName: 'beachClassic' as PhotoName,
    },
    {
      heading: 'History',
      body: "In 1871, British mining engineer John Godden found phosphate on Klein Curaçao, left by centuries of nesting birds. Within fifteen years, they had dug out around 90,000 tons for fertiliser and cattle feed, leaving the island around 3 metres lower and stripped bare, which is why it's flat and treeless today. In the 1700s and 1800s, the West India Company used it as a quarantine station.",
      photoName: 'aerialIsland' as PhotoName,
    },
    {
      heading: 'Sea Turtles',
      body: "Klein Curaçao is a protected nesting ground for three sea turtle species: Hawksbill, Loggerhead, and Green sea turtles. The whole island is a protected Ramsar wetland and a designated Important Bird Area. Those hatched here return year after year to the same beach to nest. While snorkeling you'll very likely see them grazing in the shallows, with the best chance during nesting season, March to October. Watch and swim alongside them, but never touch.",
      photoName: 'turtleReef' as PhotoName,
    },
    {
      heading: 'Snorkeling & Diving',
      body: "Klein Curaçao's eastern reef is one of the healthiest untouched coral systems left in the Caribbean, rare in a region where bleaching has hit most reefs hard. With visibility up to 30 metres, you take in coral formations, underwater caves, and dense fish life: a real dive site, not just a snorkel stop. One operator runs the island's only dive school, and snorkel gear comes standard.",
      photoName: 'coralReef' as PhotoName,
    },
    {
      heading: 'The Pink Lighthouse',
      body: "Klein Curaçao's pink lighthouse, officially the Prins Hendrik tower, stands 20 metres tall in the middle of the island as its standout landmark. First built in 1850, it was destroyed by a hurricane in 1877, rebuilt in 1879, and first lit in 1913. Stairs added in 2017 let you climb to the top for a view over the whole island, though they're weathered and unmaintained now.",
      photoName: 'lighthouse' as PhotoName,
    },
    {
      heading: 'Shipwrecks',
      body: "Klein Curaçao's north shore holds three shipwrecks. Low and hard to spot, with strong currents, the island has caught out passing boats for centuries. The most visible is the Maria Bianca Guidesman, an oil tanker stranded in 1988. Two French sailing yachts lie nearby. Wind, salt, and sand are slowly reclaiming all three. The north-shore walk takes you right past them.",
      photoName: 'scubaDiver' as PhotoName,
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
  // Hub-page AEO FAQ set (Figma node 48024:12076) - 9 questions, answers
  // grounded in the editorial above. Question ORDER matches hubFaqsFor() and
  // the localized hubFaqs templates so per-locale rows align by index.
  faqs: [
    {
      q: 'Is Klein Curaçao worth it?',
      a: "Yes. Most visitors find the day trip to Klein Curaçao well worth it for one of the longest and most beautiful white-sand beaches in the Caribbean. It's a full day on the sand and in the water, perfect for sunbathing, swimming, and snorkeling, with a protected reef and sea turtles in the shallows. The island is completely undeveloped, with no crowds beyond the day boats. We've yet to meet anyone who regretted going.",
    },
    {
      q: 'What is there to do on Klein Curaçao?',
      a: 'Claim a stretch of the kilometre-long white beach, snorkel the reef and swim with sea turtles, climb the pink lighthouse, and walk the wild north shore past the shipwrecks. Most trips include a BBQ lunch and beach beds, so the day organises itself.',
    },
    {
      q: 'How much does a Klein Curaçao trip cost?',
      a: 'Full-day trips start around $120 per person, usually including the crossing, snorkel gear, beach facilities, and a BBQ lunch. Private charters run higher and are priced per boat rather than per person.',
    },
    {
      q: 'How long is the boat trip to Klein Curaçao?',
      a: 'The crossing takes 45 minutes on a fast powerboat and up to about 1.5 hours by sailing catamaran, each way. Most trips leave early and give you five to six hours on the island.',
    },
    {
      q: 'Will I get seasick on the way to Klein Curaçao?',
      a: 'The outbound leg sails into the trade winds, so it can be lively. Sit at the back of the boat, keep your eyes on the horizon, and most stomachs settle quickly - and the return trip is much smoother. Prone to motion sickness? Take a tablet an hour before departure or pick the fast powerboat.',
    },
    {
      q: 'What should I bring to Klein Curaçao?',
      a: 'Reef-safe sunscreen, water shoes, a hat and sunglasses, and a towel. There is no shade beyond the boat awnings and beach palapas, so sun protection matters. Snorkel gear and lunch are included on most trips.',
    },
    {
      q: 'Are there toilets on Klein Curaçao?',
      a: 'Yes - on board every boat, and the operators with beach houses have basic facilities on the island. There is no public infrastructure beyond that, so go before you wander off to the lighthouse.',
    },
    {
      q: 'Is Klein Curaçao suitable for families with young children?',
      a: 'Yes. Calmer, steady boats and shaded seating make the crossing easy for children, and the reef-protected south shore is shallow and clear. Choose a family boat or catamaran rather than the fastest powerboat for the smoothest ride.',
    },
    {
      q: 'What happens if the weather is bad on my Klein Curaçao trip?',
      a: 'Captains monitor conditions daily and will cancel or reschedule if the crossing is not safe. You then choose between the next available departure or a full refund - no forms, no discussion.',
    },
  ],
};

/**
 * Generic hub FAQ set (same 9 Figma questions as Klein, parameterized by hub
 * name) for sibling hubs without hand-written answers. Question order MUST
 * match KLEIN.faqs and the localized hubFaqs templates (index-aligned rows).
 */
function hubFaqsFor(name: string): { q: string; a: string }[] {
  return [
    {
      q: `Is ${name} worth it?`,
      a: `Yes. ${name} is the day trip islanders recommend first: unspoiled sand, calm turquoise water, and snorkeling straight off the beach. It is a full day out, and very few visitors regret it.`,
    },
    {
      q: `What is there to do on ${name}?`,
      a: `Swim and snorkel the reef, walk the coast, and settle into a stretch of quiet beach. Most trips include lunch and beach facilities, so the day takes care of itself.`,
    },
    {
      q: `How much does a ${name} trip cost?`,
      a: `Full-day trips typically start around $100-130 per person including the crossing, gear, and lunch. Private charters are priced per boat - see each tour page for exact pricing.`,
    },
    {
      q: `How long is the boat trip to ${name}?`,
      a: `Expect roughly 45 minutes to 1.5 hours each way depending on the boat. Trips leave early to make the most of the calm morning water.`,
    },
    {
      q: `Will I get seasick on the way to ${name}?`,
      a: `The open-water stretch can be lively. Sit toward the back, watch the horizon, and consider a motion-sickness tablet an hour before departure if you are prone - the return leg is usually smoother.`,
    },
    {
      q: `What should I bring to ${name}?`,
      a: `Reef-safe sunscreen, water shoes, a hat, and a towel. Shade is limited, so sun protection matters. Snorkel gear and lunch are included on most trips.`,
    },
    {
      q: `Are there toilets on ${name}?`,
      a: `On board every boat, yes - and operators with beach setups have basic facilities on shore. Beyond that the island is undeveloped.`,
    },
    {
      q: `Is ${name} suitable for families with young children?`,
      a: `Yes - pick a steadier family boat or catamaran for the smoothest crossing. The swimming areas are shallow, calm, and easy for kids.`,
    },
    {
      q: `What happens if the weather is bad on my ${name} trip?`,
      a: `Captains monitor conditions daily and cancel or reschedule when the crossing is not safe. You choose between the next available departure or a full refund.`,
    },
  ];
}

// ── Per-destination editorial content (real copy + topical photos) ─────────────
const DEST_CONTENT: Record<
  string,
  { hero: PhotoName; gallery: PhotoName[]; overview: string; about: string }
> = {
  curacao: {
    hero: 'willemstad',
    gallery: ['boatReefAerial', 'beachCove', 'colonialStreet'],
    overview:
      'Curaçao pairs the painted waterfront of UNESCO-listed Willemstad with more than 35 beaches tucked into rocky coves. Offshore, the reef starts steps from the sand - and uninhabited Klein Curaçao is the day trip every islander insists on.',
    about:
      "Curaçao rewards travellers who dig a little deeper. Spend a morning snorkelling straight off Playa Lagun, an afternoon wandering Punda's colourful streets, and an evening on a catamaran sailing into the sunset. The island sits outside the hurricane belt, so the water stays calm and the boats run year-round. Every tour here is operated by a vetted local operator - many of them families who have run these routes for generations.",
  },
  aruba: {
    hero: 'beachPalms',
    gallery: ['flamingo', 'jeepTrail', 'beachChairs'],
    overview:
      'Aruba is the Caribbean at its easiest: powder-white Eagle Beach, steady trade winds, and a desert interior of cacti and hidden pools that jeeps rumble through every morning. One happy island, as the licence plates say.',
    about:
      'Aruba packs two islands into one. The west coast is all calm turquoise water, resort beaches, and sunset catamarans; the wild north-east is a desert of dramatic surf, caves, and the rugged Arikok National Park - best explored by UTV or on a jeep safari that ends with a swim in the Natural Pool. Days here are sunny virtually year-round, and everything on Island Tours confirms instantly with free cancellation.',
  },
  'sint-maarten': {
    hero: 'aerialCoast',
    gallery: ['yachtAerial', 'beachClassic', 'openOcean'],
    overview:
      'Half Dutch, half French, and all Caribbean: Sint Maarten squeezes 37 beaches, two cultures, and one famous runway approach into 87 square kilometres. Sail it, snorkel it, or watch the jets skim Maho Beach.',
    about:
      'Sint Maarten is two countries on one small island, and that is exactly the fun of it. Morning snorkelling off Pinel Island on the French side, lunch in Grand Case, and an afternoon catamaran back along the Dutch coast into Simpson Bay. The island is compact enough to circle in a day - which is why boat loops and two-nation sightseeing tours are its signature experiences.',
  },
  'saint-lucia': {
    hero: 'pitons',
    gallery: ['tropicalForest', 'hikingRidge', 'sunsetSea'],
    overview:
      'Saint Lucia rises straight out of the sea: the twin Pitons, rainforest canyons, and a drive-in volcano. It is the Caribbean for travellers who want their beach days with a side of adventure.',
    about:
      'Saint Lucia is the lush, mountainous side of the Caribbean. Hike the Gros Piton trail at dawn, soak in the volcanic mud baths at Soufrière, then finish with a sunset sail up the west coast. The island pairs dramatic scenery with warm village culture - and its best experiences are run by local guides who grew up on these trails and waters.',
  },
  bahamas: {
    hero: 'aerialAtoll',
    gallery: ['boatReefAerial', 'beachHammock', 'oceanWave'],
    overview:
      'Seven hundred islands, water in fifty shades of blue, and sandbars that appear at low tide: the Bahamas is boat country. From Nassau day sails to the famous swimming pigs of Exuma, life here happens on the water.',
    about:
      'The Bahamas is less a single destination than an archipelago of day trips. Hop a powerboat to the Exuma Cays to snorkel Thunderball Grotto, drift over blue holes, and meet the swimming pigs; or stay close to Nassau for reef snorkels and sunset cruises. The shallow banks keep the water impossibly clear - bring the camera.',
  },
};

export async function seedEntityContent(): Promise<void> {
  section('Entity content (destinations / categories / hubs)');

  // ── Destinations ──
  const destinations = await prisma.destination.findMany({
    select: { id: true, slug: true, name: true },
  });
  let destTr = 0;
  let destPc = 0;
  let destSections = 0;
  let faqRows = 0;
  for (const d of destinations) {
    const content = DEST_CONTENT[d.slug];
    const overview =
      content?.overview ??
      `Tucked into the southern Caribbean, ${d.name} pairs turquoise water and powder-soft beaches with a culture all its own. From reef snorkels to sunset sails, these are tours picked by locals who know every cove.`;
    const about =
      content?.about ??
      `${d.name} is one of the Caribbean's most rewarding islands to explore. Spend your days diving vibrant reefs, cruising to hidden beaches, and tasting the island's blend of cultures. Every experience here is run by a vetted local operator.`;
    // Demo media: hero, social-share (OG), and a small gallery, all topical to
    // the island (Willemstad's waterfront for Curaçao, the Pitons for Saint
    // Lucia) rather than random stock.
    const hero = content?.hero ?? 'beachClassic';
    const gallery = content?.gallery ?? [
      'beachPalms',
      'boatReefAerial',
      'sunsetSea',
    ];
    // Hero images are intentionally NOT seeded (admin uploads real ones via the
    // dashboard); pages render their neutral fallback until then. OG + gallery
    // stay topical so share cards and page galleries still look real.
    await prisma.destination.update({
      where: { id: d.id },
      data: {
        heroImage: null,
        ogImage: photo(hero, 1200, 630),
        galleryImages: gallery.map((g) => photo(g, 1200, 800)),
      },
    });
    // Destination names are proper nouns — keep the real name, localize the prose
    // with the per-locale templates (real copy, not machine-translation stubs).
    await prisma.destinationTranslation.deleteMany({
      where: { destinationId: d.id },
    });
    await prisma.destinationTranslation.createMany({
      data: ALL_LOCALES.map((locale) => {
        const t = tpl(locale);
        return {
          destinationId: d.id,
          locale,
          name: d.name,
          overview: t ? t.destOverview(d.name) : overview,
          breadcrumbLabel: d.name,
          isMachineTranslated: locale !== Locale.en,
        };
      }),
      skipDuplicates: true,
    });
    destTr += ALL_LOCALES.length;
    await prisma.destinationPageContent.deleteMany({
      where: { destinationId: d.id },
    });
    await prisma.destinationPageContent.createMany({
      data: ALL_LOCALES.map((locale) => {
        const t = tpl(locale);
        return {
          destinationId: d.id,
          locale,
          aboutText: t ? t.destAbout(d.name) : about,
          metaTitle: t
            ? t.destMetaTitle(d.name)
            : `${d.name} Tours & Activities | Island Tours`,
          metaDescription: t ? t.destOverview(d.name) : overview,
        };
      }),
      skipDuplicates: true,
    });
    destPc += ALL_LOCALES.length;
    faqRows += await ensureFaqs(
      'destination',
      d.id,
      d.name,
      undefined,
      (locale) => tpl(locale)?.destFaqs(d.name) ?? [],
    );
    destSections += await ensureContentSections(d.id, d.slug, d.name);
  }

  // ── Categories ──
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true, heroImage: true },
  });
  let catTr = 0;
  let catPc = 0;
  for (const c of categories) {
    const overview = `Browse the best ${c.name.toLowerCase()} across the islands — each one vetted, instantly bookable, and backed by free cancellation. Compare prices, departure times, and real traveller reviews before you commit.`;
    const about = `Looking for ${c.name.toLowerCase()}? You are in the right place. Compare options by price, duration, and traveller rating, then book the one that fits your trip. Every operator is vetted by our local team, and every booking confirms instantly with free cancellation up to the window shown on the tour page.`;
    const h1 = `Best ${c.name}`;
    // Fill the entity-level gaps the prod seed leaves empty. The OG image reuses
    // the category's curated topical hero (set by the prod seed) so the share
    // card matches the page. Icon stays null - the frontend falls back to
    // CATEGORY_ICON_BY_SLUG.
    await prisma.category.update({
      where: { id: c.id },
      data: {
        heroImage: null,
        ogImage: c.heroImage ?? photo('aerialCoast', 1200, 630),
        description: overview,
      },
    });
    await prisma.categoryTranslation.deleteMany({
      where: { categoryId: c.id },
    });
    await prisma.categoryTranslation.createMany({
      data: ALL_LOCALES.map((locale) => {
        const t = tpl(locale);
        const localName = categoryName(c.slug, locale, c.name);
        return {
          categoryId: c.id,
          locale,
          // EN row keeps name null (falls back to Category.name); other locales
          // carry their real localized category name.
          name: t ? localName : null,
          overview: t ? t.catOverview(localName) : overview,
          h1Override: t ? t.catH1(localName) : h1,
          breadcrumbLabel: t ? localName : null,
          isMachineTranslated: locale !== Locale.en,
        };
      }),
      skipDuplicates: true,
    });
    catTr += ALL_LOCALES.length;
    await prisma.categoryPageContent.deleteMany({
      where: { categoryId: c.id },
    });
    await prisma.categoryPageContent.createMany({
      data: ALL_LOCALES.map((locale) => {
        const t = tpl(locale);
        const localName = categoryName(c.slug, locale, c.name);
        return {
          categoryId: c.id,
          locale,
          aboutText: t ? t.catAbout(localName) : about,
          metaTitle: t ? t.catMetaTitle(localName) : `${c.name} | Island Tours`,
          metaDescription: t ? t.catOverview(localName) : overview,
        };
      }),
      skipDuplicates: true,
    });
    catPc += ALL_LOCALES.length;
    faqRows += await ensureFaqs(
      'category',
      c.id,
      c.name,
      categoryFaqsFor(c.name, c.slug),
      (locale) =>
        tpl(locale)?.catFaqs(categoryName(c.slug, locale, c.name)) ?? [],
    );
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

    // Ensure the hub is published + has a topical hero (a boat over the reef -
    // the signature Klein Curaçao crossing shot).
    await prisma.hub.update({
      where: { id: h.id },
      data: {
        heroImage: null,
        ogImage: photo('boatReefAerial', 1200, 630),
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
    // The hero H1 is the experience, not the bare place name (Figma 48024:11158:
    // "Klein Curaçao day trips") - localized per locale.
    await prisma.hubTranslation.deleteMany({ where: { hubId: h.id } });
    await prisma.hubTranslation.createMany({
      data: ALL_LOCALES.map((locale) => {
        const t = tpl(locale);
        return {
          hubId: h.id,
          locale,
          name: h.name,
          overview: t ? t.hubLead(h.name) : overview,
          heroTagline: t ? t.hubTagline : tagline,
          // h1Override is required by the hub publish-readiness check.
          h1Override: t
            ? t.hubMetaTitle(h.name).replace(' | Island Tours', '')
            : `${h.name} day trips`,
          breadcrumbLabel: h.name,
          isMachineTranslated: locale !== Locale.en,
        };
      }),
    });
    hubTr += ALL_LOCALES.length;

    const about = `${h.name} is a highlight of any trip to the island. Reachable only by boat, it rewards the early start with some of the clearest water in the Caribbean.`;
    await prisma.hubPageContent.deleteMany({ where: { hubId: h.id } });
    await prisma.hubPageContent.createMany({
      data: ALL_LOCALES.map((locale) => {
        const t = tpl(locale);
        return {
          hubId: h.id,
          locale,
          aboutText: t ? t.hubAbout(h.name) : about,
          metaTitle: t
            ? t.hubMetaTitle(h.name)
            : `${h.name} day trips | Island Tours`,
          metaDescription: t ? t.hubLead(h.name) : overview,
        };
      }),
    });

    // FAQs: the 9 AEO questions from the hub design (Figma 48024:12076) -
    // Klein with hand-written answers, siblings via the parameterized set;
    // non-EN rows come from the localized hubFaqs templates (index-aligned).
    faqRows += await ensureFaqs(
      'hub',
      h.id,
      h.name,
      isKlein ? KLEIN.faqs : hubFaqsFor(h.name),
      (locale) => tpl(locale)?.hubFaqs(h.name) ?? [],
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
            image: photo(d.photoName, 1280, 854),
          })),
          ...KLEIN.localTips.map((t, i) => ({
            type: HubSectionType.LOCAL_TIP,
            heading: t.heading,
            body: t.body,
            order: i,
          })),
          // Discover Intro (EDITORIAL) -> the Discover section subtitle.
          {
            type: HubSectionType.EDITORIAL,
            heading: 'Discover intro',
            body: 'A 1.7 km² flat, uninhabited island 10km off the southeast coast of Curaçao. No shops, no signal, just sand, reef, and history.',
            order: 0,
          },
          // First-timer Highlights (HIGHLIGHT) -> green-check takeaways row (Figma).
          ...[
            'Take water shoes',
            'The open bar opens after arrival',
            'There is no phone signal',
          ].map((body, i) => ({
            type: HubSectionType.HIGHLIGHT,
            heading: 'Highlight',
            body,
            order: i,
          })),
        ]
      : [
          {
            type: HubSectionType.DISCOVER,
            heading: 'Getting there',
            body: 'The crossing takes around 90 minutes by catamaran or speedboat. Most trips leave early to make the most of the calm morning water.',
            order: 0,
            image: photo('sailingHeel', 1280, 854),
          },
          {
            type: HubSectionType.DISCOVER,
            heading: 'What to do',
            body: 'Snorkel the reef, walk the coast, or simply claim a patch of sand and relax.',
            order: 1,
            image: photo('beachPalms', 1280, 854),
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
          // Discover Intro (EDITORIAL) -> the Discover section subtitle.
          {
            type: HubSectionType.EDITORIAL,
            heading: 'Discover intro',
            body: `Everything worth knowing about ${h.name} before you go, from the crossing to what to pack.`,
            order: 0,
          },
          // First-timer Highlights (HIGHLIGHT) -> green-check takeaways row.
          ...[
            'Book ahead in high season',
            'Bring reef-safe sunscreen',
            'Earliest departures are calmest',
          ].map((body, i) => ({
            type: HubSectionType.HIGHLIGHT,
            heading: 'Highlight',
            body,
            order: i,
          })),
        ];
    // Long-form editorial (discover cards, tips, fast facts) is authored in
    // English; non-EN rows carry the same English text rather than a fake
    // "[XX]" stub - real English reads fine on every locale until an operator
    // or the AI-translation job localizes it.
    const sectionRows: Prisma.HubContentSectionCreateManyInput[] = [];
    for (const s of sections) {
      for (const locale of ALL_LOCALES) {
        sectionRows.push({
          hubId: h.id,
          locale,
          sectionType: s.type,
          heading: s.heading,
          body: s.body,
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
          description: p.description,
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
          groupName: g.groupName,
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
            standoutNote: col.note,
          })),
        });
      }
      hubExtras++;
    }
  }

  log(
    `Entity content: ${destTr} dest translations / ${destPc} dest page-content / ${destSections} dest content-section rows, ${catTr} cat translations / ${catPc} cat page-content, ${hubTr} hub translations, ${hubExtras} hub editorial rows, ${faqRows} FAQ rows.`,
  );
}
