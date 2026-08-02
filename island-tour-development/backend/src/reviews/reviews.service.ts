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
  InboxEvent,
  Locale,
  Prisma,
  ReviewFlagStatus,
  ReviewModerationStatus,
  ReviewResponseAuthor,
  ReviewSource,
  Role,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { InboxService } from '@/inbox/inbox.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  isPlatformWideRole,
  resolveOperatorId,
} from '@/common/utils/operator.util';
import { dateKey, localNow } from '@/common/utils/timezone.util';
import {
  containsBannedWord,
  resolveRatingSource,
  reviewerInitial,
  roundRating,
} from './review-display.util';
import {
  REVIEW_TRANSLATION_QUEUE,
  ReviewTranslationService,
} from './review-translation.service';
import type {
  AdminReviewsQueryDto,
  BulkModerateReviewsDto,
  CreateReviewDto,
  DeleteReviewDto,
  FlagReviewDto,
  ListReviewsQueryDto,
  ModerateReviewDto,
  ModerationQueueQueryDto,
  ResolveFlagDto,
  RespondToReviewDto,
  SetThemeTagsDto,
} from './dto/review.dto';

const REVIEWABLE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.REDEEMED,
];
const STARS = [5, 4, 3, 2, 1];

/**
 * Only NATIVE, APPROVED records may reach a tour page or an aggregate. Every
 * public read and every aggregate query composes this - a non-native source is
 * never blended into a verified-booking rating (Omnibus + the E.7 promise).
 */
const PUBLISHED: Prisma.ReviewWhereInput = {
  moderationStatus: ReviewModerationStatus.APPROVED,
  source: ReviewSource.NATIVE,
};

