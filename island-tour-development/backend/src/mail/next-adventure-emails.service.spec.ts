import { EmailAudience, EmailStream, EmailTemplateKey } from '@prisma/client';
import { NextAdventureEmailsService } from './next-adventure-emails.service';

/**
 * The WP-G MK-1 sweep contract (G-10…G-16): the ANY-day Curaçao-morning
 * window, the 72h dueness computed in the booking's own zone, the G-11
 * consent gate (empty consent table = ZERO sends, zero availability I/O),
 * the full G-12 suppression matrix with machine-readable reasons, the
 * availability-first card query bounds, and the one-click unsubscribe wiring.
 *
 * Window control uses REAL instants (Curaçao is fixed UTC-4). 2026-08-10 is
 * a MONDAY: 14:30Z = 10:30 local, which the Tue–Thu lifecycle window
 * rejects — the marketing window accepting it is itself part of the spec.
 */
const MONDAY_MORNING_OPEN = new Date('2026-08-10T14:30:00.000Z'); // Mon 10:30 local
const MONDAY_MIDDAY_CLOSED = new Date('2026-08-10T16:30:00.000Z'); // Mon 12:30 local

const HOUR = 3_600_000;

/** Due at MONDAY_MORNING_OPEN: local now 10:30 Aug 10, minus 72h = Aug 7 10:30. */
const DUE_TOUR_END = new Date('2026-08-06T17:00:00.000Z'); // local wall clock
const NOT_DUE_TOUR_END = new Date('2026-08-08T09:00:00.000Z');

const bookingRow = (over: Record<string, unknown> = {}) => ({
  id: 'bk1',
  displayRef: 'IT-2026-04821',
  status: 'CONFIRMED',
  createdAt: new Date('2026-07-01T12:00:00.000Z'),
  contactEmail: 'Traveller@Example.com', // mixed case on purpose
  customerLocale: 'en',
  tourEndDateTime: DUE_TOUR_END,
  tourTimeZone: 'America/Curacao',
  utcCancellationRequestedAt: null,
  utcCancelledAt: null,
  tourId: 'tour-booked',
  review: null,
  tour: {
    name: 'Klein Curacao Day Trip',
    timeZone: 'America/Curacao',
    destinationId: 'dest-cur',
    destination: { name: 'Curacao', slug: 'curacao' },
    categories: [{ categoryId: 'cat-water' }],
  },
  ...over,
});

const cardRow = (
  id: string,
  categoryId: string | null,
  qualityScore: number,
) => ({
  id,
  name: `Tour ${id}`,
  slug: id,
  priceFrom: 89,
  defaultCurrency: 'USD',
  aggregateRating: 4.8,
  aggregateReviewCount: 212,
  durationMinutesFrom: 240,
  qualityScore,
  images: [{ url: `https://cdn.test/${id}.jpg` }],
  categories: categoryId ? [{ categoryId }] : [],
  translations: [{ locale: 'en', shortDescription: 'A one-line teaser.' }],
  departures: [{ date: new Date('2026-08-12T00:00:00.000Z') }],
});

const THREE_CARDS = [
  cardRow('t-contrast', 'cat-land', 70),
  cardRow('t-adjacent', 'cat-water', 60),
  cardRow('t-flagship', 'cat-culture', 95),
];

