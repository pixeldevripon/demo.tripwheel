/**
 * Unit tests for CalendarFeedsService. Prisma and the effective-permission engine
 * are mocked. Focus: the per-kind permission bar, operator scoping, the flat-404
 * token contract, feed stability (so conditional GET can work at all), and the two
 * projections' handling of cancellations and local-to-UTC conversion.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  CalendarFeedKind,
  DepartureStatus,
  Permission,
  Role,
} from '@prisma/client';
import { CalendarFeedsService, mergeRanges } from './calendar-feeds.service';

/** A @db.Date storage value. */
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);
/** A @db.Time(0) storage value (time-only, epoch day). */
const time = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, h, m, 0));
};
/** A local wall-clock instant, the storage form for tourStartDateTime. */
const local = (iso: string) => new Date(`${iso}Z`);

const OPERATOR_ID = 'op-1';
const OWNER = { id: 'user-1', role: Role.TOUR_OPERATOR };

function mockPrisma() {
  return {
    operator: { findUnique: jest.fn(), create: jest.fn() },
    staffMember: { findUnique: jest.fn() },
    calendarFeed: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    booking: { findMany: jest.fn().mockResolvedValue([]) },
    departure: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

/** Grants everything unless a test narrows it. */
function mockPermissions(granted: Permission[] | 'all' = 'all') {
  return {
    hasPermissions: jest.fn((_user, required: Permission[]) => {
      const missing =
        granted === 'all' ? [] : required.filter((p) => !granted.includes(p));
      return Promise.resolve({ granted: missing.length === 0, missing });
    }),
  };
}

function make(
  prisma = mockPrisma(),
  permissions = mockPermissions(),
): [
  CalendarFeedsService,
  ReturnType<typeof mockPrisma>,
  ReturnType<typeof mockPermissions>,
] {
  // The owner resolves to OPERATOR_ID through Operator.userId in every test.
  prisma.operator.findUnique.mockResolvedValue({ id: OPERATOR_ID });
  const service = new CalendarFeedsService(
    prisma as never,
    permissions as never,
  );
  return [service, prisma, permissions];
}

function feedRow(over: Record<string, unknown> = {}) {
  return {
    id: 'feed-1',
    kind: CalendarFeedKind.DEPARTURES,
    label: null,
    token: 'tok-abc',
    lastFetchedAt: null,
    fetchCount: 0,
    createdAt: new Date(Date.UTC(2026, 6, 1)),
    ...over,
  };
}

describe('CalendarFeedsService', () => {
  beforeEach(() => {
    process.env.PUBLIC_API_URL = 'https://api.example.test';
  });

  // ── Permission bar ──────────────────────────────────────────────────────────

  describe('per-kind permissions', () => {
    it('lets an availability-only seat create a DEPARTURES feed', async () => {
      const [service, prisma] = make(
        mockPrisma(),
        mockPermissions([Permission.MANAGE_AVAILABILITY]),
      );
      prisma.calendarFeed.findUnique.mockResolvedValue(null);
      prisma.calendarFeed.create.mockResolvedValue(feedRow());

      await expect(
        service.create(OWNER, { kind: CalendarFeedKind.DEPARTURES }),
      ).resolves.toMatchObject({ kind: CalendarFeedKind.DEPARTURES });
    });

    // Minting the bookings URL hands traveller names to any link-holder, so it
    // costs more than the availability permission the route itself requires.
    it('refuses a BOOKINGS feed without VIEW_BOOKINGS', async () => {
      const [service] = make(
        mockPrisma(),
        mockPermissions([Permission.MANAGE_AVAILABILITY]),
      );
      await expect(
        service.create(OWNER, { kind: CalendarFeedKind.BOOKINGS }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('hides a feed kind the caller may not read instead of failing the list', async () => {
      const [service, prisma] = make(
        mockPrisma(),
        mockPermissions([Permission.MANAGE_AVAILABILITY]),
      );
      prisma.calendarFeed.findMany.mockResolvedValue([
        feedRow({ id: 'f-dep', kind: CalendarFeedKind.DEPARTURES }),
        feedRow({ id: 'f-book', kind: CalendarFeedKind.BOOKINGS }),
      ]);

      const feeds = await service.list(OWNER);
      expect(feeds.map((f) => f.id)).toEqual(['f-dep']);
    });
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('is idempotent - an existing live feed is returned, not duplicated', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findUnique.mockResolvedValue({
        id: 'feed-1',
        revokedAt: null,
      });
      prisma.calendarFeed.update.mockResolvedValue(feedRow());

      await service.create(OWNER, { kind: CalendarFeedKind.DEPARTURES });
      expect(prisma.calendarFeed.create).not.toHaveBeenCalled();
      expect(prisma.calendarFeed.update).toHaveBeenCalled();
    });

    // Reviving with the OLD token would silently un-revoke every subscription the
    // operator revoked it to kill.
    it('mints a NEW token when reviving a revoked feed', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findUnique.mockResolvedValue({
        id: 'feed-1',
        revokedAt: new Date(),
      });
      prisma.calendarFeed.update.mockResolvedValue(feedRow());

      await service.create(OWNER, { kind: CalendarFeedKind.DEPARTURES });
      const data = prisma.calendarFeed.update.mock.calls[0][0].data;
      expect(data.revokedAt).toBeNull();
      expect(typeof data.token).toBe('string');
      expect(data.token.length).toBeGreaterThanOrEqual(43); // 32 bytes base64url
    });

    it('returns a fully-formed subscribe URL', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findUnique.mockResolvedValue(null);
      prisma.calendarFeed.create.mockResolvedValue(
        feedRow({ token: 'tok-xyz' }),
      );

      const feed = await service.create(OWNER, {
        kind: CalendarFeedKind.DEPARTURES,
      });
      expect(feed.url).toBe(
        'https://api.example.test/api/v1/calendar-feeds/tok-xyz/calendar.ics',
      );
    });
  });

  describe('rotate and revoke', () => {
    it('rotates to a different token and resets the fetch stats', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findFirst.mockResolvedValue({
        id: 'feed-1',
        kind: CalendarFeedKind.DEPARTURES,
      });
      prisma.calendarFeed.update.mockResolvedValue(
        feedRow({ token: 'tok-new' }),
      );

      await service.rotate(OWNER, 'feed-1');
      const data = prisma.calendarFeed.update.mock.calls[0][0].data;
      expect(data.token).not.toBe('tok-abc');
      expect(data.fetchCount).toBe(0);
      expect(data.lastFetchedAt).toBeNull();
    });

    // Scoping is by (id, operatorId) - another operator's feed id must not resolve.
    it('404s on a feed belonging to another operator', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findFirst.mockResolvedValue(null);
      await expect(
        service.rotate(OWNER, 'someone-elses'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('soft-revokes rather than deleting, so the token can never be re-issued', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findFirst.mockResolvedValue({
        id: 'feed-1',
        kind: CalendarFeedKind.DEPARTURES,
      });
      prisma.calendarFeed.update.mockResolvedValue(feedRow());

      await service.revoke(OWNER, 'feed-1');
      expect(
        prisma.calendarFeed.update.mock.calls[0][0].data.revokedAt,
      ).toBeInstanceOf(Date);
    });
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  describe('render', () => {
    it('404s on an unknown token', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findUnique.mockResolvedValue(null);
      await expect(service.render('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    // Same shape of failure as "unknown", so the response cannot be used as an
    // oracle for which tokens once existed.
    it('404s on a revoked token', async () => {
      const [service, prisma] = make();
      prisma.calendarFeed.findUnique.mockResolvedValue({
        id: 'feed-1',
        kind: CalendarFeedKind.DEPARTURES,
        operatorId: OPERATOR_ID,
        revokedAt: new Date(),
        createdAt: new Date(),
        operator: { companyInfo: { companyName: 'Miss Ann' } },
      });
      await expect(service.render('tok-abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('renders an empty but valid calendar for an operator with nothing scheduled', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.DEPARTURES);

      const { body, etag } = await service.render('tok-abc');
      expect(body).toContain('BEGIN:VCALENDAR');
      expect(body).not.toContain('BEGIN:VEVENT');
      expect(body).toContain('X-WR-CALNAME:Miss Ann - Departures');
      expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    });

    // Without this, Google re-downloads the whole year on every single poll.
    it('produces a stable ETag across renders of unchanged data', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.DEPARTURES);
      prisma.departure.findMany.mockResolvedValue([departureRow()]);

      const first = await service.render('tok-abc');
      const second = await service.render('tok-abc');
      expect(second.etag).toBe(first.etag);
      expect(second.body).toBe(first.body);
    });

    it('changes the ETag when the underlying data changes', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.DEPARTURES);
      prisma.departure.findMany.mockResolvedValue([departureRow()]);
      const before = await service.render('tok-abc');

      prisma.departure.findMany.mockResolvedValue([
        departureRow({
          bookedCount: 5,
          updatedAt: new Date(Date.UTC(2026, 6, 3)),
        }),
      ]);
      const after = await service.render('tok-abc');
      expect(after.etag).not.toBe(before.etag);
    });
  });

  /**
   * `recordFetch` is fire-and-forget, which makes it exactly the kind of call that can
   * silently never run - a Prisma query is lazy until something subscribes to it.
   */
  describe('recordFetch', () => {
    it('increments the counters for a live feed', () => {
      const [service, prisma] = make();
      service.recordFetch('tok-abc');

      expect(prisma.calendarFeed.updateMany).toHaveBeenCalledTimes(1);
      const call = prisma.calendarFeed.updateMany.mock.calls[0][0];
      // Scoped to live feeds so a revoked token cannot keep moving the numbers.
      expect(call.where).toEqual({ token: 'tok-abc', revokedAt: null });
      expect(call.data.fetchCount).toEqual({ increment: 1 });
      expect(call.data.lastFetchedAt).toBeInstanceOf(Date);
    });

    // A stats write must never cost the operator their calendar.
    it('swallows a write failure instead of rejecting', () => {
      const prisma = mockPrisma();
      prisma.calendarFeed.updateMany.mockRejectedValue(new Error('db down'));
      const [service] = make(prisma);

      expect(() => service.recordFetch('tok-abc')).not.toThrow();
    });
  });

  describe('departures projection', () => {
    it('converts local wall-clock to a real UTC instant and reports fill', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.DEPARTURES);
      prisma.departure.findMany.mockResolvedValue([departureRow()]);

      const { body } = await service.render('tok-abc');
      // 08:00 local on Curacao (AST, UTC-4) is 12:00Z.
      expect(body).toContain('DTSTART:20260801T120000Z');
      expect(body).toContain('DTEND:20260801T200000Z'); // +480 minutes
      expect(body).toContain('UID:departure-dep-1@island.tours');
      expect(body).toContain('Klein Curacao 08:00 - 4/20 booked');
    });

    it('publishes a cancelled departure as cancelled rather than dropping it', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.DEPARTURES);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({ status: DepartureStatus.CANCELLED }),
      ]);

      const { body } = await service.render('tok-abc');
      expect(body).toContain('BEGIN:VEVENT');
      expect(body).toContain('STATUS:CANCELLED');
    });

    it('falls back to an hour when the tour records no duration', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.DEPARTURES);
      prisma.departure.findMany.mockResolvedValue([
        departureRow({
          tour: {
            name: 'Klein Curacao',
            timeZone: 'America/Curacao',
            durationMinutesTo: null,
            durationMinutesFrom: null,
          },
        }),
      ]);

      const { body } = await service.render('tok-abc');
      expect(body).toContain('DTEND:20260801T130000Z');
    });
  });

  describe('bookings projection', () => {
    it('renders guests, ref and lead traveller but never contact details', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.BOOKINGS);
      prisma.booking.findMany.mockResolvedValue([bookingRow()]);

      const { body } = await service.render('tok-abc');
      expect(body).toContain('Klein Curacao - 2 guests');
      expect(body).toContain('Ref: IT-2026-00042');
      expect(body).toContain('Lead traveller: Ada Lovelace');
      expect(body).not.toContain('ada@example.test');
      expect(body).not.toContain('+5999');
    });

    it('publishes a cancelled booking as cancelled', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.BOOKINGS);
      prisma.booking.findMany.mockResolvedValue([
        bookingRow({ status: BookingStatus.CANCELLED }),
      ]);

      const { body } = await service.render('tok-abc');
      expect(body).toContain('STATUS:CANCELLED');
      expect(body).toContain('CANCELLED');
    });

    // Pinning it to a guessed moment would put the tour on the operator's calendar
    // at the wrong hour, which is worse than leaving it off.
    it('skips a booking with no resolvable absolute start', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.BOOKINGS);
      prisma.booking.findMany.mockResolvedValue([
        bookingRow({ tourStartDateTime: null }),
        bookingRow({ tourTimeZone: null }),
      ]);

      const { body } = await service.render('tok-abc');
      expect(body).not.toContain('BEGIN:VEVENT');
    });

    it('flags test-mode bookings so they cannot be mistaken for real ones', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.BOOKINGS);
      prisma.booking.findMany.mockResolvedValue([
        bookingRow({ testMode: true }),
      ]);

      const { body } = await service.render('tok-abc');
      expect(body).toContain('[TEST]');
    });

    it('runs a full year forward and scopes to the operator', async () => {
      const [service, prisma] = make();
      liveFeed(prisma, CalendarFeedKind.BOOKINGS);

      await service.render('tok-abc');
      const where = prisma.booking.findMany.mock.calls[0][0].where;
      expect(spanDays(where.localDate)).toBe(394); // 30 back + 364 forward
      expect(where.operatorId).toBe(OPERATOR_ID);
    });
  });

  /**
   * Departures are the cross product of tour x date x start time, so a year of them
   * measured 6,000 events / 2.1 MB against real data - past what calendar clients
   * subscribe to comfortably. The shorter horizon is the fix, and it is exactly the
   * materializer's default projection window.
   */
  describe('feed window', () => {
    it('stops the departures feed at 90 days while bookings run a year', async () => {
      const [service, prisma] = make();

      liveFeed(prisma, CalendarFeedKind.DEPARTURES);
      await service.render('tok-abc');
      expect(
        spanDays(prisma.departure.findMany.mock.calls[0][0].where.date),
      ).toBe(
        120, // 30 back + 90 forward
      );

      liveFeed(prisma, CalendarFeedKind.BOOKINGS);
      await service.render('tok-abc');
      expect(
        spanDays(prisma.booking.findMany.mock.calls[0][0].where.localDate),
      ).toBe(394);
    });
  });
});

