import { PrismaPg } from '@prisma/adapter-pg';
import {
  AttributeDataType,
  Currency,
  FilterDisplayType,
  HubType,
  Locale,
  Prisma,
  PrismaClient,
  RecommendationCategory,
  RecommendationPlacement,
  RecommendationSource,
  Region,
  Role,
  SlugEntityType,
} from '@prisma/client';
import 'dotenv/config';
import { auth } from '../src/auth/auth.instance';
import { seedTeamDesignations } from './seed-designations';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

/**
 * Creates a sign-in-able ADMIN account. Public sign-up is disabled, so the
 * account goes through Better Auth's internal adapter (which still hashes the
 * password correctly); the user is created with the default non-admin role
 * and elevated via raw Prisma afterwards - the ADMIN database hook only
 * blocks ADMIN being set at creation time. Shared by the visible admin and
 * the hidden internal-management admin below.
 */
async function createAdminAccount(
  email: string,
  password: string,
  name: string,
  extraUserData: Prisma.UserUpdateInput = {},
) {
  const authCtx = await auth.$context;
  const hashedPassword = await authCtx.password.hash(password);

  const user = await authCtx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
  });

  await authCtx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hashedPassword,
  });

  await prisma.user.update({
    where: { email },
    data: {
      role: Role.ADMIN,
      emailVerified: true,
      hasPassword: true,
      ...extraUserData,
    },
  });
}

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
    await createAdminAccount(email, password, 'System Admin');
    console.log(`Successfully created admin user ${email}!`);
  }

  await seedSystemAdmin();

  // Seeding is always run - all functions are idempotent (skip existing records).
  // Order matters: categories → destinations (needs categories for slug_registry) → hubs.
  await seedCategories();
  await seedDestinations();
  await seedHubs();
  await seedAttributes();
  await seedRecommendations();
  // Default operator-team designation templates: operators.service.create
  // provisions NEW operators; this backfills the ones that predate the
  // feature. Standalone: `pnpm prisma:seed:designations[:clean]`.
  await seedTeamDesignations(prisma);
}

// ── Island Tours' post-booking recommendations (thank-you page / email promo) ──
/**
 * The recommendations list ships with one seeded "Hotel" category and one row (the
 * old "Palm Suite Apartment" apartment promo), so an admin edits existing content
 * instead of facing an empty form before the section works at all.
 *
 * `isSeeded: true` makes both the category and the row undeletable (403 in the
 * service), the same protection seeded destinations have: the promo keeps one
 * guaranteed occupant, so the section can only be emptied deliberately - by
 * switching it off - and never by an accidental delete.
 *
 * The `20260731120000_recommendations` migration performs the same seeding, which is
 * what covers production (`prisma migrate deploy` does not run seeds). This exists for
 * a database whose row was deleted by hand, and for `migrate reset` flows.
 *
 * CREATE-ONLY on the recommendation: it never touches an existing row. The category
 * is upserted by slug (idempotent) so the seeded row always has a home to point at.
 */
async function seedRecommendations() {
  console.log('Seeding recommendations...');

  const existing = await prisma.recommendation.findFirst({
    select: { id: true },
  });
  if (existing) {
    console.log('Recommendations already exist. Leaving them untouched.');
    return;
  }

  console.log('Seeding the promoted apartment recommendation...');
  await prisma.recommendation.create({
    data: {
      source: RecommendationSource.EXTERNAL,
      category: RecommendationCategory.HOTEL,
      isEnabled: true,
      displayOrder: 0,
      isSeeded: true,
      placements: [RecommendationPlacement.THANK_YOU_PAGE],
      imageUrl: 'https://picsum.photos/seed/typ-apartment/1176/758',
      linkUrl: 'https://www.airbnb.com',
      rating: 4.8,
      reviewCount: 1738,
      sleeps: 4,
      priceAmount: 160,
      currency: Currency.USD,
      translations: {
        create: {
          locale: Locale.en,
          // Seeded as real values, NOT left null. Null renders the site's own
          // translated label, which is correct but leaves the editor showing two
          // empty boxes - an admin cannot tell a field that is deliberately
          // inheriting from one nobody has filled in. Written out, they are
          // editable and the AI pipeline translates them into the other six
          // locales like any other copy.
          //
          // NO EMOJI: the palm is chrome, rendered by the card itself.
          eyebrow: 'OUR APARTMENT',
          ctaLabel: 'See availability on Airbnb',
          areaLabel: 'Jan Thiel',
          title: 'Palm Suite Apartment',
          description:
            'Quiet, modern, 5min from the beach\nOwned and hosted by Island Tours',
        },
      },
    },
  });
  console.log('Recommendation seeded.');
}

