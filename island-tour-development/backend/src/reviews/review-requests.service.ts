import { Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus,
  EmailStream,
  EmailTemplateKey,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { EmailLogService } from '@/mail/email-log.service';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import { emailIconBase, toLocale } from '@/bookings/booking-email.context';
import { islandToursBase } from '@/common/utils/app-urls.util';
import { localNow } from '@/common/utils/timezone.util';

/**
 * The post-tour review request - the collection side of the review module.
 *
 * ## Why this exists
 * Every locked display decision in the master assumes reviews exist, and until
 * this job nothing in the platform ever asked a guest for one. The advisory is
 * blunt about it: closing the collection gap is the highest-leverage, lowest-risk
 * work in the whole module, because the best-designed review display is worthless
 * with no reviews flowing in.
 *
 * ## Timing
 * The first touch goes out the MORNING AFTER the tour, at roughly 10:00 in the
 * tour's own timezone. That matches the two direct day-tour peers (Viator sends
 * day one, GetYourGuide one to two days after) and a day tour is fully
 * experienced by then.
 *
 * It is a LAUNCH DEFAULT, not a proven optimum, and it is worth saying so in the
 * code: the strongest controlled evidence (a Journal of Marketing field study run
 * partly on a guided-tours marketplace) found next-day reminders *reduce* review
 * likelihood for experience goods, more so for younger travellers. Treat
 * {@link FIRST_SEND_LOCAL_HOUR} and {@link REMINDER_AFTER_DAYS} as the A/B
 * variables they are.
 *
 * ## Two touches, then stop
 * One email the morning after, one reminder at 5-7 days, then silence. A single
 * reminder is well supported; the 5-7 day interval is deliberately longer than a
 * 72-hour nudge, matching TripAdvisor's roughly one-week practice and avoiding
 * the reactance the study above flags.
 *
 * ## Timezone
 * Every window is computed in the booking's SNAPSHOTTED `tourTimeZone`, never a
 * universal Curaçao fallback - an Aruba or Bahamas tour must not be scheduled on
 * Curaçao's clock, and a tour whose destination timezone changes later must not
 * retroactively move the emails already sent for it.
 */

/**
 * Cadence defaults. These are only the fallback when no settings row exists yet -
 * the live values come from `ReviewRequestSettings`, which an admin controls from
 * the dashboard. They are business decisions, not engineering ones: the advisory
 * is explicit that the morning-after send is a launch default to A/B test.
 */
export const DEFAULTS = {
  enabled: false,
  firstSendLocalHour: 10,
  firstSendDelayDays: 1,
  reminderAfterDays: 5,
  reminderEnabled: true,
  giveUpAfterDays: 30,
  batchSize: 200,
};

type Cadence = typeof DEFAULTS;

/**
 * Booking states that must NEVER receive a review request. Mirrors the pre-tour
 * reminder's suppression rules: asking someone to review a tour they did not
 * take, or that we cancelled on them, is worse than not asking at all.
 */
const SUPPRESSED_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.EXPIRED,
  BookingStatus.REJECTED,
  BookingStatus.ON_HOLD,
  BookingStatus.PENDING,
];

/** Only a booking in one of these actually happened. */
const COMPLETED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.REDEEMED,
];

interface SendResult {
  created: number;
  sent: number;
  reminded: number;
  suppressed: number;
  failed: number;
}

@Injectable()
export class ReviewRequestsService {
  private readonly logger = new Logger(ReviewRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly emailLog: EmailLogService,
  ) {}

  /**
   * One pass: create invitations for newly-completed bookings, send the first
   * touch to those whose local send window has arrived, and send the single
   * reminder to those still silent after {@link REMINDER_AFTER_DAYS}.
   *
   * Idempotent. `ReviewInvitation.bookingId` is unique and every send stamps its
   * own timestamp, so running twice in the same hour sends nothing twice.
   */
  async run(now: Date = new Date()): Promise<SendResult> {
    const result: SendResult = {
      created: 0,
      sent: 0,
      reminded: 0,
      suppressed: 0,
      failed: 0,
    };

    const cadence = await this.cadence();

    // The master switch. Deliberately checked BEFORE anything else: when review
    // requests are off, the job must not even create invitations, or switching
    // it on later would fire a backlog of stale emails at once.
    if (!cadence.enabled) {
      this.logger.debug('Review requests are disabled in settings; skipping');
      return result;
    }

    result.created = await this.createInvitations(now, cadence);
    result.suppressed = await this.revokeSuppressed();

    const sent = await this.sendFirstTouch(now, cadence);
    result.sent = sent.sent;
    result.failed += sent.failed;

    if (cadence.reminderEnabled) {
      const reminded = await this.sendReminder(now, cadence);
      result.reminded = reminded.sent;
      result.failed += reminded.failed;
    }

    this.logger.log(
      `Review requests: created ${result.created}, sent ${result.sent}, reminded ${result.reminded}, suppressed ${result.suppressed}, failed ${result.failed}`,
    );
    return result;
  }

