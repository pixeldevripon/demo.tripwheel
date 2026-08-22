// DEMO SEED — users (operators + travelers) and operator profiles.
// Operator/traveler accounts are created through Better Auth so they can log in
// with the shared DEMO_PASSWORD (dashboard + "my bookings/reviews" are testable).

import { OperatorVerificationStatus, Role } from '@prisma/client';
import { auth } from '@/auth/auth.instance';
import { defaultTeamDesignationRows } from '@/config/team-designations.config';
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  log,
  prisma,
  section,
} from './_shared';

// ── Operator definitions ─────────────────────────────────────────────────────────
export interface DemoOperatorDef {
  key: string; // stable slug used for email + lookup
  companyName: string;
  ownerName: string;
  destinationSlug: string; // home island
  city: string;
  country: string;
  contactPhone: string;
  categorySlugs: string[]; // categories this operator runs tours in
  houseTier: 'premium' | 'featured' | 'boosted' | 'organic' | 'standard';
  // Operator-conditions DOCUMENT (Pastel #80 / MCK-20): one per operator,
  // shared by all its DOCUMENT-flagged tours. Placeholder text pending the
  // legal workstream (D1/D2).
  terms?: { document: Record<string, string>; version: string };
}

// Placeholder conditions text (Pastel #80). The section skeleton mirrors the
// operator's old public T&C page; counsel writes the real document (D1/D2).
// Sanitized-HTML contract: this is a TRUSTED write path - the CMS that later
// replaces it must sanitize at write time, like page editorial content.
const MISS_ANN_TERMS_EN = [
  '<h4>1 · Safety and risk</h4>',
  "<p>Miss Ann Boat Trips takes all reasonable measures to prevent injury and property damage. Speedboat travel involves movement, spray and wave impact; by joining you accept the risks that come with an open powerboat at sea and you follow the crew's safety instructions at all times.</p>",
  '<h4>2 · Weather and technical cancellations</h4>',
  '<p>If the operator cancels a departure for weather or technical reasons, you choose between a free reschedule and a full refund. This never narrows your Island Tours cancellation window.</p>',
  '<h4>3 · Health</h4>',
  '<p>This trip is not suitable during pregnancy or with recent back or neck injuries. Limited mobility: message us first, so the crew can advise honestly whether boarding works for you.</p>',
  '<h4>4 · On board</h4>',
  "<ul><li>Follow the crew's instructions at all times.</li><li>No illegal substances on board.</li><li>Do not endanger yourself, other guests or the crew.</li></ul>",
].join('\n');

const MISS_ANN_TERMS_NL = [
  '<h4>1 · Veiligheid en risico</h4>',
  "<p>Miss Ann Boat Trips neemt alle redelijke maatregelen om letsel en schade te voorkomen. Varen met een speedboot betekent beweging, buiswater en golfslag; door mee te gaan aanvaardt u de risico's van een open powerboat op zee en volgt u te allen tijde de veiligheidsinstructies van de bemanning.</p>",
  '<h4>2 · Weer en technische annuleringen</h4>',
  '<p>Annuleert de operator een afvaart wegens weer of techniek, dan kiest u tussen gratis omboeken en volledige terugbetaling. Dit beperkt nooit uw Island Tours-annuleringstermijn.</p>',
  '<h4>3 · Gezondheid</h4>',
  '<p>Deze trip is niet geschikt tijdens zwangerschap of met recente rug- of nekklachten. Beperkte mobiliteit: stuur ons eerst een bericht, zodat de bemanning eerlijk kan adviseren of aan boord gaan voor u werkt.</p>',
  '<h4>4 · Aan boord</h4>',
  '<ul><li>Volg altijd de instructies van de bemanning.</li><li>Geen illegale middelen aan boord.</li><li>Breng uzelf, andere gasten of de bemanning niet in gevaar.</li></ul>',
].join('\n');