// ── Hidden internal-management admin (isSystemAccount) ─────────────────────────
/**
 * A second ADMIN with the same powers as the seeded one but flagged
 * `isSystemAccount: true`, which every listing endpoint filters out and every
 * admin mutation path refuses to touch. Held by the internal management
 * department; the visible admin gets handed over to the client. Optional -
 * skipped with a log when the env vars are unset. Idempotent: re-runs ensure
 * the flags rather than duplicating the account.
 */
async function seedSystemAdmin() {
  const email = process.env.SYSTEM_ADMIN_EMAIL;
  const password = process.env.SYSTEM_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      'SYSTEM_ADMIN_EMAIL / SYSTEM_ADMIN_PASSWORD not set - skipping system admin seed.',
    );
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Backstop for re-runs and for an account created before the flag existed.
    if (existing.role !== Role.ADMIN || !existing.isSystemAccount) {
      await prisma.user.update({
        where: { email },
        data: { role: Role.ADMIN, isSystemAccount: true },
      });
      console.log(`Ensured system admin flags on ${email}.`);
    } else {
      console.log(`System admin ${email} already exists. Skipping.`);
    }
    return;
  }

  console.log(`Creating the internal-management admin...`);
  await createAdminAccount(email, password, 'Internal Management', {
    isSystemAccount: true,
  });
  console.log('Successfully created the internal-management admin.');
}

// ── Pre-seeded categories ──────────────────────────────────────────────────────
// isSeeded = true means the service blocks deletion of these records.
// slug_registry rows are NOT seeded here - they are created in seedDestinations(),
// because slug_registry requires a destination slug.
// NOTE: Klein Curaçao is a Hub, not a category. Do not add it here.
// The canonical 19 global categories (Platform Architecture V2 §3). Order = sortOrder.
// "Catamaran Trip" is a boat_type attribute, "Private Charters" a booking_type attribute,
// "Dolphin Encounters" a hub/wildlife theme - none are categories.
// Category hero images are intentionally NOT seeded - admins upload real,
// on-brand photos via the dashboard; pages render their neutral fallback
// (bg-it-border) until then.

const SEED_CATEGORIES = [
  {
    name: 'Boat Tours & Cruises',
    slug: 'boat-tours',
  },
  {
    name: 'Snorkeling Tours',
    slug: 'snorkeling',
  },
  {
    name: 'Scuba Diving',
    slug: 'scuba-diving',
  },
  {
    name: 'Sunset Cruises',
    slug: 'sunset-cruises',
  },
  {
    name: 'Sightseeing Tours',
    slug: 'sightseeing-tours',
  },
  {
    name: 'Day Trips',
    slug: 'day-trips',
  },
  {
    name: 'Off-Road Tours',
    slug: 'off-road-tours',
  },
  {
    name: 'Jet Ski Tours',
    slug: 'jet-ski',
  },
  {
    name: 'Parasailing',
    slug: 'parasailing',
  },
  {
    name: 'Water Sports',
    slug: 'water-sports',
  },
  {
    name: 'Fishing Trips',
    slug: 'fishing-trips',
  },
  {
    name: 'Nature & Wildlife Tours',
    slug: 'nature-wildlife-tours',
  },
  {
    name: 'Hiking Tours',
    slug: 'hiking-tours',
  },
  {
    name: 'Adventure Tours',
    slug: 'adventure-tours',
  },
  {
    name: 'Cultural & Historical Tours',
    slug: 'cultural-tours',
  },
  {
    name: 'Food & Drink Tours',
    slug: 'food-tours',
  },
  {
    name: 'Attraction Tickets',
    slug: 'attraction-tickets',
  },
  {
    name: 'Luxury Experiences',
    slug: 'luxury-experiences',
  },
  {
    name: 'Workshops & Classes',
    slug: 'workshops-classes',
  },
];

async function seedCategories() {
  console.log('Seeding categories...');

  for (const [idx, cat] of SEED_CATEGORIES.entries()) {
    const existing = await prisma.category.findUnique({
      where: { slug: cat.slug },
    });
    if (existing) {
      console.log(`  Category "${cat.name}" already exists. Skipping.`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: cat.name,
          slug: cat.slug,
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
    displayOrder: 1,
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
    displayOrder: 2,
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
    displayOrder: 3,
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
    displayOrder: 4,
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
    displayOrder: 5,
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
      // Backfill a missing timezone on rows seeded before the field existed
      // (the column is now required for all tour/departure/booking local time).
      // displayOrder is deliberately NOT backfilled here: the seed runs on
      // every deploy (build:prod), and null can be an admin's explicit
      // "unrank" - re-stamping it would revert that. Its one-time backfill
      // lives in the 20260804000000_destination_display_order migration.
      if (!existing.timezone) {
        await prisma.destination.update({
          where: { id: existing.id },
          data: { timezone: dest.timezone },
        });
        console.log(
          `  Destination "${dest.name}" already exists. Backfilled timezone ${dest.timezone}.`,
        );
      } else {
        console.log(`  Destination "${dest.name}" already exists. Skipping.`);
      }
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
          displayOrder: dest.displayOrder,
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
