import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttributeDataType,
  Currency,
  FilterDisplayType,
  HubType,
  Prisma,
  PrismaClient,
  Region,
  Role,
  SlugEntityType,
} from '@prisma/client';
import 'dotenv/config';
import { auth } from '../src/auth/auth.instance';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      'Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment variables',
    );
    process.exit(1);
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email } });

  if (existingAdmin) {
    console.log(`Admin user ${email} already exists. Skipping user creation.`);
  } else {
    console.log(`Creating admin user ${email}...`);

    // Public sign-up is disabled, so create the account through Better Auth's
    // internal adapter (which still hashes the password correctly). The user is
    // created with the default non-admin role - the ADMIN database hook only
    // blocks ADMIN being set at creation time.
    const authCtx = await auth.$context;
    const hashedPassword = await authCtx.password.hash(password);

    const user = await authCtx.internalAdapter.createUser({
      email,
      name: 'System Admin',
      emailVerified: true,
    });

    await authCtx.internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: hashedPassword,
    });

    // Elevate to ADMIN directly via Prisma (user.update carries no auth hook).
    await prisma.user.update({
      where: { email },
      data: { role: Role.ADMIN, emailVerified: true, hasPassword: true },
    });

    console.log(`Successfully created admin user ${email}!`);
  }

  // Seeding is always run - all functions are idempotent (skip existing records).
  // Order matters: categories → destinations (needs categories for slug_registry) → hubs.
  await seedCategories();
  await seedDestinations();
  await seedHubs();
  await seedAttributes();
}