export const OPERATORS: DemoOperatorDef[] = [
  {
    key: 'miss-ann-boat-trips',
    companyName: 'Miss Ann Boat Trips',
    ownerName: 'Andrés Martina',
    destinationSlug: 'curacao',
    city: 'Willemstad',
    country: 'Curaçao',
    contactPhone: '+59995601234',
    categorySlugs: ['boat-tours', 'snorkeling', 'day-trips'],
    houseTier: 'premium',
    terms: {
      document: { en: MISS_ANN_TERMS_EN, nl: MISS_ANN_TERMS_NL },
      version: '1.0-placeholder',
    },
  },
  {
    key: 'curacao-dive-crew',
    companyName: 'Curaçao Dive Crew',
    ownerName: 'Liesbeth Pieters',
    destinationSlug: 'curacao',
    city: 'Jan Thiel',
    country: 'Curaçao',
    contactPhone: '+59995602345',
    categorySlugs: ['scuba-diving', 'snorkeling'],
    houseTier: 'featured',
  },
  {
    key: 'island-roots-tours',
    companyName: 'Island Roots Tours',
    ownerName: 'Shaniqua Felix',
    destinationSlug: 'curacao',
    city: 'Otrobanda',
    country: 'Curaçao',
    contactPhone: '+59995603456',
    categorySlugs: ['cultural-tours', 'food-tours', 'sightseeing-tours'],
    houseTier: 'boosted',
  },
  {
    key: 'aruba-adventures-co',
    companyName: 'Aruba Adventures Co.',
    ownerName: 'Diego Croes',
    destinationSlug: 'aruba',
    city: 'Oranjestad',
    country: 'Aruba',
    contactPhone: '+29756001234',
    categorySlugs: ['off-road-tours', 'adventure-tours', 'water-sports'],
    houseTier: 'featured',
  },
  {
    key: 'dushi-watersports',
    companyName: 'Dushi Watersports',
    ownerName: 'Naomi Wever',
    destinationSlug: 'aruba',
    city: 'Palm Beach',
    country: 'Aruba',
    contactPhone: '+29756002345',
    categorySlugs: ['jet-ski', 'parasailing', 'water-sports'],
    houseTier: 'organic',
  },
  {
    key: 'sxm-sailing-and-sun',
    companyName: 'SXM Sailing & Sun',
    ownerName: 'Pierre Lafond',
    destinationSlug: 'sint-maarten',
    city: 'Philipsburg',
    country: 'Sint Maarten',
    contactPhone: '+17215801234',
    categorySlugs: ['sunset-cruises', 'boat-tours', 'sightseeing-tours'],
    houseTier: 'standard',
  },
];

// ── Traveler definitions ───────────────────────────────────────────────────────
export interface DemoTravelerDef {
  key: string;
  name: string;
  firstName: string;
  initial: string; // "Anna M."
  country: string;
  locale: string;
  timezone: string;
}

export const TRAVELERS: DemoTravelerDef[] = [
  {
    key: 't01',
    name: 'Anna Meijer',
    firstName: 'Anna',
    initial: 'Anna M.',
    country: 'Netherlands',
    locale: 'nl',
    timezone: 'UTC+01:00',
  },
  {
    key: 't02',
    name: 'James Carter',
    firstName: 'James',
    initial: 'James C.',
    country: 'United States',
    locale: 'en',
    timezone: 'UTC-05:00',
  },
  {
    key: 't03',
    name: 'Sophie Dubois',
    firstName: 'Sophie',
    initial: 'Sophie D.',
    country: 'France',
    locale: 'fr',
    timezone: 'UTC+01:00',
  },
  {
    key: 't04',
    name: 'Lukas Schmidt',
    firstName: 'Lukas',
    initial: 'Lukas S.',
    country: 'Germany',
    locale: 'de',
    timezone: 'UTC+01:00',
  },
  {
    key: 't05',
    name: 'Maria Santos',
    firstName: 'Maria',
    initial: 'Maria S.',
    country: 'Portugal',
    locale: 'pt',
    timezone: 'UTC+00:00',
  },
  {
    key: 't06',
    name: 'Carlos Ruiz',
    firstName: 'Carlos',
    initial: 'Carlos R.',
    country: 'Spain',
    locale: 'es',
    timezone: 'UTC+01:00',
  },
  {
    key: 't07',
    name: 'Emily Brown',
    firstName: 'Emily',
    initial: 'Emily B.',
    country: 'United Kingdom',
    locale: 'en',
    timezone: 'UTC+00:00',
  },
  {
    key: 't08',
    name: 'Wei Chen',
    firstName: 'Wei',
    initial: 'Wei C.',
    country: 'China',
    locale: 'zh',
    timezone: 'UTC+08:00',
  },
  {
    key: 't09',
    name: 'Isabella Rossi',
    firstName: 'Isabella',
    initial: 'Isabella R.',
    country: 'Italy',
    locale: 'en',
    timezone: 'UTC+01:00',
  },
  {
    key: 't10',
    name: 'Noah Jansen',
    firstName: 'Noah',
    initial: 'Noah J.',
    country: 'Netherlands',
    locale: 'nl',
    timezone: 'UTC+01:00',
  },
  {
    key: 't11',
    name: 'Olivia Wilson',
    firstName: 'Olivia',
    initial: 'Olivia W.',
    country: 'Canada',
    locale: 'en',
    timezone: 'UTC-04:00',
  },
  {
    key: 't12',
    name: 'Lucas Almeida',
    firstName: 'Lucas',
    initial: 'Lucas A.',
    country: 'Brazil',
    locale: 'pt',
    timezone: 'UTC-03:00',
  },
];

