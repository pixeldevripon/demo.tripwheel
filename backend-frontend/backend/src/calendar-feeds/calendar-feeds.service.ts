import { createHash, randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  CalendarFeedKind,
  DepartureStatus,
  Permission,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';

/**
 * The feed kinds THIS BUILD can deserialize.
 *
 * ## Why every read filters on it
 * The `calendar_feed_kind` enum in the database is a superset of the one in this schema:
 * production carries `resource` and `channel` values written by the iCal phase-2 work,
 * whose models were later reverted. A migration cannot remove a Postgres enum value while
 * rows still reference it, so those values are permanent until the rows are.
 *
 * Prisma deserializes enums strictly. A `findMany` that returns one of those rows throws
 * `Value 'channel' not found in enum 'CalendarFeedKind'` and the whole request 500s - which
 * is exactly what took the operator's iCal settings tab down: one orphaned row poisoned the
 * entire list, including the two feeds that were perfectly fine.
 *
 * Naming the supported kinds in the WHERE clause pushes the exclusion into SQL, so unknown
 * rows are never fetched and never deserialized. Filtering after the query cannot work here:
 * the throw happens while building the result, before any code of ours runs.
 *
 * This is not a workaround to remove once the data is cleaned. Any future kind added and
 * later withdrawn recreates the same trap, and a read that only returns what it understands
 * is correct on its own terms.
 */
const SUPPORTED_KINDS = [
  CalendarFeedKind.BOOKINGS,
  CalendarFeedKind.DEPARTURES,
] as const;
import { publicApiBase } from '@/common/utils/app-urls.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
import {
  buildCalendar,
  sequenceFrom,
  type IcsEvent,
} from '@/common/ics/ics.util';
import {
  combineDateTime,
  localWallClockToUtc,
  timeOfDay,
} from '@/common/utils/timezone.util';
import type {
  CalendarFeedResponseDto,
  CreateCalendarFeedDto,
} from './dto/calendar-feed.dto';

/** A rendered feed plus everything the controller needs for conditional GET. */
export interface RenderedFeed {
  body: string;
  etag: string;
  lastModified: Date;
}

const MS_PER_DAY = 86_400_000;

/**
 * Feed windows, backwards far enough that a subscriber joining today still sees the
 * recent past their calendar app will show them.
 *
 * The forward horizons differ ON PURPOSE, and the reason is size. Bookings are
 * sparse - a busy operator has a few hundred a year, a handful of KB - so the feed
 * runs a full year ahead. Departures are the cross product of every tour, date and
 * start time: a real operator's year measured 6,000 events and 2.1 MB, which is past
 * the point where calendar clients handle a subscription gracefully. 90 days is both
 * a tenth of that and exactly the materializer's DEFAULT_HORIZON_DAYS, so the feed
 * stops precisely where guaranteed-projected inventory does rather than at an
 * arbitrary cut.
 */
const PAST_DAYS = 30;
const FUTURE_DAYS_BOOKINGS = 364;
const FUTURE_DAYS_DEPARTURES = 90;

/** A tour with no recorded duration still needs an end instant. */
const DEFAULT_DURATION_MINUTES = 60;

/** Advisory poll interval for subscribers (ISO 8601 duration). */
const REFRESH_INTERVAL = 'PT1H';

/**
 * Which permission each feed kind costs. The route itself only demands
 * MANAGE_AVAILABILITY (the "I run this operator's calendar" bar); the BOOKINGS
 * feed additionally demands VIEW_BOOKINGS because minting its URL hands out
 * traveller names to anyone holding the link, and a seat trusted with opening
 * hours is not automatically trusted with the customer list.
 */
const PERMISSION_FOR_KIND: Record<CalendarFeedKind, Permission> = {
  [CalendarFeedKind.BOOKINGS]: Permission.VIEW_BOOKINGS,
  [CalendarFeedKind.DEPARTURES]: Permission.MANAGE_AVAILABILITY,
};

/**
 * Read-only iCal export (RFC 5545) of an operator's bookings and departures.
 *
 * ## The security model in one line
 * Calendar clients cannot carry a session cookie, so the unguessable token in the
 * URL is the whole authentication. Everything that follows from that:
 *   - 32 random bytes (256 bits) - not enumerable.
 *   - Revocable and rotatable, and a revoked row is KEPT so its token can never be
 *     minted for a different operator.
 *   - Deliberately narrow payload: the BOOKINGS feed carries the traveller's name,
 *     party size and our reference, and NOT their email, phone, or pickup address.
 *     A leaked subscribe URL should cost an operator their schedule, not their
 *     customers' contact details. The dashboard is where those live.
 *
 * ## Export only
 * Nothing here writes availability. Inbound iCal (an external calendar blocking our
 * dates) is a separate feature and belongs in AvailabilityException, not here.
 */
@Injectable()
export class CalendarFeedsService {
  private readonly logger = new Logger(CalendarFeedsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly staffPermissions: StaffPermissionsService,
  ) {}

  // ── Management (authenticated) ──────────────────────────────────────────────

  /**
   * The caller's feeds. A feed whose kind the caller may not read is omitted
   * rather than 403'd - the screen lists what you can have, and an availability-only
   * seat should simply not see a bookings URL sitting there.
   */
  async list(user: {
    id: string;
    role: Role;
  }): Promise<CalendarFeedResponseDto[]> {
    const operatorId = await resolveOperatorId(this.prisma, user.id, user.role);
    const feeds = await this.prisma.calendarFeed.findMany({
      // `kind` filter: see SUPPORTED_KINDS. Without it one orphaned phase-2 row 500s the
      // whole list and the operator loses feeds that work.
      where: {
        operatorId,
        revokedAt: null,
        kind: { in: [...SUPPORTED_KINDS] },
      },
      select: {
        id: true,
        kind: true,
        label: true,
        token: true,
        lastFetchedAt: true,
        fetchCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const visible = await Promise.all(
      feeds.map(async (f) => ((await this.mayUse(user, f.kind)) ? f : null)),
    );
    return visible
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map((f) => this.toDto(f));
  }

  /**
   * Mint (or return) the operator's feed of this kind.
   *
   * Idempotent by design: "give me my bookings URL" must answer the same URL every
   * time rather than pile up subscriptions. Re-creating a previously REVOKED feed
   * issues a NEW token - the revoked one stays dead, which is the entire point of
   * having revoked it.
   */
  async create(
    user: { id: string; role: Role },
    dto: CreateCalendarFeedDto,
  ): Promise<CalendarFeedResponseDto> {
    await this.assertMayUse(user, dto.kind);
    const operatorId = await resolveOperatorId(this.prisma, user.id, user.role);

    const existing = await this.prisma.calendarFeed.findUnique({
      where: { operatorId_kind: { operatorId, kind: dto.kind } },
      select: { id: true, revokedAt: true },
    });

    const feed = existing
      ? await this.prisma.calendarFeed.update({
          where: { id: existing.id },
          data: existing.revokedAt
            ? {
                revokedAt: null,
                token: mintToken(),
                label: dto.label ?? null,
                createdBy: user.id,
                fetchCount: 0,
                lastFetchedAt: null,
              }
            : { label: dto.label ?? undefined },
          select: FEED_SELECT,
        })
      : await this.prisma.calendarFeed.create({
          data: {
            operatorId,
            kind: dto.kind,
            token: mintToken(),
            label: dto.label ?? null,
            createdBy: user.id,
          },
          select: FEED_SELECT,
        });

    this.logger.log(
      `Calendar feed ${dto.kind} ready for operator ${operatorId} (user ${user.id})`,
    );
    return this.toDto(feed);
  }

  /** New token, same feed. Every existing subscription breaks - that is the point. */
  async rotate(
    user: { id: string; role: Role },
    id: string,
  ): Promise<CalendarFeedResponseDto> {
    const feed = await this.ownedFeed(user, id);
    const updated = await this.prisma.calendarFeed.update({
      where: { id: feed.id },
      data: { token: mintToken(), fetchCount: 0, lastFetchedAt: null },
      select: FEED_SELECT,
    });
    this.logger.log(`Calendar feed ${id} rotated by user ${user.id}`);
    return this.toDto(updated);
  }

  /** Soft-revoke: the row stays so the dead token can never be re-issued. */
  async revoke(user: { id: string; role: Role }, id: string): Promise<void> {
    const feed = await this.ownedFeed(user, id);
    await this.prisma.calendarFeed.update({
      where: { id: feed.id },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`Calendar feed ${id} revoked by user ${user.id}`);
  }

  // ── Public rendering (token-authenticated) ──────────────────────────────────

  /**
   * Render the calendar behind a token.
   *
   * Every failure mode is a flat 404: a revoked feed, an unknown token and a
   * malformed one must be indistinguishable, or the response itself becomes an
   * oracle telling a probe which tokens once existed.
   */
  async render(token: string): Promise<RenderedFeed> {
    // `findFirst` + the kind filter rather than `findUnique` on the token: a still-subscribed
    // phase-2 feed URL must 404 like any other retired feed, not 500. That also keeps the
    // "every failure mode is a flat 404" contract above true for this case.
    const feed = await this.prisma.calendarFeed.findFirst({
      where: { token, kind: { in: [...SUPPORTED_KINDS] } },
      select: {
        id: true,
        kind: true,
        operatorId: true,
        revokedAt: true,
        createdAt: true,
        operator: {
          select: { companyInfo: { select: { companyName: true } } },
        },
      },
    });
    if (!feed || feed.revokedAt) throw new NotFoundException('Feed not found');

    const operatorName = feed.operator?.companyInfo?.companyName ?? null;
    const { events, lastModified } =
      feed.kind === CalendarFeedKind.BOOKINGS
        ? await this.bookingEvents(feed.operatorId)
        : await this.departureEvents(feed.operatorId);

    // An empty feed still needs a stable stamp, or a brand-new subscription would
    // re-download on every poll until its first booking exists.
    const stamp = lastModified ?? feed.createdAt;

    const body = buildCalendar(events, {
      name: calendarName(feed.kind, operatorName),
      refreshInterval: REFRESH_INTERVAL,
      dtstamp: stamp,
    });

    return {
      body,
      etag: `"${createHash('sha256').update(body).digest('hex').slice(0, 32)}"`,
      lastModified: stamp,
    };
  }

  /**
   * Counters for the dashboard's "is this actually syncing?" line. Called only on a
   * 200 - a 304 means the subscriber already had the current calendar, so counting
   * it would overstate real deliveries. Never awaited by the request path and never
   * allowed to fail it: a stats write must not cost the operator their calendar.
   */
  recordFetch(token: string): void {
    this.prisma.calendarFeed
      .updateMany({
        where: { token, revokedAt: null },
        data: { lastFetchedAt: new Date(), fetchCount: { increment: 1 } },
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to record calendar feed fetch: ${String(error)}`,
        );
      });
  }

  // ── Feed projections ────────────────────────────────────────────────────────

  /**
   * One VEVENT per booking on this operator's tours.
   *
   * CANCELLED bookings are included as `STATUS:CANCELLED` rather than dropped:
   * a subscriber that already has the event keeps it forever if it simply stops
   * appearing, so the operator would go on seeing a tour that is not happening.
   */
  private async bookingEvents(
    operatorId: string,
  ): Promise<{ events: IcsEvent[]; lastModified: Date | null }> {
    const { from, to } = feedWindow(FUTURE_DAYS_BOOKINGS);

    const bookings = await this.prisma.booking.findMany({
      where: {
        operatorId,
        localDate: { gte: from, lte: to },
        status: {
          in: [
            BookingStatus.CONFIRMED,
            BookingStatus.REDEEMED,
            BookingStatus.CANCELLED,
          ],
        },
      },
      select: {
        publicRef: true,
        displayRef: true,
        status: true,
        testMode: true,
        tourStartDateTime: true,
        tourEndDateTime: true,
        tourTimeZone: true,
        pickupWindowStart: true,
        pickupWindowEnd: true,
        contactFirstName: true,
        contactLastName: true,
        updatedAt: true,
        tour: { select: { name: true } },
        _count: { select: { unitItems: true } },
      },
      orderBy: { localDate: 'asc' },
    });

    const events: IcsEvent[] = [];
    let lastModified: Date | null = null;

    for (const b of bookings) {
      // A booking with no absolute start cannot be pinned to a moment; emitting it
      // anyway would put it on the operator's calendar at the wrong time, which is
      // worse than omitting it.
      if (!b.tourStartDateTime || !b.tourTimeZone) continue;

      const startUtc = localWallClockToUtc(b.tourStartDateTime, b.tourTimeZone);
      const endUtc = b.tourEndDateTime
        ? localWallClockToUtc(b.tourEndDateTime, b.tourTimeZone)
        : new Date(startUtc.getTime() + DEFAULT_DURATION_MINUTES * 60_000);

      const pax = b._count.unitItems;
      const tourName = b.tour?.name ?? 'Tour';
      const traveller = [b.contactFirstName, b.contactLastName]
        .filter(Boolean)
        .join(' ');

      const details = [
        `Ref: ${b.displayRef}`,
        `Guests: ${pax}`,
        traveller ? `Lead traveller: ${traveller}` : null,
        b.pickupWindowStart && b.pickupWindowEnd
          ? `Pickup window: ${b.pickupWindowStart}-${b.pickupWindowEnd}`
          : null,
        b.status === BookingStatus.CANCELLED ? 'CANCELLED' : null,
        // Contact details are deliberately absent - see the class docblock.
        'Full booking details are in your Island Tours dashboard.',
      ].filter(Boolean);

      events.push({
        // Same UID as the traveller's own .ics: it is the same real-world event, and
        // an operator who is also a guest should see one entry, not two.
        uid: `${b.publicRef}@island.tours`,
        startUtc,
        endUtc,
        summary:
          `${b.testMode ? '[TEST] ' : ''}${tourName} - ${pax} ` +
          `${pax === 1 ? 'guest' : 'guests'}`,
        description: details.join('\n'),
        status:
          b.status === BookingStatus.CANCELLED ? 'CANCELLED' : 'CONFIRMED',
        sequence: sequenceFrom(b.updatedAt),
        lastModifiedUtc: b.updatedAt,
      });

      if (!lastModified || b.updatedAt > lastModified)
        lastModified = b.updatedAt;
    }

    return { events, lastModified };
  }

  /**
   * One VEVENT per departure, with its fill, for capacity planning. Carries no
   * traveller data at all - this feed is safe to share with a guide.
   */
  private async departureEvents(
    operatorId: string,
  ): Promise<{ events: IcsEvent[]; lastModified: Date | null }> {
    const { from, to } = feedWindow(FUTURE_DAYS_DEPARTURES);

    const departures = await this.prisma.departure.findMany({
      where: {
        tour: { operatorId },
        date: { gte: from, lte: to },
      },
      select: {
        id: true,
        date: true,
        startTime: true,
        capacity: true,
        bookedCount: true,
        status: true,
        updatedAt: true,
        tour: {
          select: {
            name: true,
            timeZone: true,
            durationMinutesTo: true,
            durationMinutesFrom: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const events: IcsEvent[] = [];
    let lastModified: Date | null = null;

    for (const d of departures) {
      // Departures store LOCAL wall-clock; a calendar needs the real instant.
      const localStart = combineDateTime(d.date, d.startTime);
      const startUtc = localWallClockToUtc(localStart, d.tour.timeZone);
      const minutes =
        d.tour.durationMinutesTo ??
        d.tour.durationMinutesFrom ??
        DEFAULT_DURATION_MINUTES;
      const endUtc = new Date(startUtc.getTime() + minutes * 60_000);

      const remaining = Math.max(0, d.capacity - d.bookedCount);
      events.push({
        uid: `departure-${d.id}@island.tours`,
        startUtc,
        endUtc,
        summary: `${d.tour.name} ${timeOfDay(d.startTime)} - ${d.bookedCount}/${d.capacity} booked`,
        description: [
          `Status: ${d.status}`,
          `Booked: ${d.bookedCount} of ${d.capacity}`,
          `Seats left: ${remaining}`,
        ].join('\n'),
        // A cancelled departure must publish as cancelled, not disappear.
        status:
          d.status === DepartureStatus.CANCELLED ? 'CANCELLED' : 'CONFIRMED',
        sequence: sequenceFrom(d.updatedAt),
        lastModifiedUtc: d.updatedAt,
      });

      if (!lastModified || d.updatedAt > lastModified)
        lastModified = d.updatedAt;
    }

    return { events, lastModified };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /** Scopes a feed id to the caller's operator AND re-checks the per-kind bar. */
  private async ownedFeed(
    user: { id: string; role: Role },
    id: string,
  ): Promise<{ id: string; kind: CalendarFeedKind }> {
    const operatorId = await resolveOperatorId(this.prisma, user.id, user.role);
    const feed = await this.prisma.calendarFeed.findFirst({
      // Same guard: rotating or revoking an orphaned phase-2 feed by id must 404 rather
      // than 500. There is nothing this build could do with it anyway.
      where: { id, operatorId, kind: { in: [...SUPPORTED_KINDS] } },
      select: { id: true, kind: true },
    });
    if (!feed) throw new NotFoundException('Calendar feed not found');
    await this.assertMayUse(user, feed.kind);
    return feed;
  }

  private async mayUse(
    user: { id: string; role: Role },
    kind: CalendarFeedKind,
  ): Promise<boolean> {
    const { granted } = await this.staffPermissions.hasPermissions(user, [
      PERMISSION_FOR_KIND[kind],
    ]);
    return granted;
  }

  private async assertMayUse(
    user: { id: string; role: Role },
    kind: CalendarFeedKind,
  ): Promise<void> {
    if (!(await this.mayUse(user, kind))) {
      throw new ForbiddenException(
        `Missing permissions: ${PERMISSION_FOR_KIND[kind]}`,
      );
    }
  }

  private toDto(feed: {
    id: string;
    kind: CalendarFeedKind;
    label: string | null;
    token: string;
    lastFetchedAt: Date | null;
    fetchCount: number;
    createdAt: Date;
  }): CalendarFeedResponseDto {
    return {
      id: feed.id,
      kind: feed.kind,
      label: feed.label,
      url: `${publicApiBase()}/api/v1/calendar-feeds/${feed.token}/calendar.ics`,
      lastFetchedAt: feed.lastFetchedAt?.toISOString() ?? null,
      fetchCount: feed.fetchCount,
      createdAt: feed.createdAt.toISOString(),
    };
  }
}

const FEED_SELECT = {
  id: true,
  kind: true,
  label: true,
  token: true,
  lastFetchedAt: true,
  fetchCount: true,
  createdAt: true,
} as const;

/** 256 bits, URL-safe. Long enough that the route needs no rate-limit exemption. */
function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

/** `@db.Date` bounds for the rendered window, in UTC-midnight storage form. */
function feedWindow(forwardDays: number): { from: Date; to: Date } {
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = new Date(`${todayKey}T00:00:00.000Z`);
  return {
    from: new Date(today.getTime() - PAST_DAYS * MS_PER_DAY),
    to: new Date(today.getTime() + forwardDays * MS_PER_DAY),
  };
}

function calendarName(
  kind: CalendarFeedKind,
  operatorName: string | null,
): string {
  const suffix = kind === CalendarFeedKind.BOOKINGS ? 'Bookings' : 'Departures';
  return operatorName
    ? `${operatorName} - ${suffix}`
    : `Island Tours ${suffix}`;
}
