/**
 * Unit tests for CalendarSyncService. Prisma, the reconciler and the network are
 * mocked.
 *
 * The property under the most pressure here is the failure rule: **a fetch or
 * parse failure must never remove a block**. Releasing dates because a channel
 * had a bad afternoon would reopen inventory the operator already sold there.
 */
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CalendarImportMode,
  CalendarPlatform,
  CalendarSubscriptionStatus,
  IcalSyncOutcome,
  IcalSyncTrigger,
  Role,
} from '@prisma/client';
import { CalendarSyncService } from './calendar-sync.service';
import { encrypt } from '@/common/utils/crypto.util';
import type { SafeFetchResult } from '@/common/net/safe-http.util';

/**
 * The fetcher is injected, so the network is replaced at the seam rather than by
 * mocking a module. Everything else in the pipeline stays real.
 */
const mockedFetch = jest.fn<Promise<SafeFetchResult>, [string, unknown?]>();

const OWNER = { id: 'user-1', role: Role.TOUR_OPERATOR };
const TOUR = 'tour-1';
const SUB = 'sub-1';
const FEED_URL = 'https://www.airbnb.com/calendar/ical/1.ics?s=abc';

const ics = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//test//EN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

const reserved = (start: string, end: string, uid = 'e1') =>
  [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    'SUMMARY:Reserved',
    'END:VEVENT',
  ].join('\r\n');

function subscriptionRow(over: Record<string, unknown> = {}) {
  return {
    id: SUB,
    tourId: TOUR,
    platform: CalendarPlatform.AIRBNB,
    platformLabel: null,
    url: encrypt(FEED_URL),
    urlHash: 'hash',
    importMode: CalendarImportMode.CLOSE_DATES,
    status: CalendarSubscriptionStatus.ACTIVE,
    autoSyncEnabled: true,
    syncIntervalMinutes: 60,
    nextPollAt: null,
    lastPolledAt: null,
    lastSuccessAt: null,
    lastEtag: null,
    lastModified: null,
    lastContentHash: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    failureCount: 0,
    lastEventCount: 0,
    excludeFromExport: false,
    notes: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date(),
    disconnectedAt: null,
    tour: {
      id: TOUR,
      name: 'Klein Curacao Catamaran',
      operatorId: 'op-1',
      timeZone: 'America/Curacao',
      durationMinutesTo: 480,
      durationMinutesFrom: 420,
    },
    ...over,
  };
}