  // ── 1. Create invitations for bookings whose tour has finished ────────────

  /** Live cadence from the dashboard, falling back to {@link DEFAULTS}. */
  private async cadence(): Promise<Cadence> {
    const row = await this.prisma.reviewRequestSettings.findFirst();
    return row ? { ...DEFAULTS, ...row } : DEFAULTS;
  }

  private async createInvitations(now: Date, cad: Cadence): Promise<number> {
    const cutoff = new Date(now.getTime() - cad.giveUpAfterDays * 864e5);

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: COMPLETED_STATUSES },
        reviewInvitation: null,
        review: null,
        // A tour that has not started cannot have finished. The precise local
        // window is applied per-booking below; this only narrows the scan.
        localDate: { gte: cutoff, lte: now },
        contactEmail: { not: null },
        userId: { not: null },
      },
      select: {
        id: true,
        localDate: true,
        tourEndDateTime: true,
        tourTimeZone: true,
        tour: { select: { timeZone: true } },
      },
      take: cad.batchSize,
    });

    let created = 0;
    for (const b of candidates) {
      if (!this.hasTourFinished(b, now)) continue;
      try {
        await this.prisma.reviewInvitation.create({
          data: { bookingId: b.id },
        });
        created++;
      } catch (err) {
        // Unique violation = another pass created it. Not an error.
        if (
          !(
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          )
        ) {
          throw err;
        }
      }
    }
    return created;
  }

  // ── 2. Revoke invitations whose booking stopped qualifying ────────────────

  /**
   * A booking can be cancelled AFTER its invitation was created but before the
   * email goes out. Revoking rather than deleting keeps the ledger honest about
   * what happened, and `revokedAt` also kills the token if one already shipped.
   */
  private async revokeSuppressed(): Promise<number> {
    const { count } = await this.prisma.reviewInvitation.updateMany({
      where: {
        revokedAt: null,
        completedAt: null,
        booking: { status: { in: SUPPRESSED_STATUSES } },
      },
      data: {
        revokedAt: new Date(),
        suppressedReason: 'Booking no longer in a completed state',
      },
    });
    return count;
  }

  // ── 3. First touch ────────────────────────────────────────────────────────

  private async sendFirstTouch(now: Date, cad: Cadence) {
    const siteLogoUrl = await this.siteLogo();
    const due = await this.prisma.reviewInvitation.findMany({
      where: { sentAt: null, completedAt: null, revokedAt: null },
      select: this.invitationSelect(),
      take: cad.batchSize,
    });

    let sent = 0;
    let failed = 0;
    for (const inv of due) {
      if (!this.isSendWindowOpen(inv.booking, now, cad)) continue;
      const ok = await this.deliver(inv, false, siteLogoUrl);
      if (ok) {
        await this.prisma.reviewInvitation.update({
          where: { id: inv.id },
          data: { sentAt: new Date() },
        });
        sent++;
      } else {
        failed++;
      }
    }
    return { sent, failed };
  }

  // ── 4. The single reminder ────────────────────────────────────────────────

  private async sendReminder(now: Date, cad: Cadence) {
    const siteLogoUrl = await this.siteLogo();
    const threshold = new Date(now.getTime() - cad.reminderAfterDays * 864e5);
    const giveUp = new Date(now.getTime() - cad.giveUpAfterDays * 864e5);

    const due = await this.prisma.reviewInvitation.findMany({
      where: {
        remindedAt: null,
        completedAt: null,
        revokedAt: null,
        // Sent, silent for long enough, and not so long ago that chasing is spam.
        sentAt: { lte: threshold, gte: giveUp },
      },
      select: this.invitationSelect(),
      take: cad.batchSize,
    });

    let sent = 0;
    let failed = 0;
    for (const inv of due) {
      const ok = await this.deliver(inv, true, siteLogoUrl);
      // Stamp `remindedAt` even on failure: this is the SINGLE reminder, and a
      // bounced address would otherwise be retried on every run forever.
      await this.prisma.reviewInvitation.update({
        where: { id: inv.id },
        data: { remindedAt: new Date() },
      });
      if (ok) sent++;
      else failed++;
    }
    return { sent, failed };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private invitationSelect() {
    return {
      id: true,
      token: true,
      booking: {
        select: {
          id: true,
          displayRef: true,
          localDate: true,
          startTime: true,
          tourEndDateTime: true,
          tourTimeZone: true,
          contactEmail: true,
          contactFirstName: true,
          customerLocale: true,
          reviewWhatsappOptIn: true,
          tour: { select: { name: true, timeZone: true } },
          operator: {
            select: { companyInfo: { select: { companyName: true } } },
          },
        },
      },
    } satisfies Prisma.ReviewInvitationSelect;
  }

  /** Resolve the zone from the booking snapshot, never a universal fallback. */
  private zoneOf(b: {
    tourTimeZone: string | null;
    tour: { timeZone: string } | null;
  }): string | null {
    return b.tourTimeZone ?? b.tour?.timeZone ?? null;
  }

  /** Has the experience actually finished, in its own local time? */
  private hasTourFinished(
    b: {
      localDate: Date;
      tourEndDateTime: Date | null;
      tourTimeZone: string | null;
      tour: { timeZone: string } | null;
    },
    now: Date,
  ): boolean {
    const zone = this.zoneOf(b);
    // No resolvable zone: treat as not finished rather than guess. A missed
    // invitation is recoverable; one sent mid-tour is not.
    if (!zone) return false;
    const localNowDate = localNow(zone, now);
    const end =
      b.tourEndDateTime ??
      // No end snapshot (older bookings): fall back to the end of the tour day.
      new Date(b.localDate.getTime() + 864e5 - 1);
    return end <= localNowDate;
  }

  /**
   * Is it past ~10:00 on the morning AFTER the tour, in the tour's timezone?
   *
   * Computed per booking rather than by running the cron at a fixed UTC hour,
   * because "the morning after" is a different absolute instant on every island.
   */
  private isSendWindowOpen(
    b: {
      localDate: Date;
      tourEndDateTime: Date | null;
      tourTimeZone: string | null;
      tour: { timeZone: string } | null;
    },
    now: Date,
    cad: Cadence,
  ): boolean {
    const zone = this.zoneOf(b);
    if (!zone) return false;

    const end = b.tourEndDateTime ?? b.localDate;
    const sendAt = new Date(end.getTime());
    sendAt.setUTCDate(sendAt.getUTCDate() + cad.firstSendDelayDays);
    sendAt.setUTCHours(cad.firstSendLocalHour, 0, 0, 0);

    return localNow(zone, now) >= sendAt;
  }

  /**
   * The brand-bar logo, resolved once per run rather than per email.
   * Same source and same `emailSafeLogoUrl` treatment the booking confirmation
   * uses, so the two emails render an identical header.
   */
  private async siteLogo(): Promise<string> {
    const site = await this.prisma.siteInfo.findFirst({
      select: { logo: true },
    });
    return emailSafeLogoUrl(site?.logo ?? null) ?? '';
  }

  /**
   * One review email through the send log. BK-3 and BK-3R are SEPARATE
   * template keys on the same `scopeId = bookingId`, so the unique index
   * allows exactly one of each (plan §2.1/§2.2).
   *
   * Returns true for 'sent' AND for 'skipped' (an earlier run already decided
   * this email but crashed before stamping the invitation): both must move
   * the sweeper's cursor (`sentAt`/`remindedAt`), or the sweep would re-pick
   * the invitation every hour and burn a claim attempt each time. 'failed'
   * returns false - the FAILED row keeps the slot, so the next pass resolves
   * to 'skipped' and the cursor converges; recovery is an admin resend.
   */
  private async deliver(
    inv: { token: string; booking: BookingForEmail },
    isReminder: boolean,
    siteLogoUrl: string,
  ): Promise<boolean> {
    const b = inv.booking;
    const to = b.contactEmail;
    if (!to) return false;

    // §2.9: copy language resolves from the booking's snapshotted locale.
    // The review URL is locale-prefixed with the SAME locale, so the email
    // and the page it opens can never disagree on language.
    const locale = toLocale(b.customerLocale);
    const reviewUrl = `${islandToursBase()}/${locale}/review/${inv.token}`;

    const result = await this.emailLog.claimAndSend({
      templateKey: isReminder
        ? EmailTemplateKey.BK3R_REVIEW_REMINDER
        : EmailTemplateKey.BK3_REVIEW_REQUEST,
      scopeId: b.id,
      toEmail: to,
      stream: EmailStream.TRANSACTIONAL,
      locale,
      send: () =>
        this.mail.sendReviewRequestEmail(to, {
          firstName: b.contactFirstName ?? 'there',
          tourName: b.tour?.name ?? 'your tour',
          bookingRef: b.displayRef,
          dateLong: b.localDate.toISOString().slice(0, 10),
          startTime: b.startTime ?? '',
          reviewUrl,
          emailIconBase: emailIconBase(),
          siteLogoUrl,
          isReminder,
          locale,
          operatorName: b.operator?.companyInfo?.companyName ?? null,
          whatsappOptIn: b.reviewWhatsappOptIn,
        }),
    });

    if (result.outcome === 'failed') {
      this.logger.error(
        `Review request ${isReminder ? 'reminder ' : ''}failed for booking ${b.displayRef}: ${result.error}`,
      );
      return false;
    }
    return true;
  }
}

type BookingForEmail = {
  id: string;
  displayRef: string;
  localDate: Date;
  startTime: string | null;
  contactEmail: string | null;
  contactFirstName: string | null;
  customerLocale: string | null;
  reviewWhatsappOptIn: boolean;
  tour: { name: string } | null;
  operator: { companyInfo: { companyName: string | null } | null } | null;
};