function spanDays(range: { gte: Date; lte: Date }): number {
  return (range.lte.getTime() - range.gte.getTime()) / 86_400_000;
}

describe('CHANNEL feed - what an OTA receives', () => {
  const channelFeed = (prisma: ReturnType<typeof mockPrisma>) => {
    prisma.calendarFeed.findUnique.mockResolvedValue({
      id: 'feed-c',
      kind: CalendarFeedKind.CHANNEL,
      operatorId: OPERATOR_ID,
      tourId: 'tour-1',
      revokedAt: null,
      createdAt: new Date(Date.UTC(2026, 6, 1)),
      operator: { companyInfo: { companyName: 'Miss Ann' } },
      tour: { name: 'Klein Curacao', timeZone: 'America/Curacao' },
    });
  };

  const dep = (date: string, over: Record<string, unknown> = {}) => ({
    date: day(date),
    status: DepartureStatus.OPEN,
    capacity: 60,
    bookedCount: 0,
    updatedAt: new Date(Date.UTC(2026, 6, 2)),
    ...over,
  });

  // The whole reason this feed exists as a separate kind.
  it('contains no traveller data of any kind', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([
      dep('2026-08-14', { status: DepartureStatus.SOLD_OUT, bookedCount: 60 }),
    ]);

    const { body } = await service.render('tok-abc');
    expect(body).toContain('SUMMARY:Unavailable');
    expect(body).not.toMatch(/Ada|Lovelace|guest|Ref:|IT-\d/);
  });

  // One seat sold on a 60-seat catamaran must NOT close the date on Airbnb -
  // that would cost the other 59.
  it('leaves a partly booked date open', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([
      dep('2026-08-14', { bookedCount: 1 }),
    ]);

    const { body } = await service.render('tok-abc');
    expect(body).not.toContain('BEGIN:VEVENT');
  });

  it('blocks a date once nothing on it can still be sold', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([
      dep('2026-08-14', { bookedCount: 60 }),
      dep('2026-08-14', { status: DepartureStatus.CLOSED }),
    ]);

    const { body } = await service.render('tok-abc');
    expect(body).toContain('DTSTART;VALUE=DATE:20260814');
  });

  // Any remaining seat anywhere that day means the date is still sellable.
  it('keeps a date open when one of its departures still has room', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([
      dep('2026-08-14', { bookedCount: 60 }), // full
      dep('2026-08-14', { bookedCount: 3 }), // still sellable
    ]);

    const { body } = await service.render('tok-abc');
    expect(body).not.toContain('BEGIN:VEVENT');
  });

  // A day we simply do not run is not a day the operator is busy. Publishing it
  // would block dates on the channel for no reason.
  it('says nothing about days with no departures at all', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([]);

    const { body } = await service.render('tok-abc');
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(body).not.toContain('BEGIN:VEVENT');
  });

  it('emits all-day values, not timestamps', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([
      dep('2026-08-14', { status: DepartureStatus.CLOSED }),
    ]);

    const { body } = await service.render('tok-abc');
    // DTEND is EXCLUSIVE, so one blocked day ends on the 15th.
    expect(body).toContain('DTSTART;VALUE=DATE:20260814');
    expect(body).toContain('DTEND;VALUE=DATE:20260815');
    expect(body).not.toMatch(/DTSTART:\d{8}T/);
  });

  it('collapses consecutive blocked days into one range', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    prisma.departure.findMany.mockResolvedValue([
      dep('2026-08-14', { status: DepartureStatus.CLOSED }),
      dep('2026-08-15', { status: DepartureStatus.CLOSED }),
      dep('2026-08-16', { status: DepartureStatus.CLOSED }),
      dep('2026-08-18', { status: DepartureStatus.CLOSED }), // gap on the 17th
    ]);

    const { body } = await service.render('tok-abc');
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(body).toContain('DTSTART;VALUE=DATE:20260814');
    expect(body).toContain('DTEND;VALUE=DATE:20260817'); // covers 14-16
    expect(body).toContain('DTSTART;VALUE=DATE:20260818');
  });

  it('names the calendar after the tour, not the operator', async () => {
    const [service, prisma] = make();
    channelFeed(prisma);
    const { body } = await service.render('tok-abc');
    expect(body).toContain('X-WR-CALNAME:Klein Curacao - booked');
  });
});

