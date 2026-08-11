import { Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus,
  DepartureStatus,
  EmailAudience,
  EmailStream,
  EmailTemplateKey,
  Locale,
  Prisma,
  TourStatus,
} from '@prisma/client';
import {
  emailIconBase,
  preferLocale,
  toLocale,
} from '@/bookings/booking-email.context';
import { islandToursBase, publicApiBase } from '@/common/utils/app-urls.util';
import { localNow } from '@/common/utils/timezone.util';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailLogService } from './email-log.service';
import { EmailPreferencesService } from './email-preferences.service';
import { MailService } from './mail.service';
import {
  buildNextAdventureEmailContext,
  buildNextAdventureEmailText,
  type NextAdventureCardInput,
} from './next-adventure-email.context';
import { selectNextAdventureTours } from './next-adventure-selection.util';
import { isMarketingMorningWindowOpen } from './send-window.util';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

/** The wireframe trigger: tour_end + 72h, evaluated in the booking's zone. */
const TRIGGER_OFFSET_MS = 72 * HOUR_MS;

/**
 * How stale a tour end may be and still get MK-1. "Still have days left on
 * the island?" stops being true long before this; two weeks bounds the
 * first-deploy backlog AND keeps undecided bookings from being re-scanned
 * forever (the anti-join only removes DECIDED ones). Bookings that age past
 * the horizon unsent simply never get the email — no suppression row, the
 * moving lower bound is what retires them.
 */
const HORIZON_MS = 14 * DAY_MS;

/**
 * `tourEndDateTime` stores the LOCAL wall clock Z-labelled, so the SQL
 * pre-filter compares apples to oranges by up to the zone offset. 14h covers
 * every real UTC offset; the precise per-booking check in `isDue` (via
 * `localNow`) is the authority, exactly the BK-3 coarse-then-precise shape.
 */
const ZONE_SLACK_MS = 14 * HOUR_MS;

/** Candidate cap per tick — bounds a tick, the next tick resumes (D-25). */
const SWEEP_BATCH = 500;

/**
 * The wave-2 house rule: MK-1 runs its own capped+paced loop EQUIVALENT to
 * the onboarding sweep's (same constants, same rationale — Resend's ~2/s
 * default rate limit, and a post-downtime burst must never overrun the
 * 15-minute cadence). Deferred candidates are re-found by the anti-join.
 */
const SEND_CAP_PER_TICK = 200;
const SEND_PACING_MS = 500;

/** Availability window for the cards: OPEN departures inside 7 days (G-06). */
const AVAILABILITY_WINDOW_DAYS = 7;

/** A committed follow-up booking, for the booked-again suppression. */
const BOOKED_AGAIN_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.REDEEMED,
];