describe('NextAdventureEmailsService', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    booking: { findMany: jest.Mock; count: jest.Mock };
    tour: { findMany: jest.Mock; count: jest.Mock };
    emailConsent: { findUnique: jest.Mock };
    siteInfo: { findFirst: jest.Mock };
  };
  let mail: { sendNextAdventureEmail: jest.Mock };
  let emailLog: {
    claimAndSend: jest.Mock;
    recordSuppressed: jest.Mock;
    isOptedOut: jest.Mock;
  };
  let prefs: { issueUnsubscribeToken: jest.Mock; unsubscribeWiring: jest.Mock };
  let svc: NextAdventureEmailsService;

  beforeEach(() => {
    prisma = {
      // Tagged-template mock: the candidate query (NOT EXISTS anti-join)
      // returns ids; the booked-again probe (count(*)) returns n=0.
      $queryRaw: jest
        .fn()
        .mockImplementation((strings: TemplateStringsArray) =>
          strings.join('?').includes('count(*)')
            ? Promise.resolve([{ n: 0n }])
            : Promise.resolve([{ id: 'bk1' }]),
        ),
      booking: {
        findMany: jest.fn().mockResolvedValue([bookingRow()]),
        count: jest.fn().mockResolvedValue(0), // no later booking by default
      },
      tour: {
        findMany: jest.fn().mockResolvedValue(THREE_CARDS),
        count: jest.fn().mockResolvedValue(25),
      },
      emailConsent: {
        // Consent EXISTS by default so the matrix isolates one reason per test.
        findUnique: jest.fn().mockResolvedValue({ id: 'consent-1' }),
      },
      siteInfo: { findFirst: jest.fn().mockResolvedValue({ logo: null }) },
    };
    mail = {
      sendNextAdventureEmail: jest
        .fn()
        .mockResolvedValue({ providerMessageId: 'resend-mk1' }),
    };
    emailLog = {
      claimAndSend: jest.fn(async (input: { send: () => Promise<unknown> }) => {
        await input.send();
        return { outcome: 'sent', providerMessageId: null };
      }),
      recordSuppressed: jest.fn().mockResolvedValue({ recorded: true }),
      isOptedOut: jest.fn().mockResolvedValue(false),
    };
    prefs = {
      issueUnsubscribeToken: jest.fn().mockResolvedValue('tok-mk1'),
      unsubscribeWiring: jest.fn().mockResolvedValue({
        optOutUrl: 'http://localhost:3000/unsubscribe/tok-mk1',
        headers: {
          'List-Unsubscribe':
            '<http://localhost:5050/api/v1/email/unsubscribe/tok-mk1>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    };

    svc = new NextAdventureEmailsService(
      prisma as never,
      mail as never,
      emailLog as never,
      prefs as never,
    );
  });

  const suppressionReasons = () =>
    emailLog.recordSuppressed.mock.calls.map(
      (c: [{ reason: string }]) => c[0].reason,
    );

  // ── Window (G-10) ───────────────────────────────────────────────────────────

  it('outside the Curaçao morning: no candidate query, nothing written', async () => {
    await svc.sweep(MONDAY_MIDDAY_CLOSED);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).not.toHaveBeenCalled();
  });

  it('a MONDAY morning is open — the marketing window is any-day, not Tue–Thu', async () => {
    await svc.sweep(MONDAY_MORNING_OPEN);
    // Two raw queries per sendable candidate tick: the candidate anti-join
    // and the indexed booked-again probe.
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
  });

  it('pins the coarse SQL bounds: cutoff = now - 72h + 14h slack, horizon 14d beyond', async () => {
    await svc.sweep(MONDAY_MORNING_OPEN);
    const values = prisma.$queryRaw.mock.calls[0].slice(1) as unknown[];
    const dates = values.filter((v): v is Date => v instanceof Date);
    expect(dates).toContainEqual(
      new Date(MONDAY_MORNING_OPEN.getTime() - 72 * HOUR + 14 * HOUR),
    );
    expect(dates).toContainEqual(
      new Date(
        MONDAY_MORNING_OPEN.getTime() - 72 * HOUR - 14 * 24 * HOUR - 14 * HOUR,
      ),
    );
    expect(values).toContain(EmailTemplateKey.MK1_NEXT_ADVENTURE);
  });

  // ── Dueness (G-10) ──────────────────────────────────────────────────────────

  it('a coarse match not yet 72h past tour end in ITS OWN zone is "not yet": nothing written', async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ tourEndDateTime: NOT_DUE_TOUR_END }),
    ]);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).not.toHaveBeenCalled();
  });

  it('no resolvable zone = not due, never a guess (BK-3 rule): nothing written', async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({
        tourTimeZone: null,
        tour: { ...bookingRow().tour, timeZone: null },
      }),
    ]);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(emailLog.recordSuppressed).not.toHaveBeenCalled();
  });

  // ── The G-12 suppression matrix, one reason row each ────────────────────────

  it('cancelled (status left CONFIRMED/REDEEMED) → SUPPRESSED "cancelled"', async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ status: 'CANCELLED' }),
    ]);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(suppressionReasons()).toEqual(['cancelled']);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });

  it('a pending cancellation request → SUPPRESSED "cancellation-pending"', async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({
        utcCancellationRequestedAt: new Date('2026-08-08T10:00:00.000Z'),
      }),
    ]);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(suppressionReasons()).toEqual(['cancellation-pending']);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });

  it('a 1–2★ review → SUPPRESSED "low-star-review"; a 3★ one does not suppress', async () => {
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ review: { rating: 2 } }),
    ]);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(suppressionReasons()).toEqual(['low-star-review']);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();

    emailLog.recordSuppressed.mockClear();
    prisma.booking.findMany.mockResolvedValue([
      bookingRow({ review: { rating: 3 } }),
    ]);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(emailLog.recordSuppressed).not.toHaveBeenCalled();
    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
  });

  it('a committed later booking by the same address → SUPPRESSED "booked-again"', async () => {
    prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
      strings.join('?').includes('count(*)')
        ? Promise.resolve([{ n: 1n }])
        : Promise.resolve([{ id: 'bk1' }]),
    );
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(suppressionReasons()).toEqual(['booked-again']);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    // The rebook probe is scoped raw SQL on lower("contactEmail") so the
    // expression index serves it (perf review High): same address, created
    // AFTER this booking, committed statuses only, never counting itself.
    const probeCall = prisma.$queryRaw.mock.calls.find((c: unknown[]) =>
      (c[0] as TemplateStringsArray).join('?').includes('count(*)'),
    );
    expect(probeCall).toBeDefined();
    const sql = (probeCall![0] as TemplateStringsArray).join('?');
    expect(sql).toContain('lower(b."contactEmail")');
    const params = probeCall!.slice(1) as unknown[];
    expect(params).toEqual(
      expect.arrayContaining([
        'traveller@example.com',
        'bk1',
        new Date('2026-07-01T12:00:00.000Z'),
      ]),
    );
  });

  it('MARKETING opt-out → SUPPRESSED "opted-out"', async () => {
    emailLog.isOptedOut.mockResolvedValue(true);
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(suppressionReasons()).toEqual(['opted-out']);
    expect(emailLog.isOptedOut).toHaveBeenCalledWith(
      'traveller@example.com',
      EmailAudience.TRAVELLER,
      EmailStream.MARKETING,
    );
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });

  it('fewer than three qualifying tours → SUPPRESSED "insufficient-open-tours" (G-07)', async () => {
    prisma.tour.findMany.mockResolvedValue(THREE_CARDS.slice(0, 2));
    await svc.sweep(MONDAY_MORNING_OPEN);
    expect(suppressionReasons()).toEqual(['insufficient-open-tours']);
    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
  });

  // ── The G-11 gate: the launch switch is the data ────────────────────────────

  it('EMPTY consent table ⇒ ZERO sends: every candidate suppressed "no-consent", no availability I/O', async () => {
    prisma.emailConsent.findUnique.mockResolvedValue(null);
    prisma.booking.findMany.mockResolvedValue([
      bookingRow(),
      bookingRow({ id: 'bk2', displayRef: 'IT-2026-04822' }),
    ]);
    prisma.$queryRaw.mockResolvedValue([{ id: 'bk1' }, { id: 'bk2' }]);

    await svc.sweep(MONDAY_MORNING_OPEN);

    expect(emailLog.claimAndSend).not.toHaveBeenCalled();
    expect(mail.sendNextAdventureEmail).not.toHaveBeenCalled();
    expect(suppressionReasons()).toEqual(['no-consent', 'no-consent']);
    // The gate sits BEFORE availability: no card query ever ran.
    expect(prisma.tour.findMany).not.toHaveBeenCalled();
    // The consent read is keyed on the lowercased address (plan §2.3).
    expect(prisma.emailConsent.findUnique).toHaveBeenCalledWith({
      where: { email: 'traveller@example.com' },
      select: { id: true },
    });
  });

  // ── The happy path (G-13/G-14) ──────────────────────────────────────────────

  it('sends through claimAndSend(MK1, bookingId, MARKETING) with one-click unsubscribe headers', async () => {
    await svc.sweep(MONDAY_MORNING_OPEN);

    expect(emailLog.claimAndSend).toHaveBeenCalledTimes(1);
    const claim = (
      emailLog.claimAndSend.mock.calls[0] as [Record<string, unknown>]
    )[0];
    expect(claim).toMatchObject({
      templateKey: EmailTemplateKey.MK1_NEXT_ADVENTURE,
      scopeId: 'bk1',
      toEmail: 'traveller@example.com',
      stream: EmailStream.MARKETING,
      locale: 'en',
    });

    expect(prefs.unsubscribeWiring).toHaveBeenCalledWith(
      'traveller@example.com',
      EmailAudience.TRAVELLER,
      EmailStream.MARKETING,
    );

    expect(mail.sendNextAdventureEmail).toHaveBeenCalledTimes(1);
    const [to, subject, context, text, headers] = mail.sendNextAdventureEmail
      .mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
      string,
      Record<string, string>,
    ];
    expect(to).toBe('traveller@example.com');
    expect(subject).toBe(
      'Where our guides send people after Klein Curacao Day Trip',
    );
    // G-14: env-derived bases + the server-minted token, one-click compliant.
    expect(headers['List-Unsubscribe']).toMatch(
      /^<.*\/api\/v1\/email\/unsubscribe\/tok-mk1>$/,
    );
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(String(context.unsubscribeUrl)).toMatch(/\/unsubscribe\/tok-mk1$/);
    // Three cards rendered from the availability-checked rows.
    expect(context.cardOneName).toBe('Tour t-contrast');
    expect(context.cardTwoName).toBe('Tour t-adjacent');
    expect(context.cardThreeName).toBe('Tour t-flagship');
    expect(context.seeAllLabel).toBe('See all 25 tours on Curacao');
    expect(text).toContain('Still have days left on the island?');
  });

  it('queries availability for OPEN departures inside the island 7-day window, canonical order, booked tour excluded', async () => {
    await svc.sweep(MONDAY_MORNING_OPEN);
    const arg = (
      prisma.tour.findMany.mock.calls[0] as [
        {
          where: {
            id?: unknown;
            status: string;
            isActive: boolean;
            isBookable: boolean;
            departures: {
              some: { status: string; date: { gte: Date; lt: Date } };
            };
          };
          orderBy: unknown;
        },
      ]
    )[0];
    // The booked tour is excluded IN MEMORY (the per-tick cache is shared
    // across same-destination candidates), never in the query.
    expect(arg.where.id).toBeUndefined();
    expect(arg.where.status).toBe('LIVE');
    // Listing parity: never feature what the site delists.
    expect(arg.where.isActive).toBe(true);
    expect(arg.where.isBookable).toBe(true);
    expect(arg.where.departures.some.status).toBe('OPEN');
    // Island TOMORROW (send morning's stored-OPEN boats may already be at
    // sea / inside cutoff) through exactly seven island dates, end-exclusive.
    expect(arg.where.departures.some.date.gte).toEqual(
      new Date('2026-08-11T00:00:00.000Z'),
    );
    expect(arg.where.departures.some.date.lt).toEqual(
      new Date('2026-08-18T00:00:00.000Z'),
    );
    // Canonical listing order: sponsorship first (tours_ranking_idx).
    expect(arg.orderBy).toEqual([
      { isSponsored: 'desc' },
      { tierRank: 'asc' },
      { qualityScore: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('a transport failure is reported, never thrown out of the sweep', async () => {
    emailLog.claimAndSend.mockResolvedValue({
      outcome: 'failed',
      error: 'boom',
    });
    await expect(svc.sweep(MONDAY_MORNING_OPEN)).resolves.toBeUndefined();
  });
});
