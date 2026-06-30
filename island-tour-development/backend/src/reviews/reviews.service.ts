import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  Locale,
  Prisma,
  ReviewModerationStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { dateKey, localNow } from '@/common/utils/timezone.util';
import {
  containsBannedWord,
  resolveRatingSource,
  reviewerInitial,
  roundRating,
} from './review-display.util';
import type {
  CreateReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  ModerationQueueQueryDto,
  OperatorResponseDto,
} from './dto/review.dto';

const REVIEWABLE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.REDEEMED,
];
const STARS = [5, 4, 3, 2, 1];

type Actor = { id: string; role: Role };

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ════════════════════════════════════════════════════════════════════════
  // Create - booking-gated, one per booking, starts PENDING
  // ════════════════════════════════════════════════════════════════════════

  async create(dto: CreateReviewDto, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
      select: {
        id: true,
        userId: true,
        tourId: true,
        operatorId: true,
        status: true,
        localDate: true,
        startTime: true,
        contactFirstName: true,
        contactLastName: true,
        contactCountry: true,
        tour: { select: { timeZone: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only review your own booking');
    }
    if (!REVIEWABLE_STATUSES.includes(booking.status)) {
      throw new BadRequestException(
        'Only a confirmed or redeemed booking can be reviewed',
      );
    }
    if (!this.hasExperiencePassed(booking)) {
      throw new BadRequestException(
        'You can review only after the experience date',
      );
    }

    const existing = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException('This booking has already been reviewed');

    const locale = dto.locale ?? Locale.en;
    const flagged =
      containsBannedWord(dto.comment) || containsBannedWord(dto.title);

    const review = await this.prisma.review.create({
      data: {
        bookingId: booking.id,
        tourId: booking.tourId,
        operatorId: booking.operatorId,
        userId,
        rating: dto.rating,
        ratingValue: dto.ratingValue ?? null,
        ratingGuide: dto.ratingGuide ?? null,
        ratingSafety: dto.ratingSafety ?? null,
        title: dto.title ?? null,
        reviewerFirstName: booking.contactFirstName,
        reviewerInitial: reviewerInitial(
          booking.contactFirstName,
          booking.contactLastName,
        ),
        reviewerCountry: booking.contactCountry,
        travelMonth: booking.localDate.getUTCMonth() + 1,
        travelYear: booking.localDate.getUTCFullYear(),
        photos: dto.photos ?? [],
        moderationStatus: ReviewModerationStatus.PENDING,
        translations: { create: { locale, comment: dto.comment } },
      },
      include: { translations: true },
    });

    this.logger.log(
      `Review ${review.id} created for tour ${booking.tourId} (PENDING${flagged ? ', flagged: banned word' : ''})`,
    );
    return mapReview(review, locale);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Public reads - approved only
  // ════════════════════════════════════════════════════════════════════════

  async list(query: ListReviewsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where: Prisma.ReviewWhereInput = {
      tourId: query.tourId,
      moderationStatus: ReviewModerationStatus.APPROVED,
    };

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { translations: true },
        orderBy: this.orderFor(query.sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      total,
      page,
      limit,
      data: rows.map((r) => mapReview(r, query.locale)),
    };
  }

  /** LD11 rating summary + star distribution for a tour. */
  async summary(tourId: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        id: true,
        operator: {
          select: { aggregateRating: true, aggregateReviewCount: true },
        },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');

    const where: Prisma.ReviewWhereInput = {
      tourId,
      moderationStatus: ReviewModerationStatus.APPROVED,
    };
    const [agg, groups] = await Promise.all([
      this.prisma.review.aggregate({
        where,
        _count: true,
        _avg: {
          rating: true,
          ratingValue: true,
          ratingGuide: true,
          ratingSafety: true,
        },
      }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: true }),
    ]);

    const approvedCount = agg._count;
    const tourRating = roundRating(agg._avg.rating);
    const resolution = resolveRatingSource({
      tourCount: approvedCount,
      tourRating,
      operatorCount: tour.operator.aggregateReviewCount,
      operatorRating: tour.operator.aggregateRating,
    });

    const distribution = STARS.map((stars) => ({
      stars,
      count: groups.find((g) => g.rating === stars)?._count ?? 0,
    }));

    return {
      tourId,
      source: resolution.source,
      rating:
        resolution.source === 'operator'
          ? roundRating(resolution.rating)
          : resolution.rating,
      reviewCount: resolution.reviewCount,
      approvedCount,
      distribution,
      avgValue: roundRating(agg._avg.ratingValue),
      avgGuide: roundRating(agg._avg.ratingGuide),
      avgSafety: roundRating(agg._avg.ratingSafety),
    };
  }

  async getById(id: string, actor?: Actor) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    if (review.moderationStatus !== ReviewModerationStatus.APPROVED) {
      await this.assertCanModerateOrOwn(review, actor);
    }
    return mapReview(review);
  }

  async listMine(userId: string, page = 1, limit = 20) {
    const where: Prisma.ReviewWhereInput = { userId };
    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { translations: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, data: rows.map((r) => mapReview(r)) };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Moderation (APPROVE_REVIEW)
  // ════════════════════════════════════════════════════════════════════════

  async moderationQueue(query: ModerationQueueQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ReviewWhereInput = {
      moderationStatus: query.status ?? ReviewModerationStatus.PENDING,
      ...(query.tourId && { tourId: query.tourId }),
    };
    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: { translations: true },
        orderBy: { createdAt: 'asc' }, // oldest first - clear the backlog
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, page, limit, data: rows.map((r) => mapReview(r)) };
  }

  async moderate(id: string, dto: ModerateReviewDto, adminId: string) {
    if (
      dto.status !== ReviewModerationStatus.APPROVED &&
      dto.status !== ReviewModerationStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Moderation status must be APPROVED or REJECTED',
      );
    }
    if (
      dto.status === ReviewModerationStatus.REJECTED &&
      !dto.rejectionReason?.trim()
    ) {
      throw new BadRequestException('A rejection reason is required');
    }

    const review = await this.prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        tourId: true,
        operatorId: true,
        moderationStatus: true,
      },
    });
    if (!review) throw new NotFoundException('Review not found');

    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        moderationStatus: dto.status,
        rejectionReason:
          dto.status === ReviewModerationStatus.REJECTED
            ? dto.rejectionReason!.trim()
            : null,
      },
      include: { translations: true },
    });

    // Aggregates change whenever a review enters or leaves the APPROVED set.
    await this.recomputeAggregates(review.tourId, review.operatorId);

    this.logger.log(
      `Review ${id} moderated → ${dto.status} by admin ${adminId}`,
    );
    return mapReview(updated);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Operator response (tour owner or admin)
  // ════════════════════════════════════════════════════════════════════════

  async respond(id: string, dto: OperatorResponseDto, actor: Actor) {
    if (containsBannedWord(dto.response)) {
      throw new BadRequestException('Response contains disallowed language');
    }
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, operatorId: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.assertOwnsOperator(review.operatorId, actor);

    const updated = await this.prisma.review.update({
      where: { id },
      data: { operatorResponse: dto.response, operatorRespondedAt: new Date() },
      include: { translations: true },
    });
    this.logger.log(`Review ${id} answered by ${actor.role} ${actor.id}`);
    return mapReview(updated);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Helpful vote (public) + delete (owner or moderator)
  // ════════════════════════════════════════════════════════════════════════

  async markHelpful(id: string) {
    try {
      const updated = await this.prisma.review.update({
        where: { id },
        data: { helpfulCount: { increment: 1 } },
        select: { id: true, helpfulCount: true },
      });
      return { id: updated.id, helpfulCount: updated.helpfulCount };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        throw new NotFoundException('Review not found');
      }
      throw err;
    }
  }

  async remove(id: string, actor: Actor) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        tourId: true,
        operatorId: true,
        moderationStatus: true,
      },
    });
    if (!review) throw new NotFoundException('Review not found');

    const isOwner = review.userId === actor.id;
    const canModerate = actor.role === Role.ADMIN; // DELETE_REVIEW already gates the route
    if (!isOwner && !canModerate) {
      throw new ForbiddenException('You cannot delete this review');
    }

    await this.prisma.review.delete({ where: { id } });
    if (review.moderationStatus === ReviewModerationStatus.APPROVED) {
      await this.recomputeAggregates(review.tourId, review.operatorId);
    }
    this.logger.log(`Review ${id} deleted by ${actor.role} ${actor.id}`);
    return { id, deleted: true };
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private hasExperiencePassed(booking: {
    localDate: Date;
    startTime: string | null;
    tour: { timeZone: string } | null;
  }): boolean {
    const tz = booking.tour?.timeZone ?? 'America/Curacao';
    const start = new Date(
      `${dateKey(booking.localDate)}T${booking.startTime ?? '00:00'}:00.000Z`,
    );
    return start <= localNow(tz);
  }

  private orderFor(
    sort?: ListReviewsQueryDto['sort'],
  ): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating_desc':
        return [{ rating: 'desc' }, { createdAt: 'desc' }];
      case 'rating_asc':
        return [{ rating: 'asc' }, { createdAt: 'desc' }];
      case 'helpful':
        return [{ helpfulCount: 'desc' }, { createdAt: 'desc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  /** Recompute cached tour + operator aggregates from the APPROVED set. */
  private async recomputeAggregates(
    tourId: string,
    operatorId: string,
  ): Promise<void> {
    const [tourAgg, opAgg] = await Promise.all([
      this.prisma.review.aggregate({
        where: { tourId, moderationStatus: ReviewModerationStatus.APPROVED },
        _count: true,
        _avg: { rating: true },
      }),
      this.prisma.review.aggregate({
        where: {
          operatorId,
          moderationStatus: ReviewModerationStatus.APPROVED,
        },
        _count: true,
        _avg: { rating: true },
      }),
    ]);
    await Promise.all([
      this.prisma.tour.update({
        where: { id: tourId },
        data: {
          aggregateRating: roundRating(tourAgg._avg.rating),
          aggregateReviewCount: tourAgg._count,
        },
      }),
      this.prisma.operator.update({
        where: { id: operatorId },
        data: {
          aggregateRating: roundRating(opAgg._avg.rating),
          aggregateReviewCount: opAgg._count,
        },
      }),
    ]);
  }

  private async assertOwnsOperator(
    operatorId: string,
    actor: Actor,
  ): Promise<void> {
    if (actor.role === Role.ADMIN) return;
    const own = await resolveOperatorId(this.prisma, actor.id, actor.role);
    if (own !== operatorId) {
      throw new ForbiddenException(
        'You can only respond to reviews of your own tours',
      );
    }
  }

  private async assertCanModerateOrOwn(
    review: { userId: string; operatorId: string },
    actor?: Actor,
  ): Promise<void> {
    if (!actor) throw new NotFoundException('Review not found');
    if (actor.role === Role.ADMIN) return;
    if (review.userId === actor.id) return;
    if (actor.role === Role.TOUR_OPERATOR) {
      const own = await resolveOperatorId(this.prisma, actor.id, actor.role);
      if (own === review.operatorId) return;
    }
    throw new NotFoundException('Review not found'); // don't leak unmoderated content
  }
}

// ════════════════════════════════════════════════════════════════════════════
// Pure mapping
// ════════════════════════════════════════════════════════════════════════════

type ReviewWithTranslations = Prisma.ReviewGetPayload<{
  include: { translations: true };
}>;

function mapReview(review: ReviewWithTranslations, locale?: Locale) {
  const translation =
    (locale && review.translations.find((t) => t.locale === locale)) ??
    review.translations.find((t) => t.locale === Locale.en) ??
    review.translations[0] ??
    null;

  return {
    id: review.id,
    tourId: review.tourId,
    operatorId: review.operatorId,
    rating: review.rating,
    ratingValue: review.ratingValue,
    ratingGuide: review.ratingGuide,
    ratingSafety: review.ratingSafety,
    title: review.title,
    comment: translation?.comment ?? null,
    locale: translation?.locale ?? locale ?? Locale.en,
    reviewerInitial: review.reviewerInitial,
    reviewerCountry: review.reviewerCountry,
    travelMonth: review.travelMonth,
    travelYear: review.travelYear,
    photos: review.photos,
    helpfulCount: review.helpfulCount,
    isVerified: review.isVerified,
    moderationStatus: review.moderationStatus,
    operatorResponse: review.operatorResponse,
    operatorRespondedAt: review.operatorRespondedAt
      ? review.operatorRespondedAt.toISOString()
      : null,
    createdAt: review.createdAt.toISOString(),
  };
}