describe('mergeRanges', () => {
  it('merges consecutive days and splits on a gap', () => {
    expect(mergeRanges(['2026-08-14', '2026-08-15', '2026-08-17'])).toEqual([
      { start: '2026-08-14', end: '2026-08-15' },
      { start: '2026-08-17', end: '2026-08-17' },
    ]);
  });

  it('handles a month boundary', () => {
    expect(mergeRanges(['2026-08-31', '2026-09-01'])).toEqual([
      { start: '2026-08-31', end: '2026-09-01' },
    ]);
  });

  it('handles a leap day', () => {
    expect(mergeRanges(['2028-02-28', '2028-02-29', '2028-03-01'])).toEqual([
      { start: '2028-02-28', end: '2028-03-01' },
    ]);
  });

  it('returns nothing for nothing', () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

// ── fixtures ──────────────────────────────────────────────────────────────────

function liveFeed(
  prisma: ReturnType<typeof mockPrisma>,
  kind: CalendarFeedKind,
) {
  prisma.calendarFeed.findUnique.mockResolvedValue({
    id: 'feed-1',
    kind,
    operatorId: OPERATOR_ID,
    revokedAt: null,
    createdAt: new Date(Date.UTC(2026, 6, 1)),
    operator: { companyInfo: { companyName: 'Miss Ann' } },
  });
}

function departureRow(over: Record<string, unknown> = {}) {
  return {
    id: 'dep-1',
    date: day('2026-08-01'),
    startTime: time('08:00'),
    capacity: 20,
    bookedCount: 4,
    status: DepartureStatus.OPEN,
    updatedAt: new Date(Date.UTC(2026, 6, 2)),
    tour: {
      name: 'Klein Curacao',
      timeZone: 'America/Curacao',
      durationMinutesTo: 480,
      durationMinutesFrom: 420,
    },
    ...over,
  };
}

function bookingRow(over: Record<string, unknown> = {}) {
  return {
    publicRef: 'pub-1',
    displayRef: 'IT-2026-00042',
    status: BookingStatus.CONFIRMED,
    testMode: false,
    tourStartDateTime: local('2026-08-01T08:00:00'),
    tourEndDateTime: local('2026-08-01T16:00:00'),
    tourTimeZone: 'America/Curacao',
    pickupWindowStart: null,
    pickupWindowEnd: null,
    contactFirstName: 'Ada',
    contactLastName: 'Lovelace',
    updatedAt: new Date(Date.UTC(2026, 6, 2)),
    tour: { name: 'Klein Curacao' },
    _count: { unitItems: 2 },
    ...over,
  };
}
