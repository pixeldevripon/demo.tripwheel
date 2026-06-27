/**
 * ──────────────────────────────────────────────────────────────────────────────
 * MOCK TOUR FIXTURES — sample data used as a fallback when the backend returns no
 * tours. Lets you explore every dashboard tab fully populated so it's clear which
 * tab edits which slice of the tour data model.
 *
 * Each tour maps 1:1 to the edit-view tabs:
 *   Details      → the TripListItem core fields (pricing, duration, audience, SEO…)
 *   Images       → MOCK_IMAGES
 *   Inclusions   → MOCK_INCLUSIONS          (icon + label + translations)
 *   Exclusions   → MOCK_EXCLUSIONS          (icon + type + priceText + translations)
 *   Features     → MOCK_FEATURES            (FeatureType + text + translations)
 *   Itinerary    → MOCK_LOCATIONS           (types + geo + address + title/description)
 *   Pickups      → MOCK_PICKUPS             (name + window + title/directions)
 *   Pricing      → MOCK_AGE_BANDS + MOCK_ADDONS
 *   Translations → MOCK_TRANSLATIONS        (per-locale tour copy)
 *   Schedules    → MOCK_SCHEDULES           (recurring availability)
 *   Details(card)→ MOCK_LANGUAGES           (guide languages)
 *
 * NOTE: the Attributes tab is driven by the global attribute_definitions table
 * (separate module), so it isn't part of this per-tour fallback.
 *
 * To remove: delete this file and the `MOCK_*` fallback branches in
 * `hooks/trips/use-trips.ts` + the banner in `trips-list-view.tsx`.
 * ──────────────────────────────────────────────────────────────────────────────
 */
import type {
  FeatureType,
  MyTripsQueryParams,
  PaginatedTrips,
  PickupLocation,
  TourAddOn,
  TourAgeBand,
  TourExclusion,
  TourFeature,
  TourImage,
  TourInclusion,
  TourLanguage,
  TourLocation,
  TourSchedule,
  TripListItem,
  TripStatus,
  TripTranslation,
  TierKey,
  ExclusionType,
} from '@/types/trip';

const NOW = '2026-06-20T09:00:00.000Z';
const CREATED = '2026-04-01T09:00:00.000Z';

const TIER_META: Record<TierKey, { rank: number; commission: string; deposit: string }> = {
  premium: { rank: 1, commission: '30.0', deposit: '30.0' },
  featured: { rank: 2, commission: '27.5', deposit: '27.5' },
  boosted: { rank: 3, commission: '25.0', deposit: '25.0' },
  organic: { rank: 4, commission: '22.5', deposit: '22.5' },
  standard: { rank: 5, commission: '20.0', deposit: '20.0' },
};

// ── Seed shapes (the distinctive bits per tour) ────────────────────────────────

interface LocaleCopy {
  title?: string;
  overview?: string;
  shortDescription?: string;
}

interface TripSeed {
  id: string;
  name: string;
  slug: string;
  status: TripStatus;
  tierKey: TierKey;
  destination: { id: string; name: string; slug: string };
  categories: { id: string; name: string }[]; // first is primary
  hubs: { id: string; name: string }[];
  basePrice: string;
  durationFrom: number;
  durationTo: number | null;
  pickupModel: TripListItem['pickupModel'];
  bookingType: TripListItem['bookingType'];
  paymentModel: TripListItem['paymentModel'];
  fitnessLevel: TripListItem['fitnessLevel'];
  minAgeYears: number | null;
  flags: Partial<Pick<TripListItem, 'weatherDependent' | 'wheelchairAccessible' | 'familyFriendly' | 'suitableForBeginners' | 'isLocalsFavourite'>>;
  meetingPointLat: number;
  meetingPointLng: number;
  departureCity: string;
  images: { url: string; alt: string }[]; // first = hero
  inclusions: { label: string; icon: string }[];
  exclusions: { label: string; icon: string; type?: ExclusionType; priceText?: string }[];
  features: { type: FeatureType; text: string }[];
  locations: {
    types: string[];
    title: string;
    shortDescription: string;
    latitude: number;
    longitude: number;
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    addressCountry: string;
    minutesTo: number | null;
    minutesAt: number | null;
  }[];
  pickups: { name: string; directions: string; latitude: number; longitude: number; address: string; minutesPrior: number; windowStart: string; windowEnd: string }[];
  ageBands: { label: string; minAge: number | null; maxAge: number | null; price: string; priceOriginal?: string }[];
  addOns: { name: string; description: string; price: string; unit: 'PER_PERSON' | 'FLAT'; maxQuantity: number }[];
  languages: string[];
  schedules: { weekdays: number[]; startTimes: string[]; capacity: number; priceOverride?: string }[];
  /** EN copy is required; es/nl are optional to show multilingual fallback. */
  copy: { en: Required<LocaleCopy> & {
      description: string;
      whatToBring: string[];
      knowBeforeYouGo: string[];
      notSuitableFor: string[];
      whatToExpectIntro: string;
      categoryDisplay: string;
      localTip: string;
      meetingPointText: string;
      metaTitle: string;
      metaDescription: string;
    };
    es?: LocaleCopy;
    nl?: LocaleCopy;
  };
}

// ── Output maps ────────────────────────────────────────────────────────────────

export const MOCK_TRIPS: TripListItem[] = [];
export const MOCK_IMAGES: Record<string, TourImage[]> = {};
export const MOCK_INCLUSIONS: Record<string, TourInclusion[]> = {};
export const MOCK_EXCLUSIONS: Record<string, TourExclusion[]> = {};
export const MOCK_FEATURES: Record<string, TourFeature[]> = {};
export const MOCK_LOCATIONS: Record<string, TourLocation[]> = {};
export const MOCK_PICKUPS: Record<string, PickupLocation[]> = {};
export const MOCK_AGE_BANDS: Record<string, TourAgeBand[]> = {};
export const MOCK_ADDONS: Record<string, TourAddOn[]> = {};
export const MOCK_LANGUAGES: Record<string, TourLanguage[]> = {};
export const MOCK_TRANSLATIONS: Record<string, TripTranslation[]> = {};
export const MOCK_SCHEDULES: Record<string, TourSchedule[]> = {};

