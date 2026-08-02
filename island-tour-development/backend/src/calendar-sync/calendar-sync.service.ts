import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CalendarImportMode,
  CalendarPlatform,
  CalendarSubscriptionStatus,
  IcalSyncOutcome,
  IcalSyncTrigger,
  InboxEvent,
  Prisma,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { InboxService } from '@/inbox/inbox.service';
import { encrypt, safeDecrypt } from '@/common/utils/crypto.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { dayDate } from '@/common/utils/timezone.util';
import {
  normalizeFeedUrl,
  validateFeedUrl,
  type SafeFetchFailure,
} from '@/common/net/safe-http.util';
import { FeedFetcherService } from '@/common/net/feed-fetcher.service';
import { MailService } from '@/mail/mail.service';
import {
  buildNoticeText,
  emailIconBase,
} from '@/bookings/booking-email.context';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import { dashboardAppBase } from '@/common/utils/app-urls.util';
import { CalendarReconcilerService } from './calendar-reconciler.service';
import {
  conflictMail,
  failureMail,
  recoveryMail,
  type CalendarMail,
  type CalendarMailSubscription,
} from './calendar-sync-mail.util';
import {
  mapBlocksToExceptions,
  resolveDurationMinutes,
} from './block-mapper.util';
import { parseBusyBlocks } from './ical-parser.util';
import type {
  CalendarSubscriptionResponseDto,
  CreateCalendarSubscriptionDto,
  DisconnectResponseDto,
  PaginatedSyncLogsDto,
  SyncRunResponseDto,
  UpdateCalendarSubscriptionDto,
  ValidateFeedResponseDto,
} from './dto/calendar-subscription.dto';

/**
 * Inbound calendar sync: connections, and the pipeline that runs one.
 *
 * ## The failure rule this service exists to hold
 * **Only a successful parse may remove a block.** Every error path below leaves
 * the existing imported blocks exactly where they are and only moves the
 * subscription's status. The failure being guarded against is a transient 500 at
 * a channel quietly reopening dates the operator has already sold there - the
 * one moment they have least visibility and most to lose.
 *
 * ## Why the URL is encrypted
 * An OTA calendar URL is a bearer credential for the operator's account on that
 * platform. It is stored as AES-256-GCM ciphertext, decrypted only inside this
 * service at fetch time, masked in every response, and never logged.
 */