function mockPrisma() {
  return {
    tour: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ operatorId: 'op-1', timeZone: 'America/Curacao' }),
    },
    operator: { findUnique: jest.fn().mockResolvedValue({ id: 'op-1' }) },
    // Read when addressing an alert email; a site with no logo is normal.
    siteInfo: { findFirst: jest.fn().mockResolvedValue({ logo: null }) },
    staffMember: { findUnique: jest.fn() },
    calendarSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue(subscriptionRow()),
    },
    departure: { findMany: jest.fn().mockResolvedValue([]) },
    availabilityException: { count: jest.fn().mockResolvedValue(0) },
    calendarConflict: { count: jest.fn().mockResolvedValue(0) },
    icalSyncLog: {
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

const mockInbox = () => ({ notify: jest.fn() });

const mockReconciler = () => ({
  reconcile: jest.fn().mockResolvedValue({
    blocksCreated: 0,
    blocksRemoved: 0,
    eventsAdded: 0,
    eventsRemoved: 0,
    conflictsDetected: 0,
  }),
  releaseBlocks: jest.fn().mockResolvedValue({ released: 0 }),
  convertBlocksToManual: jest.fn().mockResolvedValue({ converted: 0 }),
});

const mockMail = () => ({ sendBookingNoticeEmail: jest.fn() });

function make() {
  const prisma = mockPrisma();
  const reconciler = mockReconciler();
  const inbox = mockInbox();
  const mail = mockMail();
  const service = new CalendarSyncService(
    prisma as never,
    reconciler as never,
    inbox as never,
    // No cast needed - the stub already satisfies FeedFetcherService.
    { fetch: mockedFetch },
    mail as never,
  );
  return { service, prisma, reconciler, inbox, mail };
}

/** Pull the update payload sent to calendarSubscription inside a $transaction. */
function subscriptionUpdate(prisma: ReturnType<typeof mockPrisma>) {
  const calls = prisma.calendarSubscription.update.mock.calls;
  return calls[calls.length - 1]?.[0]?.data as Record<string, unknown>;
}

beforeEach(() => {
  mockedFetch.mockReset();
  // $transaction here receives an ARRAY of promises; the mocked delegates have
  // already run by the time it is called, so resolving is enough.
  process.env.ENCRYPTION_KEY ??= 'a'.repeat(64);
});

describe('CalendarSyncService', () => {
  describe('create', () => {
    it('stores the URL encrypted, never in plaintext', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(null);
      prisma.calendarSubscription.create.mockResolvedValue(subscriptionRow());

      await service.create(OWNER, {
        tourId: TOUR,
        platform: CalendarPlatform.AIRBNB,
        url: FEED_URL,
      });

      const { data } = prisma.calendarSubscription.create.mock.calls[0][0];
      expect(data.url).not.toContain('airbnb.com');
      expect(data.url.split(':')).toHaveLength(3); // iv:tag:ciphertext
    });

    // Ciphertext is non-deterministic (random IV), so equality has to be checked
    // against a hash of the normalized URL instead.
    it('records a hash of the normalized URL for duplicate detection', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(null);
      prisma.calendarSubscription.create.mockResolvedValue(subscriptionRow());

      await service.create(OWNER, {
        tourId: TOUR,
        platform: CalendarPlatform.AIRBNB,
        url: FEED_URL,
      });

      const { data } = prisma.calendarSubscription.create.mock.calls[0][0];
      expect(data.urlHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('defaults to WARN_ONLY, the safe mode for multi-capacity tours', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(null);
      prisma.calendarSubscription.create.mockResolvedValue(subscriptionRow());

      await service.create(OWNER, {
        tourId: TOUR,
        platform: CalendarPlatform.AIRBNB,
        url: FEED_URL,
      });

      const { data } = prisma.calendarSubscription.create.mock.calls[0][0];
      expect(data.importMode).toBe(CalendarImportMode.WARN_ONLY);
    });

    it('refuses a URL the SSRF guard rejects', async () => {
      const { service } = make();
      await expect(
        service.create(OWNER, {
          tourId: TOUR,
          platform: CalendarPlatform.AIRBNB,
          url: 'https://169.254.169.254/latest/meta-data/',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires a label when the platform is OTHER', async () => {
      const { service } = make();
      await expect(
        service.create(OWNER, {
          tourId: TOUR,
          platform: CalendarPlatform.OTHER,
          url: FEED_URL,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a duplicate of a live connection', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue({
        id: 'other',
        disconnectedAt: null,
      });
      await expect(
        service.create(OWNER, {
          tourId: TOUR,
          platform: CalendarPlatform.AIRBNB,
          url: FEED_URL,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Reviving keeps the sync history attached instead of orphaning it.
    it('revives a disconnected connection to the same URL', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue({
        id: 'old',
        disconnectedAt: new Date(),
      });

      await service.create(OWNER, {
        tourId: TOUR,
        platform: CalendarPlatform.AIRBNB,
        url: FEED_URL,
      });

      expect(prisma.calendarSubscription.create).not.toHaveBeenCalled();
      const { data } = prisma.calendarSubscription.update.mock.calls[0][0];
      expect(data.disconnectedAt).toBeNull();
    });

    it('enforces the per-tour ceiling', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.count.mockResolvedValue(10);
      await expect(
        service.create(OWNER, {
          tourId: TOUR,
          platform: CalendarPlatform.AIRBNB,
          url: FEED_URL,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('validate', () => {
    it('reports a parseable feed with its event count and range', async () => {
      const { service } = make();
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body: ics(reserved('20260814', '20260818')),
        contentType: 'text/calendar',
        etag: null,
        lastModified: null,
        sizeBytes: 400,
        finalUrl: FEED_URL,
      });

      const result = await service.validate(OWNER, {
        tourId: TOUR,
        url: FEED_URL,
      });
      expect(result.valid).toBe(true);
      expect(result.eventCount).toBe(1);
      expect(result.firstEvent).toBe('2026-08-14');
    });

    // Valid but empty is normal for a channel with no upcoming bookings, so it
    // must not read as an error the operator has to fix.
    it('treats an empty feed as valid with a warning', async () => {
      const { service } = make();
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body: ics(),
        contentType: 'text/calendar',
        etag: null,
        lastModified: null,
        sizeBytes: 80,
        finalUrl: FEED_URL,
      });

      const result = await service.validate(OWNER, {
        tourId: TOUR,
        url: FEED_URL,
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('EMPTY_FEED');
    });

    it('returns a specific reason rather than a generic failure', async () => {
      const { service } = make();
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'This link no longer exists. Regenerate it on that channel.',
        transient: false,
        httpStatus: 404,
      });

      const result = await service.validate(OWNER, {
        tourId: TOUR,
        url: FEED_URL,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('HTTP_404');
      expect(result.message).toContain('Regenerate');
    });

    it('writes nothing', async () => {
      const { service, prisma, reconciler } = make();
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body: ics(reserved('20260814', '20260815')),
        contentType: 'text/calendar',
        etag: null,
        lastModified: null,
        sizeBytes: 300,
        finalUrl: FEED_URL,
      });

      await service.validate(OWNER, { tourId: TOUR, url: FEED_URL });
      expect(reconciler.reconcile).not.toHaveBeenCalled();
      expect(prisma.calendarSubscription.create).not.toHaveBeenCalled();
    });
  });

  describe('runSync - the failure rule', () => {
    // THE rule of this feature. A transient upstream error must never look like
    // "the feed no longer lists anything", which would release every block.
    it('never reconciles when the fetch fails', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'FEED_TIMEOUT',
        message: 'The channel did not respond in time.',
        transient: true,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      expect(reconciler.reconcile).not.toHaveBeenCalled();
      expect(reconciler.releaseBlocks).not.toHaveBeenCalled();
      expect(result.outcome).toBe(IcalSyncOutcome.FAILED);
      expect(result.blocksRemoved).toBe(0);
    });

    it('never reconciles when the body will not parse', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body: '<html>login page</html>',
        contentType: 'text/html',
        etag: null,
        lastModified: null,
        sizeBytes: 100,
        finalUrl: FEED_URL,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(reconciler.reconcile).not.toHaveBeenCalled();
      expect(result.errorCode).toBe('NOT_A_CALENDAR');
    });

    // A truncated download is indistinguishable from "everything was cancelled".
    it('treats a truncated body as transient and keeps the blocks', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body: 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x',
        contentType: 'text/calendar',
        etag: null,
        lastModified: null,
        sizeBytes: 40,
        finalUrl: FEED_URL,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      expect(reconciler.reconcile).not.toHaveBeenCalled();
      const data = subscriptionUpdate(prisma);
      expect(data.lastErrorCode).toBe('TRUNCATED_FEED');
      // Transient, so it stays ACTIVE and climbs the ladder rather than dying.
      expect(data.status).toBe(CalendarSubscriptionStatus.ACTIVE);
      expect(data.failureCount).toBe(1);
    });

    it('marks a permanent error INVALID_URL and stops the schedule', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'This link no longer exists.',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      const data = subscriptionUpdate(prisma);
      expect(data.status).toBe(CalendarSubscriptionStatus.INVALID_URL);
      // Retrying a 404 sixteen times helps nobody.
      expect(data.nextPollAt).toBeNull();
    });

    it('flips to ERROR once the retry ladder is exhausted', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ failureCount: 4 }),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'FEED_TIMEOUT',
        message: 'timeout',
        transient: true,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(subscriptionUpdate(prisma).status).toBe(
        CalendarSubscriptionStatus.ERROR,
      );
    });
  });

  describe('runSync - short circuits', () => {
    it('does nothing on a 304', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ lastEtag: '"abc"' }),
      );
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: true,
        status: 304,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      expect(result.outcome).toBe(IcalSyncOutcome.UNCHANGED);
      expect(reconciler.reconcile).not.toHaveBeenCalled();
    });

    it('sends the stored validators so a 304 is possible at all', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({
          lastEtag: '"abc"',
          lastModified: 'Wed, 01 Jul 2026 00:00:00 GMT',
        }),
      );
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: true,
        status: 304,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      expect(mockedFetch).toHaveBeenCalledWith(FEED_URL, {
        etag: '"abc"',
        lastModified: 'Wed, 01 Jul 2026 00:00:00 GMT',
      });
    });

    // Plenty of feeds never send an ETag, so the body hash is the second defence.
    it('skips the diff when the body hash is unchanged', async () => {
      const body = ics(reserved('20260814', '20260818'));
      const hash = createHash('sha256').update(body).digest('hex');

      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ lastContentHash: hash }),
      );
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body,
        contentType: 'text/calendar',
        etag: null,
        lastModified: null,
        sizeBytes: body.length,
        finalUrl: FEED_URL,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(result.outcome).toBe(IcalSyncOutcome.UNCHANGED);
      expect(reconciler.reconcile).not.toHaveBeenCalled();
    });
  });

  describe('runSync - the happy path', () => {
    it('reconciles the parsed blocks and clears the error state', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ failureCount: 2, lastErrorCode: 'FEED_TIMEOUT' }),
      );
      reconciler.reconcile.mockResolvedValue({
        blocksCreated: 4,
        blocksRemoved: 1,
        eventsAdded: 1,
        eventsRemoved: 0,
        conflictsDetected: 0,
      });
      const body = ics(reserved('20260814', '20260818'));
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body,
        contentType: 'text/calendar',
        etag: '"new"',
        lastModified: null,
        sizeBytes: body.length,
        finalUrl: FEED_URL,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      expect(reconciler.reconcile).toHaveBeenCalledWith(
        expect.objectContaining({ subscriptionId: SUB, tourId: TOUR }),
      );
      expect(result.blocksCreated).toBe(4);

      const data = subscriptionUpdate(prisma);
      expect(data.status).toBe(CalendarSubscriptionStatus.ACTIVE);
      expect(data.failureCount).toBe(0);
      expect(data.lastErrorCode).toBeNull();
      expect(data.lastEtag).toBe('"new"');
    });

    it('logs a dry run as DRY_RUN when the mode is IGNORE', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ importMode: CalendarImportMode.IGNORE }),
      );
      const body = ics(reserved('20260814', '20260818'));
      mockedFetch.mockResolvedValue({
        ok: true,
        notModified: false,
        status: 200,
        body,
        contentType: 'text/calendar',
        etag: null,
        lastModified: null,
        sizeBytes: body.length,
        finalUrl: FEED_URL,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(result.outcome).toBe(IcalSyncOutcome.DRY_RUN);
    });
  });

  describe('notifications', () => {
    const feedResponse = (body: string) => ({
      ok: true as const,
      notModified: false as const,
      status: 200,
      body,
      contentType: 'text/calendar',
      etag: null,
      lastModified: null,
      sizeBytes: body.length,
      finalUrl: FEED_URL,
    });

    // The alert the whole feature is judged on: iCal is polled, not pushed, so
    // nothing else in the system can tell the operator about a double-sale.
    it('tells the operator when a block lands on a booked departure', async () => {
      const { service, prisma, reconciler, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      reconciler.reconcile.mockResolvedValue({
        blocksCreated: 1,
        blocksRemoved: 0,
        eventsAdded: 1,
        eventsRemoved: 0,
        conflictsDetected: 2,
      });
      mockedFetch.mockResolvedValue(
        feedResponse(ics(reserved('20260814', '20260818'))),
      );

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      expect(inbox.notify).toHaveBeenCalledTimes(1);
      const [payload] = inbox.notify.mock.calls[0];
      expect(payload.event).toBe('CALENDAR_SYNC_CONFLICT');
      expect(payload.operatorId).toBe('op-1');
      // Names the tour, because an operator with 40 of them cannot act on a
      // generic alert.
      expect(payload.title).toContain('Klein Curacao Catamaran');
      expect(payload.title).toContain('Airbnb');
      // The first thing they will fear is that we cancelled someone.
      expect(payload.body).toContain('no traveller has been cancelled');
    });

    it('stays quiet when nothing collided', async () => {
      const { service, prisma, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue(
        feedResponse(ics(reserved('20260814', '20260818'))),
      );

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(inbox.notify).not.toHaveBeenCalled();
    });

    it('notifies once a connection actually breaks', async () => {
      const { service, prisma, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'This link no longer exists. Regenerate it on that channel.',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);

      const [payload] = inbox.notify.mock.calls[0];
      expect(payload.event).toBe('CALENDAR_SYNC_FAILED');
      // Answering "are my dates safe?" first is the whole point of the copy.
      expect(payload.body).toContain('still blocked');
      expect(payload.body).toContain('not at risk of a double booking');
    });

    // Told six times about one dead link, an operator stops reading the seventh.
    it('does not re-notify a connection that was already broken', async () => {
      const { service, prisma, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ status: CalendarSubscriptionStatus.INVALID_URL }),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'gone',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(inbox.notify).not.toHaveBeenCalled();
    });

    // A single timeout is not news; it is the retry ladder doing its job.
    it('stays quiet while a transient failure is still being retried', async () => {
      const { service, prisma, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ failureCount: 1 }),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'FEED_TIMEOUT',
        message: 'timeout',
        transient: true,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(inbox.notify).not.toHaveBeenCalled();
    });

    it('notifies once the retry budget is spent', async () => {
      const { service, prisma, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ failureCount: 4 }),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'FEED_TIMEOUT',
        message: 'timeout',
        transient: true,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      expect(inbox.notify).toHaveBeenCalledTimes(1);
    });

    it('dedupes per connection per day', async () => {
      const { service, prisma, inbox } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'gone',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      const key = inbox.notify.mock.calls[0][0].dedupeKey as string;
      expect(key).toContain(SUB);
      expect(key).toContain('HTTP_404');
      expect(key).toMatch(/\d{4}-\d{2}-\d{2}$/);
    });
  });

  /**
   * Email is the second channel, and its whole value is that it reaches an
   * operator who is NOT looking at the dashboard - which is precisely the case
   * when a feed dies at 2am. Cadence is therefore the thing under test: one
   * email per incident, not one per retry.
   */
  describe('operator email', () => {
    const feedResponse = (body: string) => ({
      ok: true as const,
      notModified: false as const,
      status: 200,
      body,
      contentType: 'text/calendar',
      etag: null,
      lastModified: null,
      sizeBytes: body.length,
      finalUrl: FEED_URL,
    });

    const emailArgs = (mail: ReturnType<typeof mockMail>) =>
      mail.sendBookingNoticeEmail.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
        string,
      ];

    // A flush is needed because the sends are deliberately fire-and-forget:
    // a bounced address must never fail the sync that triggered it. Several
    // ticks, because the send awaits a lookup before it reaches the mailer.
    const settle = async () => {
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    };

    it('emails the operator when a block hits a booked departure', async () => {
      const { service, prisma, reconciler, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: 'ops@missann.test',
        user: { email: 'owner@missann.test' },
      });
      reconciler.reconcile.mockResolvedValue({
        blocksCreated: 1,
        blocksRemoved: 0,
        eventsAdded: 1,
        eventsRemoved: 0,
        conflictsDetected: 2,
      });
      mockedFetch.mockResolvedValue(
        feedResponse(ics(reserved('20260814', '20260818'))),
      );

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      const [to, subject, , text] = emailArgs(mail);
      expect(to).toBe('ops@missann.test');
      expect(subject).toContain('Airbnb');
      expect(subject).toContain('Klein Curacao Catamaran');
      // Same reassurance as the bell: we did not cancel anyone.
      expect(text.toLowerCase()).toContain('no traveller has been cancelled');
    });

    it('falls back to the owner login address when there is no contact email', async () => {
      const { service, prisma, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: null,
        user: { email: 'owner@missann.test' },
      });
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'gone',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      expect(emailArgs(mail)[0]).toBe('owner@missann.test');
    });

    it('emails once when the feed breaks', async () => {
      const { service, prisma, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: 'ops@missann.test',
        user: { email: 'owner@missann.test' },
      });
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'This link no longer exists.',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      expect(mail.sendBookingNoticeEmail).toHaveBeenCalledTimes(1);
      expect(emailArgs(mail)[1]).toContain('stopped syncing');
    });

    // THE cadence rule. A feed down overnight polls ~96 times; every one of
    // those must be silent, or the operator learns to filter us out.
    it('stays silent on every retry after the first break', async () => {
      const { service, prisma, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ status: CalendarSubscriptionStatus.INVALID_URL }),
      );
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'gone',
        transient: false,
        httpStatus: 404,
      });

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      expect(mail.sendBookingNoticeEmail).not.toHaveBeenCalled();
    });

    // The other half of the pair - without this, "silence" is ambiguous and the
    // operator has to check the dashboard to learn whether their fix worked.
    it('emails again when a broken feed recovers', async () => {
      const { service, prisma, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ status: CalendarSubscriptionStatus.ERROR }),
      );
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: 'ops@missann.test',
        user: { email: 'owner@missann.test' },
      });
      mockedFetch.mockResolvedValue(
        feedResponse(ics(reserved('20260814', '20260818'))),
      );

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      expect(emailArgs(mail)[1]).toContain('syncing again');
    });

    it('sends nothing on a routine successful sync', async () => {
      const { service, prisma, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      mockedFetch.mockResolvedValue(
        feedResponse(ics(reserved('20260814', '20260818'))),
      );

      await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      expect(mail.sendBookingNoticeEmail).not.toHaveBeenCalled();
    });

    // The sync is already committed by the time email runs. Losing it because
    // Resend is down would be strictly worse than a missed alert.
    it('never lets a mail failure break the sync', async () => {
      const { service, prisma, mail } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      prisma.operator.findUnique.mockResolvedValue({
        contactEmail: 'ops@missann.test',
        user: { email: 'owner@missann.test' },
      });
      mail.sendBookingNoticeEmail.mockRejectedValue(new Error('resend down'));
      mockedFetch.mockResolvedValue({
        ok: false,
        code: 'HTTP_404',
        message: 'gone',
        transient: false,
        httpStatus: 404,
      });

      const result = await service.runSync(SUB, IcalSyncTrigger.SCHEDULED);
      await settle();

      expect(result.outcome).toBe('FAILED');
      expect(result.errorCode).toBe('HTTP_404');
    });
  });

  describe('sync history', () => {
    it('returns newest first, scoped to the connection', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      prisma.icalSyncLog.count.mockResolvedValue(128);
      prisma.icalSyncLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          outcome: IcalSyncOutcome.SUCCESS,
          trigger: IcalSyncTrigger.SCHEDULED,
          httpStatus: 200,
          eventsFound: 6,
          blocksCreated: 2,
          blocksRemoved: 1,
          conflictsDetected: 0,
          errorCode: null,
          errorMessage: null,
          durationMs: 1240,
          startedAt: new Date('2026-08-02T09:00:00.000Z'),
        },
      ]);

      const result = await service.listSyncLogs(OWNER, SUB, {});

      expect(result.total).toBe(128);
      expect(result.data[0].blocksCreated).toBe(2);
      const [args] = prisma.icalSyncLog.findMany.mock.calls[0];
      expect(args.where).toEqual({ subscriptionId: SUB });
      expect(args.orderBy).toEqual({ startedAt: 'desc' });
    });

    it('paginates', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      await service.listSyncLogs(OWNER, SUB, { page: 3, limit: 10 });

      const [args] = prisma.icalSyncLog.findMany.mock.calls[0];
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });

    // Reading another operator's history has to fail the same way as reading
    // their connection: through the ownership check, not a separate one.
    it('refuses a connection the caller does not own', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(null);
      await expect(
        service.listSyncLogs(OWNER, 'someone-elses', {}),
      ).rejects.toThrow();
    });
  });

  describe('retention', () => {
    // ~95% of rows at a 15-minute cadence say "nothing changed". Keeping them
    // for six months would bury the handful that explain a date moving.
    it('drops unchanged runs early and everything else late', async () => {
      const { service, prisma } = make();
      prisma.icalSyncLog.deleteMany
        .mockResolvedValueOnce({ count: 900 })
        .mockResolvedValueOnce({ count: 12 });

      const result = await service.pruneSyncLogs();

      expect(result.removed).toBe(912);
      const [noiseArgs] = prisma.icalSyncLog.deleteMany.mock.calls[0];
      expect(noiseArgs.where.outcome).toBe(IcalSyncOutcome.UNCHANGED);

      // The two cutoffs must not be the same, or the split buys nothing.
      const [oldArgs] = prisma.icalSyncLog.deleteMany.mock.calls[1];
      expect(oldArgs.where.outcome).toBeUndefined();
      expect(oldArgs.where.startedAt.lt.getTime()).toBeLessThan(
        noiseArgs.where.startedAt.lt.getTime(),
      );
    });

    // A failure months ago is exactly what a double-booking dispute needs.
    it('keeps failures far longer than unchanged runs', async () => {
      const { service, prisma } = make();
      await service.pruneSyncLogs();

      const [noiseArgs] = prisma.icalSyncLog.deleteMany.mock.calls[0];
      const [oldArgs] = prisma.icalSyncLog.deleteMany.mock.calls[1];
      const days =
        (noiseArgs.where.startedAt.lt.getTime() -
          oldArgs.where.startedAt.lt.getTime()) /
        86_400_000;
      expect(days).toBeGreaterThan(100);
    });
  });

  describe('disconnect', () => {
    // The default, and the safer one: a channel that stopped syncing is not a
    // channel whose dates became free.
    it('keeps the dates by default, converting them to manual closures', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      reconciler.convertBlocksToManual.mockResolvedValue({ converted: 6 });

      const result = await service.disconnect(OWNER, SUB, false);

      expect(reconciler.convertBlocksToManual).toHaveBeenCalledWith(SUB);
      expect(reconciler.releaseBlocks).not.toHaveBeenCalled();
      expect(result.datesConvertedToManual).toBe(6);
    });

    it('releases them when the operator explicitly asks', async () => {
      const { service, prisma, reconciler } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );
      reconciler.releaseBlocks.mockResolvedValue({ released: 6 });

      const result = await service.disconnect(OWNER, SUB, true);

      expect(reconciler.releaseBlocks).toHaveBeenCalledWith(SUB, TOUR);
      expect(result.datesReleased).toBe(6);
    });

    it('refuses while a sync is running', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ status: CalendarSubscriptionStatus.SYNCING }),
      );
      await expect(
        service.disconnect(OWNER, SUB, false),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('syncNow', () => {
    it('refuses to stack a second run', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow({ status: CalendarSubscriptionStatus.SYNCING }),
      );
      await expect(service.syncNow(OWNER, SUB)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('list', () => {
    it('masks the URL, because it is a credential for the operator account', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findMany.mockResolvedValue([
        subscriptionRow(),
      ]);

      const [row] = await service.list(OWNER, { tourId: TOUR });

      expect(row.urlMasked).toBe(true);
      expect(row.url).toBe('https://www.airbnb.com/…');
      expect(row.url).not.toContain('s=abc');
    });

    it('returns the real URL from the single read, which the edit form needs', async () => {
      const { service, prisma } = make();
      prisma.calendarSubscription.findUnique.mockResolvedValue(
        subscriptionRow(),
      );

      const row = await service.getById(OWNER, SUB);

      expect(row.urlMasked).toBe(false);
      expect(row.url).toBe(FEED_URL);
    });
  });
});
