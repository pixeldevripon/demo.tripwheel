import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role, SlotStatus, SlugEntityType } from '@prisma/client';
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

    // Step 1: Create user via Better Auth so the password is properly hashed.
    // role is not sent — role.input=false means it's ignored anyway. User is
    // created with the default TOUR_OPERATOR role.
    await auth.api.signUpEmail({
      body: { email, password, name: 'System Admin' },
    });

    // Step 2: Elevate to ADMIN directly via Prisma. This bypasses the public
    // sign-up hook which only blocks ADMIN creation through self-registration.
    await prisma.user.update({
      where: { email },
      data: { role: Role.ADMIN, emailVerified: true, hasPassword: true },
    });

    console.log(`Successfully created admin user ${email}!`);
  }

  // Seeding is always run — all functions are idempotent (skip existing records).
  // Order matters: categories → destinations (needs categories for slug_registry) → hubs.
  await seedCategories();
  await seedDestinations();
  await seedHubs();
}

// ── Pre-seeded categories ──────────────────────────────────────────────────────
// isSeeded = true means the service blocks deletion of these records.
// FeaturedSlot rows (3 per category) are seeded here as well.
// slug_registry rows are NOT seeded here — they are created in seedDestinations(),
// because slug_registry requires a destination slug.
// NOTE: Klein Curaçao is a Hub, not a category. Do not add it here.
const SEED_CATEGORIES = [
  { name: 'Boat Tours',        slug: 'boat-tours' },
  { name: 'Sunset Cruises',    slug: 'sunset-cruises' },
  { name: 'Buggy Tours',       slug: 'buggy-tours' },
  { name: 'Snorkeling Trips',  slug: 'snorkeling-trips' },
  { name: 'Private Charters',  slug: 'private-charters' },
  { name: 'Catamaran Trip',    slug: 'catamaran-trip' },
  { name: 'Dolphin Encounters', slug: 'dolphin-encounters' },
];

async function seedCategories() {
  console.log('Seeding categories...');

  for (const cat of SEED_CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { slug: cat.slug } });
    if (existing) {
      console.log(`  Category "${cat.name}" already exists. Skipping.`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: { name: cat.name, slug: cat.slug, isSeeded: true },
      });

      await tx.featuredSlot.createMany({
        data: [1, 2, 3].map((slotNumber) => ({
          categoryId: category.id,
          slotNumber,
          status: SlotStatus.AVAILABLE,
        })),
      });

      // slug_registry rows are deferred — created in seedDestinations()
      console.log(`  Created category "${cat.name}" (${category.id})`);
    });
  }

  console.log('Categories seeded.');
}

// ── Pre-seeded destinations ────────────────────────────────────────────────────
// isSeeded = true means the service blocks deletion of these records.
// On create: seeds one 'tours' RESERVED slug_registry row + one row per active category.
const SEED_DESTINATIONS = [
  { name: 'Curaçao',      slug: 'curacao'       },
  { name: 'Aruba',        slug: 'aruba'          },
  { name: 'Sint Maarten', slug: 'sint-maarten'   },
  { name: 'Saint Lucia',  slug: 'saint-lucia'    },
];

async function seedDestinations() {
  console.log('Seeding destinations...');

  for (const dest of SEED_DESTINATIONS) {
    const existing = await prisma.destination.findUnique({ where: { slug: dest.slug } });
    if (existing) {
      console.log(`  Destination "${dest.name}" already exists. Skipping.`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const destination = await tx.destination.create({
        data: { name: dest.name, slug: dest.slug, isSeeded: true },
      });

      // Seed the 'tours' RESERVED slug — protects the /curacao/tours/ URL
      await tx.slugRegistry.create({
        data: {
          destinationSlug: dest.slug,
          slug: 'tours',
          entityType: SlugEntityType.RESERVED,
          entityId: null,
        },
      });

      // Seed one slug_registry row per existing active category
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
          })),
        });
      }

      console.log(
        `  Created destination "${dest.name}" (${destination.id}), seeded ${categories.length} category slug(s) + 1 reserved`,
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
    description:
      'A small uninhabited island off the southeast coast of Curaçao, ' +
      'renowned for pristine white beaches, crystal-clear waters, and excellent snorkeling.',
    allowedCategorySlugs: ['boat-tours', 'snorkeling-trips', 'private-charters', 'catamaran-trip'],
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
      console.warn(`  Destination "${hub.destinationSlug}" not found — skipping hub "${hub.name}"`);
      continue;
    }

    const existing = await prisma.hub.findUnique({
      where: { destinationId_slug: { destinationId: destination.id, slug: hub.slug } },
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
            data: categories.map((cat) => ({ hubId: created.id, categoryId: cat.id })),
            skipDuplicates: true,
          });
        }
      }

      console.log(`  Created hub "${hub.name}" (${created.id}) under destination "${hub.destinationSlug}"`);
    });
  }

  console.log('Hubs seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
