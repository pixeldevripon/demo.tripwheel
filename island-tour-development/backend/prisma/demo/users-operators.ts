// DEMO SEED — users (operators + travelers) and operator profiles.
// Operator/traveler accounts are created through Better Auth so they can log in
// with the shared DEMO_PASSWORD (dashboard + "my bookings/reviews" are testable).

import { OperatorVerificationStatus, Role } from '@prisma/client';
import { auth } from '@/auth/auth.instance';
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
}

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
  { key: 't01', name: 'Anna Meijer', firstName: 'Anna', initial: 'Anna M.', country: 'Netherlands', locale: 'nl', timezone: 'UTC+01:00' },
  { key: 't02', name: 'James Carter', firstName: 'James', initial: 'James C.', country: 'United States', locale: 'en', timezone: 'UTC-05:00' },
  { key: 't03', name: 'Sophie Dubois', firstName: 'Sophie', initial: 'Sophie D.', country: 'France', locale: 'fr', timezone: 'UTC+01:00' },
  { key: 't04', name: 'Lukas Schmidt', firstName: 'Lukas', initial: 'Lukas S.', country: 'Germany', locale: 'de', timezone: 'UTC+01:00' },
  { key: 't05', name: 'Maria Santos', firstName: 'Maria', initial: 'Maria S.', country: 'Portugal', locale: 'pt', timezone: 'UTC+00:00' },
  { key: 't06', name: 'Carlos Ruiz', firstName: 'Carlos', initial: 'Carlos R.', country: 'Spain', locale: 'es', timezone: 'UTC+01:00' },
  { key: 't07', name: 'Emily Brown', firstName: 'Emily', initial: 'Emily B.', country: 'United Kingdom', locale: 'en', timezone: 'UTC+00:00' },
  { key: 't08', name: 'Wei Chen', firstName: 'Wei', initial: 'Wei C.', country: 'China', locale: 'zh', timezone: 'UTC+08:00' },
  { key: 't09', name: 'Isabella Rossi', firstName: 'Isabella', initial: 'Isabella R.', country: 'Italy', locale: 'en', timezone: 'UTC+01:00' },
  { key: 't10', name: 'Noah Jansen', firstName: 'Noah', initial: 'Noah J.', country: 'Netherlands', locale: 'nl', timezone: 'UTC+01:00' },
  { key: 't11', name: 'Olivia Wilson', firstName: 'Olivia', initial: 'Olivia W.', country: 'Canada', locale: 'en', timezone: 'UTC-04:00' },
  { key: 't12', name: 'Lucas Almeida', firstName: 'Lucas', initial: 'Lucas A.', country: 'Brazil', locale: 'pt', timezone: 'UTC-03:00' },
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
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;

  const authCtx = await auth.$context;
  const hashed = await authCtx.password.hash(DEMO_PASSWORD);
  const user = await authCtx.internalAdapter.createUser({ email, name, emailVerified: true });
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
    const userId = await ensureAuthUser(email, op.ownerName, Role.TOUR_OPERATOR, {
      location: `${op.city}, ${op.country}`,
    });

    const operator = await prisma.operator.upsert({
      where: { userId },
      update: {
        isActive: true,
        verificationStatus: OperatorVerificationStatus.VERIFIED,
        contactEmail: email,
        contactPhone: op.contactPhone,
      },
      create: {
        userId,
        isActive: true,
        verificationStatus: OperatorVerificationStatus.VERIFIED,
        contactEmail: email,
        contactPhone: op.contactPhone,
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
  }
  log(`Operators ready (${OPERATORS.length}) with company/social/payment configs.`);
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
