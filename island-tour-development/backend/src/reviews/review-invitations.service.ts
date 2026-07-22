import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  Locale,
  Prisma,
  ReviewModerationStatus,
  ReviewSource,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { containsBannedWord, reviewerInitial } from './review-display.util';
import type {
  EnrichReviewDto,
  StartReviewDto,
  SubmitFeedbackDto,
} from './dto/review-invitation.dto';

/**
 * The post-tour review collection flow.
 *
 * This is the gap the whole review module was waiting on: every locked display
 * decision in the master assumes reviews exist, and until now nothing in the
 * platform ever asked a guest for one.
 *
 * ## Why a token instead of a session
 * The invitation arrives by email and must work in one tap, on a phone, with no
 * login - the same tokenized pattern as the cancellation flow. Authenticating by
 * `token` rather than by cookie is what makes step 1 a single tap rather than a
 * sign-in wall, and completion rate is the whole point of the design.
 *
 * ## Progressive disclosure
 * Step 1 (the rating) COMMITS IMMEDIATELY and spends the token. Steps 2, 3 and
 * 3b enrich the row afterwards and are individually skippable, so a guest who
 * taps one star and closes the tab has still left a real, countable review.
 * Enrichment is allowed only while the review is still PENDING: once a moderator
 * has acted on it, the text a human approved is not silently rewritable.
 */