/** The booking projection the evaluator + renderer read. */
const BOOKING_SELECT = {
  id: true,
  displayRef: true,
  status: true,
  createdAt: true,
  contactEmail: true,
  customerLocale: true,
  tourEndDateTime: true,
  tourTimeZone: true,
  utcCancellationRequestedAt: true,
  utcCancelledAt: true,
  tourId: true,
  review: { select: { rating: true } },
  tour: {
    select: {
      name: true,
      timeZone: true,
      destinationId: true,
      destination: { select: { name: true, slug: true } },
      categories: {
        where: { isPrimary: true },
        select: { categoryId: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

/** The tour projection one MK-1 card renders from (select: discipline). */
const CARD_TOUR_SELECT = (locale: Locale, windowStart: Date, windowEnd: Date) =>
  ({
    id: true,
    name: true,
    slug: true,
    priceFrom: true,
    defaultCurrency: true,
    aggregateRating: true,
    aggregateReviewCount: true,
    durationMinutesFrom: true,
    qualityScore: true,
    images: { where: { isHero: true }, select: { url: true }, take: 1 },
    categories: {
      where: { isPrimary: true },
      select: { categoryId: true },
      take: 1,
    },
    translations: {
      where: { locale: { in: [locale, Locale.en] } },
      select: { locale: true, shortDescription: true },
    },
    departures: {
      where: {
        status: DepartureStatus.OPEN,
        date: { gte: windowStart, lt: windowEnd },
      },
      select: { date: true },
      orderBy: { date: 'asc' },
      // One row per DATE: the "Open:" line names days, and a four-slots-a-day
      // tour must not push the window's last weekday past the cap (review
      // Minor 5). Seven island dates max.
      distinct: ['date'],
      take: 7,
    },
  }) satisfies Prisma.TourSelect;

/**
 * WP-G: the MK-1 "Next adventure" marketing email (EMAIL-PROGRAMME-CHECKLIST
 * G-10…G-14) — the traveller-facing half of the 15-minute lifecycle sweep.
 *
 * Lives in the global MailModule beside OnboardingEmailsService for the same
 * reason it does: NightlyJobsService invokes it without new module imports,
 * and it reads bookings/tours through Prisma directly.
 *
 * ## Window
 * "Curaçao morning" (wireframe): 09:00–11:00 America/Curacao ANY day —
 * `isMarketingMorningWindowOpen`, NOT the Tue–Thu lifecycle window. The
 * trigger is tour_end + 72h; a weekday-pinned window would slide sends by
 * days and mail travellers who already flew home.
 *
 * ## Sweep shape (the D-25 house rule)
 * The candidate query pre-filters with `NOT EXISTS (email_sends MK1,
 * bookingId)` — decided bookings (sent, failed, or suppressed) never
 * re-enter; `claimAndSend` closes only the residual race between ticks.
 *
 * ## The gate (G-11)
 * A send requires BOTH an `EmailConsent` row for the lowercased contact
 * email AND no MARKETING `EmailOptOut`. An empty consent table therefore
 * means ZERO marketing sends — the launch switch is the data, not a flag.
 *
 * ## Suppressions (G-12) — decisions, with reasons
 * cancelled (status left CONFIRMED/REDEEMED) · cancellation-pending ·
 * low-star-review (1–2★) · booked-again · no-consent · opted-out ·
 * insufficient-open-tours (G-07). Two of the wireframe's six have NO signal
 * in the platform today and are documented skips in `evaluate`:
 * no-show (no field marks a no-show anywhere in the schema) and complained
 * (no bounce/complaint webhook exists).
 */
@Injectable()
export class NextAdventureEmailsService {
  /**
   * Card working-set cache, valid for ONE sweep tick (~2 min worst case) -
   * cleared at every sweep entry, so "availability at send time" stays
   * honest while 100 same-destination candidates share one query.
   */
  private readonly cardRowsCache = new Map<
    string,
    Awaited<ReturnType<NextAdventureEmailsService['queryCardRows']>>
  >();

  private readonly logger = new Logger(NextAdventureEmailsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly emailLog: EmailLogService,
    private readonly emailPreferences: EmailPreferencesService,
  ) {}

  /** One `email.lifecycle-sweep` tick's MK-1 pass (G-10). */
  async sweep(now: Date = new Date()): Promise<void> {
    // Closed window = "not yet", never a decision: nothing is written and
    // the anti-join re-finds every candidate when the morning opens.
    if (!isMarketingMorningWindowOpen(now)) return;
    // MASTER SWITCH, the ReviewRequestSettings.enabled precedent: MK-1 stays
    // dark until deliberately enabled, even for consented addresses - the
    // founder flips it, not a deploy. "Not yet" semantics: nothing is
    // written, the anti-join re-finds everyone when it turns on. WP-H moves
    // this to a dashboard setting with the env var as fallback.
    if (process.env.MK1_ENABLED?.trim() !== 'true') return;
    this.cardRowsCache.clear();

    const ids = await this.fetchCandidateIds(now);
    if (ids.length === 0) return;

    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: ids } },
      select: BOOKING_SELECT,
    });
    const siteLogoUrl = await this.siteLogo();
    // One "See all {n} tours" count per destination per tick, not per booking.
    const tourCounts = new Map<string, number>();

    let sent = 0;
    let capped = 0;
    for (const booking of bookings) {
      if (sent >= SEND_CAP_PER_TICK) {
        // Beyond the cap the backlog just waits — the anti-join re-finds
        // every undecided booking next tick (same rule as the OB sweep).
        capped++;
        continue;
      }
      const outcome = await this.evaluate(
        booking,
        now,
        siteLogoUrl,
        tourCounts,
      );
      if (outcome === 'sent') {
        sent++;
        // ~2 sends/s: a 429 would mark the claim FAILED and burn the
        // send-once slot permanently.
        await NextAdventureEmailsService.sleep(SEND_PACING_MS);
      }
    }
    this.logger.log(
      `MK-1 sweep: ${bookings.length} candidate(s), ${sent} sent` +
        (capped ? `, ${capped} deferred by the per-tick cap` : ''),
    );
  }

  /**
   * Undecided bookings whose tour ended ~72h ago — the D-25 anti-join, raw
   * SQL because `email_sends` has no Prisma relation to `bookings` (scopeId
   * is polymorphic). CANCELLED is deliberately IN the set: the wireframe
   * wants a recorded suppression reason for it, so it must reach the
   * evaluator once (then the anti-join retires it). ON_HOLD / EXPIRED /
   * REJECTED / PENDING never completed checkout and stay out entirely —
   * they are not customers and must not spawn suppression rows.
   */
  private async fetchCandidateIds(now: Date): Promise<string[]> {
    const coarseCutoff = new Date(
      now.getTime() - TRIGGER_OFFSET_MS + ZONE_SLACK_MS,
    );
    const horizon = new Date(
      now.getTime() - TRIGGER_OFFSET_MS - HORIZON_MS - ZONE_SLACK_MS,
    );
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT b."id"
      FROM "bookings" b
      WHERE b."status" IN (
          ${BookingStatus.CONFIRMED}::"BookingStatus",
          ${BookingStatus.REDEEMED}::"BookingStatus",
          ${BookingStatus.CANCELLED}::"BookingStatus"
        )
        AND b."contactEmail" IS NOT NULL
        AND b."tourEndDateTime" IS NOT NULL
        AND b."tourEndDateTime" <= ${coarseCutoff}
        AND b."tourEndDateTime" >= ${horizon}
        AND NOT EXISTS (
          SELECT 1 FROM "email_sends" es
          WHERE es."templateKey" = ${EmailTemplateKey.MK1_NEXT_ADVENTURE}::"EmailTemplateKey"
            AND es."scopeId" = b."id"
        )
      ORDER BY b."tourEndDateTime" ASC
      LIMIT ${SWEEP_BATCH}
    `;
    return rows.map((r) => r.id);
  }

  /**
   * Send-time evaluation for one booking: dueness first (a coarse SQL match
   * that is not precisely due yet is "not yet" — nothing written), then the
   * G-12 suppression ladder, then the G-11 consent gate, then availability.
   */
  private async evaluate(
    booking: BookingRow,
    now: Date,
    siteLogoUrl: string | null,
    tourCounts: Map<string, number>,
  ): Promise<'sent' | 'skipped'> {
    if (!this.isDue(booking, now)) return 'skipped';

    // The candidate SQL requires contactEmail IS NOT NULL; a blank-after-trim
    // address is "not yet" (nothing written) rather than a decided reason
    // outside the documented G-12 set (review Nit 10).
    const email = booking.contactEmail?.trim().toLowerCase();
    if (!email) return 'skipped';

    // Cancelled / forfeited / operator-cancelled all LEAVE the completed
    // statuses (the BK-2 rule), so one status check covers the wireframe's
    // whole cancellation list.
    if (
      booking.status !== BookingStatus.CONFIRMED &&
      booking.status !== BookingStatus.REDEEMED
    ) {
      await this.suppress(booking, email, 'cancelled');
      return 'skipped';
    }

    // A pending cancellation request leaves status CONFIRMED until the admin
    // acts — marketing "your next adventure" to someone waiting to be
    // refunded is the same trust-damage class resendConfirmation guards.
    if (booking.utcCancellationRequestedAt && !booking.utcCancelledAt) {
      await this.suppress(booking, email, 'cancellation-pending');
      return 'skipped';
    }

    // Wireframe suppression "no-show": DOCUMENTED SKIP — nothing in the
    // schema marks a no-show today (no booking field, no unit-item state).
    // When redemption tracking lands, the check belongs right here.

    // Wireframe suppression "complained": DOCUMENTED SKIP — no
    // bounce/complaint webhook exists today (no Resend inbound events).
    // When one lands, it should write a MARKETING opt-out and this ladder
    // catches it below without changes.

    if (booking.review && booking.review.rating <= 2) {
      // A 1–2★ reviewer told us the last tour disappointed; selling them the
      // next one reads as not listening (wireframe suppression list).
      await this.suppress(booking, email, 'low-star-review');
      return 'skipped';
    }

    // Booked again: a committed booking by the same address, created after
    // this one — they already chose their next adventure. Raw SQL on
    // lower("contactEmail") so the expression index serves it (Prisma's
    // insensitive mode compiles to a form no btree can use - perf review of
    // #188, High: this was a full scan of bookings per candidate).
    const rebookedRows = await this.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n
      FROM "bookings" b
      WHERE lower(b."contactEmail") = ${email}
        AND b."id" <> ${booking.id}
        AND b."createdAt" > ${booking.createdAt}
        AND b."status" = ANY(${BOOKED_AGAIN_STATUSES}::"BookingStatus"[])
    `;
    const rebooked = Number(rebookedRows[0]?.n ?? 0);
    if (rebooked > 0) {
      await this.suppress(booking, email, 'booked-again');
      return 'skipped';
    }

    // ── The G-11 gate: consent AND no opt-out ────────────────────────────────
    // An empty consent table suppresses every candidate here — zero sends,
    // zero availability I/O. The launch switch is the data.
    const consent = await this.prisma.emailConsent.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!consent) {
      await this.suppress(booking, email, 'no-consent');
      return 'skipped';
    }
    if (
      await this.emailLog.isOptedOut(
        email,
        EmailAudience.TRAVELLER,
        EmailStream.MARKETING,
      )
    ) {
      await this.suppress(booking, email, 'opted-out');
      return 'skipped';
    }

    // ── Availability-first card selection (G-06/G-07) ────────────────────────
    const locale = toLocale(booking.customerLocale);
    const cards = await this.loadCards(booking, locale, now);
    if (!cards) {
      await this.suppress(booking, email, 'insufficient-open-tours');
      return 'skipped';
    }

    const destinationId = booking.tour.destinationId;
    let destinationTourCount = tourCounts.get(destinationId);
    if (destinationTourCount === undefined) {
      destinationTourCount = await this.prisma.tour.count({
        // Listing parity: the count backs the "See all {n} tours" claim, so
        // it must count what the site actually lists (review of #188).
        where: {
          destinationId,
          status: TourStatus.LIVE,
          isActive: true,
          isBookable: true,
        },
      });
      tourCounts.set(destinationId, destinationTourCount);
    }

    // G-14: both header values are env-derived bases + the server-minted
    // token — never caller-supplied, never CR/LF (SendMailOptions contract).
    // One owner for the one-click recipe (review minor 7); MK-1 is the
    // MARKETING stream for the TRAVELLER audience.
    const { optOutUrl, headers } =
      await this.emailPreferences.unsubscribeWiring(
        email,
        EmailAudience.TRAVELLER,
        EmailStream.MARKETING,
      );

    const context = buildNextAdventureEmailContext({
      booking: { customerLocale: booking.customerLocale, contactEmail: email },
      bookedTourName: booking.tour.name,
      destination: booking.tour.destination,
      destinationTourCount,
      cards,
      site: { logoUrl: siteLogoUrl },
      unsubscribeUrl: optOutUrl,
      config: {
        frontendUrl: islandToursBase(),
        emailIconBase: emailIconBase(),
      },
    });

    const result = await this.emailLog.claimAndSend({
      templateKey: EmailTemplateKey.MK1_NEXT_ADVENTURE,
      scopeId: booking.id,
      toEmail: email,
      stream: EmailStream.MARKETING,
      locale,
      send: () =>
        this.mail.sendNextAdventureEmail(
          email,
          String(context.subjectLine),
          context,
          buildNextAdventureEmailText(context),
          headers,
        ),
    });
    if (result.outcome === 'failed') {
      // Reported, not thrown — the sweep must survive one bad recipient; the
      // FAILED row keeps the slot and recovery would be an explicit admin resend - WHICH, unlike the OB set, MUST re-run the consent + opt-out gate at send time: MK-1 is MARKETING, and 'admin action is its own authorization' does not extend to mailing someone who unsubscribed (CAN-SPAM/ePrivacy).
      this.logger.error(
        `MK-1 failed for booking ${booking.displayRef}: ${result.error}`,
      );
    }
    return result.outcome === 'sent' ? 'sent' : 'skipped';
  }

  /**
   * Has tour_end + 72h passed in the booking's OWN zone? Both instants are
   * local wall clock (the BK-3 `hasTourFinished` idiom); no resolvable zone
   * = not due, never a guess — a late MK-1 is recoverable, one sent mid-stay
   * off a wrong clock is spam.
   */
  private isDue(booking: BookingRow, now: Date): boolean {
    const zone = booking.tourTimeZone ?? booking.tour.timeZone ?? null;
    if (!zone || !booking.tourEndDateTime) return false;
    const localNowDate = localNow(zone, now);
    return (
      localNowDate.getTime() - booking.tourEndDateTime.getTime() >=
      TRIGGER_OFFSET_MS
    );
  }

  /** The shared per-tick card query - see cardRowsCache for why. */
  private queryCardRows(
    destinationId: string,
    locale: Locale,
    windowStart: Date,
    windowEnd: Date,
  ) {
    return this.prisma.tour.findMany({
      where: {
        destinationId,
        status: TourStatus.LIVE,
        // Listing parity (review of #188): the site's canonical ranked
        // queries filter isActive AND isBookable - the email must never
        // feature a tour the site itself has delisted.
        isActive: true,
        isBookable: true,
        departures: {
          some: {
            status: DepartureStatus.OPEN,
            date: { gte: windowStart, lt: windowEnd },
          },
        },
      },
      // The canonical listing order (tours_ranking_idx): sponsorship first,
      // then tier/quality/id - the email must never contradict the site.
      orderBy: [
        { isSponsored: 'desc' },
        { tierRank: 'asc' },
        { qualityScore: 'desc' },
        { id: 'asc' },
      ],
      take: 26,
      select: CARD_TOUR_SELECT(locale, windowStart, windowEnd),
    });
  }

  /**
   * The three cards (G-06): LIVE tours in the booking's destination with an
   * OPEN departure inside the next 7 days — availability read AT SEND TIME,
   * never a cached rail — excluding the booked tour; role-picking delegated
   * to the pure `selectNextAdventureTours`. Null = fewer than three qualify.
   */
  private async loadCards(
    booking: BookingRow,
    locale: Locale,
    now: Date,
  ): Promise<
    | [NextAdventureCardInput, NextAdventureCardInput, NextAdventureCardInput]
    | null
  > {
    const zone = booking.tourTimeZone ?? booking.tour.timeZone ?? 'UTC';
    // Departure.date is @db.Date (UTC-midnight instants); "today" must be the
    // ISLAND's today, so the window starts from the zone's local date.
    const local = localNow(zone, now);
    // The window starts at the island's TOMORROW: sends run 09:00-11:00, so
    // "today's" stored-OPEN departures are mostly already at sea or inside
    // the tour's booking cutoff (cutoffs are computed live, never stored) -
    // a card must never advertise a boat the traveller cannot book (review
    // of #188, Major 2). End-exclusive = exactly seven island dates
    // (Minor 4: gte+lte on @db.Date endpoints was silently eight).
    const windowStart = new Date(
      Date.UTC(
        local.getUTCFullYear(),
        local.getUTCMonth(),
        local.getUTCDate() + 1,
      ),
    );
    const windowEnd = new Date(
      windowStart.getTime() + AVAILABILITY_WINDOW_DAYS * DAY_MS,
    );

    // Per-tick cache: on a one-destination launch, every due booking in a
    // morning tick asks the same question - same destination, same window,
    // same locale bucket. The booked tour is excluded IN MEMORY so the cache
    // is shareable (perf review of #188, Medium 3); take one extra row so
    // the exclusion cannot starve the selector.
    const cacheKey = `${booking.tour.destinationId}:${windowStart.toISOString()}:${locale}`;
    let cached = this.cardRowsCache.get(cacheKey);
    if (!cached) {
      cached = await this.queryCardRows(
        booking.tour.destinationId,
        locale,
        windowStart,
        windowEnd,
      );
      this.cardRowsCache.set(cacheKey, cached);
    }
    const rows = cached.filter((row) => row.id !== booking.tourId);

    const picked = selectNextAdventureTours(
      booking.tour.categories[0]?.categoryId ?? null,
      rows.map((row) => ({
        id: row.id,
        primaryCategoryId: row.categories[0]?.categoryId ?? null,
        qualityScore: Number(row.qualityScore),
        row,
      })),
    );
    if (!picked) return null;

    const toCard = (pick: (typeof picked)[number]): NextAdventureCardInput => ({
      name: pick.row.name,
      slug: pick.row.slug,
      imageUrl: pick.row.images[0]?.url ?? null,
      aggregateRating: pick.row.aggregateRating,
      aggregateReviewCount: pick.row.aggregateReviewCount,
      durationMinutesFrom: pick.row.durationMinutesFrom,
      priceFrom: pick.row.priceFrom?.toString() ?? null,
      currency: pick.row.defaultCurrency,
      oneLiner:
        preferLocale(pick.row.translations, locale)?.shortDescription ?? null,
      openDates: pick.row.departures.map((d) => d.date),
    });
    return [toCard(picked[0]), toCard(picked[1]), toCard(picked[2])];
  }

  private async suppress(
    booking: BookingRow,
    email: string,
    reason: string,
  ): Promise<void> {
    await this.emailLog.recordSuppressed({
      templateKey: EmailTemplateKey.MK1_NEXT_ADVENTURE,
      scopeId: booking.id,
      toEmail: email,
      stream: EmailStream.MARKETING,
      reason,
      locale: toLocale(booking.customerLocale),
    });
  }

  /** One SiteInfo read per tick — the brand-bar logo chip. */
  private async siteLogo(): Promise<string | null> {
    try {
      const info = await this.prisma.siteInfo.findFirst({
        select: { logo: true },
      });
      return info?.logo ?? null;
    } catch {
      // An email must never fail over branding (the MailService rule).
      return null;
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