function buildTrip(seed: TripSeed) {
  const tier = TIER_META[seed.tierKey];
  const hero = seed.images[0];
  const published = seed.status === 'DRAFT' ? null : CREATED;

  const trip: TripListItem = {
    id: seed.id,
    name: seed.name,
    slug: seed.slug,
    status: seed.status,
    operatorId: 'mock-operator-1',
    destinationId: seed.destination.id,
    categoryIds: seed.categories.map((c) => c.id),
    primaryCategoryId: seed.categories[0]?.id ?? null,
    hubIds: seed.hubs.map((h) => h.id),

    pricingModel: 'PER_PERSON',
    wholeUnitType: null,
    defaultCurrency: 'USD',
    basePrice: seed.basePrice,
    priceFrom: seed.ageBands.length ? seed.ageBands[seed.ageBands.length - 1].price : seed.basePrice,

    durationMinutesFrom: seed.durationFrom,
    durationMinutesTo: seed.durationTo,

    pickupModel: seed.pickupModel,
    pickupRequired: seed.pickupModel === 'INCLUDED',
    maxPartySize: 24,
    minPartySize: 1,
    bookingCutoffMinutes: 120,
    cancellationHours: 48,
    checkInMinutesBefore: 30,
    instantConfirmation: true,

    paymentModel: seed.paymentModel,
    depositPct: tier.deposit,
    bookingType: seed.bookingType,

    meetingPointLat: seed.meetingPointLat,
    meetingPointLng: seed.meetingPointLng,
    departureCity: seed.departureCity,

    minAgeYears: seed.minAgeYears,
    fitnessLevel: seed.fitnessLevel,
    weatherDependent: seed.flags.weatherDependent ?? false,
    wheelchairAccessible: seed.flags.wheelchairAccessible ?? true,
    familyFriendly: seed.flags.familyFriendly ?? true,
    suitableForBeginners: seed.flags.suitableForBeginners ?? true,
    isLocalsFavourite: seed.flags.isLocalsFavourite ?? false,

    commissionTier: tier.commission,
    tierKey: seed.tierKey,
    tierRank: tier.rank,
    tierLockedUntil: seed.tierKey === 'standard' ? null : '2026-07-20T09:00:00.000Z',
    qualityScore: '78.4',
    eligibilityState: seed.status === 'LIVE' ? 'ELIGIBLE' : 'PROVISIONAL',
    isBookable: seed.status === 'LIVE',
    firstPublishedAt: published,

    h1Override: null,
    breadcrumbLabel: seed.name.split(' ').slice(0, 3).join(' '),
    ogImage: hero?.url ?? null,
    reference: `OCTO-${seed.id.toUpperCase()}`,

    aggregateRating: 4.4 + (tier.rank % 5) * 0.1,
    aggregateReviewCount: 40 + tier.rank * 33,
    bookingCount: 120 + tier.rank * 55,
    bookingCountToday: tier.rank,
    spotsRemaining: 24 - tier.rank * 2,
    lastBookedAt: NOW,

    isSponsored: seed.tierKey === 'premium' || seed.tierKey === 'featured',
    isActive: seed.status !== 'ARCHIVED',
    publishedAt: published,
    createdAt: CREATED,
    updatedAt: NOW,

    destinationName: seed.destination.name,
    categoryNames: seed.categories.map((c) => c.name),
    primaryCategoryName: seed.categories[0]?.name ?? null,
    hubNames: seed.hubs.map((h) => h.name),

    heroImage: hero ? { id: `${seed.id}-img-1`, url: hero.url, altText: hero.alt } : null,
    imageCount: seed.images.length,
    inclusionCount: seed.inclusions.length,
    exclusionCount: seed.exclusions.length,
  };
  MOCK_TRIPS.push(trip);

  // Images
  MOCK_IMAGES[seed.id] = seed.images.map((img, i) => ({
    id: `${seed.id}-img-${i + 1}`,
    tourId: seed.id,
    url: img.url,
    isHero: i === 0,
    focalX: 0.5,
    focalY: 0.5,
    altText: img.alt,
    displayOrder: i,
    width: 1200,
    height: 800,
  }));

  // Inclusions
  MOCK_INCLUSIONS[seed.id] = seed.inclusions.map((inc, i) => ({
    id: `${seed.id}-inc-${i + 1}`,
    tourId: seed.id,
    icon: inc.icon,
    displayOrder: i,
    imageUrl: null,
    translations: [{ locale: 'en', label: inc.label, isMachineTranslated: false }],
  }));

  // Exclusions
  MOCK_EXCLUSIONS[seed.id] = seed.exclusions.map((exc, i) => ({
    id: `${seed.id}-exc-${i + 1}`,
    tourId: seed.id,
    icon: exc.icon,
    type: exc.type ?? null,
    priceText: exc.priceText ?? null,
    displayOrder: i,
    imageUrl: null,
    translations: [{ locale: 'en', label: exc.label, isMachineTranslated: false }],
  }));

  // Features
  MOCK_FEATURES[seed.id] = seed.features.map((f, i) => ({
    id: `${seed.id}-feat-${i + 1}`,
    tourId: seed.id,
    type: f.type,
    displayOrder: i,
    translations: [{ locale: 'en', text: f.text, isMachineTranslated: false }],
  }));

  // Locations (itinerary)
  MOCK_LOCATIONS[seed.id] = seed.locations.map((loc, i) => ({
    id: `${seed.id}-loc-${i + 1}`,
    tourId: seed.id,
    types: loc.types,
    latitude: loc.latitude,
    longitude: loc.longitude,
    streetAddress: loc.streetAddress,
    addressLocality: loc.addressLocality,
    addressRegion: loc.addressRegion,
    postalCode: null,
    addressCountry: loc.addressCountry,
    minutesTo: loc.minutesTo,
    minutesAt: loc.minutesAt,
    displayOrder: i,
    translations: [{ locale: 'en', title: loc.title, shortDescription: loc.shortDescription, isMachineTranslated: false }],
  }));

  // Pickup locations
  MOCK_PICKUPS[seed.id] = seed.pickups.map((p, i) => ({
    id: `${seed.id}-pick-${i + 1}`,
    tourId: seed.id,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    address: p.address,
    minutesPrior: p.minutesPrior,
    windowStart: p.windowStart,
    windowEnd: p.windowEnd,
    displayOrder: i,
    isActive: true,
    translations: [{ locale: 'en', title: p.name, directions: p.directions, isMachineTranslated: false }],
  }));

  // Age bands
  MOCK_AGE_BANDS[seed.id] = seed.ageBands.map((b, i) => ({
    id: `${seed.id}-band-${i + 1}`,
    tourId: seed.id,
    label: b.label,
    minAge: b.minAge,
    maxAge: b.maxAge,
    price: b.price,
    priceOriginal: b.priceOriginal ?? null,
    priceNet: null,
    isDefault: i === 0,
    displayOrder: i,
  }));

  // Add-ons
  MOCK_ADDONS[seed.id] = seed.addOns.map((a, i) => ({
    id: `${seed.id}-addon-${i + 1}`,
    tourId: seed.id,
    name: a.name,
    description: a.description,
    price: a.price,
    unit: a.unit,
    maxQuantity: a.maxQuantity,
    displayOrder: i,
    isActive: true,
  }));

  // Languages
  MOCK_LANGUAGES[seed.id] = seed.languages.map((language, i) => ({
    id: `${seed.id}-lang-${i + 1}`,
    tourId: seed.id,
    language,
  }));

  // Translations (EN required; ES/NL optional)
  const en = seed.copy.en;
  const translations: TripTranslation[] = [
    {
      locale: 'en',
      title: null,
      overview: en.overview,
      description: en.description,
      shortDescription: en.shortDescription,
      whatToBring: en.whatToBring,
      knowBeforeYouGo: en.knowBeforeYouGo,
      notSuitableFor: en.notSuitableFor,
      whatToExpectIntro: en.whatToExpectIntro,
      categoryDisplay: en.categoryDisplay,
      localTip: en.localTip,
      meetingPointText: en.meetingPointText,
      metaTitle: en.metaTitle,
      metaDescription: en.metaDescription,
      isMachineTranslated: false,
      updatedAt: NOW,
    },
  ];
  for (const locale of ['es', 'nl'] as const) {
    const c = seed.copy[locale];
    if (!c) continue;
    translations.push({
      locale,
      title: c.title ?? null,
      overview: c.overview ?? null,
      description: null,
      shortDescription: c.shortDescription ?? null,
      whatToBring: [],
      knowBeforeYouGo: [],
      notSuitableFor: [],
      whatToExpectIntro: null,
      categoryDisplay: null,
      localTip: null,
      meetingPointText: null,
      metaTitle: null,
      metaDescription: null,
      isMachineTranslated: true,
      updatedAt: NOW,
    });
  }
  MOCK_TRANSLATIONS[seed.id] = translations;

  // Schedules (recurring)
  MOCK_SCHEDULES[seed.id] = seed.schedules.map((s, i) => ({
    id: `${seed.id}-sch-${i + 1}`,
    tourId: seed.id,
    weekdays: s.weekdays,
    startTimes: s.startTimes,
    capacity: s.capacity,
    seasonStart: null,
    seasonEnd: null,
    priceOverride: s.priceOverride ?? null,
    isActive: true,
  }));
}

const img = (seed: string, alt: string) => ({ url: `https://picsum.photos/seed/${seed}/1200/800`, alt });

const CURACAO = { id: 'dest-curacao', name: 'Curaçao', slug: 'curacao' };
const ARUBA = { id: 'dest-aruba', name: 'Aruba', slug: 'aruba' };
const SXM = { id: 'dest-sint-maarten', name: 'Sint Maarten', slug: 'sint-maarten' };