@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  /**
   * How far the import reaches. Blocks beyond the materialized horizon are still
   * written - the materializer applies them when it catches up - so this only
   * needs to be wider than the departures window, not narrower.
   */
  private static readonly HORIZON = { pastDays: 30, futureDays: 365 } as const;

  /** Ceiling per tour. Beyond this an operator wants a channel manager, not iCal. */
  private static readonly MAX_PER_TOUR = 10;

  /**
   * Backoff after consecutive failures: 1m, 5m, 15m, 1h, 4h, then every 6h.
   * Permanent errors never enter this ladder - retrying a 404 helps nobody.
   */
  private static readonly RETRY_LADDER_MINUTES = [1, 5, 15, 60, 240];
  private static readonly SLOW_RETRY_MINUTES = 360;

  /**
   * History retention. `UNCHANGED` runs are ~95% of the rows at a 15-minute
   * cadence and say nothing except "it ran", so they go early; everything else
   * is the audit trail and stays, because a double-booking dispute can surface
   * months after the sync that caused it.
   */
  private static readonly KEEP_UNCHANGED_DAYS = 7;
  private static readonly KEEP_ALL_DAYS = 180;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciler: CalendarReconcilerService,
    private readonly inbox: InboxService,
    private readonly fetcher: FeedFetcherService,
    private readonly mail: MailService,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async list(
    user: { id: string; role: Role },
    query: { tourId: string; includeDisconnected?: boolean },
  ): Promise<CalendarSubscriptionResponseDto[]> {
    await this.assertTourAccess(query.tourId, user);

    const rows = await this.prisma.calendarSubscription.findMany({
      where: {
        tourId: query.tourId,
        ...(query.includeDisconnected ? {} : { disconnectedAt: null }),
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(rows.map((row) => this.toDto(row, { maskUrl: true })));
  }

  async getById(
    user: { id: string; role: Role },
    id: string,
  ): Promise<CalendarSubscriptionResponseDto> {
    const row = await this.ownedSubscription(user, id);
    // The detail read is the edit form's source, so it carries the real URL.
    return this.toDto(row, { maskUrl: false });
  }

  /**
   * Dry run for the add form: fetch, parse, report, write nothing.
   *
   * Catching a bad link here turns a class of silent failures - a feed that was
   * never readable, quietly erroring every hour - into a mistake the operator
   * fixes while they are still looking at the field.
   */
  async validate(
    user: { id: string; role: Role },
    input: { tourId: string; url: string },
  ): Promise<ValidateFeedResponseDto> {
    const tour = await this.assertTourAccess(input.tourId, user);

    const checked = validateFeedUrl(input.url);
    if ('ok' in checked && checked.ok === false) {
      return {
        valid: false,
        errorCode: checked.code,
        message: checked.message,
      };
    }

    const fetched = await this.fetcher.fetch(input.url);
    if (!fetched.ok) {
      return {
        valid: false,
        errorCode: fetched.code,
        message: fetched.message,
      };
    }
    if (fetched.notModified) {
      // Nothing sent a conditional header, so a 304 here means a misbehaving
      // origin rather than an unchanged feed.
      return {
        valid: false,
        errorCode: 'NOT_A_CALENDAR',
        message: 'That address did not return a calendar.',
      };
    }

    const parsed = parseBusyBlocks(fetched.body, {
      fallbackTimeZone: tour.timeZone,
      ...this.horizonDates(),
    });
    if (!parsed.ok) {
      return { valid: false, errorCode: parsed.code, message: parsed.message };
    }

    const keys = parsed.blocks.map((b) => b.startDateKey).sort();
    return {
      valid: true,
      eventCount: parsed.blocks.length,
      calendarName: parsed.calendarName,
      firstEvent: keys[0] ?? null,
      lastEvent: keys[keys.length - 1] ?? null,
      feedSizeBytes: fetched.sizeBytes,
      // Empty is valid and normal for a channel with no upcoming bookings.
      warnings: parsed.blocks.length === 0 ? ['EMPTY_FEED'] : [],
    };
  }

  async create(
    user: { id: string; role: Role },
    dto: CreateCalendarSubscriptionDto,
  ): Promise<CalendarSubscriptionResponseDto> {
    await this.assertTourAccess(dto.tourId, user);

    if (dto.platform === CalendarPlatform.OTHER && !dto.platformLabel?.trim()) {
      throw new BadRequestException(
        'platformLabel is required when platform is OTHER',
      );
    }

    const checked = validateFeedUrl(dto.url);
    if ('ok' in checked && checked.ok === false) {
      throw new BadRequestException(checked.message);
    }
    const normalized = normalizeFeedUrl(dto.url);
    const urlHash = hashUrl(normalized);

    const live = await this.prisma.calendarSubscription.count({
      where: { tourId: dto.tourId, disconnectedAt: null },
    });
    if (live >= CalendarSyncService.MAX_PER_TOUR) {
      throw new ConflictException(
        `You have reached the limit of ${CalendarSyncService.MAX_PER_TOUR} calendars for this tour.`,
      );
    }

    const existing = await this.prisma.calendarSubscription.findUnique({
      where: { tourId_urlHash: { tourId: dto.tourId, urlHash } },
      select: { id: true, disconnectedAt: true },
    });
    if (existing && !existing.disconnectedAt) {
      throw new ConflictException('This calendar is already connected.');
    }

    const data = {
      platform: dto.platform,
      platformLabel: dto.platformLabel?.trim() || null,
      url: encrypt(normalized),
      urlHash,
      importMode: dto.importMode ?? CalendarImportMode.WARN_ONLY,
      syncIntervalMinutes: dto.syncIntervalMinutes ?? 60,
      notes: dto.notes ?? null,
      status: CalendarSubscriptionStatus.PENDING,
      // The first sync runs immediately rather than on the next tick, so the
      // operator sees the result while the modal is still in front of them.
      nextPollAt: new Date(),
      autoSyncEnabled: true,
      failureCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastEtag: null,
      lastModified: null,
      lastContentHash: null,
      createdBy: user.id,
    };

    // Reviving a disconnected row keeps its sync history attached rather than
    // orphaning it behind a second connection to the same URL.
    const row = existing
      ? await this.prisma.calendarSubscription.update({
          where: { id: existing.id },
          data: { ...data, disconnectedAt: null },
        })
      : await this.prisma.calendarSubscription.create({
          data: { ...data, tourId: dto.tourId },
        });

    this.logger.log(
      `Calendar subscription ${row.id} connected to tour ${dto.tourId} (${dto.platform})`,
    );
    return this.toDto(row, { maskUrl: false });
  }

  async update(
    user: { id: string; role: Role },
    id: string,
    dto: UpdateCalendarSubscriptionDto,
  ): Promise<CalendarSubscriptionResponseDto> {
    const existing = await this.ownedSubscription(user, id);

    const data: Prisma.CalendarSubscriptionUpdateInput = {
      importMode: dto.importMode,
      syncIntervalMinutes: dto.syncIntervalMinutes,
      autoSyncEnabled: dto.autoSyncEnabled,
      excludeFromExport: dto.excludeFromExport,
      notes: dto.notes,
      platformLabel: dto.platformLabel,
    };

    if (dto.url) {
      const checked = validateFeedUrl(dto.url);
      if ('ok' in checked && checked.ok === false) {
        throw new BadRequestException(checked.message);
      }
      const normalized = normalizeFeedUrl(dto.url);
      data.url = encrypt(normalized);
      data.urlHash = hashUrl(normalized);
      // A new URL is a new feed: the cached validators and the error state
      // describe the old one and would suppress the first real sync.
      data.lastEtag = null;
      data.lastModified = null;
      data.lastContentHash = null;
      data.failureCount = 0;
      data.lastErrorCode = null;
      data.lastErrorMessage = null;
      data.status = CalendarSubscriptionStatus.PENDING;
      data.nextPollAt = new Date();
    }

    if (dto.autoSyncEnabled === false) {
      data.status = CalendarSubscriptionStatus.PAUSED;
      data.nextPollAt = null;
    } else if (dto.autoSyncEnabled === true && existing.status === 'PAUSED') {
      data.status = CalendarSubscriptionStatus.ACTIVE;
      data.nextPollAt = new Date();
    }

    const row = await this.prisma.calendarSubscription.update({
      where: { id },
      data,
    });
    return this.toDto(row, { maskUrl: false });
  }

  /**
   * Disconnect, with the operator choosing what happens to the dates.
   *
   * The default is KEEP, and deliberately: a channel that stopped syncing is not
   * a channel whose dates became free, and releasing them is the one outcome
   * that can cause a double booking.
   */
  async disconnect(
    user: { id: string; role: Role },
    id: string,
    releaseDates: boolean,
  ): Promise<DisconnectResponseDto> {
    const existing = await this.ownedSubscription(user, id);
    if (existing.status === CalendarSubscriptionStatus.SYNCING) {
      throw new ConflictException(
        'A sync is running for this calendar. Try again in a moment.',
      );
    }

    const result = releaseDates
      ? await this.reconciler.releaseBlocks(id, existing.tourId)
      : await this.reconciler.convertBlocksToManual(id);

    await this.prisma.calendarSubscription.update({
      where: { id },
      data: {
        status: CalendarSubscriptionStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        autoSyncEnabled: false,
        nextPollAt: null,
      },
    });

    this.logger.log(
      `Calendar subscription ${id} disconnected (releaseDates=${releaseDates})`,
    );
    return {
      datesReleased: 'released' in result ? result.released : 0,
      datesConvertedToManual: 'converted' in result ? result.converted : 0,
    };
  }

  /**
   * Paginated run history for one connection.
   *
   * Deliberately a first-class surface, not a debug table. It is how an operator
   * answers "why did my dates change" and "why has nothing synced since
   * Tuesday", it is the audit trail when an import closed a booked date, and in
   * `WARN_ONLY` - where nothing is written to availability - it is most of what
   * the feature produces.
   */
  async listSyncLogs(
    user: { id: string; role: Role },
    id: string,
    query: { page?: number; limit?: number },
  ): Promise<PaginatedSyncLogsDto> {
    await this.ownedSubscription(user, id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [total, rows] = await Promise.all([
      this.prisma.icalSyncLog.count({ where: { subscriptionId: id } }),
      this.prisma.icalSyncLog.findMany({
        where: { subscriptionId: id },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          outcome: true,
          trigger: true,
          httpStatus: true,
          eventsFound: true,
          blocksCreated: true,
          blocksRemoved: true,
          conflictsDetected: true,
          errorCode: true,
          errorMessage: true,
          durationMs: true,
          startedAt: true,
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((row) => ({
        ...row,
        startedAt: row.startedAt.toISOString(),
      })),
    };
  }

  /**
   * Trim sync history. Called nightly.
   *
   * Two windows, because the rows are not equally useful. At a 15-minute cadence
   * a single connection writes ~96 rows a day and almost all of them say
   * "nothing changed" - which is worth keeping for a week to answer "is it
   * running?", and worthless after that. Anything that FAILED or actually moved
   * inventory is the audit trail and survives far longer, since a double-booking
   * dispute can surface months later.
   */
  async pruneSyncLogs(): Promise<{ removed: number }> {
    const day = 86_400_000;
    const now = Date.now();

    const [noise, old] = await Promise.all([
      this.prisma.icalSyncLog.deleteMany({
        where: {
          outcome: IcalSyncOutcome.UNCHANGED,
          startedAt: {
            lt: new Date(now - CalendarSyncService.KEEP_UNCHANGED_DAYS * day),
          },
        },
      }),
      this.prisma.icalSyncLog.deleteMany({
        where: {
          startedAt: {
            lt: new Date(now - CalendarSyncService.KEEP_ALL_DAYS * day),
          },
        },
      }),
    ]);

    const removed = noise.count + old.count;
    if (removed > 0) {
      this.logger.log(`Pruned ${removed} calendar sync log row(s)`);
    }
    return { removed };
  }

  // ── Sync ────────────────────────────────────────────────────────────────────

  /** Operator-triggered sync. Allowed even on a paused or errored connection - it is how a fix is verified. */
  async syncNow(
    user: { id: string; role: Role },
    id: string,
  ): Promise<SyncRunResponseDto> {
    const existing = await this.ownedSubscription(user, id);
    if (existing.status === CalendarSubscriptionStatus.SYNCING) {
      throw new ConflictException('A sync is already in progress.');
    }
    return this.runSync(id, IcalSyncTrigger.MANUAL, user.id);
  }

  /**
   * The pipeline: fetch → parse → map → reconcile → log.
   *
   * Shared by the manual button and the scheduler, so both paths behave
   * identically and there is only one place the failure rule has to hold.
   */
  async runSync(
    subscriptionId: string,
    trigger: IcalSyncTrigger,
    triggeredBy?: string,
  ): Promise<SyncRunResponseDto> {
    const startedAt = new Date();
    const subscription = await this.prisma.calendarSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        tour: {
          select: {
            id: true,
            name: true,
            // Needed to address the inbox notification at the owning operator.
            operatorId: true,
            timeZone: true,
            durationMinutesTo: true,
            durationMinutesFrom: true,
          },
        },
      },
    });
    if (!subscription || subscription.disconnectedAt) {
      throw new NotFoundException('Calendar subscription not found');
    }

    await this.prisma.calendarSubscription.update({
      where: { id: subscriptionId },
      data: { status: CalendarSubscriptionStatus.SYNCING },
    });

    const url = safeDecrypt(subscription.url);
    if (!url) {
      // The key rotated, or the row predates encryption. Permanent by nature:
      // no amount of retrying will make an unreadable ciphertext readable.
      return this.finishFailed(
        subscription,
        trigger,
        triggeredBy,
        startedAt,
        {
          ok: false,
          code: 'URL_MALFORMED',
          message: 'This calendar link could not be read. Please re-enter it.',
          transient: false,
        },
        null,
      );
    }

    const fetched = await this.fetcher.fetch(url, {
      etag: subscription.lastEtag,
      lastModified: subscription.lastModified,
    });

    if (!fetched.ok) {
      return this.finishFailed(
        subscription,
        trigger,
        triggeredBy,
        startedAt,
        fetched,
        null,
      );
    }

    if (fetched.notModified) {
      return this.finishUnchanged(
        subscription,
        trigger,
        triggeredBy,
        startedAt,
        {
          httpStatus: 304,
        },
      );
    }

    // Some feeds never send an ETag, so hash the body as a second short-circuit.
    const contentHash = createHash('sha256').update(fetched.body).digest('hex');
    if (contentHash === subscription.lastContentHash) {
      return this.finishUnchanged(
        subscription,
        trigger,
        triggeredBy,
        startedAt,
        {
          httpStatus: fetched.status,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
        },
      );
    }

    const parsed = parseBusyBlocks(fetched.body, {
      fallbackTimeZone: subscription.tour.timeZone,
      ...this.horizonDates(),
    });
    if (!parsed.ok) {
      return this.finishFailed(
        subscription,
        trigger,
        triggeredBy,
        startedAt,
        {
          ok: false,
          code: parsed.code,
          message: parsed.message,
          transient: parsed.transient,
        },
        fetched.status,
      );
    }

    const { from, to } = this.horizonRange();
    const departures = await this.prisma.departure.findMany({
      where: { tourId: subscription.tourId, date: { gte: from, lte: to } },
      select: {
        id: true,
        date: true,
        startTime: true,
        capacity: true,
        bookedCount: true,
      },
    });

    const mapped = mapBlocksToExceptions({
      blocks: parsed.blocks,
      tour: {
        timeZone: subscription.tour.timeZone,
        durationMinutes: resolveDurationMinutes(subscription.tour),
      },
      departures,
      mode: subscription.importMode,
      sourceLabel: platformLabel(
        subscription.platform,
        subscription.platformLabel,
      ),
    });

    const applied = await this.reconciler.reconcile({
      subscriptionId,
      tourId: subscription.tourId,
      desired: mapped.desired,
      conflicts: mapped.conflicts,
      events: parsed.blocks,
    });

    const finishedAt = new Date();
    const outcome =
      parsed.truncated || Object.keys(parsed.skipped).length > 0
        ? IcalSyncOutcome.PARTIAL
        : subscription.importMode === CalendarImportMode.IGNORE
          ? IcalSyncOutcome.DRY_RUN
          : IcalSyncOutcome.SUCCESS;

    await this.prisma.$transaction([
      this.prisma.icalSyncLog.create({
        data: {
          subscriptionId,
          tourId: subscription.tourId,
          trigger,
          triggeredBy: triggeredBy ?? null,
          outcome,
          httpStatus: fetched.status,
          eventsFound: parsed.eventsFound,
          eventsAdded: applied.eventsAdded,
          eventsRemoved: applied.eventsRemoved,
          blocksCreated: applied.blocksCreated,
          blocksRemoved: applied.blocksRemoved,
          conflictsDetected: applied.conflictsDetected,
          responseSizeBytes: fetched.sizeBytes,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          startedAt,
          finishedAt,
        },
      }),
      this.prisma.calendarSubscription.update({
        where: { id: subscriptionId },
        data: {
          status: CalendarSubscriptionStatus.ACTIVE,
          lastPolledAt: finishedAt,
          lastSuccessAt: finishedAt,
          lastEtag: fetched.etag,
          lastModified: fetched.lastModified,
          lastContentHash: contentHash,
          lastEventCount: parsed.eventsFound,
          failureCount: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          nextPollAt: this.scheduleNext(subscription.syncIntervalMinutes, 0),
        },
      }),
    ]);

    // `conflictsDetected` counts only the NEW ones - the reconciler suppresses
    // any the operator has already been shown - so this fires on news, not on
    // the same double-sale every fifteen minutes.
    if (applied.conflictsDetected > 0) {
      this.notifyConflict(subscription, applied.conflictsDetected);
    }

    // The other half of the transition pair. The failure alert is sent once, on
    // the way into a broken state, so this is the only thing that tells an
    // operator their fix worked - without it they are left watching a dashboard
    // to find out whether the link they just replaced took.
    if (
      subscription.status === CalendarSubscriptionStatus.ERROR ||
      subscription.status === CalendarSubscriptionStatus.INVALID_URL
    ) {
      this.notifyRecovery(subscription);
    }

    return {
      outcome,
      eventsFound: parsed.eventsFound,
      blocksCreated: applied.blocksCreated,
      blocksRemoved: applied.blocksRemoved,
      conflictsDetected: applied.conflictsDetected,
      errorCode: null,
      errorMessage: null,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  // ── internals ───────────────────────────────────────────────────────────────

  /**
   * Record a failure WITHOUT touching a single imported block.
   *
   * This is the rule the whole feature rests on. Releasing dates because a fetch
   * failed would reopen inventory the operator has already sold on that channel,
   * at exactly the moment they cannot see it happening.
   */
  private async finishFailed(
    subscription: NotifiableSubscription & {
      failureCount: number;
      syncIntervalMinutes: number;
      status: CalendarSubscriptionStatus;
    },
    trigger: IcalSyncTrigger,
    triggeredBy: string | undefined,
    startedAt: Date,
    failure:
      | SafeFetchFailure
      | { ok: false; code: string; message: string; transient: boolean },
    httpStatus: number | null,
  ): Promise<SyncRunResponseDto> {
    const finishedAt = new Date();
    const failureCount = failure.transient ? subscription.failureCount + 1 : 0;
    const exhausted =
      !failure.transient ||
      failureCount >= CalendarSyncService.RETRY_LADDER_MINUTES.length;

    const status = !failure.transient
      ? CalendarSubscriptionStatus.INVALID_URL
      : exhausted
        ? CalendarSubscriptionStatus.ERROR
        : CalendarSubscriptionStatus.ACTIVE;

    await this.prisma.$transaction([
      this.prisma.icalSyncLog.create({
        data: {
          subscriptionId: subscription.id,
          tourId: subscription.tourId,
          trigger,
          triggeredBy: triggeredBy ?? null,
          outcome: IcalSyncOutcome.FAILED,
          httpStatus:
            httpStatus ??
            ('httpStatus' in failure ? (failure.httpStatus ?? null) : null),
          errorCode: failure.code,
          errorMessage: failure.message,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          startedAt,
          finishedAt,
        },
      }),
      this.prisma.calendarSubscription.update({
        where: { id: subscription.id },
        data: {
          status,
          lastPolledAt: finishedAt,
          failureCount,
          lastErrorCode: failure.code,
          lastErrorMessage: failure.message,
          // A permanent error stops the schedule; a transient one climbs the ladder.
          nextPollAt: failure.transient
            ? this.scheduleNext(subscription.syncIntervalMinutes, failureCount)
            : null,
        },
      }),
    ]);

    this.logger.warn(
      `Calendar subscription ${subscription.id} sync failed: ${failure.code}`,
    );

    // Only on the TRANSITION into a broken state. Notifying on every attempt
    // would send an alert each time the retry ladder ticks, and an operator who
    // is told six times about one dead link stops reading the seventh.
    const wasBroken =
      subscription.status === CalendarSubscriptionStatus.ERROR ||
      subscription.status === CalendarSubscriptionStatus.INVALID_URL;
    const nowBroken =
      status === CalendarSubscriptionStatus.ERROR ||
      status === CalendarSubscriptionStatus.INVALID_URL;
    if (nowBroken && !wasBroken) {
      this.notifyFailure(subscription, failure.code, failure.message);
    }

    return {
      outcome: IcalSyncOutcome.FAILED,
      eventsFound: 0,
      blocksCreated: 0,
      blocksRemoved: 0,
      conflictsDetected: 0,
      errorCode: failure.code,
      errorMessage: failure.message,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * Tell the operator an imported block landed on a departure they have sold.
   *
   * This is the alert the whole feature is judged on. iCal is POLLED, not
   * pushed, so a channel can sell a seat we only learn about hours later - the
   * atomic claim cannot see it, and nothing else in the system will say so. In
   * `WARN_ONLY`, where nothing is written to availability at all, this
   * notification IS the product.
   */
  private notifyConflict(
    subscription: NotifiableSubscription,
    fresh: number,
  ): void {
    const label = platformLabel(
      subscription.platform,
      subscription.platformLabel,
    );
    const plural = fresh === 1 ? 'departure' : 'departures';

    this.inbox.notify({
      event: InboxEvent.CALENDAR_SYNC_CONFLICT,
      operatorId: subscription.tour.operatorId,
      title: `${label} overlaps ${fresh} booked ${plural} on ${subscription.tour.name}`,
      body:
        `${label} marks time as busy that you have already sold here. ` +
        `Existing bookings are untouched - no traveller has been cancelled. ` +
        `Check whether the same seats were sold on both channels.`,
      url: `/trips/${subscription.tourId}/edit?step=schedules`,
      entityType: 'calendarSubscription',
      entityId: subscription.id,
      // One per connection per day: the reconciler already suppresses conflicts
      // the operator has seen, so anything reaching here is genuinely new, but a
      // 15-minute poll should still never produce more than a daily nudge.
      dedupeKey: `calendar-conflict:${subscription.id}:${todayKey()}`,
    });

    void this.emailOperator(subscription, (ctx) => conflictMail(ctx, fresh));
  }

  /** Tell the operator a feed has stopped working, and that their dates are safe. */
  private notifyFailure(
    subscription: NotifiableSubscription,
    code: string,
    message: string,
  ): void {
    const label = platformLabel(
      subscription.platform,
      subscription.platformLabel,
    );

    this.inbox.notify({
      event: InboxEvent.CALENDAR_SYNC_FAILED,
      operatorId: subscription.tour.operatorId,
      title: `${label} calendar stopped syncing on ${subscription.tour.name}`,
      // Answer the operator's first question in the body, not the third: their
      // existing blocks are retained, so they are not at risk right now.
      body:
        `${message} The dates it had already blocked are still blocked, so you ` +
        `are not at risk of a double booking. New reservations on ${label} will ` +
        `not appear here until this is fixed.`,
      url: `/trips/${subscription.tourId}/edit?step=schedules`,
      entityType: 'calendarSubscription',
      entityId: subscription.id,
      // Per connection, per error code, per day - a link that 404s all week is
      // one problem, not seven.
      dedupeKey: `calendar-failed:${subscription.id}:${code}:${todayKey()}`,
    });

    void this.emailOperator(subscription, (ctx) => failureMail(ctx, message));
  }

  /**
   * Tell the operator a feed they were warned about is working again.
   *
   * This is what lets the failure email be sent ONCE instead of on every rung of
   * the retry ladder: an operator told both when it breaks and when it recovers
   * always knows which state they are in, so silence in between is safe to read
   * as "still broken, still being retried".
   */
  private notifyRecovery(subscription: NotifiableSubscription): void {
    const label = platformLabel(
      subscription.platform,
      subscription.platformLabel,
    );

    this.inbox.notify({
      event: InboxEvent.CALENDAR_SYNC_FAILED,
      operatorId: subscription.tour.operatorId,
      title: `${label} calendar is syncing again on ${subscription.tour.name}`,
      body:
        `We read ${label} successfully, so this tour is up to date with that ` +
        `channel again. Any dates booked there while the link was down have ` +
        `been applied.`,
      url: `/trips/${subscription.tourId}/edit?step=schedule`,
      entityType: 'calendarSubscription',
      entityId: subscription.id,
      dedupeKey: `calendar-recovered:${subscription.id}:${todayKey()}`,
    });

    void this.emailOperator(subscription, recoveryMail);
  }

  /**
   * Send one calendar alert to the operator's contact address.
   *
   * Fire-and-forget on purpose, and every failure is swallowed after logging: a
   * bounced address, a Resend outage or a missing contact email must never fail
   * a sync. The sync has already been committed by the time this runs - throwing
   * here would turn "we emailed you about a conflict" into "we lost the sync
   * that found it", which is strictly worse than a missed email.
   *
   * Addressed to the operator's `contactEmail`, falling back to the owner's
   * login address. An operator with neither simply gets the dashboard bell.
   */
  private async emailOperator(
    subscription: NotifiableSubscription,
    build: (ctx: {
      subscription: CalendarMailSubscription;
      dashboardBaseUrl: string;
      siteLogoUrl: string;
      emailIconBase: string;
    }) => CalendarMail,
  ): Promise<void> {
    try {
      const [operator, site] = await Promise.all([
        this.prisma.operator.findUnique({
          where: { id: subscription.tour.operatorId },
          select: {
            contactEmail: true,
            user: { select: { email: true } },
          },
        }),
        this.prisma.siteInfo.findFirst({ select: { logo: true } }),
      ]);

      const to = operator?.contactEmail?.trim() || operator?.user?.email;
      if (!to) {
        this.logger.warn(
          `No contact address for operator ${subscription.tour.operatorId}; calendar alert not emailed`,
        );
        return;
      }

      const mail = build({
        subscription: {
          tourId: subscription.tourId,
          tourName: subscription.tour.name,
          channelLabel: platformLabel(
            subscription.platform,
            subscription.platformLabel,
          ),
        },
        dashboardBaseUrl: dashboardAppBase(),
        siteLogoUrl: emailSafeLogoUrl(site?.logo ?? null) ?? '',
        emailIconBase: emailIconBase(),
      });

      await this.mail.sendBookingNoticeEmail(
        to,
        mail.subject,
        mail.context,
        buildNoticeText(mail.context),
      );
    } catch (err) {
      this.logger.error(
        `Calendar alert email failed for subscription ${subscription.id}`,
        err as Error,
      );
    }
  }

  /** A 304 or an identical body: the cheapest and most common outcome. */
  private async finishUnchanged(
    subscription: { id: string; tourId: string; syncIntervalMinutes: number },
    trigger: IcalSyncTrigger,
    triggeredBy: string | undefined,
    startedAt: Date,
    meta: {
      httpStatus: number;
      etag?: string | null;
      lastModified?: string | null;
    },
  ): Promise<SyncRunResponseDto> {
    const finishedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.icalSyncLog.create({
        data: {
          subscriptionId: subscription.id,
          tourId: subscription.tourId,
          trigger,
          triggeredBy: triggeredBy ?? null,
          outcome: IcalSyncOutcome.UNCHANGED,
          httpStatus: meta.httpStatus,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          startedAt,
          finishedAt,
        },
      }),
      this.prisma.calendarSubscription.update({
        where: { id: subscription.id },
        data: {
          status: CalendarSubscriptionStatus.ACTIVE,
          lastPolledAt: finishedAt,
          lastSuccessAt: finishedAt,
          failureCount: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          ...(meta.etag !== undefined ? { lastEtag: meta.etag } : {}),
          ...(meta.lastModified !== undefined
            ? { lastModified: meta.lastModified }
            : {}),
          nextPollAt: this.scheduleNext(subscription.syncIntervalMinutes, 0),
        },
      }),
    ]);

    return {
      outcome: IcalSyncOutcome.UNCHANGED,
      eventsFound: 0,
      blocksCreated: 0,
      blocksRemoved: 0,
      conflictsDetected: 0,
      errorCode: null,
      errorMessage: null,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  /**
   * Next poll time, with ±10% jitter.
   *
   * The jitter matters at scale: without it, every connection created by one
   * migration polls the same channel in the same second, forever.
   */
  private scheduleNext(intervalMinutes: number, failureCount: number): Date {
    const base =
      failureCount === 0
        ? intervalMinutes
        : (CalendarSyncService.RETRY_LADDER_MINUTES[failureCount - 1] ??
          CalendarSyncService.SLOW_RETRY_MINUTES);
    const jitter = 1 + (Math.random() * 0.2 - 0.1);
    return new Date(Date.now() + base * 60_000 * jitter);
  }

  private horizonRange(): { from: Date; to: Date } {
    const today = dayDate(new Date().toISOString().slice(0, 10));
    const day = 86_400_000;
    return {
      from: new Date(
        today.getTime() - CalendarSyncService.HORIZON.pastDays * day,
      ),
      to: new Date(
        today.getTime() + CalendarSyncService.HORIZON.futureDays * day,
      ),
    };
  }

  private horizonDates(): { horizonStart: Date; horizonEnd: Date } {
    const { from, to } = this.horizonRange();
    return { horizonStart: from, horizonEnd: to };
  }

  private async assertTourAccess(
    tourId: string,
    user: { id: string; role: Role },
  ): Promise<{ operatorId: string; timeZone: string }> {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { operatorId: true, timeZone: true },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    if (user.role === Role.ADMIN) return tour;

    const operatorId = await resolveOperatorId(this.prisma, user.id, user.role);
    if (tour.operatorId !== operatorId) {
      throw new ForbiddenException(
        'You do not have permission to manage this tour',
      );
    }
    return tour;
  }

  /** Scopes a subscription id to a tour the caller may manage. */
  private async ownedSubscription(
    user: { id: string; role: Role },
    id: string,
  ) {
    const row = await this.prisma.calendarSubscription.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Calendar subscription not found');
    await this.assertTourAccess(row.tourId, user);
    return row;
  }

  private async toDto(
    row: Prisma.CalendarSubscriptionGetPayload<object>,
    options: { maskUrl: boolean },
  ): Promise<CalendarSubscriptionResponseDto> {
    const [blockedCount, openConflictCount] = await Promise.all([
      this.prisma.availabilityException.count({
        where: { subscriptionId: row.id },
      }),
      this.prisma.calendarConflict.count({
        where: { subscriptionId: row.id, acknowledgedAt: null },
      }),
    ]);

    const plain = safeDecrypt(row.url) ?? '';
    return {
      id: row.id,
      tourId: row.tourId,
      platform: row.platform,
      platformLabel: row.platformLabel,
      url: options.maskUrl ? maskUrl(plain) : plain,
      urlMasked: options.maskUrl,
      importMode: row.importMode,
      status: row.status,
      autoSyncEnabled: row.autoSyncEnabled,
      syncIntervalMinutes: row.syncIntervalMinutes,
      lastPolledAt: row.lastPolledAt?.toISOString() ?? null,
      lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
      lastErrorCode: row.lastErrorCode,
      lastErrorMessage: row.lastErrorMessage,
      lastEventCount: row.lastEventCount,
      blockedCount,
      openConflictCount,
      excludeFromExport: row.excludeFromExport,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

/** The fields a notification needs: who owns it, and what to call it. */
interface NotifiableSubscription {
  id: string;
  tourId: string;
  platform: CalendarPlatform;
  platformLabel: string | null;
  tour: { name: string; operatorId: string };
}

/** `YYYY-MM-DD`, used to bucket notification dedupe keys to one per day. */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** SHA-256 of the NORMALIZED url - ciphertext is non-deterministic and cannot be compared. */
function hashUrl(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Origin plus a hint of the path. Enough to tell WHICH calendar is connected,
 * useless as a credential - the token always lives in the tail we drop.
 */
function maskUrl(plain: string): string {
  if (!plain) return '';
  try {
    const url = new URL(plain);
    return `${url.origin}/…`;
  } catch {
    return '…';
  }
}

const PLATFORM_NAMES: Record<CalendarPlatform, string> = {
  AIRBNB: 'Airbnb',
  BOOKING_COM: 'Booking.com',
  EXPEDIA: 'Expedia',
  VRBO: 'Vrbo',
  VIATOR: 'Viator',
  GETYOURGUIDE: 'GetYourGuide',
  MAKEMYTRIP: 'MakeMyTrip',
  GOOGLE_CALENDAR: 'Google Calendar',
  OTHER: 'External calendar',
};

/** The name that ends up on the operator's agenda beside a closed day. */
function platformLabel(
  platform: CalendarPlatform,
  label: string | null,
): string {
  return platform === CalendarPlatform.OTHER && label
    ? label
    : PLATFORM_NAMES[platform];
}