@Injectable()
export class ReviewInvitationsService {
  private readonly logger = new Logger(ReviewInvitationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════
  // Token resolution
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Resolve a token to the small, safe payload the review page renders.
   *
   * Deliberately narrow: a tour name, a hero image, the travel date and a first
   * name. The token travels in an email and may be forwarded, so it must not be
   * a key to the booking's price, contact details or payment data.
   */
  async resolve(token: string) {
    const invitation = await this.loadUsable(token);
    const b = invitation.booking;

    return {
      token,
      tourId: b.tourId,
      tourName: b.tour?.name ?? null,
      tourSlug: b.tour?.slug ?? null,
      destinationSlug: b.tour?.destination?.slug ?? null,
      heroImage: b.tour?.images?.[0]?.url ?? null,
      operatorName: b.operator?.companyInfo?.companyName ?? null,
      guestFirstName: b.contactFirstName,
      travelDate: b.localDate.toISOString().slice(0, 10),
      alreadyReviewed: false,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 1 - the rating. Commits immediately and spends the token.
  // ════════════════════════════════════════════════════════════════════════

  async start(token: string, dto: StartReviewDto) {
    const invitation = await this.loadUsable(token);
    const b = invitation.booking;

    // `Review.bookingId` is unique, so this is belt-and-braces against a double
    // tap racing itself. The 409 is the honest answer either way.
    const existing = await this.prisma.review.findUnique({
      where: { bookingId: b.id },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This booking has already been reviewed');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          bookingId: b.id,
          tourId: b.tourId,
          operatorId: b.operatorId,
          departureId: b.departureId,
          // The booking's user, not a session user: this flow has no session.
          // A booking always has one by the time it is reviewable (a USER is
          // auto-created at booking), so a null here is data corruption, not a
          // guest we should quietly accept.
          userId: b.userId!,
          rating: dto.rating,
          reviewerFirstName: b.contactFirstName,
          reviewerInitial: reviewerInitial(
            b.contactFirstName,
            b.contactLastName,
          ),
          reviewerCountry: b.contactCountry,
          travelMonth: b.localDate.getUTCMonth() + 1,
          travelYear: b.localDate.getUTCFullYear(),
          source: ReviewSource.NATIVE,
          moderationStatus: ReviewModerationStatus.PENDING,
        },
      });

      await tx.reviewModerationLog.create({
        data: {
          reviewId: created.id,
          actorId: b.userId,
          fromStatus: null,
          toStatus: ReviewModerationStatus.PENDING,
          reason: 'Submitted via the post-tour invitation',
        },
      });

      // Spend the token in the same transaction as the review it produced.
      await tx.reviewInvitation.update({
        where: { id: invitation.id },
        data: { completedAt: new Date(), reviewId: created.id },
      });

      return created;
    });

    this.logger.log(
      `Review ${review.id} started from invitation for booking ${b.displayRef} (rating ${dto.rating})`,
    );
    return { reviewId: review.id, rating: review.rating };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Steps 2 / 3 / 3b - optional enrichment of the review step 1 created
  // ════════════════════════════════════════════════════════════════════════

  async enrich(token: string, dto: EnrichReviewDto) {
    const { invitation, review } = await this.loadEnrichable(token);

    if (containsBannedWord(dto.comment) || containsBannedWord(dto.title)) {
      throw new BadRequestException('Please reword: disallowed language');
    }

    const locale = dto.locale ?? Locale.en;
    const data: Prisma.ReviewUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.reviewerType !== undefined) data.reviewerType = dto.reviewerType;
    if (dto.photos !== undefined) data.photos = dto.photos;
    if (dto.ratingValue !== undefined) data.ratingValue = dto.ratingValue;
    if (dto.ratingGuide !== undefined) data.ratingGuide = dto.ratingGuide;
    if (dto.ratingSafety !== undefined) data.ratingSafety = dto.ratingSafety;

    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        ...data,
        ...(dto.comment !== undefined && {
          translations: {
            upsert: {
              where: { reviewId_locale: { reviewId: review.id, locale } },
              create: { locale, comment: dto.comment },
              update: { comment: dto.comment },
            },
          },
        }),
      },
      select: { id: true, moderationStatus: true },
    });

    this.logger.log(
      `Review ${review.id} enriched via invitation ${invitation.id}`,
    );
    return { reviewId: updated.id, saved: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Step 4b - the PRIVATE service-recovery channel
  // ════════════════════════════════════════════════════════════════════════

  /**
   * "Sorry it missed the mark. Tell us what went wrong, just to us."
   *
   * This is offered ALONGSIDE the neutral Trustpilot invitation on a low rating,
   * never instead of it. Routing unhappy customers here while sending only happy
   * ones to a third-party platform is review gating: it breaches Trustpilot's own
   * rules, and it is the conduct the Italian AGCM fined Trustpilot 4 million euro
   * over. The public review stands in full whatever the score; this is only a
   * private line to support.
   */
  async submitPrivateFeedback(token: string, dto: SubmitFeedbackDto) {
    const invitation = await this.prisma.reviewInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        booking: { select: { id: true, displayRef: true, contactEmail: true } },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    // Deliberately not stored on the review: this is support correspondence, not
    // review content, and it must never reach a public surface or an aggregate.
    this.logger.warn(
      `Private service-recovery feedback for booking ${invitation.booking.displayRef}: ${dto.message.slice(0, 500)}`,
    );
    return { received: true };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** A token that may still be used to START a review. */
  private async loadUsable(token: string) {
    const invitation = await this.prisma.reviewInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        completedAt: true,
        revokedAt: true,
        booking: {
          select: {
            id: true,
            displayRef: true,
            userId: true,
            tourId: true,
            operatorId: true,
            departureId: true,
            status: true,
            localDate: true,
            contactFirstName: true,
            contactLastName: true,
            contactCountry: true,
            tour: {
              select: {
                name: true,
                slug: true,
                destination: { select: { slug: true } },
                images: {
                  where: { isHero: true },
                  select: { url: true },
                  take: 1,
                },
              },
            },
            operator: {
              select: { companyInfo: { select: { companyName: true } } },
            },
          },
        },
      },
    });

    // One 404 for unknown, spent and revoked alike: a caller holding a bad token
    // learns nothing about whether it ever existed.
    if (!invitation || invitation.revokedAt || invitation.completedAt) {
      throw new NotFoundException('This review link is no longer valid');
    }
    if (
      invitation.booking.status !== BookingStatus.CONFIRMED &&
      invitation.booking.status !== BookingStatus.REDEEMED
    ) {
      throw new NotFoundException('This review link is no longer valid');
    }
    if (!invitation.booking.userId) {
      throw new BadRequestException('Booking has no associated customer');
    }
    return invitation;
  }

  /** A token whose review exists and is still open to enrichment. */
  private async loadEnrichable(token: string) {
    const invitation = await this.prisma.reviewInvitation.findUnique({
      where: { token },
      select: { id: true, reviewId: true, revokedAt: true },
    });
    if (!invitation || invitation.revokedAt || !invitation.reviewId) {
      throw new NotFoundException('This review link is no longer valid');
    }

    const review = await this.prisma.review.findUnique({
      where: { id: invitation.reviewId },
      select: { id: true, moderationStatus: true },
    });
    if (!review) throw new NotFoundException('Review not found');

    // Once a moderator has acted, the text they approved is not rewritable from
    // an emailed link.
    if (review.moderationStatus !== ReviewModerationStatus.PENDING) {
      throw new ConflictException(
        'This review has already been moderated and can no longer be edited',
      );
    }
    return { invitation, review };
  }
}