type Actor = { id: string; role: Role };

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly translation: ReviewTranslationService,
    @InjectQueue(REVIEW_TRANSLATION_QUEUE)
    private readonly translationQueue: Queue,
    private readonly inbox: InboxService,
  ) {}

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
        departureId: true,
        status: true,
        localDate: true,
        startTime: true,
        tourTimeZone: true,
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
        // Derived, never client-supplied: the departure is whatever the booking
        // was actually placed against (null on freesale).
        departureId: booking.departureId,
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
        reviewerType: dto.reviewerType ?? null,
        travelMonth: booking.localDate.getUTCMonth() + 1,
        travelYear: booking.localDate.getUTCFullYear(),
        photos: dto.photos ?? [],
        source: ReviewSource.NATIVE,
        moderationStatus: ReviewModerationStatus.PENDING,
        translations: { create: { locale, comment: dto.comment } },
      },
      include: { translations: true },
    });

    // Genesis audit row. Written separately rather than nested because the log
    // is deliberately not a relation (see `ReviewModerationLog` in the schema).
    // The trail must have no gaps: "how did this reach PENDING" is as auditable
    // as every later transition.
    await this.prisma.reviewModerationLog.create({
      data: {
        reviewId: review.id,
        actorId: userId,
        fromStatus: null,
        toStatus: ReviewModerationStatus.PENDING,
        reason: flagged
          ? 'Submitted; auto-flagged for banned language'
          : 'Submitted',
      },
    });

    this.inbox.notify({
      event: InboxEvent.REVIEW_SUBMITTED,
      operatorId: booking.operatorId,
      title: flagged
        ? `Review flagged for moderation (${dto.rating}/5)`
        : `New review awaiting moderation (${dto.rating}/5)`,
      body: flagged ? 'Auto-flagged for banned language.' : undefined,
      url: '/reviews',
      entityType: 'review',
      entityId: review.id,
      // The traveller is not a dashboard user; nothing to exclude.
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
      ...PUBLISHED,
      tourId: query.tourId,
      // LD31: clicking a bar on the star chart filters to that star value.
      ...(query.rating != null && { rating: query.rating }),
      // FE-9: theme chips. `has` is an exact array-element match, so a tag is
      // never matched by prefix - "Great guide" cannot be selected by "Great".
      ...(query.themeTag && { themeTags: { has: query.themeTag } }),
      // Phase 7 depth filters.
      ...(query.reviewerType && { reviewerType: query.reviewerType }),
      ...(query.withPhotos && { NOT: { photos: { isEmpty: true } } }),
      // Language WRITTEN in, matched on the source row. Filtering on the
      // display translation would return every review once LD32 has run.
      ...(query.writtenIn && {
        translations: {
          some: { locale: query.writtenIn, isMachineTranslated: false },
        },
      }),
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

    const where: Prisma.ReviewWhereInput = { ...PUBLISHED, tourId };
    const [agg, groups, facetRows] = await Promise.all([
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
      // Theme-chip and photo facets. Counted in JS off one bounded per-tour
      // query rather than `groupBy` (which cannot aggregate a scalar list) or
      // raw SQL with `unnest`: raw SQL would mean hand-restating the PUBLISHED
      // clause, and a filter that drifts from the shared constant would publish
      // held or imported reviews into the facets while the list itself hides
      // them. One tour's approved reviews are tens to low hundreds of rows.
      this.prisma.review.findMany({
        where,
        select: {
          themeTags: true,
          photos: true,
          reviewerType: true,
          // Source-language facet: the row the guest actually wrote.
          translations: {
            where: { isMachineTranslated: false },
            select: { locale: true },
          },
        },
      }),
    ]);

    const themeCounts = new Map<string, number>();
    const guestCounts = new Map<string, number>();
    const languageCounts = new Map<string, number>();
    let photoCount = 0;
    for (const row of facetRows) {
      if (row.photos.length > 0) photoCount++;
      for (const tag of row.themeTags) {
        themeCounts.set(tag, (themeCounts.get(tag) ?? 0) + 1);
      }
      if (row.reviewerType) {
        guestCounts.set(
          row.reviewerType,
          (guestCounts.get(row.reviewerType) ?? 0) + 1,
        );
      }
      const source = row.translations[0]?.locale;
      if (source) {
        languageCounts.set(source, (languageCounts.get(source) ?? 0) + 1);
      }
    }

    // Same ordering rule as the theme chips: most-used first, alphabetical on a
    // tie, so a filter bar cannot reshuffle between requests.
    const byCount = (a: { count: number; value: string }, b: typeof a) =>
      b.count - a.count || a.value.localeCompare(b.value);
    const guestTypes = [...guestCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort(byCount);
    const languages = [...languageCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort(byCount);
    // Most-used first, then alphabetical so the chip order is stable across
    // requests when counts tie - an unstable chip bar reads as a rendering bug.
    const themes = [...themeCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

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
      themes,
      // Phase 7 facets. The UI offers only options that return something - a
      // filter that yields an empty list is a dead end the user has to undo.
      guestTypes,
      languages,
      photoCount,
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
    const reason = dto.rejectionReason?.trim() || null;
    if (dto.status === ReviewModerationStatus.REJECTED && !reason) {
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

    // The status change and its audit row are ONE transaction. A transition
    // without a trail is exactly the thing we would be unable to defend.
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.review.update({
        where: { id },
        data: {
          moderationStatus: dto.status,
          rejectionReason:
            dto.status === ReviewModerationStatus.REJECTED ? reason : null,
        },
        include: { translations: true },
      });
      await tx.reviewModerationLog.create({
        data: {
          reviewId: id,
          actorId: adminId,
          fromStatus: review.moderationStatus,
          toStatus: dto.status,
          reason,
        },
      });
      return next;
    });

    // Aggregates change whenever a review enters or leaves the APPROVED set.
    await this.recomputeAggregates(review.tourId, review.operatorId);

    // LD32: approval is what makes a review publishable, so it is what triggers
    // translation. Enqueued, never awaited - the moderator's click must not wait
    // on six third-party round trips, and `enqueue` swallows its own failure so
    // a Redis outage cannot turn into a failed approval.
    if (dto.status === ReviewModerationStatus.APPROVED) {
      await this.translation.enqueue(this.translationQueue, id);
    }

    if (dto.status === ReviewModerationStatus.APPROVED) {
      this.inbox.notify({
        event: InboxEvent.REVIEW_PUBLISHED,
        operatorId: review.operatorId,
        title: `A ${updated.rating}-star review is now live`,
        body: 'You can post one public response to it.',
        url: '/reviews',
        entityType: 'review',
        entityId: id,
        actorUserId: adminId,
      });
    }
    this.logger.log(
      `Review ${id} moderated ${review.moderationStatus} → ${dto.status} by ${adminId}`,
    );
    return mapReview(updated);
  }

  /**
   * Bulk transition. Clearing a launch-volume queue one dialog at a time is the
   * difference between moderation happening and not happening.
   *
   * Per-review, not a single `updateMany`: each needs its own audit row carrying
   * its own `fromStatus`, and a failure on one must not silently swallow the
   * rest. Aggregates are recomputed once per affected (tour, operator) pair
   * rather than once per review.
   */
  async bulkModerate(dto: BulkModerateReviewsDto, adminId: string) {
    const reason = dto.rejectionReason?.trim() || null;
    if (dto.status === ReviewModerationStatus.REJECTED && !reason) {
      throw new BadRequestException('A rejection reason is required');
    }

    const reviews = await this.prisma.review.findMany({
      where: { id: { in: dto.ids } },
      select: {
        id: true,
        tourId: true,
        operatorId: true,
        moderationStatus: true,
      },
    });
    if (!reviews.length) throw new NotFoundException('No reviews found');

    await this.prisma.$transaction(async (tx) => {
      for (const r of reviews) {
        await tx.review.update({
          where: { id: r.id },
          data: {
            moderationStatus: dto.status,
            rejectionReason:
              dto.status === ReviewModerationStatus.REJECTED ? reason : null,
          },
        });
        await tx.reviewModerationLog.create({
          data: {
            reviewId: r.id,
            actorId: adminId,
            fromStatus: r.moderationStatus,
            toStatus: dto.status,
            reason,
          },
        });
      }
    });

    const pairs = new Map(
      reviews.map((r) => [`${r.tourId}:${r.operatorId}`, r]),
    );
    for (const r of pairs.values()) {
      await this.recomputeAggregates(r.tourId, r.operatorId);
    }

    this.logger.log(
      `Bulk moderated ${reviews.length} review(s) → ${dto.status} by ${adminId}`,
    );
    return { updated: reviews.length, status: dto.status };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Editorial (EDIT_REVIEW): theme chips + feature
  // ════════════════════════════════════════════════════════════════════════

  /** Manual highlight chips (pre-AI LD29 Tier 3). Admin-only, never operator-set. */
  /**
   * LD32 on demand (see the controller for when this is the right tool).
   *
   * Surfaces `not_configured` as a 400 rather than a silent success: an admin
   * clicking "translate" and getting 200 / nothing translated would look like a
   * broken button, when the real answer is that no API key is set.
   */
  async translate(id: string) {
    const res = await this.translation.translateReview(id);
    if (res.reason === 'not_configured') {
      throw new BadRequestException(
        'AI translation is not configured - set it up under Settings > Integrations > AI Translation (or TRANSLATION_API_KEY)',
      );
    }
    return res;
  }

  async setThemeTags(id: string, dto: SetThemeTagsDto) {
    const tags = [
      ...new Set(dto.themeTags.map((t) => t.trim()).filter(Boolean)),
    ];
    const updated = await this.updateOrNotFound(id, { themeTags: tags });
    this.logger.log(`Review ${id} theme tags set: [${tags.join(', ')}]`);
    return mapReview(updated);
  }

  /** Editorial pick for the LD29 preview / homepage quote strip. Admin-only. */
  async setFeatured(id: string, isFeatured: boolean) {
    const updated = await this.updateOrNotFound(id, { isFeatured });
    this.logger.log(`Review ${id} isFeatured → ${isFeatured}`);
    return mapReview(updated);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Response (LD37)
  //
  // PLATFORM-AUTHORED AT LAUNCH. Master E.7 says "operator response" while the
  // canonical Section4_7 §4.7.18 says "platform response (Island Tours-authored,
  // not operator)". LD37 resolves that: Island Tours replies in brand voice
  // while volume is low and the moderation surface is small, and moderated
  // operator-authored responses unlock in phase 4 once operators have a
  // dashboard. Until then only an admin may write one, and `responseAuthor`
  // records which regime produced it.
  //
  // No editing after publish, per E.7: a second write is a 409, not an
  // overwrite. A published reply a traveller has already read is not something
  // the platform gets to quietly revise.
  // ════════════════════════════════════════════════════════════════════════

  async respond(id: string, dto: RespondToReviewDto, actor: Actor) {
    if (containsBannedWord(dto.response)) {
      throw new BadRequestException('Response contains disallowed language');
    }
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: {
        id: true,
        operatorId: true,
        responseText: true,
        moderationStatus: true,
      },
    });
    if (!review) throw new NotFoundException('Review not found');

    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Responses are authored by Island Tours at launch; operator responses ' +
          'unlock with the operator dashboard (LD37)',
      );
    }
    if (review.responseText) {
      throw new ConflictException(
        'This review already has a published response, which cannot be edited',
      );
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        responseText: dto.response.trim(),
        responseAuthor: ReviewResponseAuthor.PLATFORM,
        responseAt: new Date(),
      },
      include: { translations: true },
    });
    this.logger.log(`Review ${id} answered (PLATFORM) by ${actor.id}`);
    return mapReview(updated);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Flags - the operator's ONLY lever
  //
  // A flag is a request, never an action. Operators cannot delete, unpublish or
  // edit any review; they raise a policy concern and Island Tours decides. That
  // asymmetry is the product: the moment buyers suspect operators can scrub bad
  // reviews, every five-star rating stops meaning anything.
  // ════════════════════════════════════════════════════════════════════════

  async flag(id: string, dto: FlagReviewDto, actor: Actor) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true, operatorId: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.assertOwnsOperator(review.operatorId, actor);

    // Re-flagging updates the existing report rather than queueing duplicates.
    const flag = await this.prisma.reviewFlag.upsert({
      where: {
        reviewId_flaggedByUserId: { reviewId: id, flaggedByUserId: actor.id },
      },
      create: {
        reviewId: id,
        flaggedByUserId: actor.id,
        reason: dto.reason,
        note: dto.note ?? null,
      },
      update: {
        reason: dto.reason,
        note: dto.note ?? null,
        status: ReviewFlagStatus.OPEN,
        resolvedById: null,
        resolvedAt: null,
        resolutionNote: null,
      },
      select: { id: true, reviewId: true, reason: true, status: true },
    });
    this.logger.log(
      `Review ${id} flagged (${dto.reason}) by ${actor.role} ${actor.id}`,
    );
    return flag;
  }

  /** Island Tours decides. The flag closes; the review's status is unchanged. */
  async resolveFlag(flagId: string, dto: ResolveFlagDto, adminId: string) {
    const flag = await this.prisma.reviewFlag.findUnique({
      where: { id: flagId },
      select: { id: true },
    });
    if (!flag) throw new NotFoundException('Flag not found');

    const updated = await this.prisma.reviewFlag.update({
      where: { id: flagId },
      data: {
        status: dto.status,
        resolvedById: adminId,
        resolvedAt: new Date(),
        resolutionNote: dto.resolutionNote ?? null,
      },
      select: {
        id: true,
        reviewId: true,
        status: true,
        resolvedAt: true,
        resolutionNote: true,
      },
    });
    this.logger.log(`Flag ${flagId} → ${dto.status} by admin ${adminId}`);
    return updated;
  }

  // ════════════════════════════════════════════════════════════════════════
  // Delete (owner or moderator)
  //
  // NO HELPFUL-VOTE ENDPOINT. Helpful votes are deferred to V2 by the master,
  // and the public `POST /reviews/:id/helpful` that used to live here took no
  // identity of any kind - a loop could inflate any review's count, quietly
  // poisoning a signal the reviews section sorted by. The `helpfulCount` column
  // is retained so V2 can re-enable this with a per-visitor vote binding rather
  // than a migration.
  // ════════════════════════════════════════════════════════════════════════

  async remove(id: string, actor: Actor, dto?: DeleteReviewDto) {
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

    const reason = dto?.reason?.trim() || null;
    // A moderator destroying someone else's review must say on what ground. An
    // author deleting their own need not: that is not a moderation act.
    if (!isOwner && !reason) {
      throw new BadRequestException(
        'A documented policy ground is required to remove a review',
      );
    }

    // `review_moderation_logs` cascades on delete, so the trail would vanish
    // with the row it documents. Detach the surviving audit record from the
    // review first, then delete: the evidence that a removal happened must
    // outlive the thing removed.
    await this.prisma.$transaction(async (tx) => {
      await tx.reviewModerationLog.create({
        data: {
          reviewId: id,
          actorId: actor.id,
          fromStatus: review.moderationStatus,
          toStatus: null,
          isDeletion: true,
          reason: reason ?? 'Deleted by the author',
        },
      });
      await tx.review.delete({ where: { id } });
    });

    if (review.moderationStatus === ReviewModerationStatus.APPROVED) {
      await this.recomputeAggregates(review.tourId, review.operatorId);
    }
    this.logger.log(
      `Review ${id} deleted by ${actor.role} ${actor.id}${reason ? ` (${reason})` : ''}`,
    );
    return { id, deleted: true };
  }

  // ════════════════════════════════════════════════════════════════════════
  // Admin + operator listings (BE-11 / BE-12 / BE-13)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Cross-tour, all-status listing for the moderation queue.
   *
   * `operatorScope` is set when a TOUR_OPERATOR calls it, which hard-limits the
   * query to their own tours. It is applied AFTER the DTO filters so a supplied
   * `operatorId` can never widen the scope past the caller's own.
   */
  async adminList(query: AdminReviewsQueryDto, operatorScope?: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim();

    const where: Prisma.ReviewWhereInput = {
      ...(query.status && { moderationStatus: query.status }),
      ...(query.tourId && { tourId: query.tourId }),
      ...(query.operatorId && { operatorId: query.operatorId }),
      ...(query.rating != null && { rating: query.rating }),
      ...(query.hasPhotos && { photos: { isEmpty: false } }),
      ...(query.flagged && {
        flags: { some: { status: ReviewFlagStatus.OPEN } },
      }),
      ...(query.locale && { translations: { some: { locale: query.locale } } }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      ...(search && {
        OR: [
          { reviewerFirstName: { contains: search, mode: 'insensitive' } },
          { reviewerInitial: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
          {
            translations: {
              some: { comment: { contains: search, mode: 'insensitive' } },
            },
          },
        ],
      }),
      // Last, and unconditional: an operator sees only their own.
      ...(operatorScope && { operatorId: operatorScope }),
    };

    const [total, rows] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          translations: true,
          tour: { select: { name: true } },
          operator: {
            select: { companyInfo: { select: { companyName: true } } },
          },
          booking: { select: { displayRef: true } },
          _count: { select: { flags: { where: { status: 'OPEN' } } } },
        },
        // Oldest-first by default: a queue is cleared from the bottom, and the
        // oldest pending review is the traveller who has waited longest.
        // `pending_first` is for the unfiltered list - see adminOrderFor.
        orderBy: this.adminOrderFor(query.sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      total,
      page,
      limit,
      data: rows.map((r) => ({
        ...mapReview(r, query.locale),
        tourTitle: r.tour?.name ?? null,
        operatorName: r.operator?.companyInfo?.companyName ?? null,
        bookingRef: r.booking?.displayRef ?? null,
        isFeatured: r.isFeatured,
        rejectionReason: r.rejectionReason,
        openFlagCount: r._count.flags,
      })),
    };
  }

  /** The same queue, hard-scoped to the calling operator's own tours. */
  /**
   * The moderation queue, scoped to whoever is asking.
   *
   * `VIEW_REVIEWS` is held by TOUR_OPERATOR as well as ADMIN, so the permission
   * alone cannot be the scope: it says "may see reviews", not "may see everyone's
   * reviews". Without this branch the `/reviews/admin` route handed any operator
   * the whole platform's queue - every rival's pending and rejected reviews,
   * with reviewer names and booking references attached.
   */
  async listForActor(query: AdminReviewsQueryDto, actor: Actor) {
    // Platform-wide, not ADMIN-only. Testing for ADMIN alone sent an invited
    // platform staff member (Operations Manager, holding VIEW_REVIEWS and
    // APPROVE_REVIEW) down the operator branch, where `resolveOperatorId`
    // throws because they have no operator record - so the moderation queue
    // answered an error instead of the platform's reviews (test report
    // 2026-08-01 §Admin.4). Operators still resolve to their own scope below.
    if (isPlatformWideRole(actor.role)) return this.adminList(query);
    return this.operatorList(query, actor);
  }

  async operatorList(query: AdminReviewsQueryDto, actor: Actor) {
    const operatorId = await resolveOperatorId(
      this.prisma,
      actor.id,
      actor.role,
    );
    if (!operatorId) {
      throw new ForbiddenException('No operator record for this account');
    }
    return this.adminList(query, operatorId);
  }

  /** Full audit trail for one review. Read-only, append-only at the source. */
  async moderationHistory(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!review) throw new NotFoundException('Review not found');
    return this.prisma.reviewModerationLog.findMany({
      where: { reviewId: id },
      select: {
        id: true,
        actorId: true,
        fromStatus: true,
        toStatus: true,
        isDeletion: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private hasExperiencePassed(booking: {
    localDate: Date;
    startTime: string | null;
    tourTimeZone: string | null;
    tour: { timeZone: string } | null;
  }): boolean {
    // Anchor "has the experience happened yet?" to the zone snapshotted on the
    // booking (falling back to the live tour zone for older bookings) - never a
    // universal Curaçao fallback. If no zone is resolvable we conservatively
    // treat the experience as not-yet-passed.
    const tz = booking.tourTimeZone ?? booking.tour?.timeZone;
    if (!tz) return false;
    const start = new Date(
      `${dateKey(booking.localDate)}T${booking.startTime ?? '00:00'}:00.000Z`,
    );
    return start <= localNow(tz);
  }

  /**
   * Row order for the dashboard review list (`/reviews/admin`, `/reviews/operator`).
   *
   * `pending_first` sorts by `moderationStatus` ascending, which in Postgres is
   * the ENUM DECLARATION order - PENDING, APPROVED, HELD, REJECTED - not
   * alphabetical. PENDING is declared first, so the reviews still awaiting a
   * decision float to the top of an otherwise unfiltered list. Reordering the
   * enum would silently change this sort; the tiebreaker keeps rows stable
   * within a group.
   *
   * This has to be a SERVER sort: the list is paginated here, so ordering on
   * the client would only rearrange whichever page happened to be fetched.
   */
  private adminOrderFor(
    sort?: AdminReviewsQueryDto['sort'],
  ): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
      case 'pending_first':
        return [{ moderationStatus: 'asc' }, { createdAt: 'desc' }];
      case 'newest':
        return [{ createdAt: 'desc' }];
      default:
        return [{ createdAt: 'asc' }];
    }
  }

  private orderFor(
    sort?: ListReviewsQueryDto['sort'],
  ): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
      case 'rating_desc':
        return [{ rating: 'desc' }, { createdAt: 'desc' }];
      case 'rating_asc':
        return [{ rating: 'asc' }, { createdAt: 'desc' }];
      default:
        return [{ createdAt: 'desc' }];
    }
  }

  /**
   * Recompute cached tour + operator aggregates from the APPROVED set.
   *
   * Writes ALL FIVE denormalized tour columns, not just the rating and count.
   * `ratingDistribution` backs the clickable star chart (LD31) and
   * `photoReviewCount` gates the photo carousel at ≥3 photo reviews - both are
   * declared on the tour, selected by `toursSelect`, typed in the DTO and read
   * by the public page, so leaving them unwritten rendered a permanently empty
   * histogram and a gate that could never open.
   */
  private async recomputeAggregates(
    tourId: string,
    operatorId: string,
  ): Promise<void> {
    const approvedTour: Prisma.ReviewWhereInput = { ...PUBLISHED, tourId };

    const [tourAgg, buckets, photoCount, opAgg] = await Promise.all([
      this.prisma.review.aggregate({
        where: approvedTour,
        _count: true,
        _avg: { rating: true },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: approvedTour,
        _count: true,
      }),
      this.prisma.review.count({
        where: { ...approvedTour, photos: { isEmpty: false } },
      }),
      this.prisma.review.aggregate({
        where: { ...PUBLISHED, operatorId },
        _count: true,
        _avg: { rating: true },
      }),
    ]);

    // STARS is [5,4,3,2,1] and the column is documented as [5★,4★,3★,2★,1★],
    // which is also the order the public histogram indexes into. Keep them aligned.
    const distribution = STARS.map(
      (stars) => buckets.find((b) => b.rating === stars)?._count ?? 0,
    );

    await Promise.all([
      this.prisma.tour.update({
        where: { id: tourId },
        data: {
          aggregateRating: roundRating(tourAgg._avg.rating),
          aggregateReviewCount: tourAgg._count,
          ratingDistribution: distribution,
          photoReviewCount: photoCount,
          aggregatesUpdatedAt: new Date(),
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

  /** Update-and-return, turning Prisma's "record not found" into a clean 404. */
  private async updateOrNotFound(id: string, data: Prisma.ReviewUpdateInput) {
    try {
      return await this.prisma.review.update({
        where: { id },
        data,
        include: { translations: true },
      });
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

  // LD32: the row the guest actually wrote. `isMachineTranslated = false` is the
  // marker; EN then anything are the fallbacks for rows predating the flag.
  const original =
    review.translations.find((t) => !t.isMachineTranslated) ??
    review.translations.find((t) => t.locale === Locale.en) ??
    review.translations[0] ??
    null;
  const isTranslated = Boolean(
    translation && original && translation.locale !== original.locale,
  );

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
    // FE-6: both texts ship together so the show-original toggle is instant and
    // in place. A per-review translation URL would be a second indexable page
    // of the same content in a different language - duplicate content, and one
    // more thing for a crawler to find that no traveller ever links to.
    isMachineTranslated: isTranslated,
    originalComment: isTranslated ? (original?.comment ?? null) : null,
    originalLocale: original?.locale ?? null,
    reviewerInitial: review.reviewerInitial,
    reviewerCountry: review.reviewerCountry,
    travelMonth: review.travelMonth,
    travelYear: review.travelYear,
    reviewerType: review.reviewerType,
    photos: review.photos,
    themeTags: review.themeTags,
    helpfulCount: review.helpfulCount,
    source: review.source,
    isVerified: review.isVerified,
    moderationStatus: review.moderationStatus,
    responseText: review.responseText,
    responseAuthor: review.responseAuthor,
    responseAt: review.responseAt ? review.responseAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
  };
}