const SEEDS: TripSeed[] = [
  {
    id: 'mock-tour-1',
    name: 'Sunset Catamaran Cruise & Snorkel',
    slug: 'sunset-catamaran-cruise-snorkel',
    status: 'LIVE',
    tierKey: 'premium',
    destination: CURACAO,
    categories: [{ id: 'cat-boat', name: 'Boat Tours' }, { id: 'cat-snorkel', name: 'Snorkeling' }],
    hubs: [{ id: 'hub-spanish-water', name: 'Spanish Water' }],
    basePrice: '79.00',
    durationFrom: 180,
    durationTo: 210,
    pickupModel: 'INCLUDED',
    bookingType: 'SHARED',
    paymentModel: 'OPERATOR_LINK',
    fitnessLevel: 'EASY',
    minAgeYears: 4,
    flags: { weatherDependent: true, familyFriendly: true, suitableForBeginners: true, isLocalsFavourite: true },
    meetingPointLat: 12.0833,
    meetingPointLng: -68.85,
    departureCity: 'Willemstad',
    images: [
      img('catamaran1', 'Catamaran sailing into a Caribbean sunset'),
      img('catamaran2', 'Guests snorkeling over a coral reef'),
      img('catamaran3', 'Open bar on deck'),
      img('catamaran4', 'Turquoise water and sailboat'),
      img('catamaran5', 'Sunset over the ocean'),
    ],
    inclusions: [
      { label: 'Hotel pickup & drop-off', icon: 'transport' },
      { label: 'Open bar (rum punch, beer, soft drinks)', icon: 'drink' },
      { label: 'Snorkel gear & instruction', icon: 'gear' },
      { label: 'Fresh fruit & snacks', icon: 'food' },
    ],
    exclusions: [
      { label: 'Gratuities', icon: 'money', type: 'PAID_ONSITE', priceText: 'Optional, ~15%' },
      { label: 'Underwater camera rental', icon: 'photo', type: 'PAID_ADVANCE', priceText: '$25' },
      { label: 'Hotel WiFi', icon: 'ban', type: 'UNAVAILABLE' },
    ],
    features: [
      { type: 'PREBOOKING_INFORMATION', text: 'Confirmation received at time of booking.' },
      { type: 'ACCESSIBILITY_INFORMATION', text: 'Not wheelchair accessible; boarding requires steps.' },
      { type: 'CANCELLATION_TERM', text: 'Free cancellation up to 48 hours before departure.' },
    ],
    locations: [
      { types: ['START'], title: 'Spanish Water Marina', shortDescription: 'Board the catamaran at the main pier.', latitude: 12.0786, longitude: -68.8472, streetAddress: 'Caracasbaaiweg', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: null, minutesAt: 20 },
      { types: ['ITINERARY_ITEM'], title: 'Tugboat Reef', shortDescription: 'Snorkel stop over the famous sunken tugboat.', latitude: 12.0667, longitude: -68.8617, streetAddress: '', addressLocality: 'Caracas Bay', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 25, minutesAt: 60 },
      { types: ['END'], title: 'Spanish Water Marina', shortDescription: 'Return to the marina after sunset.', latitude: 12.0786, longitude: -68.8472, streetAddress: 'Caracasbaaiweg', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 30, minutesAt: null },
    ],
    pickups: [
      { name: 'Marriott Beach Resort - lobby', directions: 'Wait by the main entrance.', latitude: 12.1273, longitude: -68.9789, address: 'Piscadera Bay', minutesPrior: 45, windowStart: '15:30', windowEnd: '15:45' },
      { name: 'Renaissance Mall - taxi stand', directions: 'Meet at the covered taxi stand.', latitude: 12.1086, longitude: -68.9335, address: 'Otrobanda', minutesPrior: 45, windowStart: '15:50', windowEnd: '16:05' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '79.00', priceOriginal: '89.00' },
      { label: 'Child (4-12)', minAge: 4, maxAge: 12, price: '49.00' },
      { label: 'Infant (0-3)', minAge: 0, maxAge: 3, price: '0.00' },
    ],
    addOns: [
      { name: 'Professional photo package', description: 'Digital gallery of your trip.', price: '35.00', unit: 'PER_PERSON', maxQuantity: 6 },
      { name: 'Private charter upgrade', description: 'Reserve the whole boat.', price: '600.00', unit: 'FLAT', maxQuantity: 1 },
    ],
    languages: ['en', 'nl', 'es'],
    schedules: [
      { weekdays: [1, 3, 5], startTimes: ['16:00'], capacity: 24 },
      { weekdays: [6, 0], startTimes: ['10:00', '16:00'], capacity: 24, priceOverride: '85.00' },
    ],
    copy: {
      en: {
        title: 'Sunset Catamaran Cruise & Snorkel',
        overview: 'Glide along Curaçao’s south coast on a spacious catamaran, snorkel a vibrant reef, then toast the sunset with unlimited drinks and island music.',
        shortDescription: 'Luxury sunset sail with reef snorkeling and open bar.',
        description: 'Our flagship afternoon cruise is the most-loved way to end a day in Curaçao. Set sail from Spanish Water, drop anchor over the protected Tugboat reef for a guided snorkel, and relax on deck as the crew pours rum punch and the sun dips below the horizon. Hotel transfers, gear, and snacks are all included.',
        whatToBring: ['Swimwear', 'Towel', 'Reef-safe sunscreen', 'A light layer for after sunset'],
        knowBeforeYouGo: ['Bring a valid photo ID', 'Tour runs rain or shine', 'Arrive 20 minutes before departure'],
        notSuitableFor: ['Travellers who are pregnant', 'Guests with limited mobility'],
        whatToExpectIntro: 'A relaxed 3-hour cruise with one guided snorkel stop and an open bar throughout.',
        categoryDisplay: 'Catamaran Cruises',
        localTip: 'Sit at the front netting for the best sunset photos.',
        meetingPointText: 'Meet at the Spanish Water Marina main pier, 20 minutes before departure.',
        metaTitle: 'Sunset Catamaran Cruise & Snorkel in Curaçao',
        metaDescription: 'Sail Curaçao’s coast at sunset, snorkel a coral reef and enjoy an open bar. Hotel pickup included.',
      },
      es: { title: 'Crucero en Catamarán al Atardecer', overview: 'Navega por la costa sur de Curaçao, bucea en un arrecife vibrante y brinda al atardecer con barra libre.', shortDescription: 'Velero de lujo al atardecer con snorkel y barra libre.' },
      nl: { title: 'Zonsondergang Catamarancruise & Snorkelen', overview: 'Vaar langs de zuidkust van Curaçao, snorkel bij een kleurrijk rif en proost op de zonsondergang met onbeperkt drinken.', shortDescription: 'Luxe zonsondergangtocht met snorkelen en open bar.' },
    },
  },
  {
    id: 'mock-tour-2',
    name: 'Mambo Beach Snorkel Adventure',
    slug: 'mambo-beach-snorkel-adventure',
    status: 'LIVE',
    tierKey: 'featured',
    destination: CURACAO,
    categories: [{ id: 'cat-snorkel', name: 'Snorkeling' }, { id: 'cat-beach', name: 'Beaches' }],
    hubs: [{ id: 'hub-mambo', name: 'Mambo Beach' }],
    basePrice: '45.00',
    durationFrom: 120,
    durationTo: 150,
    pickupModel: 'PAID_ADDON',
    bookingType: 'SHARED',
    paymentModel: 'PAID_IN_FULL',
    fitnessLevel: 'MODERATE',
    minAgeYears: 8,
    flags: { weatherDependent: true, suitableForBeginners: true },
    meetingPointLat: 12.0853,
    meetingPointLng: -68.8967,
    departureCity: 'Willemstad',
    images: [
      img('snorkel1', 'Snorkeler over a colorful reef'),
      img('snorkel2', 'Mambo Beach shoreline'),
      img('snorkel3', 'Tropical fish underwater'),
      img('snorkel4', 'Sea turtle swimming'),
      img('snorkel5', 'Beach gear laid out'),
    ],
    inclusions: [
      { label: 'Snorkel mask, fins & vest', icon: 'gear' },
      { label: 'Certified guide', icon: 'guide' },
      { label: 'Bottled water', icon: 'drink' },
      { label: 'Beach entry ticket', icon: 'ticket' },
    ],
    exclusions: [
      { label: 'Hotel pickup', icon: 'transport', type: 'PAID_ADVANCE', priceText: '$10 per person' },
      { label: 'Lunch', icon: 'food', type: 'PAID_ONSITE' },
      { label: 'Locker rental', icon: 'money', type: 'PAID_ONSITE', priceText: '$5' },
    ],
    features: [
      { type: 'PREARRIVAL_INFORMATION', text: 'Apply reef-safe sunscreen before arrival to protect the reef.' },
      { type: 'REDEMPTION_INSTRUCTION', text: 'Show your voucher at the Mambo Beach dive desk.' },
      { type: 'ADDITIONAL_INFORMATION', text: 'Basic swimming ability required.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Mambo Beach Dive Desk', shortDescription: 'Check in at the dive desk on the boardwalk.', latitude: 12.0853, longitude: -68.8967, streetAddress: 'Mambo Beach Boulevard', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: null, minutesAt: 30 },
      { types: ['ITINERARY_ITEM'], title: 'House Reef', shortDescription: 'Swim out to the protected house reef.', latitude: 12.084, longitude: -68.898, streetAddress: '', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 10, minutesAt: 70 },
    ],
    pickups: [
      { name: 'Mambo Beach main gate', directions: 'Meet at the ticket booth.', latitude: 12.0855, longitude: -68.8969, address: 'Mambo Beach', minutesPrior: 20, windowStart: '09:30', windowEnd: '09:45' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '45.00' },
      { label: 'Youth (8-12)', minAge: 8, maxAge: 12, price: '30.00' },
    ],
    addOns: [
      { name: 'GoPro rental', description: 'Capture your dive.', price: '20.00', unit: 'PER_PERSON', maxQuantity: 4 },
      { name: 'Reef-safe sunscreen', description: 'Protect yourself and the reef.', price: '8.00', unit: 'PER_PERSON', maxQuantity: 4 },
    ],
    languages: ['en', 'nl'],
    schedules: [{ weekdays: [1, 2, 3, 4, 5], startTimes: ['10:00', '13:00'], capacity: 8 }],
    copy: {
      en: {
        title: 'Mambo Beach Snorkel Adventure',
        overview: 'Join a marine biologist for an intimate guided snorkel over Mambo Beach’s thriving house reef, home to turtles and tropical fish.',
        shortDescription: 'Small-group guided reef snorkel with a marine biologist.',
        description: 'This small-group snorkel is perfect for curious beginners and families. Your guide explains the reef ecosystem as you float over corals teeming with parrotfish, and there’s a good chance of meeting a green sea turtle. All gear and beach entry are included.',
        whatToBring: ['Swimwear', 'Towel', 'Water shoes'],
        knowBeforeYouGo: ['Basic swimming required', 'Arrive 30 minutes early', 'Sunscreen must be reef-safe'],
        notSuitableFor: ['Non-swimmers', 'Children under 8'],
        whatToExpectIntro: 'A 2-hour guided snorkel including a short reef briefing on the beach.',
        categoryDisplay: 'Snorkeling Tours',
        localTip: 'Go on the morning slot for the calmest water.',
        meetingPointText: 'Meet at the Mambo Beach dive desk on the boardwalk.',
        metaTitle: 'Mambo Beach Snorkel Adventure in Curaçao',
        metaDescription: 'Guided small-group snorkel over Curaçao’s Mambo Beach reef. Turtles, gear and beach entry included.',
      },
      es: { title: 'Aventura de Snorkel en Mambo Beach', shortDescription: 'Snorkel guiado en grupos pequeños con un biólogo marino.' },
    },
  },
  {
    id: 'mock-tour-3',
    name: 'Christoffel National Park Sunrise Hike',
    slug: 'christoffel-national-park-sunrise-hike',
    status: 'LIVE',
    tierKey: 'boosted',
    destination: CURACAO,
    categories: [{ id: 'cat-hiking', name: 'Hiking' }, { id: 'cat-nature', name: 'Nature & Wildlife' }],
    hubs: [{ id: 'hub-westpunt', name: 'Westpunt' }],
    basePrice: '55.00',
    durationFrom: 240,
    durationTo: 300,
    pickupModel: 'INCLUDED',
    bookingType: 'SHARED',
    paymentModel: 'OPERATOR_LINK',
    fitnessLevel: 'CHALLENGING',
    minAgeYears: 12,
    flags: { weatherDependent: true, wheelchairAccessible: false, familyFriendly: false, suitableForBeginners: false },
    meetingPointLat: 12.3667,
    meetingPointLng: -69.1167,
    departureCity: 'Westpunt',
    images: [
      img('hike1', 'Hikers on Mount Christoffel at sunrise'),
      img('hike2', 'View from the summit'),
      img('hike3', 'Cactus landscape'),
      img('hike4', 'Trail through the park'),
      img('hike5', 'Sunrise over Curaçao'),
    ],
    inclusions: [
      { label: 'Park entrance fee', icon: 'ticket' },
      { label: 'Experienced guide', icon: 'guide' },
      { label: 'Round-trip transport', icon: 'transport' },
      { label: 'Energy snack & water', icon: 'food' },
    ],
    exclusions: [
      { label: 'Hiking boots', icon: 'gear', type: 'NOT_PERMITTED' },
      { label: 'Breakfast', icon: 'food', type: 'UNAVAILABLE' },
      { label: 'Gratuities', icon: 'money', type: 'PAID_ONSITE' },
    ],
    features: [
      { type: 'PREARRIVAL_INFORMATION', text: 'Wear sturdy closed shoes; the trail is steep and rocky.' },
      { type: 'ACCESSIBILITY_INFORMATION', text: 'Strenuous hike, not suitable for limited mobility.' },
      { type: 'BOOKING_TERM', text: 'Minimum 2 participants required for the tour to run.' },
    ],
    locations: [
      { types: ['START'], title: 'Christoffel Park Gate', shortDescription: 'Meet at the park visitor center before dawn.', latitude: 12.3667, longitude: -69.1167, streetAddress: 'Savonet', addressLocality: 'Westpunt', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: null, minutesAt: 15 },
      { types: ['ITINERARY_ITEM'], title: 'Mount Christoffel Summit', shortDescription: 'Reach the 372m summit for sunrise.', latitude: 12.3742, longitude: -69.1206, streetAddress: '', addressLocality: 'Westpunt', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 90, minutesAt: 45 },
      { types: ['END'], title: 'Christoffel Park Gate', shortDescription: 'Return to the visitor center.', latitude: 12.3667, longitude: -69.1167, streetAddress: 'Savonet', addressLocality: 'Westpunt', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 75, minutesAt: null },
    ],
    pickups: [
      { name: 'Westpunt village square', directions: 'Meet beside the church.', latitude: 12.366, longitude: -69.157, address: 'Westpunt', minutesPrior: 30, windowStart: '04:30', windowEnd: '04:45' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '55.00' },
      { label: 'Youth (12)', minAge: 12, maxAge: 12, price: '40.00' },
    ],
    addOns: [{ name: 'Trekking pole rental', description: 'Helps on the steep descent.', price: '6.00', unit: 'PER_PERSON', maxQuantity: 8 }],
    languages: ['en', 'nl', 'es'],
    schedules: [{ weekdays: [2, 4, 6], startTimes: ['05:00'], capacity: 12 }],
    copy: {
      en: {
        title: 'Christoffel National Park Sunrise Hike',
        overview: 'Climb Curaçao’s highest peak before dawn and watch the sun rise over the island from 372 meters up.',
        shortDescription: 'Guided pre-dawn summit hike of Mount Christoffel.',
        description: 'Start in the dark and climb steadily through cactus-dotted trails to the rocky summit of Mount Christoffel. As the sun breaks the horizon, you’ll be rewarded with 360-degree views across the whole island. A challenging but unforgettable adventure led by an expert local guide.',
        whatToBring: ['Closed hiking shoes', 'Water', 'Light rain jacket', 'Headlamp'],
        knowBeforeYouGo: ['Strenuous, steep terrain', 'Start is before sunrise', 'Minimum age 12'],
        notSuitableFor: ['Young children', 'Travellers with heart or knee conditions'],
        whatToExpectIntro: 'A 4-5 hour round-trip hike starting before dawn to reach the summit at sunrise.',
        categoryDisplay: 'Hiking Tours',
        localTip: 'Bring a windbreaker - the summit is breezy at dawn.',
        meetingPointText: 'Meet at the Christoffel Park visitor center before dawn.',
        metaTitle: 'Christoffel Park Sunrise Hike in Curaçao',
        metaDescription: 'Summit Curaçao’s highest peak at sunrise on this guided hike. Transport and park fees included.',
      },
      nl: { title: 'Christoffelpark Zonsopkomst Wandeling', shortDescription: 'Begeleide wandeling naar de top van de Christoffelberg bij dageraad.' },
    },
  },
  {
    id: 'mock-tour-4',
    name: 'Klein Curaçao Island Day Trip',
    slug: 'klein-curacao-island-day-trip',
    status: 'LIVE',
    tierKey: 'organic',
    destination: CURACAO,
    categories: [{ id: 'cat-boat', name: 'Boat Tours' }, { id: 'cat-daytrip', name: 'Day Trips' }],
    hubs: [{ id: 'hub-spanish-water', name: 'Spanish Water' }],
    basePrice: '129.00',
    durationFrom: 540,
    durationTo: 600,
    pickupModel: 'INCLUDED',
    bookingType: 'SHARED',
    paymentModel: 'OPERATOR_LINK',
    fitnessLevel: 'EASY',
    minAgeYears: 0,
    flags: { weatherDependent: true, familyFriendly: true, suitableForBeginners: true, isLocalsFavourite: true },
    meetingPointLat: 12.0786,
    meetingPointLng: -68.8472,
    departureCity: 'Willemstad',
    images: [
      img('klein1', 'Klein Curaçao white sand beach'),
      img('klein2', 'Historic lighthouse'),
      img('klein3', 'Boat anchored off the island'),
      img('klein4', 'Snorkeling near the shore'),
      img('klein5', 'Shipwreck on the beach'),
    ],
    inclusions: [
      { label: 'Round-trip boat transfer', icon: 'transport' },
      { label: 'BBQ lunch', icon: 'food' },
      { label: 'Open bar', icon: 'drink' },
      { label: 'Beach chairs & shade', icon: 'gear' },
    ],
    exclusions: [
      { label: 'Souvenirs', icon: 'money', type: 'PAID_ONSITE' },
      { label: 'Diving excursion', icon: 'gear', type: 'PAID_ADVANCE', priceText: '$60' },
      { label: 'WiFi on the island', icon: 'ban', type: 'UNAVAILABLE' },
    ],
    features: [
      { type: 'PREBOOKING_INFORMATION', text: 'Departure may be rescheduled due to sea conditions.' },
      { type: 'ADDITIONAL_INFORMATION', text: 'The crossing takes around 90 minutes each way.' },
      { type: 'CANCELLATION_TERM', text: 'Free cancellation up to 72 hours before departure.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Spanish Water Marina', shortDescription: 'Board the day-trip vessel early morning.', latitude: 12.0786, longitude: -68.8472, streetAddress: 'Caracasbaaiweg', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: null, minutesAt: 20 },
      { types: ['ITINERARY_ITEM'], title: 'Klein Curaçao Beach', shortDescription: 'Relax on the white-sand beach all day.', latitude: 11.9886, longitude: -68.6428, streetAddress: '', addressLocality: 'Klein Curaçao', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 90, minutesAt: 300 },
    ],
    pickups: [
      { name: 'Jan Thiel Beach lot', directions: 'Meet at the parking entrance.', latitude: 12.0769, longitude: -68.8847, address: 'Jan Thiel', minutesPrior: 60, windowStart: '06:30', windowEnd: '06:45' },
      { name: 'Willemstad cruise terminal', directions: 'Meet outside the terminal gate.', latitude: 12.1108, longitude: -68.9335, address: 'Otrobanda', minutesPrior: 60, windowStart: '06:50', windowEnd: '07:05' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '129.00' },
      { label: 'Child (4-12)', minAge: 4, maxAge: 12, price: '89.00' },
      { label: 'Infant (0-3)', minAge: 0, maxAge: 3, price: '0.00' },
    ],
    addOns: [{ name: 'Massage on the beach', description: '20-minute beach massage.', price: '40.00', unit: 'PER_PERSON', maxQuantity: 6 }],
    languages: ['en', 'nl', 'es'],
    schedules: [{ weekdays: [0, 2, 4, 6], startTimes: ['07:30'], capacity: 40 }],
    copy: {
      en: {
        title: 'Klein Curaçao Island Day Trip',
        overview: 'Cruise to the uninhabited island of Klein Curaçao for a full day of white-sand beaches, snorkeling, and a beachside BBQ.',
        shortDescription: 'Full-day boat trip to a pristine uninhabited island.',
        description: 'Escape to Klein Curaçao, a tiny uninhabited island ringed by powder-white sand and turquoise water. Snorkel over reefs, explore the historic lighthouse and a weathered shipwreck, then tuck into a fresh BBQ lunch with an open bar. A complete day of Caribbean paradise.',
        whatToBring: ['Swimwear', 'Towel', 'Sunscreen', 'Hat', 'Cash for souvenirs'],
        knowBeforeYouGo: ['The crossing can be choppy', 'Bring motion-sickness tablets if prone', 'No shade beyond the provided umbrellas'],
        notSuitableFor: ['Travellers with severe seasickness'],
        whatToExpectIntro: 'A full-day excursion with a 90-minute crossing each way and ~5 hours on the island.',
        categoryDisplay: 'Day Trips',
        localTip: 'Grab a spot near the lighthouse for the clearest snorkeling.',
        meetingPointText: 'Meet at the Spanish Water Marina at 7:30 AM.',
        metaTitle: 'Klein Curaçao Island Day Trip',
        metaDescription: 'Spend a full day on uninhabited Klein Curaçao with snorkeling, a BBQ lunch and open bar. Transfers included.',
      },
    },
  },
  {
    id: 'mock-tour-5',
    name: 'Aruba Jeep Safari & Natural Pool',
    slug: 'aruba-jeep-safari-natural-pool',
    status: 'LIVE',
    tierKey: 'standard',
    destination: ARUBA,
    categories: [{ id: 'cat-offroad', name: 'Off-Road & ATV' }, { id: 'cat-nature', name: 'Nature & Wildlife' }],
    hubs: [{ id: 'hub-arikok', name: 'Arikok National Park' }],
    basePrice: '95.00',
    durationFrom: 360,
    durationTo: 420,
    pickupModel: 'INCLUDED',
    bookingType: 'SHARED',
    paymentModel: 'OPERATOR_LINK',
    fitnessLevel: 'MODERATE',
    minAgeYears: 6,
    flags: { weatherDependent: false, wheelchairAccessible: false, familyFriendly: true },
    meetingPointLat: 12.5061,
    meetingPointLng: -69.9633,
    departureCity: 'Oranjestad',
    images: [
      img('jeep1', '4x4 jeep on a rugged Aruba trail'),
      img('jeep2', 'Aruba natural pool'),
      img('jeep3', 'Rocky coastline'),
      img('jeep4', 'Desert landscape with cacti'),
      img('jeep5', 'Group at a scenic overlook'),
    ],
    inclusions: [
      { label: '4x4 transport with driver-guide', icon: 'transport' },
      { label: 'Park entrance', icon: 'ticket' },
      { label: 'Lunch & drinks', icon: 'food' },
      { label: 'Snorkel gear', icon: 'gear' },
    ],
    exclusions: [
      { label: 'Gratuities', icon: 'money', type: 'PAID_ONSITE' },
      { label: 'Towels', icon: 'gear', type: 'NOT_PERMITTED' },
      { label: 'Alcoholic drinks', icon: 'drink', type: 'PAID_ONSITE', priceText: 'From $4' },
    ],
    features: [
      { type: 'PREARRIVAL_INFORMATION', text: 'The Natural Pool swim depends on safe sea conditions.' },
      { type: 'ACCESSIBILITY_INFORMATION', text: 'The terrain is bumpy; not recommended for back/neck issues.' },
      { type: 'REDEMPTION_INSTRUCTION', text: 'Present your booking confirmation to the driver at pickup.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Oranjestad Pickup', shortDescription: 'Hotel pickup around the Palm Beach area.', latitude: 12.5239, longitude: -70.0386, streetAddress: 'J.E. Irausquin Blvd', addressLocality: 'Palm Beach', addressRegion: 'Aruba', addressCountry: 'Aruba', minutesTo: null, minutesAt: 15 },
      { types: ['ITINERARY_ITEM'], title: 'Conchi Natural Pool', shortDescription: 'Swim in the volcanic rock pool.', latitude: 12.4928, longitude: -69.9419, streetAddress: '', addressLocality: 'Arikok', addressRegion: 'Aruba', addressCountry: 'Aruba', minutesTo: 60, minutesAt: 60 },
      { types: ['POI'], title: 'Quadirikiri Caves', shortDescription: 'Explore sunlit limestone caves.', latitude: 12.4775, longitude: -69.8869, streetAddress: '', addressLocality: 'Arikok', addressRegion: 'Aruba', addressCountry: 'Aruba', minutesTo: 30, minutesAt: 30 },
    ],
    pickups: [
      { name: 'Palm Beach hotels', directions: 'Your driver will text the exact lobby.', latitude: 12.5708, longitude: -70.0489, address: 'Palm Beach', minutesPrior: 30, windowStart: '08:00', windowEnd: '08:30' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '95.00' },
      { label: 'Child (6-12)', minAge: 6, maxAge: 12, price: '65.00' },
    ],
    addOns: [{ name: 'Aqua shoes', description: 'Protect your feet on the rocks.', price: '10.00', unit: 'PER_PERSON', maxQuantity: 8 }],
    languages: ['en', 'es'],
    schedules: [{ weekdays: [1, 3, 5], startTimes: ['08:30'], capacity: 16 }],
    copy: {
      en: {
        title: 'Aruba Jeep Safari & Natural Pool',
        overview: 'Bounce through Arikok National Park in a 4x4, swim in the hidden Natural Pool, and explore caves and rugged coastline.',
        shortDescription: 'Off-road 4x4 adventure with a Natural Pool swim.',
        description: 'See the wild side of Aruba on this half-day off-road safari. Your driver-guide tackles rocky trails through Arikok National Park to reach Conchi, the famous Natural Pool, where you can swim in a volcanic rock basin. Along the way you’ll explore the Quadirikiri caves and stop at scenic coastal overlooks.',
        whatToBring: ['Swimwear', 'Sunscreen', 'Closed shoes', 'Water'],
        knowBeforeYouGo: ['The ride is bumpy', 'Natural Pool swim is weather-dependent', 'Bring a change of clothes'],
        notSuitableFor: ['Pregnant travellers', 'Guests with back or neck problems'],
        whatToExpectIntro: 'A 6-hour off-road tour with a swim stop, cave visit and coastal viewpoints.',
        categoryDisplay: 'Off-Road Safaris',
        localTip: 'Sit in the middle rows for the smoothest ride.',
        meetingPointText: 'Hotel pickup from Palm Beach and Eagle Beach areas.',
        metaTitle: 'Aruba Jeep Safari & Natural Pool Tour',
        metaDescription: 'Off-road 4x4 safari through Arikok Park with a Natural Pool swim, caves and lunch. Hotel pickup included.',
      },
      es: { title: 'Safari en Jeep y Piscina Natural de Aruba', shortDescription: 'Aventura todoterreno 4x4 con baño en la Piscina Natural.' },
    },
  },
  {
    id: 'mock-tour-6',
    name: 'Aruba Sunset Sailing & Open Bar',
    slug: 'aruba-sunset-sailing-open-bar',
    status: 'DRAFT',
    tierKey: 'premium',
    destination: ARUBA,
    categories: [{ id: 'cat-boat', name: 'Boat Tours' }, { id: 'cat-romantic', name: 'Romantic' }],
    hubs: [{ id: 'hub-palm-beach', name: 'Palm Beach' }],
    basePrice: '69.00',
    durationFrom: 150,
    durationTo: 150,
    pickupModel: 'NONE',
    bookingType: 'SHARED',
    paymentModel: 'OPERATOR_FULL',
    fitnessLevel: 'EASY',
    minAgeYears: 0,
    flags: { weatherDependent: true, familyFriendly: true, suitableForBeginners: true },
    meetingPointLat: 12.5708,
    meetingPointLng: -70.0489,
    departureCity: 'Palm Beach',
    images: [
      img('sail1', 'Sailboat at sunset off Aruba'),
      img('sail2', 'Couple toasting on deck'),
      img('sail3', 'Palm Beach coastline'),
    ],
    inclusions: [
      { label: 'Open bar', icon: 'drink' },
      { label: 'Canapés', icon: 'food' },
      { label: 'Onboard restroom', icon: 'check' },
    ],
    exclusions: [
      { label: 'Hotel transfers', icon: 'transport', type: 'UNAVAILABLE' },
      { label: 'Gratuities', icon: 'money', type: 'PAID_ONSITE' },
    ],
    features: [
      { type: 'PREBOOKING_INFORMATION', text: 'Adults-only sunset slot available on request.' },
      { type: 'CANCELLATION_TERM', text: 'Free cancellation up to 24 hours before departure.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Palm Beach Pier', shortDescription: 'Board at the main pier near the high-rise hotels.', latitude: 12.5708, longitude: -70.0489, streetAddress: 'Palm Beach Pier', addressLocality: 'Palm Beach', addressRegion: 'Aruba', addressCountry: 'Aruba', minutesTo: null, minutesAt: 15 },
    ],
    pickups: [],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '69.00' },
      { label: 'Child (4-12)', minAge: 4, maxAge: 12, price: '39.00' },
    ],
    addOns: [{ name: 'Champagne bottle', description: 'Celebrate with a bottle of bubbly.', price: '45.00', unit: 'FLAT', maxQuantity: 3 }],
    languages: ['en'],
    schedules: [{ weekdays: [4, 5, 6], startTimes: ['17:30'], capacity: 30 }],
    copy: {
      en: {
        title: 'Aruba Sunset Sailing & Open Bar',
        overview: 'A romantic sunset sail along Palm Beach with unlimited drinks, canapés and live acoustic music.',
        shortDescription: 'Romantic sunset sail with open bar and live music.',
        description: 'Set sail as the Aruban sun melts into the sea. This relaxed 2.5-hour cruise pairs an open bar and fresh canapés with live acoustic music, making it the perfect romantic evening or a laid-back outing with friends. (This sample tour is in DRAFT to show the publish-readiness checklist.)',
        whatToBring: ['Light jacket', 'Camera'],
        knowBeforeYouGo: ['Boarding is 15 minutes before departure', 'Flat shoes recommended'],
        notSuitableFor: ['Guests prone to seasickness'],
        whatToExpectIntro: 'A 2.5-hour evening sail timed to the sunset.',
        categoryDisplay: 'Sunset Cruises',
        localTip: 'Arrive early to claim the bow seats.',
        meetingPointText: 'Meet at the Palm Beach pier near the Ritz-Carlton.',
        metaTitle: 'Aruba Sunset Sailing & Open Bar',
        metaDescription: 'Romantic Aruba sunset sail with open bar, canapés and live music along Palm Beach.',
      },
    },
  },
  {
    id: 'mock-tour-7',
    name: 'Sint Maarten Island Tour & Beach Hop',
    slug: 'sint-maarten-island-tour-beach-hop',
    status: 'PAUSED',
    tierKey: 'featured',
    destination: SXM,
    categories: [{ id: 'cat-sightseeing', name: 'Sightseeing' }, { id: 'cat-beach', name: 'Beaches' }],
    hubs: [{ id: 'hub-philipsburg', name: 'Philipsburg' }],
    basePrice: '60.00',
    durationFrom: 300,
    durationTo: 360,
    pickupModel: 'INCLUDED',
    bookingType: 'SHARED',
    paymentModel: 'PAID_IN_FULL',
    fitnessLevel: 'EASY',
    minAgeYears: 0,
    flags: { familyFriendly: true, suitableForBeginners: true },
    meetingPointLat: 18.0255,
    meetingPointLng: -63.0548,
    departureCity: 'Philipsburg',
    images: [
      img('sxm1', 'Sint Maarten coastline from above'),
      img('sxm2', 'Colorful Philipsburg street'),
      img('sxm3', 'Beach with turquoise water'),
      img('sxm4', 'French side market'),
    ],
    inclusions: [
      { label: 'Air-conditioned transport', icon: 'transport' },
      { label: 'Local guide', icon: 'guide' },
      { label: 'Bottled water', icon: 'drink' },
    ],
    exclusions: [
      { label: 'Lunch', icon: 'food', type: 'PAID_ONSITE' },
      { label: 'Beach loungers', icon: 'money', type: 'PAID_ONSITE', priceText: '$10' },
      { label: 'Gratuities', icon: 'money', type: 'PAID_ONSITE' },
    ],
    features: [
      { type: 'ADDITIONAL_INFORMATION', text: 'Bring your passport for photos at the border monument.' },
      { type: 'REDEMPTION_INSTRUCTION', text: 'Show the voucher to your guide at pickup.' },
      { type: 'BOOKING_TERM', text: 'Itinerary order may vary with cruise-ship traffic.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Philipsburg Boardwalk', shortDescription: 'Meet near the courthouse on the boardwalk.', latitude: 18.0255, longitude: -63.0548, streetAddress: 'Front Street', addressLocality: 'Philipsburg', addressRegion: 'Sint Maarten', addressCountry: 'Sint Maarten', minutesTo: null, minutesAt: 20 },
      { types: ['ITINERARY_ITEM'], title: 'Maho Beach', shortDescription: 'Watch planes land right over the beach.', latitude: 18.0411, longitude: -63.1136, streetAddress: '', addressLocality: 'Maho', addressRegion: 'Sint Maarten', addressCountry: 'Sint Maarten', minutesTo: 30, minutesAt: 40 },
      { types: ['ITINERARY_ITEM'], title: 'Marigot (French side)', shortDescription: 'Free time at the waterfront market.', latitude: 18.0686, longitude: -63.0847, streetAddress: '', addressLocality: 'Marigot', addressRegion: 'Saint-Martin', addressCountry: 'Saint-Martin', minutesTo: 25, minutesAt: 60 },
    ],
    pickups: [
      { name: 'Cruise port', directions: 'Meet at the welcome center exit.', latitude: 18.0186, longitude: -63.0411, address: 'Philipsburg', minutesPrior: 30, windowStart: '09:00', windowEnd: '09:20' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '60.00' },
      { label: 'Child (4-12)', minAge: 4, maxAge: 12, price: '40.00' },
      { label: 'Infant (0-3)', minAge: 0, maxAge: 3, price: '0.00' },
    ],
    addOns: [{ name: 'Lunch upgrade', description: 'Set lunch at a local restaurant.', price: '22.00', unit: 'PER_PERSON', maxQuantity: 10 }],
    languages: ['en', 'nl', 'fr'],
    schedules: [{ weekdays: [1, 2, 3, 4, 5, 6], startTimes: ['09:30'], capacity: 18 }],
    copy: {
      en: {
        title: 'Sint Maarten Island Tour & Beach Hop',
        overview: 'See the best of the Dutch and French sides of the island, hopping between three beaches with free time in Marigot.',
        shortDescription: 'Full island tour across two nations with three beach stops.',
        description: 'This relaxed island tour covers both the Dutch and French sides of Sint Maarten / Saint-Martin. Snap photos at scenic overlooks, watch jets skim the sand at Maho Beach, and enjoy free time at the colorful Marigot market. A great overview for first-time visitors. (This sample tour is PAUSED to show that lifecycle state.)',
        whatToBring: ['Passport', 'Swimwear', 'Sunscreen', 'Camera'],
        knowBeforeYouGo: ['Bring cash for lunch and beach chairs', 'Itinerary order may change'],
        notSuitableFor: [],
        whatToExpectIntro: 'A 5-6 hour sightseeing loop with three beach stops and shopping time.',
        categoryDisplay: 'Island Tours',
        localTip: 'Stand at the fence at Maho for the famous plane shots.',
        meetingPointText: 'Meet on the Philipsburg boardwalk near the courthouse.',
        metaTitle: 'Sint Maarten Island Tour & Beach Hop',
        metaDescription: 'Tour both sides of Sint Maarten with three beach stops and free time in Marigot. Transport and guide included.',
      },
      nl: { title: 'Sint Maarten Eilandtour & Strandhoppen', shortDescription: 'Volledige eilandtour over twee landen met drie strandstops.' },
    },
  },
  {
    id: 'mock-tour-8',
    name: 'Maho Beach Plane Spotting & BBQ',
    slug: 'maho-beach-plane-spotting-bbq',
    status: 'LIVE',
    tierKey: 'boosted',
    destination: SXM,
    categories: [{ id: 'cat-food', name: 'Food & Drink' }, { id: 'cat-beach', name: 'Beaches' }],
    hubs: [{ id: 'hub-maho', name: 'Maho' }],
    basePrice: '40.00',
    durationFrom: 180,
    durationTo: 240,
    pickupModel: 'PAID_ADDON',
    bookingType: 'SHARED',
    paymentModel: 'ON_ARRIVAL',
    fitnessLevel: 'EASY',
    minAgeYears: 0,
    flags: { familyFriendly: true, suitableForBeginners: true, isLocalsFavourite: true },
    meetingPointLat: 18.0411,
    meetingPointLng: -63.1136,
    departureCity: 'Maho',
    images: [
      img('maho1', 'Jet landing over Maho Beach'),
      img('maho2', 'Beach BBQ spread'),
      img('maho3', 'Crowd watching planes'),
      img('maho4', 'Sunset at Maho Beach'),
    ],
    inclusions: [
      { label: 'BBQ lunch', icon: 'food' },
      { label: 'One welcome drink', icon: 'drink' },
      { label: 'Reserved beach seating', icon: 'gear' },
    ],
    exclusions: [
      { label: 'Hotel pickup', icon: 'transport', type: 'PAID_ADVANCE', priceText: '$12' },
      { label: 'Extra drinks', icon: 'drink', type: 'PAID_ONSITE' },
    ],
    features: [
      { type: 'PREARRIVAL_INFORMATION', text: 'Jet-blast zone can be dangerous - follow your host’s instructions.' },
      { type: 'ADDITIONAL_INFORMATION', text: 'Best plane activity is midday; schedules vary.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Sunset Bar & Grill', shortDescription: 'Meet your host at the beach bar.', latitude: 18.0411, longitude: -63.1136, streetAddress: 'Beacon Hill Rd', addressLocality: 'Maho', addressRegion: 'Sint Maarten', addressCountry: 'Sint Maarten', minutesTo: null, minutesAt: 20 },
    ],
    pickups: [
      { name: 'Simpson Bay hotels', directions: 'Driver meets you in the lobby.', latitude: 18.035, longitude: -63.105, address: 'Simpson Bay', minutesPrior: 30, windowStart: '11:00', windowEnd: '11:30' },
    ],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '40.00' },
      { label: 'Child (4-12)', minAge: 4, maxAge: 12, price: '25.00' },
    ],
    addOns: [{ name: 'Drink package', description: 'Unlimited soft drinks & two cocktails.', price: '18.00', unit: 'PER_PERSON', maxQuantity: 8 }],
    languages: ['en', 'fr'],
    schedules: [{ weekdays: [0, 3, 5, 6], startTimes: ['11:30'], capacity: 20 }],
    copy: {
      en: {
        title: 'Maho Beach Plane Spotting & BBQ',
        overview: 'Feel the thrill of jets landing meters overhead at world-famous Maho Beach, with a beachfront BBQ and reserved seating.',
        shortDescription: 'Plane spotting at Maho Beach with a beachfront BBQ.',
        description: 'There’s no beach quite like Maho, where arriving jets skim just above the sand. Your host secures shaded seating, serves up a beachfront BBQ, and shares the day’s flight schedule so you don’t miss the biggest planes. A bucket-list experience for aviation fans and families alike.',
        whatToBring: ['Sunscreen', 'Hat', 'Ear protection for kids', 'Camera'],
        knowBeforeYouGo: ['Stay clear of the jet-blast fence', 'Flight times vary by day'],
        notSuitableFor: ['Guests sensitive to loud noise'],
        whatToExpectIntro: 'A 3-hour beach experience timed around the busiest arrival window.',
        categoryDisplay: 'Food & Beach Experiences',
        localTip: 'The biggest jets usually arrive early afternoon.',
        meetingPointText: 'Meet your host at the Sunset Bar & Grill on Maho Beach.',
        metaTitle: 'Maho Beach Plane Spotting & BBQ in Sint Maarten',
        metaDescription: 'Watch jets land over Maho Beach with reserved seating and a beachfront BBQ. Family-friendly.',
      },
    },
  },
  {
    id: 'mock-tour-9',
    name: 'Blue Room Cave Kayak & Snorkel',
    slug: 'blue-room-cave-kayak-snorkel',
    status: 'ARCHIVED',
    tierKey: 'standard',
    destination: CURACAO,
    categories: [{ id: 'cat-kayak', name: 'Kayaking' }, { id: 'cat-snorkel', name: 'Snorkeling' }],
    hubs: [{ id: 'hub-santa-cruz', name: 'Santa Cruz' }],
    basePrice: '65.00',
    durationFrom: 180,
    durationTo: 210,
    pickupModel: 'NONE',
    bookingType: 'SHARED',
    paymentModel: 'OPERATOR_LINK',
    fitnessLevel: 'MODERATE',
    minAgeYears: 10,
    flags: { weatherDependent: true, wheelchairAccessible: false, suitableForBeginners: false },
    meetingPointLat: 12.29,
    meetingPointLng: -69.135,
    departureCity: 'Santa Cruz',
    images: [
      img('kayak1', 'Kayaks at the Blue Room cave entrance'),
      img('kayak2', 'Glowing blue water inside a cave'),
      img('kayak3', 'Snorkeler near the cave'),
      img('kayak4', 'Coastal cliffs of Curaçao'),
    ],
    inclusions: [
      { label: 'Kayak & paddle', icon: 'gear' },
      { label: 'Snorkel gear', icon: 'gear' },
      { label: 'Guide', icon: 'guide' },
      { label: 'Dry bag', icon: 'check' },
    ],
    exclusions: [
      { label: 'Transport to Santa Cruz', icon: 'transport', type: 'UNAVAILABLE' },
      { label: 'Photos', icon: 'photo', type: 'PAID_ADVANCE', priceText: '$20' },
    ],
    features: [
      { type: 'PREARRIVAL_INFORMATION', text: 'You must be comfortable swimming in open water.' },
      { type: 'ACCESSIBILITY_INFORMATION', text: 'Entering the cave requires a short swim/duck under rock.' },
      { type: 'CANCELLATION_TERM', text: 'Free cancellation up to 48 hours before departure.' },
    ],
    locations: [
      { types: ['START', 'END'], title: 'Santa Cruz Beach', shortDescription: 'Launch the kayaks from the beach.', latitude: 12.29, longitude: -69.135, streetAddress: 'Santa Cruz', addressLocality: 'Santa Cruz', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: null, minutesAt: 20 },
      { types: ['ITINERARY_ITEM'], title: 'Blue Room Cave', shortDescription: 'Snorkel inside the luminous blue cave.', latitude: 12.295, longitude: -69.145, streetAddress: '', addressLocality: 'Santa Cruz', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 30, minutesAt: 45 },
    ],
    pickups: [],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '65.00' },
      { label: 'Youth (10-12)', minAge: 10, maxAge: 12, price: '50.00' },
    ],
    addOns: [{ name: 'Waterproof phone case', description: 'Keep your phone dry.', price: '7.00', unit: 'PER_PERSON', maxQuantity: 6 }],
    languages: ['en', 'nl'],
    schedules: [{ weekdays: [2, 4, 6], startTimes: ['09:00'], capacity: 10 }],
    copy: {
      en: {
        title: 'Blue Room Cave Kayak & Snorkel',
        overview: 'Paddle along Curaçao’s rugged west coast to the hidden Blue Room, a sea cave that glows electric blue.',
        shortDescription: 'Kayak and snorkel adventure to the glowing Blue Room cave.',
        description: 'Launch from Santa Cruz beach and paddle along dramatic limestone cliffs to reach the Blue Room, a partially submerged cave where sunlight turns the water a glowing electric blue. Duck inside for an unforgettable snorkel. An adventurous trip for confident swimmers. (This sample tour is ARCHIVED to show that state and hard-delete flow.)',
        whatToBring: ['Swimwear', 'Water shoes', 'Sunscreen'],
        knowBeforeYouGo: ['Confident open-water swimming required', 'Cave entry involves a short duck-under'],
        notSuitableFor: ['Non-swimmers', 'Children under 10'],
        whatToExpectIntro: 'A 3-hour paddle-and-snorkel adventure to a sea cave.',
        categoryDisplay: 'Kayaking Tours',
        localTip: 'Mid-morning light makes the cave glow brightest.',
        meetingPointText: 'Meet at Santa Cruz beach by the kayak launch.',
        metaTitle: 'Blue Room Cave Kayak & Snorkel in Curaçao',
        metaDescription: 'Kayak to Curaçao’s glowing Blue Room sea cave and snorkel inside. For confident swimmers.',
      },
    },
  },
  {
    id: 'mock-tour-10',
    name: 'Willemstad Food & Culture Walking Tour',
    slug: 'willemstad-food-culture-walking-tour',
    status: 'LIVE',
    tierKey: 'organic',
    destination: CURACAO,
    categories: [{ id: 'cat-food', name: 'Food & Drink' }, { id: 'cat-walking', name: 'Walking Tours' }],
    hubs: [{ id: 'hub-punda', name: 'Punda' }],
    basePrice: '50.00',
    durationFrom: 180,
    durationTo: 180,
    pickupModel: 'NONE',
    bookingType: 'SHARED',
    paymentModel: 'PAID_IN_FULL',
    fitnessLevel: 'EASY',
    minAgeYears: 0,
    flags: { familyFriendly: true, suitableForBeginners: true, wheelchairAccessible: true },
    meetingPointLat: 12.1091,
    meetingPointLng: -68.9335,
    departureCity: 'Willemstad',
    images: [
      img('food1', 'Colorful Handelskade waterfront'),
      img('food2', 'Local Caribbean dishes'),
      img('food3', 'Floating market stalls'),
      img('food4', 'Street art in Otrobanda'),
    ],
    inclusions: [
      { label: 'Six food tastings', icon: 'food' },
      { label: 'Local drinks', icon: 'drink' },
      { label: 'Expert culture guide', icon: 'guide' },
      { label: 'Floating-market visit', icon: 'ticket' },
    ],
    exclusions: [
      { label: 'Additional drinks', icon: 'drink', type: 'PAID_ONSITE' },
      { label: 'Souvenirs', icon: 'money', type: 'PAID_ONSITE' },
    ],
    features: [
      { type: 'PREBOOKING_INFORMATION', text: 'Vegetarian options available - note it at booking.' },
      { type: 'ACCESSIBILITY_INFORMATION', text: 'Mostly flat, wheelchair- and stroller-friendly route.' },
      { type: 'ADDITIONAL_INFORMATION', text: 'Come hungry - the tastings add up to a full meal.' },
    ],
    locations: [
      { types: ['START'], title: 'Queen Emma Bridge', shortDescription: 'Meet at the Punda side of the floating bridge.', latitude: 12.1091, longitude: -68.9335, streetAddress: 'Handelskade', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: null, minutesAt: 10 },
      { types: ['ITINERARY_ITEM'], title: 'Old Market (Marshé)', shortDescription: 'Taste traditional Krioyo dishes.', latitude: 12.1102, longitude: -68.9325, streetAddress: 'De Ruyterkade', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 15, minutesAt: 40 },
      { types: ['END'], title: 'Otrobanda', shortDescription: 'Finish among the street art of Otrobanda.', latitude: 12.1086, longitude: -68.9365, streetAddress: 'Brionplein', addressLocality: 'Willemstad', addressRegion: 'Curaçao', addressCountry: 'Curaçao', minutesTo: 20, minutesAt: null },
    ],
    pickups: [],
    ageBands: [
      { label: 'Adult (13+)', minAge: 13, maxAge: 99, price: '50.00' },
      { label: 'Child (4-12)', minAge: 4, maxAge: 12, price: '30.00' },
      { label: 'Infant (0-3)', minAge: 0, maxAge: 3, price: '0.00' },
    ],
    addOns: [{ name: 'Local rum tasting', description: 'Flight of three Curaçao rums.', price: '15.00', unit: 'PER_PERSON', maxQuantity: 6 }],
    languages: ['en', 'nl', 'es', 'pt'],
    schedules: [{ weekdays: [1, 3, 5, 6], startTimes: ['10:00', '16:00'], capacity: 12 }],
    copy: {
      en: {
        title: 'Willemstad Food & Culture Walking Tour',
        overview: 'Taste your way through historic Willemstad with six local dishes, drinks and stories of the island’s rich culture.',
        shortDescription: 'Guided food and culture walk through UNESCO Willemstad.',
        description: 'Wander the candy-colored streets of UNESCO-listed Willemstad with a local guide who knows every family-run kitchen. Sample six authentic Krioyo dishes, sip local drinks, browse the Venezuelan floating market, and uncover the Afro-Caribbean history behind the city. You’ll leave full and full of stories.',
        whatToBring: ['Comfortable shoes', 'An appetite', 'Water'],
        knowBeforeYouGo: ['Come hungry', 'Tell us about dietary needs in advance', 'Tour runs in light rain'],
        notSuitableFor: ['Guests with severe food allergies (cross-contamination risk)'],
        whatToExpectIntro: 'A 3-hour walking tour with six tasting stops across Punda and Otrobanda.',
        categoryDisplay: 'Food Tours',
        localTip: 'The morning tour is cooler and less crowded.',
        meetingPointText: 'Meet at the Punda side of the Queen Emma floating bridge.',
        metaTitle: 'Willemstad Food & Culture Walking Tour in Curaçao',
        metaDescription: 'Taste six local dishes on a guided food and culture walk through UNESCO Willemstad.',
      },
      nl: { title: 'Willemstad Eten & Cultuur Wandeltour', shortDescription: 'Begeleide eten- en cultuurwandeling door UNESCO Willemstad.' },
      es: { title: 'Tour Gastronómico y Cultural por Willemstad', shortDescription: 'Caminata guiada de comida y cultura por Willemstad (UNESCO).' },
    },
  },
];

