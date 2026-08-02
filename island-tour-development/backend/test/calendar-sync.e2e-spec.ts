/**
 * Calendar sync E2E - the whole import pipeline against a REAL database.
 *
 * Every other calendar test mocks its neighbours. This one does not: it seeds a
 * tour with a weekly schedule, lets the real materializer project real
 * `departures`, then feeds a real Airbnb-shaped `.ics` through parse → map →
 * reconcile → materialize and asserts the DEPARTURES actually changed. That
 * chain crossing correctly IS the feature, and it is the one thing unit tests
 * with mocked Prisma cannot prove.
 *
 * ## Only the network is replaced, and only because our own guard forbids it
 * `safe-http.util` refuses loopback and private addresses by design, so a local
 * fixture server is unreachable BY OUR OWN SSRF DEFENCE - correctly. The fetch
 * is a provider (`FeedFetcherService`) precisely so a test can override it at
 * the seam; the guard keeps its own 98-test suite, and every layer below the
 * fetch runs for real here.
 *
 * ## Why not the whole AppModule
 * Booting it drags in Better Auth, BullMQ and the HTTP stack, which needs Redis
 * and exhausted the V8 heap under jest. Only the modules under test are wired.
 */
// The e2e config runs under ESM, where jest is not a global.
import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';

import { AvailabilityModule } from '@/availability/availability.module';
import { AvailabilityService } from '@/availability/availability.service';
import { CalendarReconcilerService } from '@/calendar-sync/calendar-reconciler.service';
import { CalendarSyncService } from '@/calendar-sync/calendar-sync.service';
import { FeedFetcherService } from '@/common/net/feed-fetcher.service';
import type {
  SafeFetchFailure,
  SafeFetchOptions,
  SafeFetchResult,
  SafeFetchSuccess,
} from '@/common/net/safe-http.util';
import { encrypt } from '@/common/utils/crypto.util';
import { InboxModule } from '@/inbox/inbox.module';
import { MailService } from '@/mail/mail.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsModule } from '@/staff/staff-permissions.module';

/** An Airbnb-shaped feed: all-day values, exclusive DTEND, generic summary. */
const feed = (...events: string[]) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