// ── Pre-seeded categories ──────────────────────────────────────────────────────
// isSeeded = true means the service blocks deletion of these records.
// slug_registry rows are NOT seeded here - they are created in seedDestinations(),
// because slug_registry requires a destination slug.
// NOTE: Klein Curaçao is a Hub, not a category. Do not add it here.
// The canonical 19 global categories (Platform Architecture V2 §3). Order = sortOrder.
// "Catamaran Trip" is a boat_type attribute, "Private Charters" a booking_type attribute,
// "Dolphin Encounters" a hub/wildlife theme - none are categories.
// Curated Unsplash hero photos, one per category (best-effort topical match).
// `unsplash(id)` builds a square 600x600 crop. Swap for self-hosted assets before
// production (host whitelisted in frontend next.config under images.unsplash.com).
const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?w=600&h=600&fit=crop&auto=format&q=80`;

const SEED_CATEGORIES = [
  {
    name: 'Boat Tours & Cruises',
    slug: 'boat-tours',
    heroImage: unsplash('photo-1518837695005-2083093ee35b'),
  },
  {
    name: 'Snorkeling Tours',
    slug: 'snorkeling',
    heroImage: unsplash('photo-1473116763249-2faaef81ccda'),
  },
  {
    name: 'Scuba Diving',
    slug: 'scuba-diving',
    heroImage: unsplash('photo-1544551763-46a013bb70d5'),
  },
  {
    name: 'Sunset Cruises',
    slug: 'sunset-cruises',
    heroImage: unsplash('photo-1505228395891-9a51e7e86bf6'),
  },
  {
    name: 'Sightseeing Tours',
    slug: 'sightseeing-tours',
    heroImage: unsplash('photo-1500375592092-40eb2168fd21'),
  },
  {
    name: 'Day Trips',
    slug: 'day-trips',
    heroImage: unsplash('photo-1507525428034-b723cf961d3e'),
  },
  {
    name: 'Off-Road Tours',
    slug: 'off-road-tours',
    heroImage: unsplash('photo-1530866495561-507c9faab2ed'),
  },
  {
    name: 'Jet Ski Tours',
    slug: 'jet-ski',
    heroImage: unsplash('photo-1530549387789-4c1017266635'),
  },
  {
    name: 'Parasailing',
    slug: 'parasailing',
    heroImage: unsplash('photo-1502933691298-84fc14542831'),
  },
  {
    name: 'Water Sports',
    slug: 'water-sports',
    heroImage: unsplash('photo-1502680390469-be75c86b636f'),
  },
  {
    name: 'Fishing Trips',
    slug: 'fishing-trips',
    heroImage: unsplash('photo-1559825481-12a05cc00344'),
  },
  {
    name: 'Nature & Wildlife Tours',
    slug: 'nature-wildlife-tours',
    heroImage: unsplash('photo-1559827260-dc66d52bef19'),
  },
  {
    name: 'Hiking Tours',
    slug: 'hiking-tours',
    heroImage: unsplash('photo-1551632811-561732d1e306'),
  },
  {
    name: 'Adventure Tours',
    slug: 'adventure-tours',
    heroImage: unsplash('photo-1488646953014-85cb44e25828'),
  },
  {
    name: 'Cultural & Historical Tours',
    slug: 'cultural-tours',
    heroImage: unsplash('photo-1583212292454-1fe6229603b7'),
  },
  {
    name: 'Food & Drink Tours',
    slug: 'food-tours',
    heroImage: unsplash('photo-1437846972679-9e6e537be46e'),
  },
  {
    name: 'Attraction Tickets',
    slug: 'attraction-tickets',
    heroImage: unsplash('photo-1540541338287-41700207dee6'),
  },
  {
    name: 'Luxury Experiences',
    slug: 'luxury-experiences',
    heroImage: unsplash('photo-1468413253725-0d5181091126'),
  },
  {
    name: 'Workshops & Classes',
    slug: 'workshops-classes',
    heroImage: unsplash('photo-1571896349842-33c89424de2d'),
  },
];

async function seedCategories() {
  console.log('Seeding categories...');

  for (const [idx, cat] of SEED_CATEGORIES.entries()) {
    const existing = await prisma.category.findUnique({
      where: { slug: cat.slug },
    });
    if (existing) {
      // Backfill the hero image onto rows seeded before images existed, without
      // clobbering an image an admin may have set manually.
      if (!existing.heroImage) {
        await prisma.category.update({
          where: { id: existing.id },
          data: { heroImage: cat.heroImage },
        });
        console.log(
          `  Category "${cat.name}" already exists - backfilled heroImage.`,
        );
      } else {
        console.log(`  Category "${cat.name}" already exists. Skipping.`);
      }
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          heroImage: cat.heroImage,
          isSeeded: true,
          sortOrder: idx + 1,
        },
      });

      // slug_registry rows are deferred - created in seedDestinations()
      console.log(`  Created category "${cat.name}" (${category.id})`);
    });
  }

  console.log('Categories seeded.');
}

// ── Pre-seeded destinations ────────────────────────────────────────────────────
// isSeeded = true means the service blocks deletion of these records.
// On create: seeds one 'tours' RESERVED slug_registry row + one row per active category.
// V2 launch list = 5 Caribbean islands (Platform Architecture V2 §2):
//   Curaçao (launch), Aruba, Sint Maarten are LIVE (isActive: true).
//   Saint Lucia and Bahamas are pipeline rows — seeded but isActive: false. Their
//   slug_registry rows are created inactive too (slug stays protected, page 404s)
//   so the islands can be activated later without re-seeding. Flip isActive via the
//   admin update endpoint, which cascades the flag onto the slug_registry rows.
const SEED_DESTINATIONS = [
  {
    name: 'Curaçao',
    slug: 'curacao',
    region: Region.CARIBBEAN,
    isActive: true,
    country: 'Curaçao',
    latitude: 12.1696,
    longitude: -68.99,
    timezone: 'America/Curacao',
    currency: Currency.USD,
    language: 'nl',
  },
  {
    name: 'Aruba',
    slug: 'aruba',
    region: Region.CARIBBEAN,
    isActive: true,
    country: 'Aruba',
    latitude: 12.5211,
    longitude: -69.9683,
    timezone: 'America/Aruba',
    currency: Currency.USD,
    language: 'nl',
  },
  {
    name: 'Sint Maarten',
    slug: 'sint-maarten',
    region: Region.CARIBBEAN,
    isActive: true,
    country: 'Sint Maarten',
    latitude: 18.0425,
    longitude: -63.0548,
    timezone: 'America/Lower_Princes',
    currency: Currency.USD,
    language: 'nl',
  },
  {
    name: 'Saint Lucia',
    slug: 'saint-lucia',
    region: Region.CARIBBEAN,
    isActive: false,
    country: 'Saint Lucia',
    latitude: 13.9094,
    longitude: -60.9789,
    timezone: 'America/St_Lucia',
    currency: Currency.USD,
    language: 'en',
  },
  {
    name: 'Bahamas',
    slug: 'bahamas',
    region: Region.CARIBBEAN,
    isActive: false,
    country: 'The Bahamas',
    latitude: 25.0343,
    longitude: -77.3963,
    timezone: 'America/Nassau',
    currency: Currency.USD,
    language: 'en',
  },
];

async function seedDestinations() {
  console.log('Seeding destinations...');

  for (const dest of SEED_DESTINATIONS) {
    const existing = await prisma.destination.findUnique({
      where: { slug: dest.slug },
    });
    if (existing) {
      console.log(`  Destination "${dest.name}" already exists. Skipping.`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const destination = await tx.destination.create({
        data: {
          name: dest.name,
          slug: dest.slug,
          region: dest.region,
          country: dest.country,
          latitude: dest.latitude,
          longitude: dest.longitude,
          timezone: dest.timezone,
          currency: dest.currency,
          language: dest.language,
          isSeeded: true,
          isActive: dest.isActive,
        },
      });

      // Seed the 'tours' RESERVED slug - protects the /curacao/tours/ URL.
      // Inactive (pipeline) destinations keep the slug reserved but 404 the page.
      await tx.slugRegistry.create({
        data: {
          destinationSlug: dest.slug,
          slug: 'tours',
          entityType: SlugEntityType.RESERVED,
          entityId: null,
          isActive: dest.isActive,
        },
      });

      // Seed one slug_registry row per existing active category, mirroring the
      // destination's active state so a pipeline island's category pages 404 too.
      const categories = await tx.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true },
      });

      if (categories.length > 0) {
        await tx.slugRegistry.createMany({
          data: categories.map((cat) => ({
            destinationSlug: dest.slug,
            slug: cat.slug,
            entityType: SlugEntityType.CATEGORY,
            entityId: cat.id,
            isActive: dest.isActive,
          })),
        });
      }

      console.log(
        `  Created destination "${dest.name}" (${destination.id}, ${dest.isActive ? 'active' : 'inactive/pipeline'}), seeded ${categories.length} category slug(s) + 1 reserved`,
      );
    });
  }

  console.log('Destinations seeded.');
}

// ── Pre-seeded hubs ────────────────────────────────────────────────────────────
// isSeeded = true means the service blocks deletion of these records.
// On create: seeds one slug_registry row for the hub's destination.
// Klein Curaçao is a destination-specific island (hub), not a global category.
const SEED_HUBS = [
  {
    destinationSlug: 'curacao',
    name: 'Klein Curaçao',
    slug: 'klein-curacao',
    hubType: HubType.LOCATION,
    description:
      'A small uninhabited island off the southeast coast of Curaçao, ' +
      'renowned for pristine white beaches, crystal-clear waters, and excellent snorkeling.',
    allowedCategorySlugs: ['boat-tours', 'snorkeling', 'day-trips'],
  },
];

async function seedHubs() {
  console.log('Seeding hubs...');

  for (const hub of SEED_HUBS) {
    const destination = await prisma.destination.findUnique({
      where: { slug: hub.destinationSlug },
      select: { id: true, slug: true },
    });

    if (!destination) {
      console.warn(
        `  Destination "${hub.destinationSlug}" not found - skipping hub "${hub.name}"`,
      );
      continue;
    }

    const existing = await prisma.hub.findUnique({
      where: {
        destinationId_slug: { destinationId: destination.id, slug: hub.slug },
      },
    });
    if (existing) {
      console.log(`  Hub "${hub.name}" already exists. Skipping.`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const created = await tx.hub.create({
        data: {
          destinationId: destination.id,
          name: hub.name,
          slug: hub.slug,
          hubType: hub.hubType,
          description: hub.description,
          isSeeded: true,
        },
      });

      // Seed one slug_registry row for this hub (Critical Rule)
      await tx.slugRegistry.create({
        data: {
          destinationSlug: destination.slug,
          slug: hub.slug,
          entityType: SlugEntityType.HUB,
          entityId: created.id,
        },
      });

      // Seed allowed categories
      if (hub.allowedCategorySlugs.length > 0) {
        const categories = await tx.category.findMany({
          where: { slug: { in: hub.allowedCategorySlugs }, isActive: true },
          select: { id: true },
        });

        if (categories.length > 0) {
          await tx.hubAllowedCategory.createMany({
            data: categories.map((cat) => ({
              hubId: created.id,
              categoryId: cat.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      console.log(
        `  Created hub "${hub.name}" (${created.id}) under destination "${hub.destinationSlug}"`,
      );
    });
  }

  console.log('Hubs seeded.');
}

// ── Attribute dictionary (Platform Architecture V2 §7) ──────────────────────────
// appliesToCategories holds category SLUGS ([] = global). Idempotent: upsert by key.
type AttrSeed = {
  key: string;
  displayName: string;
  dataType: AttributeDataType;
  allowedValues?: string[];
  appliesToCategories?: string[];
  isFilterable?: boolean;
  isSortable?: boolean;
};

const ATTRIBUTE_DEFS: AttrSeed[] = [
  // Global
  {
    key: 'booking_type',
    displayName: 'Booking Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['private', 'shared'],
  },
  {
    key: 'duration_minutes',
    displayName: 'Duration',
    dataType: AttributeDataType.INTEGER,
    isSortable: true,
  },
  {
    key: 'pickup_available',
    displayName: 'Hotel Pickup',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'instant_confirmation',
    displayName: 'Instant Confirmation',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'free_cancellation',
    displayName: 'Free Cancellation',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'minimum_age',
    displayName: 'Minimum Age',
    dataType: AttributeDataType.INTEGER,
  },
  {
    key: 'guide_languages',
    displayName: 'Guide Languages',
    dataType: AttributeDataType.ENUM_MULTI,
    allowedValues: [
      'english',
      'spanish',
      'dutch',
      'french',
      'german',
      'portuguese',
    ],
  },
  {
    key: 'wheelchair_accessible',
    displayName: 'Wheelchair Accessible',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'family_friendly',
    displayName: 'Family Friendly',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'suitable_for_beginners',
    displayName: 'Suitable for Beginners',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'food_included',
    displayName: 'Food Included',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'drinks_included',
    displayName: 'Drinks Included',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'equipment_included',
    displayName: 'Equipment Included',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'snorkeling_included',
    displayName: 'Snorkeling Included',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'sunset_tour',
    displayName: 'Sunset Tour',
    dataType: AttributeDataType.BOOLEAN,
  },
  {
    key: 'cancellation_window_hours',
    displayName: 'Cancellation Window (hours)',
    dataType: AttributeDataType.INTEGER,
    isFilterable: false,
  },
  {
    key: 'maximum_travelers',
    displayName: 'Maximum Travelers',
    dataType: AttributeDataType.INTEGER,
    isFilterable: false,
  },
  {
    key: 'meeting_point',
    displayName: 'Meeting Point',
    dataType: AttributeDataType.TEXT,
    isFilterable: false,
  },
  // Boat Tours
  {
    key: 'boat_type',
    displayName: 'Boat Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: [
      'catamaran',
      'yacht',
      'speedboat',
      'sailboat',
      'glass_bottom',
    ],
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'snorkeling_stop_count',
    displayName: 'Snorkeling Stops',
    dataType: AttributeDataType.INTEGER,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'sunset_cruise',
    displayName: 'Sunset Cruise',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'onboard_toilet',
    displayName: 'Onboard Toilet',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'open_bar_included',
    displayName: 'Open Bar Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'bbq_included',
    displayName: 'BBQ Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'beach_house_included',
    displayName: 'Beach House',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'breakfast_included',
    displayName: 'Breakfast Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['boat-tours'],
  },
  // Hub comparison-table inputs (curated boat-tour compare template - see
  // HubService.COMPARISON_TEMPLATE). Not surfaced as filters.
  {
    key: 'island_facilities',
    displayName: 'On the island',
    dataType: AttributeDataType.ENUM_MULTI,
    allowedValues: [
      'Beach house',
      'Beds',
      'Shower',
      'WC',
      'Palapas',
      'On board WC',
      'Sun beds',
      'Shade',
    ],
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'crossing_time',
    displayName: 'Crossing',
    dataType: AttributeDataType.TEXT,
    appliesToCategories: ['boat-tours'],
  },
  {
    key: 'boat_name',
    displayName: 'Boat Name',
    dataType: AttributeDataType.TEXT,
    appliesToCategories: ['boat-tours'],
  },
  // Snorkeling
  {
    key: 'snorkeling_equipment_included',
    displayName: 'Snorkeling Equipment Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['snorkeling'],
  },
  {
    key: 'guide_included',
    displayName: 'Guide Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['snorkeling'],
  },
  {
    key: 'swimming_required',
    displayName: 'Swimming Required',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['snorkeling'],
  },
  // wildlife_type spans snorkeling + nature-wildlife (union of allowed values)
  {
    key: 'wildlife_type',
    displayName: 'Wildlife',
    dataType: AttributeDataType.ENUM_MULTI,
    allowedValues: [
      'turtles',
      'coral',
      'tropical_fish',
      'rays',
      'dolphins',
      'whales',
      'flamingos',
    ],
    appliesToCategories: ['snorkeling', 'nature-wildlife-tours'],
  },
  // Scuba Diving
  {
    key: 'dive_type',
    displayName: 'Dive Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['discover_scuba', 'certified', 'night_dive'],
    appliesToCategories: ['scuba-diving'],
  },
  {
    key: 'certification_required',
    displayName: 'Certification Required',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['scuba-diving'],
  },
  {
    key: 'max_depth',
    displayName: 'Max Depth',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['12m', '18m', '30m'],
    appliesToCategories: ['scuba-diving'],
  },
  // Off-Road
  {
    key: 'vehicle_type',
    displayName: 'Vehicle Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['buggy', 'atv', 'utv', 'jeep'],
    appliesToCategories: ['off-road-tours'],
  },
  {
    key: 'driver_license_required',
    displayName: 'Driver License Required',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['off-road-tours'],
  },
  {
    key: 'offroad_difficulty',
    displayName: 'Difficulty',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['easy', 'moderate', 'extreme'],
    appliesToCategories: ['off-road-tours'],
  },
  // Water Sports / Jet Ski / Parasailing
  {
    key: 'water_sport_type',
    displayName: 'Water Sport',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['jet_ski', 'kayak', 'sup', 'surf', 'parasail'],
    appliesToCategories: ['water-sports', 'jet-ski', 'parasailing'],
  },
  {
    key: 'instructor_included',
    displayName: 'Instructor Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['water-sports', 'jet-ski', 'parasailing'],
  },
  {
    key: 'passenger_allowed',
    displayName: 'Passenger Allowed',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['water-sports', 'jet-ski', 'parasailing'],
  },
  // Nature & Wildlife
  {
    key: 'animal_guarantee',
    displayName: 'Animal Sighting Guarantee',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['nature-wildlife-tours'],
  },
  // Food & Drink
  {
    key: 'tasting_type',
    displayName: 'Tasting Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['food', 'wine', 'rum', 'cocktail'],
    appliesToCategories: ['food-tours'],
  },
  {
    key: 'meal_included',
    displayName: 'Meal Included',
    dataType: AttributeDataType.BOOLEAN,
    appliesToCategories: ['food-tours'],
  },
  // Adventure
  {
    key: 'adventure_type',
    displayName: 'Adventure Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['zipline', 'bungee', 'skydiving', 'cliff_jumping'],
    appliesToCategories: ['adventure-tours'],
  },
  {
    key: 'height_requirement',
    displayName: 'Height Requirement (cm)',
    dataType: AttributeDataType.INTEGER,
    appliesToCategories: ['adventure-tours'],
  },
  // Hiking
  {
    key: 'fitness_level',
    displayName: 'Fitness Level',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['easy', 'moderate', 'hard'],
    appliesToCategories: ['hiking-tours'],
  },
  {
    key: 'trail_distance_km',
    displayName: 'Trail Distance (km)',
    dataType: AttributeDataType.DECIMAL,
    appliesToCategories: ['hiking-tours'],
  },
  // Attraction Tickets
  {
    key: 'ticket_type',
    displayName: 'Ticket Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['museum', 'park', 'attraction', 'show'],
    appliesToCategories: ['attraction-tickets'],
  },
  // Luxury
  {
    key: 'tier',
    displayName: 'Tier',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['premium', 'luxury', 'ultra_luxury'],
    appliesToCategories: ['luxury-experiences'],
  },
  // Workshops
  {
    key: 'class_type',
    displayName: 'Class Type',
    dataType: AttributeDataType.ENUM,
    allowedValues: ['cooking', 'surf_lesson', 'art', 'craft'],
    appliesToCategories: ['workshops-classes'],
  },
];

function filterDisplayFor(
  dataType: AttributeDataType,
): FilterDisplayType | null {
  switch (dataType) {
    case AttributeDataType.BOOLEAN:
      return FilterDisplayType.CHECKBOX;
    case AttributeDataType.ENUM:
      return FilterDisplayType.RADIO;
    case AttributeDataType.ENUM_MULTI:
      return FilterDisplayType.CHECKBOX;
    case AttributeDataType.INTEGER:
    case AttributeDataType.DECIMAL:
      return FilterDisplayType.RANGE_SLIDER;
    default:
      return null;
  }
}

async function seedAttributes() {
  console.log('Seeding attribute dictionary...');
  for (let i = 0; i < ATTRIBUTE_DEFS.length; i++) {
    const def = ATTRIBUTE_DEFS[i];
    const isFilterable = def.isFilterable ?? true;
    const data = {
      displayName: def.displayName,
      dataType: def.dataType,
      allowedValues: def.allowedValues
        ? (def.allowedValues as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      appliesToCategories: def.appliesToCategories ?? [],
      isFilterable,
      isSortable: def.isSortable ?? false,
      filterDisplayType: isFilterable ? filterDisplayFor(def.dataType) : null,
      sortOrder: i + 1,
    };
    await prisma.attributeDefinition.upsert({
      where: { key: def.key },
      create: { key: def.key, ...data },
      update: data,
    });
  }
  console.log(
    `Attribute dictionary seeded (${ATTRIBUTE_DEFS.length} definitions).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