SEEDS.forEach(buildTrip);

// ── Public helpers ──────────────────────────────────────────────────────────────

export const MOCK_TRIP_IDS = new Set(MOCK_TRIPS.map((t) => t.id));

export function isMockTripId(id: string | undefined | null): boolean {
  return !!id && MOCK_TRIP_IDS.has(id);
}

export function getMockTripById(id: string): TripListItem | undefined {
  return MOCK_TRIPS.find((t) => t.id === id);
}

/** Build a paginated list response from the mock tours, honoring status + search. */
export function mockPaginatedTrips(params: MyTripsQueryParams = {}): PaginatedTrips {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  let rows = MOCK_TRIPS;
  if (params.status) rows = rows.filter((t) => t.status === params.status);
  if (params.search) {
    const q = params.search.toLowerCase();
    rows = rows.filter((t) => t.name.toLowerCase().includes(q));
  }
  const start = (page - 1) * limit;
  return { total: rows.length, page, limit, data: rows.slice(start, start + limit) };
}

/** Returns the requested locale's mock translation, or an empty shell so the form renders. */
export function getMockTranslation(tripId: string, locale: string): TripTranslation {
  const existing = (MOCK_TRANSLATIONS[tripId] ?? []).find((t) => t.locale === locale);
  if (existing) return existing;
  return {
    locale,
    title: null,
    overview: null,
    description: null,
    shortDescription: null,
    whatToBring: [],
    knowBeforeYouGo: [],
    notSuitableFor: [],
    whatToExpectIntro: null,
    categoryDisplay: null,
    localTip: null,
    meetingPointText: null,
    metaTitle: null,
    metaDescription: null,
    isMachineTranslated: false,
    updatedAt: NOW,
  };
}