const reservation = (uid: string, start: string, endExclusive: string) =>
  [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${endExclusive}`,
    'SUMMARY:Reserved',
    'END:VEVENT',
  ].join('\r\n');

const okResponse = (body: string): SafeFetchSuccess => ({
  ok: true,
  notModified: false,
  status: 200,
  body,
  contentType: 'text/calendar',
  etag: null,
  lastModified: null,
  sizeBytes: body.length,
  finalUrl: 'https://www.airbnb.com/calendar/ical/1.ics',
});

/** `YYYY-MM-DD` a number of days from today, in UTC. */
const dayFromNow = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const compact = (key: string) => key.replace(/-/g, '');

describe('Calendar sync (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sync: CalendarSyncService;
  let availability: AvailabilityService;

  // Typed against the real signature, so a fixture that drifts from
  // `SafeFetchResult` fails the typecheck instead of silently passing.
  const fetchMock =
    jest.fn<
      (url: string, options?: SafeFetchOptions) => Promise<SafeFetchResult>
    >();

  const mailMock = jest.fn<() => Promise<void>>().mockResolvedValue();

  const ids = { user: '', operator: '', destination: '', tour: '', sub: '' };

  // Far enough out that the materializer's default window covers it and no
  // booking cutoff interferes.
  const blockedDay = dayFromNow(30);
  const nextDay = dayFromNow(31);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PrismaModule,
        StaffPermissionsModule,
        InboxModule,
        AvailabilityModule,
      ],
      providers: [
        CalendarSyncService,
        CalendarReconcilerService,
        // Registered so it can be overridden below - `overrideProvider` only
        // replaces a provider the module already has.
        FeedFetcherService,
        // Stubbed rather than imported: a failing sync sends the operator an
        // alert, and a test suite must not put mail on the wire. The copy and
        // the send-or-stay-silent rules have their own unit tests.
        {
          provide: MailService,
          useValue: { sendBookingNoticeEmail: mailMock },
        },
      ],
    })
      .overrideProvider(FeedFetcherService)
      .useValue({ fetch: fetchMock })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    sync = app.get(CalendarSyncService);
    availability = app.get(AvailabilityService);

    const stamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `calsync-${stamp}@example.test`,
        name: 'Cal Sync',
        role: 'TOUR_OPERATOR',
        emailVerified: true,
      },
    });
    ids.user = user.id;

    const operator = await prisma.operator.create({
      data: { userId: user.id },
    });
    ids.operator = operator.id;

    const destination = await prisma.destination.create({
      data: {
        name: `Calsync Isle ${stamp}`,
        slug: `calsync-isle-${stamp}`,
        timezone: 'America/Curacao',
        region: 'CARIBBEAN',
      },
    });
    ids.destination = destination.id;

    const tour = await prisma.tour.create({
      data: {
        operatorId: operator.id,
        destinationId: destination.id,
        name: 'Calsync Catamaran',
        slug: `calsync-catamaran-${stamp}`,
        timeZone: 'America/Curacao',
        maxPartySize: 60,
        startTimes: ['08:00', '14:00'],
        durationMinutesTo: 240,
      },
    });
    ids.tour = tour.id;

    // A rule on EVERY weekday, so the blocked date has departures whichever day
    // of the week it happens to land on when this runs.
    for (let weekday = 0; weekday < 7; weekday++) {
      for (const startTime of ['08:00', '14:00']) {
        await prisma.availabilitySchedule.create({
          data: {
            tourId: tour.id,
            weekday,
            startTime: new Date(`1970-01-01T${startTime}:00.000Z`),
            validFrom: new Date('2020-01-01T00:00:00.000Z'),
          },
        });
      }
    }
    // The real materializer, writing real departures.
    await availability.resyncTourAvailability(tour.id);

    const subscription = await prisma.calendarSubscription.create({
      data: {
        tourId: tour.id,
        platform: 'AIRBNB',
        url: encrypt('https://www.airbnb.com/calendar/ical/1.ics?s=abc'),
        urlHash: `hash-${stamp}`,
        importMode: 'CLOSE_DATES',
        syncIntervalMinutes: 60,
      },
    });
    ids.sub = subscription.id;
  }, 180_000);

  afterAll(async () => {
    // A failed `beforeAll` leaves these undefined; without the guard the real
    // error is buried under "Cannot read properties of undefined".
    if (!app || !prisma) return;

    // FK-safe order: children before parents.
    if (ids.sub) {
      await prisma.icalSyncLog.deleteMany({
        where: { subscriptionId: ids.sub },
      });
      await prisma.calendarConflict.deleteMany({
        where: { subscriptionId: ids.sub },
      });
      await prisma.calendarEvent.deleteMany({
        where: { subscriptionId: ids.sub },
      });
    }
    if (ids.tour) {
      await prisma.availabilityException.deleteMany({
        where: { tourId: ids.tour },
      });
      await prisma.calendarSubscription.deleteMany({
        where: { tourId: ids.tour },
      });
      await prisma.departure.deleteMany({ where: { tourId: ids.tour } });
      await prisma.availabilitySchedule.deleteMany({
        where: { tourId: ids.tour },
      });
      await prisma.slugRegistry.deleteMany({ where: { entityId: ids.tour } });
      await prisma.tour.deleteMany({ where: { id: ids.tour } });
    }
    if (ids.destination) {
      await prisma.slugRegistry.deleteMany({
        where: { entityId: ids.destination },
      });
      await prisma.destination.deleteMany({ where: { id: ids.destination } });
    }
    if (ids.operator) {
      await prisma.operator.deleteMany({ where: { id: ids.operator } });
    }
    if (ids.user) await prisma.user.deleteMany({ where: { id: ids.user } });

    await app.close();
  }, 120_000);

  const departuresOn = (dayKey: string) =>
    prisma.departure.findMany({
      where: { tourId: ids.tour, date: new Date(`${dayKey}T00:00:00.000Z`) },
      orderBy: { startTime: 'asc' },
    });

  const importedCount = () =>
    prisma.availabilityException.count({ where: { subscriptionId: ids.sub } });

  it('materializes real departures from the weekly schedule', async () => {
    const rows = await departuresOn(blockedDay);
    expect(rows).toHaveLength(2);
    expect(rows.every((d) => d.status === 'OPEN')).toBe(true);
  });

  it('closes real departures when the channel reports the date busy', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        // EXCLUSIVE end - this covers blockedDay only.
        feed(reservation('airbnb-1', compact(blockedDay), compact(nextDay))),
      ),
    );

    const result = await sync.runSync(ids.sub, 'MANUAL');
    expect(result.errorCode).toBeNull();
    expect(result.blocksCreated).toBe(1);

    const exceptions = await prisma.availabilityException.findMany({
      where: { subscriptionId: ids.sub },
    });
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].source).toBe('ICAL');
    expect(exceptions[0].type).toBe('CLOSE_DATE');

    // ...and the DEPARTURES actually moved. This is the assertion the whole
    // feature rests on: an imported block reaches real inventory.
    const rows = await departuresOn(blockedDay);
    expect(rows).toHaveLength(2);
    expect(rows.every((d) => d.status === 'CLOSED')).toBe(true);
  }, 120_000);

  // The #1 bug in iCal integrations, proven against real rows.
  it('leaves the following day alone, because DTEND is exclusive', async () => {
    const rows = await departuresOn(nextDay);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((d) => d.status === 'OPEN')).toBe(true);
  });

  it('reopens the departures once the reservation leaves the feed', async () => {
    // The guest cancelled on Airbnb: the event is simply gone.
    fetchMock.mockResolvedValue(okResponse(feed()));

    const result = await sync.runSync(ids.sub, 'MANUAL');
    expect(result.blocksRemoved).toBe(1);
    expect(await importedCount()).toBe(0);

    const rows = await departuresOn(blockedDay);
    expect(rows.every((d) => d.status === 'OPEN')).toBe(true);
  }, 120_000);

  // THE failure rule. A transient error must never look like "the feed listed
  // nothing", which would release every block at the worst possible moment.
  it('keeps every block when the fetch fails', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        feed(reservation('airbnb-2', compact(blockedDay), compact(nextDay))),
      ),
    );
    await sync.runSync(ids.sub, 'MANUAL');
    expect(await importedCount()).toBe(1);

    fetchMock.mockResolvedValue({
      ok: false,
      code: 'FEED_TIMEOUT',
      message: 'The channel did not respond in time.',
      transient: true,
    } satisfies SafeFetchFailure);
    const failed = await sync.runSync(ids.sub, 'MANUAL');

    expect(failed.outcome).toBe('FAILED');
    expect(await importedCount()).toBe(1); // still there - nothing released
    const rows = await departuresOn(blockedDay);
    expect(rows.every((d) => d.status === 'CLOSED')).toBe(true);
  }, 120_000);

  it('never touches an exception the operator authored by hand', async () => {
    const manualDay = dayFromNow(40);
    const manual = await prisma.availabilityException.create({
      data: {
        tourId: ids.tour,
        date: new Date(`${manualDay}T00:00:00.000Z`),
        type: 'CLOSE_DATE',
        note: 'Operator closed this by hand',
      },
    });

    // A feed mentioning neither day: the reconciler sees "nothing desired" and
    // must still leave the manual row completely alone.
    fetchMock.mockResolvedValue(okResponse(feed()));
    await sync.runSync(ids.sub, 'MANUAL');

    const stillThere = await prisma.availabilityException.findUnique({
      where: { id: manual.id },
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.source).toBe('MANUAL');

    await prisma.availabilityException.delete({ where: { id: manual.id } });
    await availability.resyncTourAvailability(ids.tour);
  }, 120_000);

  it('writes a readable history row for every run', async () => {
    const logs = await prisma.icalSyncLog.findMany({
      where: { subscriptionId: ids.sub },
      orderBy: { startedAt: 'desc' },
    });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.outcome === 'FAILED')).toBe(true);
    expect(logs.some((l) => l.blocksCreated > 0)).toBe(true);
    expect(logs.some((l) => l.blocksRemoved > 0)).toBe(true);
  });
});