export function operatorEmail(key: string): string {
  return `op.${key}@${DEMO_EMAIL_DOMAIN}`;
}
export function travelerEmail(key: string): string {
  return `traveler.${key}@${DEMO_EMAIL_DOMAIN}`;
}

/** Create a Better Auth account (email/password) with the given platform role. */
async function ensureAuthUser(
  email: string,
  name: string,
  role: Role,
  extra: { phone?: string; location?: string; timezone?: string } = {},
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) return existing.id;

  const authCtx = await auth.$context;
  const hashed = await authCtx.password.hash(DEMO_PASSWORD);
  const user = await authCtx.internalAdapter.createUser({
    email,
    name,
    emailVerified: true,
  });
  await authCtx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: 'credential',
    accountId: user.id,
    password: hashed,
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { role, emailVerified: true, hasPassword: true, ...extra },
  });
  return user.id;
}

export async function seedUsersAndOperators(): Promise<void> {
  section('Users + Operators');

  // Travelers
  for (const t of TRAVELERS) {
    await ensureAuthUser(travelerEmail(t.key), t.name, Role.USER, {
      location: t.country,
      timezone: t.timezone,
    });
  }
  log(`Travelers ready (${TRAVELERS.length}).`);

  // Operators (+ profile + configs)
  for (const op of OPERATORS) {
    const email = operatorEmail(op.key);
    const userId = await ensureAuthUser(
      email,
      op.ownerName,
      Role.TOUR_OPERATOR,
      {
        location: `${op.city}, ${op.country}`,
      },
    );

    // Operator-conditions document rides both branches so a re-seed refreshes
    // the placeholder text in place (this seed is re-runnable by design).
    const termsData = op.terms
      ? {
          termsDocument: op.terms.document,
          termsVersion: op.terms.version,
          termsEffectiveDate: new Date(),
        }
      : {};
    const operator = await prisma.operator.upsert({
      where: { userId },
      update: {
        isActive: true,
        verificationStatus: OperatorVerificationStatus.VERIFIED,
        contactEmail: email,
        contactPhone: op.contactPhone,
        // Public operator URL slug - the canonical conditions page address.
        slug: op.key,
        ...termsData,
      },
      create: {
        userId,
        isActive: true,
        verificationStatus: OperatorVerificationStatus.VERIFIED,
        contactEmail: email,
        contactPhone: op.contactPhone,
        slug: op.key,
        ...termsData,
      },
    });

    await prisma.operatorCompanyInfo.upsert({
      where: { operatorId: operator.id },
      update: {},
      create: {
        operatorId: operator.id,
        companyName: op.companyName,
        companyEmail: email,
        companyCountry: op.country,
        companyCity: op.city,
        companyPhone: op.contactPhone,
        plannedTripCount: op.categorySlugs.length * 3,
        yearlySalesTarget: 250000,
      },
    });

    const handle = op.key.replace(/-/g, '');
    await prisma.operatorSocialMedia.upsert({
      where: { operatorId: operator.id },
      update: {},
      create: {
        operatorId: operator.id,
        facebookUrl: `https://facebook.com/${handle}`,
        instagramUrl: `https://instagram.com/${handle}`,
        twitterUrl: `https://x.com/${handle}`,
        linkedinUrl: '',
      },
    });

    // Configs exist but carry no real secrets (demo).
    await prisma.operatorStripeConfig.upsert({
      where: { operatorId: operator.id },
      update: {},
      create: {
        operatorId: operator.id,
        publishableKey: '',
        secretKey: '',
        webhookSecret: '',
        paymentMethods: ['card'],
        isActive: false,
      },
    });
    await prisma.operatorMollieConfig.upsert({
      where: { operatorId: operator.id },
      update: {},
      create: {
        operatorId: operator.id,
        apiKey: '',
        paymentMethods: ['creditcard', 'ideal'],
        isActive: false,
      },
    });

    // Default team designation templates - the same rows the operators
    // service provisions on real operator creation. skipDuplicates on the
    // (operatorId, name) unique keeps the demo seed re-runnable.
    await prisma.staffDesignation.createMany({
      data: defaultTeamDesignationRows(operator.id),
      skipDuplicates: true,
    });
  }
  log(
    `Operators ready (${OPERATORS.length}) with company/social/payment configs.`,
  );
}

// ── Loaders for downstream modules ───────────────────────────────────────────────
export async function loadDemoOperators() {
  return prisma.operator.findMany({
    where: { user: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } },
    select: { id: true, userId: true, user: { select: { email: true } } },
  });
}
export async function loadDemoTravelers() {
  return prisma.user.findMany({
    where: {
      role: Role.USER,
      email: { startsWith: 'traveler.', endsWith: `@${DEMO_EMAIL_DOMAIN}` },
    },
    select: { id: true, name: true, email: true, location: true },
  });
}
