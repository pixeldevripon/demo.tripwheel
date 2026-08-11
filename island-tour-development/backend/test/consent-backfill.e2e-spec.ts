/**
 * WP-G G-02/G-17: the MK-1 consent backfill migration
 * (prisma/migrations/20260811180000_mk1_consent_backfill) against real
 * Postgres. Pins the whole data contract:
 *
 *  (a) historical `newsletterOptIn=true` bookings with a contact email land
 *      in `email_consents`, lowercased + trimmed, with checkout provenance;
 *  (b) among several opted-in bookings by one address, the OLDEST booking
 *      wins the provenance row (matching the runtime upsert's keep-first);
 *  (c) opt-outs, contact-less and blank-address bookings are excluded;
 *  (d) IDEMPOTENT: running the migration twice changes nothing - same
 *      count, same rows, same ids (the ON CONFLICT DO NOTHING contract).
 *
 * The suite executes the migration file's own SQL (not a copy), so a future
 * edit to the migration is what this spec tests.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  Currency,
  PaymentModel,
  PricingModel,
  Region,
  TourStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// The e2e transform is ESM (`useESM`, better-auth's constraint), so
// `__dirname` does not exist here — the mail.service TEMPLATE_DIR trap.
// Jest's rootDir is `test/`, and the suite always runs from `backend/`.
const MIGRATION_SQL = fs.readFileSync(
  path.join(
    process.cwd(),
    'prisma',
    'migrations',
    '20260811180000_mk1_consent_backfill',
    'migration.sql',
  ),
  'utf8',
);

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SHARED_RAW = `Backfill+${suffix}@Example-E2E.com`; // mixed case on purpose
const SHARED = SHARED_RAW.toLowerCase();
const SOLO = `solo+${suffix}@example-e2e.com`;
const OPTED_OUT_EMAIL = `nofill+${suffix}@example-e2e.com`;

describe('MK-1 consent backfill migration - real Postgres', () => {
  let prisma: PrismaClient;

  let destinationId: string;
  let userId: string;
  let operatorId: string;
  let tourId: string;
  const bookingIds: string[] = [];
  let oldestSharedBookingId: string;

  const booking = (over: {
    displayRef: string;
    createdAt: Date;
    contactEmail: string | null;
    newsletterOptIn: boolean;
  }) =>
    prisma.booking.create({
      data: {
        tourId,
        operatorId,
        island: `e2e-backfill-dest-${suffix}`,
        paymentModel: PaymentModel.OPERATOR_LINK,
        currency: Currency.EUR,
        localDate: new Date('2026-06-05'),
        totalRetail: 100,
        depositAmount: 20,
        balanceAmount: 80,
        ...over,
      },
      select: { id: true },
    });

  beforeAll(async () => {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    prisma = new PrismaClient({ adapter });
    await prisma.$connect();

    const destination = await prisma.destination.create({
      data: {
        name: `E2E Backfill Dest ${suffix}`,
        slug: `e2e-backfill-dest-${suffix}`,
        region: Region.CARIBBEAN,
        timezone: 'America/Curacao',
        isActive: true,
        isSeeded: false,
      },
      select: { id: true },
    });
    destinationId = destination.id;

    const user = await prisma.user.create({
      data: {
        name: 'E2E Backfill Operator',
        email: `backfill-op+${suffix}@example-e2e.com`,
      },
      select: { id: true },
    });
    userId = user.id;
    const operator = await prisma.operator.create({
      data: { userId },
      select: { id: true },
    });
    operatorId = operator.id;

    const tour = await prisma.tour.create({
      data: {
        name: `E2E Backfill Tour ${suffix}`,
        slug: `e2e-backfill-tour-${suffix}`,
        destinationId,
        operatorId,
        status: TourStatus.LIVE,
        timeZone: 'America/Curacao',
        defaultCurrency: Currency.EUR,
        paymentModel: PaymentModel.OPERATOR_LINK,
        pricingModel: PricingModel.UNIT,
        basePrice: 100,
      },
      select: { id: true },
    });
    tourId = tour.id;

    // (b) two opted-in bookings by ONE address: the older one owns provenance.
    const oldest = await booking({
      displayRef: `E2E-BF-${suffix}-1`,
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      contactEmail: SHARED_RAW,
      newsletterOptIn: true,
    });
    oldestSharedBookingId = oldest.id;
    const rows = await Promise.all([
      booking({
        displayRef: `E2E-BF-${suffix}-2`,
        createdAt: new Date('2026-06-01T10:00:00.000Z'),
        contactEmail: SHARED.toUpperCase(), // same address, different casing
        newsletterOptIn: true,
      }),
      // (a) a distinct opted-in address.
      booking({
        displayRef: `E2E-BF-${suffix}-3`,
        createdAt: new Date('2026-06-02T10:00:00.000Z'),
        contactEmail: SOLO,
        newsletterOptIn: true,
      }),
      // (c) exclusions: no tick / no address / blank address.
      booking({
        displayRef: `E2E-BF-${suffix}-4`,
        createdAt: new Date('2026-06-03T10:00:00.000Z'),
        contactEmail: OPTED_OUT_EMAIL,
        newsletterOptIn: false,
      }),
      booking({
        displayRef: `E2E-BF-${suffix}-5`,
        createdAt: new Date('2026-06-04T10:00:00.000Z'),
        contactEmail: null,
        newsletterOptIn: true,
      }),
      booking({
        displayRef: `E2E-BF-${suffix}-6`,
        createdAt: new Date('2026-06-05T10:00:00.000Z'),
        contactEmail: '   ',
        newsletterOptIn: true,
      }),
    ]);
    bookingIds.push(oldest.id, ...rows.map((r) => r.id));
  }, 60_000);

  afterAll(async () => {
    await prisma.emailConsent.deleteMany({
      where: { email: { in: [SHARED, SOLO, OPTED_OUT_EMAIL] } },
    });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.tour.deleteMany({ where: { id: tourId } });
    await prisma.operator.deleteMany({ where: { id: operatorId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.destination.deleteMany({ where: { id: destinationId } });
    await prisma.$disconnect();
  });

  const ourConsents = () =>
    prisma.emailConsent.findMany({
      where: { email: { in: [SHARED, SOLO, OPTED_OUT_EMAIL] } },
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        source: true,
        bookingId: true,
        createdAt: true,
      },
    });

  it('backfills opted-in bookings - lowercased, keep-oldest provenance, exclusions honoured', async () => {
    await prisma.$executeRawUnsafe(MIGRATION_SQL);

    const consents = await ourConsents();
    expect(consents).toHaveLength(2);

    const shared = consents.find((c) => c.email === SHARED);
    expect(shared).toBeDefined();
    // Provenance: the OLDEST opted-in booking, address canonicalized.
    expect(shared?.bookingId).toBe(oldestSharedBookingId);
    expect(shared?.source).toBe('checkout-newsletter-opt-in');

    const solo = consents.find((c) => c.email === SOLO);
    expect(solo?.source).toBe('checkout-newsletter-opt-in');

    // The no-tick address never entered the table.
    expect(consents.some((c) => c.email === OPTED_OUT_EMAIL)).toBe(false);
  });

  it('is idempotent: a second run changes nothing (G-17)', async () => {
    const before = await ourConsents();
    await prisma.$executeRawUnsafe(MIGRATION_SQL);
    const after = await ourConsents();
    // Same COUNT and the very same rows - ids and timestamps untouched.
    expect(after).toEqual(before);

    // And the global count is stable across the re-run too.
    const total = await prisma.emailConsent.count();
    await prisma.$executeRawUnsafe(MIGRATION_SQL);
    expect(await prisma.emailConsent.count()).toBe(total);
  });
});
