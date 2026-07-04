// DEMO SEED — tours + every child (age bands, categories, hubs, attributes,
// images, add-ons, languages, inclusions, exclusions, features, locations,
// pickups, translations) + the mandatory TOUR slug_registry row.
//
// All tours are LIVE + isActive + bookable so the public listing renders them.
// English content is real; the other six locales get isMachineTranslated stubs.

import {
  AddOnUnit,
  AgeBandType,
  BandParticipation,
  Currency,
  EligibilityState,
  ExclusionType,
  FeatureType,
  FitnessLevel,
  Locale,
  PaymentModel,
  PickupModel,
  PricingModel,
  Prisma,
  SlugEntityType,
  TourBookingType,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import {
  ALL_LOCALES,
  D,
  DEMO_TOUR_REF,
  NON_EN_LOCALES,
  TIER_MAP,
  dayOffset,
  img,
  log,
  money,
  prisma,
  section,
  stub,
} from './_shared';
import { OPERATORS, operatorEmail } from './users-operators';

// ── Per-destination geo + timezone anchors ───────────────────────────────────────
const DEST_META: Record<
  string,
  { lat: number; lng: number; tz: string; city: string }
> = {
  curacao: {
    lat: 12.1696,
    lng: -68.99,
    tz: 'America/Curacao',
    city: 'Willemstad',
  },
  aruba: {
    lat: 12.5211,
    lng: -70.0086,
    tz: 'America/Aruba',
    city: 'Oranjestad',
  },
  'sint-maarten': {
    lat: 18.0425,
    lng: -63.0548,
    tz: 'America/Lower_Princes',
    city: 'Philipsburg',
  },
};

const ISO_TO_GUIDE_LANG: Record<string, string> = {
  en: 'english',
  es: 'spanish',
  nl: 'dutch',
  fr: 'french',
  de: 'german',
  pt: 'portuguese',
};

type AttrValue = string | number | boolean | string[];
function attrVal(v: AttrValue): string {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

// ── Category content templates (reused across blueprints) ────────────────────────
interface CategoryContent {
  inclusions: string[];
  exclusions: { label: string; type?: ExclusionType; priceText?: string }[];
  whatToBring: string[];
  knowBeforeYouGo: string[];
  notSuitableFor: string[];
  attrs: Record<string, AttrValue>;
  addOns: {
    name: string;
    description: string;
    price: number;
    unit: AddOnUnit;
    maxQuantity: number;
  }[];
}

const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  'boat-tours': {
    inclusions: [
      'Experienced local captain & crew',
      'Snorkel gear (mask, fins, vest)',
      'Fresh fruit & local snacks',
      'Soft drinks & water',
      'Hotel pickup on request',
    ],
    exclusions: [
      { label: 'Gratuities for the crew', type: ExclusionType.PAID_ONSITE },
      {
        label: 'Alcoholic drinks',
        type: ExclusionType.PAID_ADVANCE,
        priceText: 'Open bar add-on $25',
      },
      {
        label: 'Underwater camera rental',
        type: ExclusionType.PAID_ONSITE,
        priceText: '$20 per device',
      },
    ],
    whatToBring: [
      'Swimwear & towel',
      'Reef-safe sunscreen',
      'Hat & sunglasses',
      'A change of clothes',
    ],
    knowBeforeYouGo: [
      'Departs on time, arrive 30 minutes early',
      'Infants under 3 travel free on a guardian lap',
      'Trip may reroute in high winds for your safety',
    ],
    notSuitableFor: [
      'Travelers prone to severe seasickness',
      'Wheelchair users (no ramp on board)',
    ],
    attrs: {
      boat_type: 'catamaran',
      snorkeling_stop_count: 2,
      onboard_toilet: true,
      open_bar_included: false,
      snorkeling_included: true,
      equipment_included: true,
      drinks_included: true,
    },
    addOns: [
      {
        name: 'Open bar upgrade',
        description: 'Unlimited local beer, rum punch & cocktails',
        price: 25,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 10,
      },
      {
        name: 'GoPro photo package',
        description: 'Edited photos & video from your trip',
        price: 39,
        unit: AddOnUnit.FLAT,
        maxQuantity: 1,
      },
    ],
  },
  snorkeling: {
    inclusions: [
      'Certified snorkel guide',
      'Full snorkel set & flotation vest',
      'Bottled water',
      'Reef briefing & marine-life guide',
    ],
    exclusions: [
      { label: 'Towels', type: ExclusionType.UNAVAILABLE },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
      {
        label: 'Prescription mask',
        type: ExclusionType.PAID_ADVANCE,
        priceText: '$10 rental',
      },
    ],
    whatToBring: ['Swimwear', 'Reef-safe sunscreen', 'Towel', 'Water shoes'],
    knowBeforeYouGo: [
      'Basic swimming ability required',
      'Flotation vests provided for all guests',
      'Conditions confirmed the morning of the tour',
    ],
    notSuitableFor: ['Non-swimmers without a guardian', 'Children under 5'],
    attrs: {
      snorkeling_equipment_included: true,
      guide_included: true,
      swimming_required: true,
      wildlife_type: ['turtles', 'coral', 'tropical_fish'],
      snorkeling_included: true,
      equipment_included: true,
    },
    addOns: [
      {
        name: 'Underwater camera rental',
        description: 'Waterproof camera for the day',
        price: 20,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 4,
      },
    ],
  },
  'day-trips': {
    inclusions: [
      'Round-trip transport',
      'Local guide',
      'Lunch & refreshments',
      'All entrance fees',
    ],
    exclusions: [
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
      { label: 'Souvenirs', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: ['Comfortable shoes', 'Sunscreen', 'Camera', 'Light jacket'],
    knowBeforeYouGo: [
      'Full-day itinerary, expect 7-8 hours',
      'Bring cash for souvenirs',
      'Vegetarian lunch available on request',
    ],
    notSuitableFor: ['Travelers with limited mobility on the hiking segment'],
    attrs: {
      food_included: true,
      drinks_included: true,
      snorkeling_included: true,
    },
    addOns: [
      {
        name: 'Private guide upgrade',
        description: 'Dedicated guide for your group',
        price: 80,
        unit: AddOnUnit.FLAT,
        maxQuantity: 1,
      },
    ],
  },
  'scuba-diving': {
    inclusions: [
      'PADI-certified divemaster',
      'All scuba equipment',
      'Tanks & weights',
      'Dive briefing & guided dive',
    ],
    exclusions: [
      {
        label: 'Dive insurance',
        type: ExclusionType.PAID_ADVANCE,
        priceText: '$8 per day',
      },
      {
        label: 'Underwater photos',
        type: ExclusionType.PAID_ONSITE,
        priceText: '$35',
      },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: [
      'Swimwear',
      'Towel',
      'Certification card (if certified)',
      'Reef-safe sunscreen',
    ],
    knowBeforeYouGo: [
      'Medical questionnaire required before diving',
      'No flying within 18 hours of your last dive',
      'Minimum age 10 for Discover Scuba',
    ],
    notSuitableFor: [
      'Pregnant travelers',
      'Guests with heart or respiratory conditions',
    ],
    attrs: {
      dive_type: 'discover_scuba',
      certification_required: false,
      max_depth: '12m',
      equipment_included: true,
    },
    addOns: [
      {
        name: 'Underwater photo set',
        description: 'Photos of you on the dive',
        price: 35,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 6,
      },
    ],
  },
  'cultural-tours': {
    inclusions: [
      'Local storytelling guide',
      'All entrance fees',
      'Bottled water',
      'Walking map',
    ],
    exclusions: [
      { label: 'Food & drinks', type: ExclusionType.PAID_ONSITE },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: [
      'Comfortable walking shoes',
      'Hat & sunscreen',
      'Water bottle',
    ],
    knowBeforeYouGo: [
      'Mostly outdoors on foot, ~3 km total',
      'Modest dress for heritage sites',
      'Tour runs rain or shine',
    ],
    notSuitableFor: [],
    attrs: { food_included: false, drinks_included: false },
    addOns: [
      {
        name: 'Local lunch add-on',
        description: 'Traditional Krioyo plate at a family kitchen',
        price: 18,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 10,
      },
    ],
  },
  'food-tours': {
    inclusions: [
      'Foodie guide',
      'All tastings & samples',
      'One welcome drink',
      'Market visit',
    ],
    exclusions: [
      { label: 'Additional drinks', type: ExclusionType.PAID_ONSITE },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: ['An appetite', 'Comfortable shoes', 'Cash for extra treats'],
    knowBeforeYouGo: [
      'Tell us about allergies at booking',
      'Several stops over ~3 hours',
      'Vegetarian options available',
    ],
    notSuitableFor: ['Guests with severe nut or shellfish allergies'],
    attrs: {
      tasting_type: 'food',
      meal_included: true,
      food_included: true,
      drinks_included: true,
    },
    addOns: [
      {
        name: 'Rum flight upgrade',
        description: 'Three premium aged-rum pours',
        price: 22,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 6,
      },
    ],
  },
  'sightseeing-tours': {
    inclusions: [
      'Air-conditioned transport',
      'Local guide',
      'Bottled water',
      'Photo stops',
    ],
    exclusions: [
      { label: 'Lunch', type: ExclusionType.PAID_ONSITE },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: ['Camera', 'Sunscreen', 'Hat', 'Light layers'],
    knowBeforeYouGo: [
      'Several short walks at viewpoints',
      'Itinerary order may vary with traffic',
      'Hotel pickup included',
    ],
    notSuitableFor: [],
    attrs: { food_included: false, drinks_included: true },
    addOns: [
      {
        name: 'Beach club entry',
        description: 'Day pass with a lounger',
        price: 30,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 8,
      },
    ],
  },
  'off-road-tours': {
    inclusions: [
      'Off-road vehicle',
      'Safety briefing & helmet',
      'Lead guide',
      'Bottled water',
    ],
    exclusions: [
      {
        label: 'Fuel surcharge',
        type: ExclusionType.PAID_ADVANCE,
        priceText: '$15 per vehicle',
      },
      {
        label: 'Damage waiver',
        type: ExclusionType.PAID_ONSITE,
        priceText: '$25',
      },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: [
      'Closed shoes',
      'Bandana or buff (it gets dusty)',
      'Sunglasses',
      'Cash for fuel surcharge',
    ],
    knowBeforeYouGo: [
      'Valid driver license required to drive',
      'Expect dust, bumps & splashes',
      'Minimum age 18 to drive, 5 to ride along',
    ],
    notSuitableFor: ['Pregnant travelers', 'Guests with back or neck problems'],
    attrs: {
      vehicle_type: 'utv',
      driver_license_required: true,
      offroad_difficulty: 'moderate',
      equipment_included: true,
    },
    addOns: [
      {
        name: 'Action camera rental',
        description: 'Helmet-mounted camera',
        price: 25,
        unit: AddOnUnit.FLAT,
        maxQuantity: 2,
      },
    ],
  },
  'adventure-tours': {
    inclusions: [
      'Certified adventure guide',
      'All safety equipment',
      'Bottled water',
      'Light snack',
    ],
    exclusions: [
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
      { label: 'Photos', type: ExclusionType.PAID_ONSITE, priceText: '$20' },
    ],
    whatToBring: ['Athletic wear', 'Closed shoes', 'Water', 'Towel'],
    knowBeforeYouGo: [
      'Moderate fitness required',
      'Some hiking on uneven terrain',
      'Weather-dependent activity',
    ],
    notSuitableFor: [
      'Guests with heart conditions',
      'Travelers afraid of heights (for cliff segments)',
    ],
    attrs: {
      adventure_type: 'cliff_jumping',
      height_requirement: 120,
      equipment_included: true,
    },
    addOns: [
      {
        name: 'Photo & video package',
        description: 'Edited highlights of your adventure',
        price: 29,
        unit: AddOnUnit.FLAT,
        maxQuantity: 1,
      },
    ],
  },
  'water-sports': {
    inclusions: [
      'All equipment',
      'Safety briefing & vest',
      'Instructor or guide',
      'Bottled water',
    ],
    exclusions: [
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
      { label: 'Photos', type: ExclusionType.PAID_ONSITE, priceText: '$15' },
    ],
    whatToBring: ['Swimwear', 'Towel', 'Reef-safe sunscreen', 'Water shoes'],
    knowBeforeYouGo: [
      'Basic swimming ability required',
      'Minimum age varies by activity',
      'Conditions confirmed the morning of',
    ],
    notSuitableFor: ['Pregnant travelers', 'Non-swimmers'],
    attrs: {
      water_sport_type: 'kayak',
      instructor_included: true,
      passenger_allowed: true,
      equipment_included: true,
    },
    addOns: [
      {
        name: 'Extra 30 minutes',
        description: 'Add half an hour of water time',
        price: 20,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 2,
      },
    ],
  },
  'jet-ski': {
    inclusions: [
      'Jet ski rental',
      'Safety briefing & vest',
      'Guide escort',
      'Fuel',
    ],
    exclusions: [
      {
        label: 'Damage deposit',
        type: ExclusionType.PAID_ONSITE,
        priceText: '$200 refundable',
      },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: ['Swimwear', 'Towel', 'Sunscreen', 'Waterproof phone case'],
    knowBeforeYouGo: [
      'Driver must be 18+ with ID',
      'One passenger allowed per ski',
      'Refundable damage deposit on site',
    ],
    notSuitableFor: ['Pregnant travelers', 'Children under 5'],
    attrs: {
      water_sport_type: 'jet_ski',
      instructor_included: true,
      passenger_allowed: true,
      equipment_included: true,
    },
    addOns: [
      {
        name: 'Second rider',
        description: 'Add a passenger to your ski',
        price: 25,
        unit: AddOnUnit.FLAT,
        maxQuantity: 1,
      },
    ],
  },
  parasailing: {
    inclusions: [
      'Parasail flight',
      'Safety briefing & harness',
      'Boat ride to launch',
      'Crew assistance',
    ],
    exclusions: [
      { label: 'Photos', type: ExclusionType.PAID_ONSITE, priceText: '$20' },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: [
      'Swimwear',
      'Sunglasses with strap',
      'Sunscreen',
      'Light jacket',
    ],
    knowBeforeYouGo: [
      'Combined weight limits apply per flight',
      'Minimum age 6 with an adult',
      'Flights subject to wind conditions',
    ],
    notSuitableFor: ['Pregnant travelers', 'Guests with recent surgery'],
    attrs: {
      water_sport_type: 'parasail',
      instructor_included: true,
      passenger_allowed: true,
    },
    addOns: [
      {
        name: 'Onboard photos',
        description: 'Photos of your flight',
        price: 20,
        unit: AddOnUnit.PER_PERSON,
        maxQuantity: 6,
      },
    ],
  },
  'sunset-cruises': {
    inclusions: [
      'Sunset sail with crew',
      'Welcome drink',
      'Canapés & light bites',
      'Open bar (beer, wine, rum punch)',
    ],
    exclusions: [
      { label: 'Premium spirits', type: ExclusionType.PAID_ONSITE },
      { label: 'Gratuities', type: ExclusionType.PAID_ONSITE },
    ],
    whatToBring: ['Light layer for the breeze', 'Camera', 'Flat shoes'],
    knowBeforeYouGo: [
      'Boards 30 minutes before sunset',
      'Adults-only on the champagne sail',
      'Open bar starts at departure',
    ],
    notSuitableFor: ['Unaccompanied minors on adults-only sailings'],
    attrs: {
      boat_type: 'catamaran',
      sunset_cruise: true,
      sunset_tour: true,
      onboard_toilet: true,
      open_bar_included: true,
      drinks_included: true,
    },
    addOns: [
      {
        name: 'Champagne upgrade',
        description: 'Bottle of sparkling wine for two',
        price: 45,
        unit: AddOnUnit.FLAT,
        maxQuantity: 3,
      },
    ],
  },
};

// ── Tour blueprints (30) ─────────────────────────────────────────────────────────
interface Blueprint {
  operatorKey: string;
  destinationSlug: string;
  slug: string;
  name: string;
  primaryCategory: string;
  extraCategories?: string[];
  hubSlugs?: string[];
  overview: string;
  shortDescription: string;
  durationFrom: number;
  durationTo: number;
  pricingModel?: PricingModel;
  wholeUnitType?: WholeUnitType;
  currency?: Currency;
  basePrice: number; // adult / unit price
  bookingType: TourBookingType;
  fitnessLevel?: FitnessLevel;
  minAgeYears?: number;
  startTimes: string[];
  pickup?: boolean;
  paymentModel?: PaymentModel;
  cancellationHours?: 24 | 48 | 72 | 168;
  tierKey: keyof typeof TIER_MAP;
  flags?: {
    familyFriendly?: boolean;
    suitableForBeginners?: boolean;
    wheelchairAccessible?: boolean;
    weatherDependent?: boolean;
    isLocalsFavourite?: boolean;
  };
  attrOverrides?: Record<string, AttrValue>;
  languages?: string[];
  maxPartySize?: number;
  // ── Badge showcase (master §3.6/§3.7) - lets the demo surface every badge.
  // `publishedDaysAgo` overrides the default -45d publish date: < 30 with 0 reviews
  // -> "New"; >= 90 is a prerequisite for the "Likely to sell out" demand signal. The
  // "Sponsored" badge is NOT a blueprint flag - it is driven by an ACTIVE Destination
  // Spotlight (see commercial.ts), exactly as in production. See demand-showcase.ts.
  publishedDaysAgo?: number;
}

const L_DEFAULT = ['en', 'es', 'nl'];

// ── Badge showcase (master §3.6/§3.7) ───────────────────────────────────────
// One tour per badge per LIVE destination (curacao / aruba / sint-maarten), all
// flagged isLocalsFavourite so each appears in the destination "Locals' favorites"
// grid. `publishedDaysAgo` is set inline on the blueprints below; the "Sponsored"
// badge is driven by an ACTIVE Destination Spotlight in commercial.ts (the same
// mechanism as production), NOT a blueprint flag. These sets drive the remaining
// data-dependent badges: MOST_POPULAR tours get >= 10 redeemed bookings (-> reviews)
// in bookings-payments.ts, NEW tours get ZERO bookings (so review_count stays 0),
// and LIKELY_TO_SELL_OUT tours get the §3.7 sellout setup in demand-showcase.ts.
// The Spotlight ACTIVE tours in commercial.ts are these same per-destination leads:
// klein-curacao-full-day-catamaran / utv-off-road-desert-and-beach-adventure /
// sunset-catamaran-cruise-with-drinks.
export const SHOWCASE_MOST_POPULAR = new Set<string>([
  'westpoint-snorkel-and-beach-hop', // curacao
  'palm-beach-jet-ski-safari', // aruba
  'maho-beach-and-island-loop-boat-tour', // sint-maarten
]);
export const SHOWCASE_NEW = new Set<string>([
  'sunset-sail-with-open-bar', // curacao
  'sunset-buggy-tour-to-california-lighthouse', // aruba
  'dutch-and-french-side-sightseeing-tour', // sint-maarten
]);
export const SHOWCASE_LIKELY_TO_SELL_OUT = new Set<string>([
  'tugboat-and-coral-garden-snorkel', // curacao
  'arikok-national-park-jeep-safari', // aruba
  'pinel-island-snorkel-and-sail', // sint-maarten
]);

export const TOUR_BLUEPRINTS: Blueprint[] = [
  // ── Miss Ann Boat Trips (Curaçao) ──
  {
    operatorKey: 'miss-ann-boat-trips',
    destinationSlug: 'curacao',
    slug: 'klein-curacao-full-day-catamaran',
    name: 'Klein Curaçao Full-Day Catamaran',
    primaryCategory: 'boat-tours',
    extraCategories: ['snorkeling', 'day-trips', 'catamaran-cruises'],
    hubSlugs: ['klein-curacao'],
    overview:
      'Sail to the uninhabited island of Klein Curaçao aboard a spacious catamaran. Spend the day on powder-white sand, snorkel over shipwrecks and turtle grounds, and enjoy a freshly grilled lunch on the beach before the relaxed sail home.',
    shortDescription:
      'Catamaran day trip to Klein Curaçao with snorkeling, beach time and lunch.',
    durationFrom: 480,
    durationTo: 540,
    basePrice: 139,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['07:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'premium',
    flags: {
      familyFriendly: true,
      suitableForBeginners: true,
      isLocalsFavourite: true,
      weatherDependent: true,
    },
    attrOverrides: { snorkeling_stop_count: 3 },
    languages: L_DEFAULT,
    maxPartySize: 40,
  },
  {
    operatorKey: 'miss-ann-boat-trips',
    destinationSlug: 'curacao',
    slug: 'klein-curacao-luxury-yacht-charter',
    name: 'Klein Curaçao Luxury Yacht Charter',
    primaryCategory: 'boat-tours',
    extraCategories: ['yacht-charters'],
    hubSlugs: ['klein-curacao'],
    overview:
      'Charter a private yacht for your group and cruise to Klein Curaçao in style. Your crew handles everything, from snorkel stops to a chilled lunch on board, while you enjoy the island on your own schedule.',
    shortDescription:
      'Private yacht charter to Klein Curaçao for your whole group.',
    durationFrom: 480,
    durationTo: 540,
    pricingModel: PricingModel.UNIT,
    wholeUnitType: WholeUnitType.BOAT,
    basePrice: 1450,
    bookingType: TourBookingType.PRIVATE,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['07:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 72,
    tierKey: 'premium',
    flags: { familyFriendly: true, weatherDependent: true },
    attrOverrides: { boat_type: 'yacht', open_bar_included: true },
    languages: L_DEFAULT,
    maxPartySize: 12,
  },
  {
    operatorKey: 'miss-ann-boat-trips',
    destinationSlug: 'curacao',
    slug: 'westpoint-snorkel-and-beach-hop',
    name: 'West Point Snorkel & Beach Hop',
    primaryCategory: 'snorkeling',
    extraCategories: ['boat-tours'],
    overview:
      'Hop between the calm coves of Curaçao’s rugged west coast. Snorkel with sea turtles at Playa Piskado, swim at hidden beaches, and learn the reef from a guide who grew up diving these waters.',
    shortDescription:
      'Boat-based snorkel hop along the west coast with turtle encounters.',
    durationFrom: 300,
    durationTo: 330,
    basePrice: 89,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 6,
    startTimes: ['08:30', '13:30'],
    pickup: true,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'boosted',
    flags: {
      familyFriendly: true,
      suitableForBeginners: true,
      isLocalsFavourite: true,
      weatherDependent: true,
    },
    attrOverrides: {
      wildlife_type: ['turtles', 'coral', 'tropical_fish', 'rays'],
    },
    languages: L_DEFAULT,
  },
  {
    operatorKey: 'miss-ann-boat-trips',
    destinationSlug: 'curacao',
    slug: 'sunset-sail-with-open-bar',
    name: 'Sunset Sail with Open Bar',
    primaryCategory: 'boat-tours',
    extraCategories: ['sailing-trips'],
    overview:
      'Toast the golden hour on a relaxed catamaran sail along the Willemstad coast. Sip from the open bar, watch the sky turn pink over the colourful waterfront, and let the trade winds carry you back to harbour.',
    shortDescription: 'Evening catamaran sail with open bar and skyline views.',
    durationFrom: 120,
    durationTo: 150,
    basePrice: 65,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['17:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'featured',
    flags: { isLocalsFavourite: true },
    attrOverrides: {
      sunset_cruise: true,
      sunset_tour: true,
      open_bar_included: true,
    },
    languages: L_DEFAULT,
    maxPartySize: 30,
    publishedDaysAgo: -8,
  },
  {
    operatorKey: 'miss-ann-boat-trips',
    destinationSlug: 'curacao',
    slug: 'spanish-water-mangrove-day-trip',
    name: 'Spanish Water Mangrove Day Trip',
    primaryCategory: 'day-trips',
    extraCategories: ['boat-tours'],
    overview:
      'Explore the sheltered lagoon of Spanish Water, glide through mangrove channels, and stop to snorkel and swim at quiet bays. A laid-back full-day escape with lunch and plenty of time in the water.',
    shortDescription:
      'Relaxed lagoon and mangrove day trip with swimming and lunch.',
    durationFrom: 360,
    durationTo: 420,
    basePrice: 109,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['09:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'standard',
    flags: {
      familyFriendly: true,
      suitableForBeginners: true,
      weatherDependent: true,
    },
    languages: L_DEFAULT,
  },

  // ── Curaçao Dive Crew (Curaçao) ──
  {
    operatorKey: 'curacao-dive-crew',
    destinationSlug: 'curacao',
    slug: 'discover-scuba-diving-for-beginners',
    name: 'Discover Scuba Diving for Beginners',
    primaryCategory: 'scuba-diving',
    overview:
      'Never dived before? Your PADI instructor guides you through the basics in shallow water, then takes you on a gentle reef dive teeming with tropical fish. No certification needed, just a sense of adventure.',
    shortDescription:
      'First-time scuba experience with a PADI instructor, no certification needed.',
    durationFrom: 180,
    durationTo: 210,
    basePrice: 119,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 10,
    startTimes: ['09:00', '13:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 48,
    tierKey: 'featured',
    flags: { suitableForBeginners: true },
    attrOverrides: {
      dive_type: 'discover_scuba',
      certification_required: false,
      max_depth: '12m',
    },
    languages: ['en', 'nl', 'de'],
  },
  {
    operatorKey: 'curacao-dive-crew',
    destinationSlug: 'curacao',
    slug: 'two-tank-certified-reef-dive',
    name: 'Two-Tank Certified Reef Dive',
    primaryCategory: 'scuba-diving',
    overview:
      'For certified divers: two guided tank dives along Curaçao’s legendary fringing reef and the famous Mushroom Forest. Healthy coral, big sponges, and the chance of turtles and rays on every dive.',
    shortDescription:
      'Two guided reef dives for certified divers, gear included.',
    durationFrom: 240,
    durationTo: 270,
    basePrice: 135,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 12,
    startTimes: ['08:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 48,
    tierKey: 'boosted',
    flags: {},
    attrOverrides: {
      dive_type: 'certified',
      certification_required: true,
      max_depth: '30m',
    },
    languages: ['en', 'nl', 'de'],
  },
  {
    operatorKey: 'curacao-dive-crew',
    destinationSlug: 'curacao',
    slug: 'tugboat-and-coral-garden-snorkel',
    name: 'Tugboat & Coral Garden Snorkel',
    primaryCategory: 'snorkeling',
    extraCategories: ['scuba-diving'],
    overview:
      'Snorkel the iconic sunken Tugboat at Caracas Bay, then drift over a shallow coral garden bursting with colour. A short boat ride and an easy swim make this perfect for families and first-timers.',
    shortDescription:
      'Snorkel the famous Tugboat wreck and a vibrant coral garden.',
    durationFrom: 180,
    durationTo: 210,
    basePrice: 75,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 6,
    startTimes: ['09:30', '14:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 24,
    tierKey: 'organic',
    flags: {
      familyFriendly: true,
      suitableForBeginners: true,
      isLocalsFavourite: true,
    },
    attrOverrides: { wildlife_type: ['coral', 'tropical_fish', 'turtles'] },
    languages: ['en', 'nl'],
    publishedDaysAgo: -100,
  },
  {
    operatorKey: 'curacao-dive-crew',
    destinationSlug: 'curacao',
    slug: 'night-dive-at-directors-bay',
    name: "Night Dive at Director's Bay",
    primaryCategory: 'scuba-diving',
    overview:
      'Witness the reef transform after dark. With torch in hand, spot octopus, lobster, and hunting tarpon as the bioluminescence sparkles around you. A guided night dive for certified divers seeking something different.',
    shortDescription:
      'Guided night dive for certified divers at Director’s Bay.',
    durationFrom: 120,
    durationTo: 150,
    basePrice: 95,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 16,
    startTimes: ['18:30'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 48,
    tierKey: 'standard',
    flags: { weatherDependent: true },
    attrOverrides: {
      dive_type: 'night_dive',
      certification_required: true,
      max_depth: '18m',
    },
    languages: ['en', 'nl', 'de'],
  },
  {
    operatorKey: 'curacao-dive-crew',
    destinationSlug: 'curacao',
    slug: 'turtle-bay-guided-snorkel',
    name: 'Turtle Bay Guided Snorkel',
    primaryCategory: 'snorkeling',
    overview:
      'A short, easy guided snorkel in a calm bay where green turtles graze daily. Your guide helps you spot them respectfully and explains how the local reef is protected. Ideal for beginners and kids.',
    shortDescription: 'Easy guided snorkel in a calm turtle-filled bay.',
    durationFrom: 120,
    durationTo: 150,
    basePrice: 59,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 5,
    startTimes: ['10:00', '14:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 24,
    tierKey: 'organic',
    flags: { familyFriendly: true, suitableForBeginners: true },
    attrOverrides: { wildlife_type: ['turtles', 'tropical_fish'] },
    languages: ['en', 'nl'],
  },

  // ── Island Roots Tours (Curaçao) ──
  {
    operatorKey: 'island-roots-tours',
    destinationSlug: 'curacao',
    slug: 'willemstad-old-town-walking-tour',
    name: 'Willemstad Old Town Walking Tour',
    primaryCategory: 'cultural-tours',
    overview:
      'Wander the UNESCO-listed streets of Willemstad with a local who knows every mural and merchant. Hear the story behind the candy-coloured Handelskade, cross the floating bridge, and taste a local treat along the way.',
    shortDescription:
      'Guided walk through UNESCO Willemstad with local stories.',
    durationFrom: 150,
    durationTo: 180,
    basePrice: 39,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['09:00', '16:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'boosted',
    flags: {
      familyFriendly: true,
      wheelchairAccessible: true,
      isLocalsFavourite: true,
    },
    languages: ['en', 'es', 'nl', 'pt'],
  },
  {
    operatorKey: 'island-roots-tours',
    destinationSlug: 'curacao',
    slug: 'curacao-street-food-and-market-tour',
    name: 'Curaçao Street Food & Market Tour',
    primaryCategory: 'food-tours',
    extraCategories: ['cultural-tours'],
    overview:
      'Eat your way through Willemstad’s markets and food trucks. Sample fresh fish at the floating market, try pastechi, funchi, and a cold Amstel Bright, and learn how Krioyo cuisine blends the island’s many cultures.',
    shortDescription:
      'Taste your way through Willemstad’s markets and street food.',
    durationFrom: 180,
    durationTo: 210,
    basePrice: 69,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['10:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'featured',
    flags: { isLocalsFavourite: true },
    attrOverrides: { tasting_type: 'food' },
    languages: ['en', 'es', 'nl'],
  },
  {
    operatorKey: 'island-roots-tours',
    destinationSlug: 'curacao',
    slug: 'island-highlights-sightseeing-drive',
    name: 'Island Highlights Sightseeing Drive',
    primaryCategory: 'sightseeing-tours',
    overview:
      'See the best of Curaçao in a day: the colourful capital, sweeping coastal viewpoints, a salt-pan flamingo stop, and a swim at a postcard beach. Air-conditioned comfort with a guide full of island lore.',
    shortDescription:
      'Full-island highlights drive with viewpoints, flamingos and a beach.',
    durationFrom: 360,
    durationTo: 420,
    basePrice: 95,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['08:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'standard',
    flags: { familyFriendly: true, weatherDependent: false },
    languages: ['en', 'es', 'nl'],
  },
  {
    operatorKey: 'island-roots-tours',
    destinationSlug: 'curacao',
    slug: 'rum-and-chocolate-tasting-experience',
    name: 'Rum & Chocolate Tasting Experience',
    primaryCategory: 'food-tours',
    overview:
      'Settle in for a guided tasting of Caribbean aged rums paired with locally made chocolate. Learn how cacao and sugarcane shaped the islands, and leave with a few new favourites and a warm glow.',
    shortDescription: 'Guided rum and chocolate pairing with island history.',
    durationFrom: 90,
    durationTo: 120,
    basePrice: 49,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 18,
    startTimes: ['15:00', '17:30'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'organic',
    flags: {},
    attrOverrides: { tasting_type: 'rum', meal_included: false },
    languages: ['en', 'nl'],
  },
  {
    operatorKey: 'island-roots-tours',
    destinationSlug: 'curacao',
    slug: 'hato-caves-and-north-coast-culture-tour',
    name: 'Hato Caves & North Coast Culture Tour',
    primaryCategory: 'cultural-tours',
    extraCategories: ['sightseeing-tours'],
    overview:
      'Descend into the limestone Hato Caves to see stalactites, bats, and ancient Arawak petroglyphs, then explore the wild north coast and a former plantation. History, nature, and dramatic scenery in one tour.',
    shortDescription:
      'Hato Caves, petroglyphs and the wild north coast with a guide.',
    durationFrom: 240,
    durationTo: 300,
    basePrice: 79,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 6,
    startTimes: ['09:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'standard',
    flags: { familyFriendly: true },
    languages: ['en', 'es', 'nl'],
  },

  // ── Aruba Adventures Co. (Aruba) ──
  {
    operatorKey: 'aruba-adventures-co',
    destinationSlug: 'aruba',
    slug: 'utv-off-road-desert-and-beach-adventure',
    name: 'UTV Off-Road Desert & Beach Adventure',
    primaryCategory: 'off-road-tours',
    extraCategories: ['adventure-tours'],
    overview:
      'Drive your own UTV across Aruba’s rugged outback to hidden beaches and the Natural Pool. Kick up dust on desert trails, splash through the coast, and cool off with a swim in a volcanic rock pool.',
    shortDescription:
      'Self-drive UTV adventure to the outback, beaches and Natural Pool.',
    durationFrom: 240,
    durationTo: 300,
    currency: Currency.USD,
    basePrice: 129,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 5,
    startTimes: ['08:00', '13:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'featured',
    flags: { isLocalsFavourite: true, weatherDependent: true },
    attrOverrides: { vehicle_type: 'utv', offroad_difficulty: 'moderate' },
    languages: ['en', 'es', 'nl'],
    maxPartySize: 16,
  },
  {
    operatorKey: 'aruba-adventures-co',
    destinationSlug: 'aruba',
    slug: 'arikok-national-park-jeep-safari',
    name: 'Arikok National Park Jeep Safari',
    primaryCategory: 'off-road-tours',
    extraCategories: ['adventure-tours'],
    overview:
      'Ride deep into Arikok National Park, which covers nearly a fifth of Aruba. Bounce along desert tracks to caves with ancient drawings, a natural bridge, and the wild windward coast, with a guide who knows the land.',
    shortDescription:
      'Guided jeep safari through Arikok’s caves, coast and natural bridge.',
    durationFrom: 300,
    durationTo: 360,
    currency: Currency.USD,
    basePrice: 99,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 6,
    startTimes: ['08:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'boosted',
    flags: {
      isLocalsFavourite: true,
      familyFriendly: true,
      weatherDependent: true,
    },
    attrOverrides: { vehicle_type: 'jeep', offroad_difficulty: 'easy' },
    languages: ['en', 'es', 'nl'],
    publishedDaysAgo: -100,
  },
  {
    operatorKey: 'aruba-adventures-co',
    destinationSlug: 'aruba',
    slug: 'natural-pool-cliff-jump-and-hike',
    name: 'Natural Pool Cliff Jump & Hike',
    primaryCategory: 'adventure-tours',
    overview:
      'Hike across volcanic terrain to Aruba’s Natural Pool, a sheltered basin ringed by lava rock. Snorkel in the calm water, and if you dare, take the leap from the cliff ledge under your guide’s watch.',
    shortDescription: 'Hike and cliff-jump at Aruba’s sheltered Natural Pool.',
    durationFrom: 240,
    durationTo: 300,
    currency: Currency.USD,
    basePrice: 89,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.CHALLENGING,
    minAgeYears: 12,
    startTimes: ['09:00'],
    pickup: true,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 48,
    tierKey: 'organic',
    flags: { weatherDependent: true },
    attrOverrides: { adventure_type: 'cliff_jumping', height_requirement: 130 },
    languages: ['en', 'es'],
  },
  {
    operatorKey: 'aruba-adventures-co',
    destinationSlug: 'aruba',
    slug: 'aruba-coastline-kayak-and-snorkel',
    name: 'Aruba Coastline Kayak & Snorkel',
    primaryCategory: 'water-sports',
    extraCategories: ['adventure-tours'],
    overview:
      'Paddle a stable sea kayak along Aruba’s calm leeward coast, then anchor and snorkel over a shallow reef. A gentle, guided half-day that mixes a light workout with plenty of time in the warm water.',
    shortDescription: 'Guided coastal kayak with a reef snorkel stop.',
    durationFrom: 180,
    durationTo: 210,
    currency: Currency.USD,
    basePrice: 69,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 8,
    startTimes: ['08:00', '14:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 24,
    tierKey: 'standard',
    flags: { familyFriendly: true, suitableForBeginners: true },
    attrOverrides: { water_sport_type: 'kayak' },
    languages: ['en', 'es', 'nl'],
  },
  {
    operatorKey: 'aruba-adventures-co',
    destinationSlug: 'aruba',
    slug: 'sunset-buggy-tour-to-california-lighthouse',
    name: 'Sunset Buggy Tour to California Lighthouse',
    primaryCategory: 'off-road-tours',
    overview:
      'Lead your own buggy along the northwest coast to the iconic California Lighthouse, timed for golden hour. Watch the sun sink into the sea from one of the island’s best viewpoints before the dusk drive back.',
    shortDescription:
      'Self-drive buggy tour to California Lighthouse at sunset.',
    durationFrom: 180,
    durationTo: 210,
    currency: Currency.USD,
    basePrice: 109,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 5,
    startTimes: ['16:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'featured',
    flags: { isLocalsFavourite: true, weatherDependent: true },
    attrOverrides: {
      vehicle_type: 'buggy',
      offroad_difficulty: 'easy',
      sunset_tour: true,
    },
    languages: ['en', 'es', 'nl'],
    publishedDaysAgo: -8,
  },

  // ── Dushi Watersports (Aruba) ──
  {
    operatorKey: 'dushi-watersports',
    destinationSlug: 'aruba',
    slug: 'palm-beach-jet-ski-safari',
    name: 'Palm Beach Jet Ski Safari',
    primaryCategory: 'jet-ski',
    overview:
      'Open the throttle on a guided jet ski safari from Palm Beach. Follow your lead guide along the high-rise coastline, past shipwrecks and lagoons, with plenty of room to carve across the turquoise water.',
    shortDescription: 'Guided jet ski safari along the Palm Beach coast.',
    durationFrom: 60,
    durationTo: 90,
    currency: Currency.USD,
    basePrice: 99,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 16,
    startTimes: ['09:00', '11:00', '14:00', '16:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'boosted',
    flags: { isLocalsFavourite: true, weatherDependent: true },
    attrOverrides: { water_sport_type: 'jet_ski' },
    languages: ['en', 'es', 'nl'],
  },
  {
    operatorKey: 'dushi-watersports',
    destinationSlug: 'aruba',
    slug: 'tandem-parasailing-over-palm-beach',
    name: 'Tandem Parasailing over Palm Beach',
    primaryCategory: 'parasailing',
    overview:
      'Rise high above Palm Beach on a tandem parasail and take in the whole coast from the air. The crew handles every detail, you just relax in the harness and enjoy the silence and the view.',
    shortDescription: 'Tandem parasail flight high above Palm Beach.',
    durationFrom: 60,
    durationTo: 75,
    currency: Currency.USD,
    basePrice: 85,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 6,
    startTimes: ['09:30', '11:30', '13:30', '15:30'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'organic',
    flags: { familyFriendly: true, weatherDependent: true },
    attrOverrides: { water_sport_type: 'parasail' },
    languages: ['en', 'es', 'nl'],
  },
  {
    operatorKey: 'dushi-watersports',
    destinationSlug: 'aruba',
    slug: 'flyboard-lesson-for-beginners',
    name: 'Flyboard Lesson for Beginners',
    primaryCategory: 'water-sports',
    overview:
      'Ever wanted to hover over the water like a superhero? A certified instructor straps you into a flyboard and coaches you from your first wobble to gliding above the surface. Wetsuit and full safety gear included.',
    shortDescription: 'Beginner flyboard session with a certified instructor.',
    durationFrom: 45,
    durationTo: 60,
    currency: Currency.USD,
    basePrice: 119,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.CHALLENGING,
    minAgeYears: 15,
    startTimes: ['10:00', '12:00', '15:00'],
    pickup: false,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 24,
    tierKey: 'standard',
    flags: { suitableForBeginners: true, weatherDependent: true },
    attrOverrides: { water_sport_type: 'surf' },
    languages: ['en', 'es'],
  },
  {
    operatorKey: 'dushi-watersports',
    destinationSlug: 'aruba',
    slug: 'banana-boat-and-tube-ride',
    name: 'Banana Boat & Tube Ride',
    primaryCategory: 'water-sports',
    overview:
      'A classic burst of family fun: hold on tight as a speedboat tows your banana boat and tube across the bay. Plenty of laughs, splashes, and friendly competition for who can stay on the longest.',
    shortDescription: 'Family-friendly banana boat and tube ride in the bay.',
    durationFrom: 30,
    durationTo: 45,
    currency: Currency.USD,
    basePrice: 39,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 6,
    startTimes: ['10:30', '12:30', '14:30'],
    pickup: false,
    paymentModel: PaymentModel.ON_ARRIVAL,
    cancellationHours: 24,
    tierKey: 'standard',
    flags: { familyFriendly: true, weatherDependent: true },
    attrOverrides: { water_sport_type: 'sup', instructor_included: false },
    languages: ['en', 'es', 'nl'],
  },
  {
    operatorKey: 'dushi-watersports',
    destinationSlug: 'aruba',
    slug: 'private-jet-ski-island-tour',
    name: 'Private Jet Ski Island Tour',
    primaryCategory: 'jet-ski',
    overview:
      'A private guided jet ski tour for your group, away from the crowds. Set your own pace along the coast with a dedicated guide, stopping for photos at the island’s most scenic spots.',
    shortDescription: 'Private guided jet ski tour at your own pace.',
    durationFrom: 90,
    durationTo: 120,
    currency: Currency.USD,
    basePrice: 159,
    bookingType: TourBookingType.PRIVATE,
    fitnessLevel: FitnessLevel.MODERATE,
    minAgeYears: 16,
    startTimes: ['09:00', '13:00'],
    pickup: false,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'organic',
    flags: { weatherDependent: true },
    attrOverrides: { water_sport_type: 'jet_ski' },
    languages: ['en', 'es', 'nl'],
  },

  // ── SXM Sailing & Sun (Sint Maarten) ──
  {
    operatorKey: 'sxm-sailing-and-sun',
    destinationSlug: 'sint-maarten',
    slug: 'sunset-catamaran-cruise-with-drinks',
    name: 'Sunset Catamaran Cruise with Drinks',
    primaryCategory: 'sunset-cruises',
    overview:
      'Sail into the sunset off Sint Maarten on a relaxed catamaran. Enjoy an open bar and canapés as the sky lights up over Simpson Bay, with island music and the warm Caribbean breeze setting the mood.',
    shortDescription: 'Open-bar sunset catamaran cruise off Simpson Bay.',
    durationFrom: 150,
    durationTo: 180,
    basePrice: 79,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['16:30'],
    pickup: true,
    paymentModel: PaymentModel.PAID_IN_FULL,
    cancellationHours: 48,
    tierKey: 'premium',
    flags: { isLocalsFavourite: true, weatherDependent: true },
    attrOverrides: {
      sunset_cruise: true,
      sunset_tour: true,
      open_bar_included: true,
    },
    languages: ['en', 'fr', 'nl'],
    maxPartySize: 30,
  },
  {
    operatorKey: 'sxm-sailing-and-sun',
    destinationSlug: 'sint-maarten',
    slug: 'maho-beach-and-island-loop-boat-tour',
    name: 'Maho Beach & Island Loop Boat Tour',
    primaryCategory: 'boat-tours',
    extraCategories: ['sightseeing-tours'],
    overview:
      'Circle the island by boat, with a front-row view of the planes landing over famous Maho Beach. Stop to snorkel and swim at quiet bays on both the Dutch and French sides, with drinks and snacks on board.',
    shortDescription: 'Island-loop boat tour with the Maho Beach plane view.',
    durationFrom: 300,
    durationTo: 360,
    basePrice: 99,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['09:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'featured',
    flags: {
      isLocalsFavourite: true,
      familyFriendly: true,
      weatherDependent: true,
    },
    attrOverrides: { boat_type: 'speedboat', snorkeling_stop_count: 2 },
    languages: ['en', 'fr', 'nl'],
  },
  {
    operatorKey: 'sxm-sailing-and-sun',
    destinationSlug: 'sint-maarten',
    slug: 'pinel-island-snorkel-and-sail',
    name: 'Pinel Island Snorkel & Sail',
    primaryCategory: 'boat-tours',
    extraCategories: ['snorkeling'],
    overview:
      'Sail to the protected nature reserve of Pinel Island on the French side. Snorkel the marine park’s clear shallows, relax on the beach, and enjoy a barefoot lunch before the breezy sail home.',
    shortDescription: 'Sail and snorkel at the Pinel Island nature reserve.',
    durationFrom: 360,
    durationTo: 420,
    basePrice: 119,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 5,
    startTimes: ['09:00'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'boosted',
    flags: {
      isLocalsFavourite: true,
      familyFriendly: true,
      suitableForBeginners: true,
      weatherDependent: true,
    },
    attrOverrides: {
      boat_type: 'catamaran',
      wildlife_type: ['coral', 'tropical_fish', 'rays'],
    },
    languages: ['en', 'fr', 'nl'],
    publishedDaysAgo: -100,
  },
  {
    operatorKey: 'sxm-sailing-and-sun',
    destinationSlug: 'sint-maarten',
    slug: 'dutch-and-french-side-sightseeing-tour',
    name: 'Dutch & French Side Sightseeing Tour',
    primaryCategory: 'sightseeing-tours',
    overview:
      'One island, two nations. Cross from the Dutch capital of Philipsburg to French Marigot, taking in viewpoints, markets, and beaches along the way. A relaxed, comfortable introduction to Sint Maarten / Saint-Martin.',
    shortDescription:
      'Both-sides island sightseeing tour, Philipsburg to Marigot.',
    durationFrom: 240,
    durationTo: 300,
    basePrice: 75,
    bookingType: TourBookingType.SHARED,
    fitnessLevel: FitnessLevel.EASY,
    startTimes: ['09:00', '13:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 48,
    tierKey: 'standard',
    flags: {
      isLocalsFavourite: true,
      familyFriendly: true,
      wheelchairAccessible: true,
    },
    languages: ['en', 'fr', 'nl'],
    publishedDaysAgo: -8,
  },
  {
    operatorKey: 'sxm-sailing-and-sun',
    destinationSlug: 'sint-maarten',
    slug: 'sunset-champagne-sail-private-charter',
    name: 'Sunset Champagne Sail - Private Charter',
    primaryCategory: 'sunset-cruises',
    overview:
      'Charter the whole catamaran for a private sunset celebration. Champagne on ice, canapés, and a dedicated crew make this perfect for proposals, anniversaries, or simply a special evening on the water.',
    shortDescription:
      'Private sunset catamaran charter with champagne for your group.',
    durationFrom: 150,
    durationTo: 180,
    pricingModel: PricingModel.UNIT,
    wholeUnitType: WholeUnitType.BOAT,
    basePrice: 1200,
    bookingType: TourBookingType.PRIVATE,
    fitnessLevel: FitnessLevel.EASY,
    minAgeYears: 18,
    startTimes: ['16:30'],
    pickup: true,
    paymentModel: PaymentModel.OPERATOR_LINK,
    cancellationHours: 72,
    tierKey: 'premium',
    flags: { weatherDependent: true },
    attrOverrides: {
      sunset_cruise: true,
      sunset_tour: true,
      open_bar_included: true,
      boat_type: 'catamaran',
    },
    languages: ['en', 'fr', 'nl'],
    maxPartySize: 12,
  },
];

// ── Builders ───────────────────────────────────────────────────────────────────
function buildAgeBands(bp: Blueprint): Prisma.TourAgeBandCreateManyTourInput[] {
  const adult = money(bp.basePrice);
  if (bp.pricingModel === PricingModel.UNIT) {
    return [
      {
        bandType: AgeBandType.ADULT,
        participation: BandParticipation.PARTICIPANT,
        label: `Private charter (up to ${bp.maxPartySize ?? 12})`,
        price: adult,
        isDefault: true,
        displayOrder: 0,
      },
    ];
  }
  const child = money(Number(bp.basePrice) * 0.6);
  const bands: Prisma.TourAgeBandCreateManyTourInput[] = [
    {
      bandType: AgeBandType.ADULT,
      participation: BandParticipation.PARTICIPANT,
      label: 'Adult',
      minAge: 13,
      price: adult,
      isDefault: true,
      displayOrder: 0,
    },
    {
      bandType: AgeBandType.CHILD,
      participation: BandParticipation.PARTICIPANT,
      label: 'Child (4-12)',
      minAge: 4,
      maxAge: 12,
      price: child,
      isDefault: false,
      displayOrder: 1,
    },
  ];
  // Cultural/sightseeing add a discounted Senior band for richness.
  if (
    ['cultural-tours', 'sightseeing-tours', 'food-tours'].includes(
      bp.primaryCategory,
    )
  ) {
    bands.push({
      bandType: AgeBandType.SENIOR,
      participation: BandParticipation.PARTICIPANT,
      label: 'Senior (65+)',
      minAge: 65,
      price: money(Number(bp.basePrice) * 0.85),
      isDefault: false,
      displayOrder: 2,
    });
  }
  return bands;
}

function buildAttributes(bp: Blueprint): Record<string, string> {
  const c = CATEGORY_CONTENT[bp.primaryCategory];
  const langValues = (bp.languages ?? L_DEFAULT)
    .map((iso) => ISO_TO_GUIDE_LANG[iso])
    .filter(Boolean);
  const raw: Record<string, AttrValue> = {
    booking_type: bp.bookingType.toLowerCase(),
    duration_minutes: bp.durationFrom,
    pickup_available: !!bp.pickup,
    instant_confirmation: true,
    free_cancellation: true,
    guide_languages: langValues,
    wheelchair_accessible: bp.flags?.wheelchairAccessible ?? false,
    family_friendly: bp.flags?.familyFriendly ?? false,
    suitable_for_beginners: bp.flags?.suitableForBeginners ?? false,
    cancellation_window_hours: bp.cancellationHours ?? 48,
    maximum_travelers: bp.maxPartySize ?? 20,
    ...c.attrs,
    ...(bp.attrOverrides ?? {}),
  };
  if (bp.minAgeYears && bp.minAgeYears > 0) raw.minimum_age = bp.minAgeYears;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = attrVal(v);
  return out;
}

function localizedTranslations(bp: Blueprint, categoryDisplay: string) {
  const c = CATEGORY_CONTENT[bp.primaryCategory];
  const meeting = `Meet at the ${DEST_META[bp.destinationSlug].city} departure point; look for the ${OPERATORS.find((o) => o.key === bp.operatorKey)?.companyName} flag.`;
  const description = `${bp.overview} ${bp.overview} This experience is run by a local operator who knows ${DEST_META[bp.destinationSlug].city} inside out, with small-group attention and a focus on safety, sustainability, and showing you the island the way locals love it.`;
  const localTipTitle = 'Book the morning departure';
  const localTipBody =
    'The earliest slot has the calmest water, the best light for photos, and the smallest crowds.';
  const intro = `Here is what a typical ${bp.name} looks like, step by step.`;
  return ALL_LOCALES.map((locale) => {
    const isEn = locale === Locale.en;
    return {
      locale,
      title: isEn ? bp.name : stub(locale, bp.name),
      overview: isEn ? bp.overview : stub(locale, bp.overview),
      description: isEn ? description : stub(locale, bp.overview),
      shortDescription: isEn
        ? bp.shortDescription
        : stub(locale, bp.shortDescription),
      whatToBring: isEn
        ? c.whatToBring
        : c.whatToBring.map((t) => stub(locale, t)),
      knowBeforeYouGo: isEn
        ? c.knowBeforeYouGo
        : c.knowBeforeYouGo.map((t) => stub(locale, t)),
      notSuitableFor: isEn
        ? c.notSuitableFor
        : c.notSuitableFor.map((t) => stub(locale, t)),
      whatToExpectIntro: isEn ? intro : stub(locale, intro),
      categoryDisplay: isEn ? categoryDisplay : stub(locale, categoryDisplay),
      localTipTitle: isEn ? localTipTitle : stub(locale, localTipTitle),
      localTipBody: isEn ? localTipBody : stub(locale, localTipBody),
      meetingPointText: isEn ? meeting : stub(locale, meeting),
      metaTitle: isEn
        ? `${bp.name} | Island Tours`
        : stub(locale, `${bp.name} | Island Tours`),
      metaDescription: isEn
        ? bp.shortDescription
        : stub(locale, bp.shortDescription),
      isMachineTranslated: !isEn,
    };
  });
}

export async function seedTours(): Promise<void> {
  section('Tours + children');

  const operators = await prisma.operator.findMany({
    where: {
      user: { email: { in: OPERATORS.map((o) => operatorEmail(o.key)) } },
    },
    select: { id: true, user: { select: { email: true } } },
  });
  const opIdByEmail = new Map(operators.map((o) => [o.user.email, o.id]));

  const destinations = await prisma.destination.findMany({
    select: { id: true, slug: true },
  });
  const destIdBySlug = new Map(destinations.map((d) => [d.slug, d.id]));

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  });
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  const hubs = await prisma.hub.findMany({
    select: { id: true, slug: true, destinationId: true },
  });
  const hubKey = (destId: string, slug: string) => `${destId}:${slug}`;
  const hubByKey = new Map(
    hubs.map((h) => [hubKey(h.destinationId, h.slug), h.id]),
  );

  let created = 0;
  let skipped = 0;
  const publishedAt = dayOffset(-45);

  for (const bp of TOUR_BLUEPRINTS) {
    const operatorId = opIdByEmail.get(operatorEmail(bp.operatorKey));
    const destinationId = destIdBySlug.get(bp.destinationSlug);
    if (!operatorId || !destinationId) {
      log(`! Skipping ${bp.slug} (missing operator/destination)`);
      continue;
    }

    const existing = await prisma.tour.findUnique({
      where: { destinationId_slug: { destinationId, slug: bp.slug } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const meta = DEST_META[bp.destinationSlug];
    const tier = TIER_MAP[bp.tierKey];
    // Per-tour publish date (badge showcase): defaults to the shared -45d.
    const tourPublishedAt =
      bp.publishedDaysAgo != null
        ? dayOffset(bp.publishedDaysAgo)
        : publishedAt;
    const currency = bp.currency ?? Currency.USD;
    const c = CATEGORY_CONTENT[bp.primaryCategory];
    const primaryCat = catBySlug.get(bp.primaryCategory);
    const categoryDisplay = primaryCat ? primaryCat.name : bp.primaryCategory;

    await prisma.$transaction(async (tx) => {
      const tour = await tx.tour.create({
        data: {
          operatorId,
          destinationId,
          name: bp.name,
          slug: bp.slug,
          status: TourStatus.LIVE,
          isActive: true,
          isBookable: true,
          reference: DEMO_TOUR_REF,
          timeZone: meta.tz,
          // pricing
          pricingModel: bp.pricingModel ?? PricingModel.PER_PERSON,
          wholeUnitType: bp.wholeUnitType ?? null,
          defaultCurrency: currency,
          basePrice: money(bp.basePrice),
          // operational
          durationMinutesFrom: bp.durationFrom,
          durationMinutesTo: bp.durationTo,
          pickupModel: bp.pickup ? PickupModel.INCLUDED : PickupModel.NONE,
          pickupRequired: false,
          minPartySize: 1,
          maxPartySize:
            bp.maxPartySize ??
            (bp.bookingType === TourBookingType.PRIVATE ? 12 : 20),
          bookingCutoffMinutes: 120,
          cancellationHours: bp.cancellationHours ?? 48,
          startTimes: bp.startTimes,
          paymentModel: bp.paymentModel ?? PaymentModel.OPERATOR_LINK,
          depositPct: D(20.0),
          // commercial
          commissionTier: D(tier.commission),
          tierKey: bp.tierKey,
          tierRank: tier.rank,
          qualityScore: D(60 + tier.rank * 5),
          eligibilityState: EligibilityState.ELIGIBLE,
          firstPublishedAt: tourPublishedAt,
          publishedAt: tourPublishedAt,
          // SEO / content
          ogImage: img(`${bp.slug}-og`, 1200, 630),
          breadcrumbLabel: bp.name,
          // meeting point
          meetingPointLat: meta.lat,
          meetingPointLng: meta.lng,
          departureCity: meta.city,
          checkInMinutesBefore: 30,
          // audience
          minAgeYears: bp.minAgeYears ?? null,
          fitnessLevel: bp.fitnessLevel ?? FitnessLevel.EASY,
          bookingType: bp.bookingType,
          weatherDependent: bp.flags?.weatherDependent ?? false,
          wheelchairAccessible: bp.flags?.wheelchairAccessible ?? false,
          familyFriendly: bp.flags?.familyFriendly ?? false,
          suitableForBeginners: bp.flags?.suitableForBeginners ?? false,
          isLocalsFavourite: bp.flags?.isLocalsFavourite ?? false,
        },
      });

      // Age bands
      await tx.tourAgeBand.createMany({
        data: buildAgeBands(bp).map((b) => ({ ...b, tourId: tour.id })),
      });

      // Categories (one primary)
      const catLinks: { categoryId: string; isPrimary: boolean }[] = [];
      if (primaryCat)
        catLinks.push({ categoryId: primaryCat.id, isPrimary: true });
      for (const slug of bp.extraCategories ?? []) {
        const cat = catBySlug.get(slug);
        if (cat && cat.id !== primaryCat?.id)
          catLinks.push({ categoryId: cat.id, isPrimary: false });
      }
      if (catLinks.length)
        await tx.tourCategory.createMany({
          data: catLinks.map((l) => ({ ...l, tourId: tour.id })),
          skipDuplicates: true,
        });

      // Hubs
      for (const hubSlug of bp.hubSlugs ?? []) {
        const hubId = hubByKey.get(hubKey(destinationId, hubSlug));
        if (hubId)
          await tx.tourHub.create({ data: { tourId: tour.id, hubId } });
      }

      // Attributes
      const attrs = buildAttributes(bp);
      await tx.tourAttribute.createMany({
        data: Object.entries(attrs).map(([attributeKey, attributeValue]) => ({
          tourId: tour.id,
          attributeKey,
          attributeValue,
        })),
        skipDuplicates: true,
      });

      // Images (1 hero + 5)
      await tx.tourImage.createMany({
        data: Array.from({ length: 6 }, (_, i) => ({
          tourId: tour.id,
          url: img(`${bp.slug}-${i}`),
          urlWebp: img(`${bp.slug}-${i}`),
          isHero: i === 0,
          altText: `${bp.name} photo ${i + 1}`,
          displayOrder: i,
          width: 1280,
          height: 854,
        })),
      });

      // Add-ons
      await tx.tourAddOn.createMany({
        data: c.addOns.map((a, i) => ({
          tourId: tour.id,
          name: a.name,
          description: a.description,
          price: money(a.price),
          unit: a.unit,
          maxQuantity: a.maxQuantity,
          displayOrder: i,
          isActive: true,
        })),
      });

      // Languages
      await tx.tourLanguage.createMany({
        data: (bp.languages ?? L_DEFAULT).map((language) => ({
          tourId: tour.id,
          language,
        })),
        skipDuplicates: true,
      });

      // Highlights (+ translations) — 4 marketing bullets: the card teaser plus the
      // top three inclusions. Guarantees the ≥3 publish requirement is met.
      const highlights = [bp.shortDescription, ...c.inclusions.slice(0, 3)];
      for (let i = 0; i < highlights.length; i++) {
        const hl = await tx.tourHighlight.create({
          data: {
            tourId: tour.id,
            displayOrder: i,
            imageUrl: i === 0 ? img(`${bp.slug}-0`) : null,
          },
        });
        await tx.tourHighlightTranslation.createMany({
          data: ALL_LOCALES.map((locale) => ({
            highlightId: hl.id,
            locale,
            text:
              locale === Locale.en
                ? highlights[i]
                : stub(locale, highlights[i]),
            isMachineTranslated: locale !== Locale.en,
          })),
        });
      }

      // Inclusions (+ translations)
      for (let i = 0; i < c.inclusions.length; i++) {
        const inc = await tx.tourInclusion.create({
          data: { tourId: tour.id, icon: 'check', displayOrder: i },
        });
        await tx.tourInclusionTranslation.createMany({
          data: ALL_LOCALES.map((locale) => ({
            inclusionId: inc.id,
            locale,
            label:
              locale === Locale.en
                ? c.inclusions[i]
                : stub(locale, c.inclusions[i]),
            isMachineTranslated: locale !== Locale.en,
          })),
        });
      }

      // Exclusions (+ translations)
      for (let i = 0; i < c.exclusions.length; i++) {
        const ex = c.exclusions[i];
        const row = await tx.tourExclusion.create({
          data: {
            tourId: tour.id,
            icon: 'x',
            type: ex.type ?? null,
            priceText: ex.priceText ?? null,
            displayOrder: i,
          },
        });
        await tx.tourExclusionTranslation.createMany({
          data: ALL_LOCALES.map((locale) => ({
            exclusionId: row.id,
            locale,
            label: locale === Locale.en ? ex.label : stub(locale, ex.label),
            isMachineTranslated: locale !== Locale.en,
          })),
        });
      }

      // Features (free-text notes only). The structured-backed terms
      // (booking/cancellation/accessibility/pre-arrival) are no longer stored as
      // features — they are derived into the OCTO feed from the tour's structured
      // fields (cancellationHours, instantConfirmation, wheelchairAccessible,
      // checkInMinutesBefore). See octo-tour.serializer.ts.
      const features: { type: FeatureType; text: string }[] = [
        {
          type: FeatureType.PREBOOKING_INFORMATION,
          text: 'Bookings close 24 hours before departure. A minimum of 2 guests is required for the tour to run.',
        },
        {
          type: FeatureType.REDEMPTION_INSTRUCTION,
          text: 'Show your emailed voucher (printed or on your phone) to the crew at the meeting point.',
        },
        {
          type: FeatureType.ADDITIONAL_INFORMATION,
          text: 'Bring reef-safe sunscreen, a towel, and a change of clothes. Lockers are available at the marina.',
        },
      ];
      for (let i = 0; i < features.length; i++) {
        const f = features[i];
        const row = await tx.tourFeature.create({
          data: { tourId: tour.id, type: f.type, displayOrder: i },
        });
        await tx.tourFeatureTranslation.createMany({
          data: ALL_LOCALES.map((locale) => ({
            featureId: row.id,
            locale,
            text: locale === Locale.en ? f.text : stub(locale, f.text),
            isMachineTranslated: locale !== Locale.en,
          })),
        });
      }

      // Locations (start + itinerary + end)
      const locs = [
        {
          types: ['START'],
          title: `${meta.city} departure point`,
          short: 'Meet your crew and check in here.',
          dLat: 0,
          dLng: 0,
          minutesAt: 30,
        },
        {
          types: ['ITINERARY_ITEM'],
          title: 'Main activity area',
          short: 'The heart of the experience.',
          dLat: 0.03,
          dLng: -0.02,
          minutesAt: bp.durationFrom - 60,
        },
        {
          types: ['END'],
          title: `Return to ${meta.city}`,
          short: 'Drop-off back at the departure point.',
          dLat: 0,
          dLng: 0,
          minutesTo: 20,
        },
      ];
      for (let i = 0; i < locs.length; i++) {
        const l = locs[i];
        const row = await tx.tourLocation.create({
          data: {
            tourId: tour.id,
            types: l.types,
            latitude: meta.lat + l.dLat,
            longitude: meta.lng + l.dLng,
            addressLocality: meta.city,
            addressCountry: bp.destinationSlug,
            minutesAt: l.minutesAt ?? null,
            minutesTo: l.minutesTo ?? null,
            displayOrder: i,
          },
        });
        await tx.tourLocationTranslation.createMany({
          data: ALL_LOCALES.map((locale) => ({
            locationId: row.id,
            locale,
            title: locale === Locale.en ? l.title : stub(locale, l.title),
            shortDescription:
              locale === Locale.en ? l.short : stub(locale, l.short),
            isMachineTranslated: locale !== Locale.en,
          })),
        });
      }

      // Pickup location
      if (bp.pickup) {
        const pl = await tx.pickupLocation.create({
          data: {
            tourId: tour.id,
            name: `${meta.city} hotels (main lobby)`,
            latitude: meta.lat + 0.01,
            longitude: meta.lng + 0.01,
            address: `Central ${meta.city} hotel zone`,
            minutesPrior: 45,
            windowStart: '07:15',
            windowEnd: '07:45',
            displayOrder: 0,
            isActive: true,
          },
        });
        await tx.pickupLocationTranslation.createMany({
          data: ALL_LOCALES.map((locale) => ({
            pickupLocationId: pl.id,
            locale,
            title:
              locale === Locale.en
                ? `${meta.city} hotel pickup`
                : stub(locale, `${meta.city} hotel pickup`),
            directions:
              locale === Locale.en
                ? 'Wait in your hotel lobby; our driver will call your name.'
                : stub(
                    locale,
                    'Wait in your hotel lobby; our driver will call your name.',
                  ),
            isMachineTranslated: locale !== Locale.en,
          })),
        });
      }

      // Translations (EN real + stubs)
      await tx.tourTranslation.createMany({
        data: localizedTranslations(bp, categoryDisplay).map((t) => ({
          ...t,
          tourId: tour.id,
        })),
      });

      // priceFrom = cheapest participant band (mirror tours.service)
      const cheapest = await tx.tourAgeBand.findFirst({
        where: {
          tourId: tour.id,
          participation: BandParticipation.PARTICIPANT,
        },
        orderBy: { price: 'asc' },
        select: { price: true },
      });
      await tx.tour.update({
        where: { id: tour.id },
        data: { priceFrom: cheapest?.price ?? money(bp.basePrice) },
      });

      // Mandatory TOUR slug_registry row (critical rule #8)
      await tx.slugRegistry.upsert({
        where: {
          destinationSlug_slug: {
            destinationSlug: bp.destinationSlug,
            slug: bp.slug,
          },
        },
        update: {
          isActive: true,
          entityType: SlugEntityType.TOUR,
          entityId: tour.id,
          deletedAt: null,
        },
        create: {
          destinationSlug: bp.destinationSlug,
          slug: bp.slug,
          entityType: SlugEntityType.TOUR,
          entityId: tour.id,
          isActive: true,
        },
      });
    });
    created++;
  }

  log(
    `Tours: ${created} created, ${skipped} already existed (total blueprints ${TOUR_BLUEPRINTS.length}).`,
  );
}

export async function loadDemoTours() {
  return prisma.tour.findMany({
    where: { reference: DEMO_TOUR_REF },
    select: {
      id: true,
      slug: true,
      operatorId: true,
      destinationId: true,
      defaultCurrency: true,
      paymentModel: true,
      depositPct: true,
      commissionTier: true,
      startTimes: true,
      maxPartySize: true,
      destination: { select: { slug: true } },
      ageBands: {
        select: {
          id: true,
          bandType: true,
          price: true,
          priceNet: true,
          participation: true,
          label: true,
          isDefault: true,
        },
      },
      addOns: { select: { id: true, name: true, unit: true, price: true } },
    },
  });
}
