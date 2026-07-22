import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  Prisma,
  ReviewModerationStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '@/mail/mail.service';
import { emailSafeLogoUrl } from '@/mail/email-logo.util';
import { emailIconBase } from '@/bookings/booking-email.context';
import { islandToursBase } from '@/common/utils/app-urls.util';
import { resolveOperatorId } from '@/common/utils/operator.util';
import type {
  CustomerEmailResultDto,
  EmailCustomersDto,
  ListCustomersQueryDto,
  PaginatedCustomersDto,
} from './dto/customer.dto';

/** Roles that see every operator's customers. Everyone else is scoped to one. */
const PLATFORM_WIDE: Role[] = [Role.ADMIN, Role.STAFF, Role.EDITOR];

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * The customer list.
   *
   * ## Scope is decided by the ACTOR, never by the query
   * An operator is pinned to their own `operatorId` AFTER every other filter is
   * applied, so no combination of query params can widen it - the same rule the
   * reviews queue follows, and the one a `/reviews/admin` route once got wrong
   * by trusting the permission alone.
   *
   * ## Why two review numbers per row
   * `reviewsLeft` is history; `awaitingReview` is the actionable one - completed
   * bookings with no review yet. That second number is the entire reason an
   * operator would open this screen rather than the bookings list.
   */
  async list(
    query: ListCustomersQueryDto,
    actor: { id: string; role: Role },
  ): Promise<PaginatedCustomersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const platformWide = PLATFORM_WIDE.includes(actor.role);
    const ownOperatorId = platformWide
      ? null
      : await resolveOperatorId(this.prisma, actor.id, actor.role);

    const where: Prisma.CustomerWhereInput = {
      ...(query.operatorId && platformWide && { operatorId: query.operatorId }),
      ...(search && {
        user: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
      // Last and unconditional: an operator sees only their own.
      ...(ownOperatorId ? { operatorId: ownOperatorId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: {
          id: true,
          userId: true,
          operatorId: true,
          bookingsCount: true,
          totalSpendEur: true,
          firstBookingAt: true,
          lastBookingAt: true,
          user: { select: { email: true, name: true } },
          operator: {
            select: { companyInfo: { select: { companyName: true } } },
          },
        },
        orderBy: [{ lastBookingAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Review counts for exactly the rows on this page, in two grouped queries
    // rather than two per row - an N+1 here would be 40 queries for a 20-row page.
    const userIds = [...new Set(rows.map((r) => r.userId))];
    const operatorIds = [...new Set(rows.map((r) => r.operatorId))];

    const [reviewed, awaiting] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['userId', 'operatorId'],
        where: {
          userId: { in: userIds },
          operatorId: { in: operatorIds },
          moderationStatus: ReviewModerationStatus.APPROVED,
        },
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['userId', 'operatorId'],
        where: {
          userId: { in: userIds },
          operatorId: { in: operatorIds },
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
          review: { is: null },
          tourEndDateTime: { lt: new Date() },
        },
        _count: { _all: true },
      }),
    ]);

    const key = (u: string | null, o: string) => `${u}:${o}`;
    const reviewedBy = new Map(
      reviewed.map((r) => [key(r.userId, r.operatorId), r._count._all]),
    );
    const awaitingBy = new Map(
      awaiting.map((r) => [key(r.userId, r.operatorId), r._count._all]),
    );

    let data = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.user.email,
      name: r.user.name ?? null,
      operatorId: r.operatorId,
      operatorName: r.operator.companyInfo?.companyName ?? null,
      bookingsCount: r.bookingsCount,
      totalSpendEur: r.totalSpendEur.toString(),
      firstBookingAt: r.firstBookingAt?.toISOString() ?? null,
      lastBookingAt: r.lastBookingAt?.toISOString() ?? null,
      reviewsLeft: reviewedBy.get(key(r.userId, r.operatorId)) ?? 0,
      awaitingReview: awaitingBy.get(key(r.userId, r.operatorId)) ?? 0,
    }));

    if (query.awaitingReviewOnly) {
      data = data.filter((d) => d.awaitingReview > 0);
    }

    return { total, page, limit, data };
  }

  /**
   * Email selected customers.
   *
   * ## Deduplicated by ADDRESS, not by row
   * A `customers` row is a user x operator relationship, so one person who has
   * booked with three operators is three rows. Emailing per row would send them
   * the same message three times.
   *
   * Sends are sequential and failures are counted, never thrown: one bad address
   * must not abort a 200-recipient send half way through, leaving the caller
   * with no idea who received it.
   */
  async email(
    dto: EmailCustomersDto,
    actor: { id: string; role: Role },
  ): Promise<CustomerEmailResultDto> {
    const platformWide = PLATFORM_WIDE.includes(actor.role);
    const ownOperatorId = platformWide
      ? null
      : await resolveOperatorId(this.prisma, actor.id, actor.role);

    const rows = await this.prisma.customer.findMany({
      where: {
        id: { in: dto.customerIds },
        // Re-scoped on the WRITE too. Ids come from the client, and a client
        // that can guess an id must not thereby be able to email a stranger.
        ...(ownOperatorId ? { operatorId: ownOperatorId } : {}),
      },
      select: { user: { select: { email: true, name: true } } },
    });

    const byEmail = new Map<string, string | null>();
    for (const r of rows) {
      if (!byEmail.has(r.user.email)) byEmail.set(r.user.email, r.user.name);
    }
    const deduped = rows.length - byEmail.size;

    const siteLogoUrl = await this.siteLogo();
    let sent = 0;
    let failed = 0;

    for (const [email, name] of byEmail) {
      const firstName = (name ?? '').trim().split(' ')[0] || 'there';
      const body = dto.body.replaceAll('{firstName}', firstName);
      try {
        await this.mail.sendBookingNoticeEmail(
          email,
          dto.subject,
          {
            noticeTitle: dto.subject,
            bookingRef: '',
            tourName: '',
            dateLong: '',
            startTime: '',
            noticeParagraphs: body.split('\n').filter(Boolean),
            ctaUrl: '',
            ctaLabel: '',
            siteLogoUrl,
            emailIconBase: emailIconBase(),
          },
          body,
        );
        sent++;
      } catch (err) {
        failed++;
        this.logger.error(
          `Customer email failed for ${email}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }

    this.logger.log(
      `Customer email "${dto.subject}" by ${actor.id}: ${sent} sent, ${failed} failed, ${deduped} deduped`,
    );
    return { sent, failed, deduped };
  }

  /**
   * Send ONE customer a review request by hand.
   *
   * The manual twin of the hourly job, for the cases a schedule cannot serve: a
   * guest who asks for the link again, a demo, or a nudge before the automation
   * is switched on. It deliberately does NOT consult the job's `enabled` switch
   * - that switch governs unattended bulk sending, and a person clicking "send"
   * has already made the decision it exists to protect.
   *
   * Reuses the booking's existing invitation rather than minting a second one:
   * `ReviewInvitation.bookingId` is unique, and two live links for one booking
   * would mean the first one a guest clicks silently kills the other.
   */
  async sendReviewRequest(
    customerId: string,
    actor: { id: string; role: Role },
  ): Promise<{ sent: boolean; email?: string; reason?: string }> {
    const platformWide = PLATFORM_WIDE.includes(actor.role);
    const ownOperatorId = platformWide
      ? null
      : await resolveOperatorId(this.prisma, actor.id, actor.role);

    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        ...(ownOperatorId ? { operatorId: ownOperatorId } : {}),
      },
      select: {
        userId: true,
        operatorId: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Their oldest completed booking with no review - the one that has been
    // waiting longest is the one worth asking about.
    const booking = await this.prisma.booking.findFirst({
      where: {
        userId: customer.userId,
        operatorId: customer.operatorId,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.REDEEMED] },
        review: { is: null },
        tourEndDateTime: { lt: new Date() },
      },
      select: {
        id: true,
        displayRef: true,
        localDate: true,
        startTime: true,
        contactEmail: true,
        contactFirstName: true,
        contactLocales: true,
        tour: { select: { name: true } },
        reviewInvitation: { select: { token: true } },
      },
      orderBy: { localDate: 'asc' },
    });
    if (!booking) {
      return { sent: false, reason: 'no_booking_awaiting_review' };
    }
    const to = booking.contactEmail ?? customer.user.email;
    if (!to) return { sent: false, reason: 'no_email' };

    const invitation = booking.reviewInvitation
      ? await this.prisma.reviewInvitation.update({
          where: { bookingId: booking.id },
          data: { revokedAt: null, suppressedReason: null },
          select: { token: true },
        })
      : await this.prisma.reviewInvitation.create({
          data: { bookingId: booking.id },
          select: { token: true },
        });

    const locale = booking.contactLocales?.[0] ?? 'en';
    try {
      await this.mail.sendReviewRequestEmail(to, {
        firstName: booking.contactFirstName ?? 'there',
        tourName: booking.tour?.name ?? 'your tour',
        bookingRef: booking.displayRef,
        dateLong: booking.localDate.toISOString().slice(0, 10),
        startTime: booking.startTime ?? '',
        reviewUrl: `${islandToursBase()}/${locale}/review/${invitation.token}`,
        emailIconBase: emailIconBase(),
        siteLogoUrl: await this.siteLogo(),
        isReminder: false,
      });
    } catch (err) {
      this.logger.error(
        `Manual review request failed for ${to}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return { sent: false, reason: 'send_failed' };
    }

    await this.prisma.reviewInvitation.update({
      where: { bookingId: booking.id },
      data: { sentAt: new Date() },
    });
    this.logger.log(
      `Manual review request sent to ${to} for ${booking.displayRef} by ${actor.id}`,
    );
    return { sent: true, email: to };
  }

  private async siteLogo(): Promise<string> {
    const site = await this.prisma.siteInfo.findFirst({
      select: { logo: true },
    });
    // The template expects a string; a site with no logo renders without one.
    return emailSafeLogoUrl(site?.logo ?? null) ?? '';
  }
}
