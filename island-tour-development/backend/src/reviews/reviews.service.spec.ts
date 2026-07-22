import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  BookingStatus,
  Locale,
  ReviewModerationStatus,
  ReviewResponseAuthor,
  ReviewSource,
  Role,
} from '@prisma/client';
import { ReviewsService } from './reviews.service';

const PAST = new Date('2020-06-01T00:00:00.000Z');

function mockPrisma(): any {
  const base: any = {
    booking: { findUnique: jest.fn() },
    review: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    reviewModerationLog: { create: jest.fn(), findMany: jest.fn() },
    reviewFlag: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    tour: { findUnique: jest.fn(), update: jest.fn() },
    operator: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    // Run the callback against the same mock: these transactions exist to keep a
    // status change and its audit row atomic, not to change the query surface.
    $transaction: jest.fn((fn: any) => fn(base)),
  };
  return base;
}

function reviewableBooking(over: Record<string, unknown> = {}) {
  return {
    id: 'bk1',
    userId: 'u1',
    tourId: 't1',
    operatorId: 'op1',
    status: BookingStatus.CONFIRMED,
    localDate: PAST,
    startTime: '09:00',
    contactFirstName: 'Ada',
    contactLastName: 'Byron',
    contactCountry: 'NL',
    tour: { timeZone: 'America/Curacao' },
    ...over,
  };
}

function createdReview(over: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    tourId: 't1',
    operatorId: 'op1',
    rating: 5,
    ratingValue: null,
    ratingGuide: null,
    ratingSafety: null,
    title: null,
    reviewerInitial: 'Ada B.',
    reviewerCountry: 'NL',
    travelMonth: 6,
    travelYear: 2020,
    reviewerType: null,
    photos: [],
    themeTags: [],
    helpfulCount: 0,
    source: 'NATIVE',
    isVerified: true,
    moderationStatus: ReviewModerationStatus.PENDING,
    responseText: null,
    responseAuthor: null,
    responseAt: null,
    createdAt: PAST,
    translations: [{ locale: Locale.en, comment: 'Wonderful sunset cruise' }],
    ...over,
  };
}

const dto = { bookingId: 'bk1', rating: 5, comment: 'Wonderful sunset cruise' };

describe('ReviewsService', () => {
  let prisma: any;
  let svc: ReviewsService;

  beforeEach(() => {
    prisma = mockPrisma();
    svc = new ReviewsService(prisma);
  });

  describe('create (booking-gated)', () => {
    it('creates a PENDING review for an owned, completed booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(reviewableBooking());
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue(createdReview());

      const res = await svc.create(dto, 'u1');

      expect(res.moderationStatus).toBe(ReviewModerationStatus.PENDING);
      expect(res.comment).toBe('Wonderful sunset cruise');
      expect(res.reviewerInitial).toBe('Ada B.');
      const data = prisma.review.create.mock.calls[0][0].data;
      expect(data.tourId).toBe('t1');
      expect(data.translations.create).toEqual({
        locale: Locale.en,
        comment: dto.comment,
      });
    });

    it('rejects reviewing someone else’s booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        reviewableBooking({ userId: 'someone-else' }),
      );
      await expect(svc.create(dto, 'u1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects a booking that is not confirmed/redeemed', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        reviewableBooking({ status: BookingStatus.ON_HOLD }),
      );
      await expect(svc.create(dto, 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects when the experience date has not passed', async () => {
      prisma.booking.findUnique.mockResolvedValue(
        reviewableBooking({ localDate: new Date('2999-01-01T00:00:00.000Z') }),
      );
      await expect(svc.create(dto, 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a second review for the same booking', async () => {
      prisma.booking.findUnique.mockResolvedValue(reviewableBooking());
      prisma.review.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(svc.create(dto, 'u1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('summary (LD11 cold-start)', () => {
    beforeEach(() => {
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: 8 },
        { rating: 4, _count: 2 },
      ]);
    });

    it('uses the tour rating at ≥3 approved reviews', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        id: 't1',
        operator: { aggregateRating: 4.9, aggregateReviewCount: 99 },
      });
      prisma.review.aggregate.mockResolvedValue({
        _count: 10,
        _avg: {
          rating: 4.6,
          ratingValue: 4.5,
          ratingGuide: 4.8,
          ratingSafety: 4.9,
        },
      });

      const s = await svc.summary('t1');
      expect(s.source).toBe('tour');
      expect(s.rating).toBe(4.6);
      expect(s.approvedCount).toBe(10);
      expect(s.distribution.find((d: any) => d.stars === 5)).toEqual({
        stars: 5,
        count: 8,
      });
      expect(s.avgGuide).toBe(4.8);
    });

    it('falls back to the operator rating below 3 tour reviews', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        id: 't1',
        operator: { aggregateRating: 4.3, aggregateReviewCount: 25 },
      });
      prisma.review.aggregate.mockResolvedValue({
        _count: 2,
        _avg: {
          rating: 5,
          ratingValue: null,
          ratingGuide: null,
          ratingSafety: null,
        },
      });

      const s = await svc.summary('t1');
      expect(s.source).toBe('operator');
      expect(s.rating).toBe(4.3);
      expect(s.reviewCount).toBe(25);
    });

    it('shows no rating when neither qualifies', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        id: 't1',
        operator: { aggregateRating: 3.5, aggregateReviewCount: 4 },
      });
      prisma.review.aggregate.mockResolvedValue({
        _count: 1,
        _avg: {
          rating: 5,
          ratingValue: null,
          ratingGuide: null,
          ratingSafety: null,
        },
      });

      const s = await svc.summary('t1');
      expect(s.source).toBe('none');
      expect(s.rating).toBeNull();
    });
  });

  describe('moderate', () => {
    it('approves and recomputes tour + operator aggregates', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        tourId: 't1',
        operatorId: 'op1',
        moderationStatus: ReviewModerationStatus.PENDING,
      });
      prisma.review.update.mockResolvedValue(
        createdReview({ moderationStatus: ReviewModerationStatus.APPROVED }),
      );
      prisma.review.aggregate.mockResolvedValue({
        _count: 3,
        _avg: { rating: 4.5 },
      });
      // Two 5-star, one 4-star, and one of those carries photos.
      prisma.review.groupBy.mockResolvedValue([
        { rating: 5, _count: 2 },
        { rating: 4, _count: 1 },
      ]);
      prisma.review.count.mockResolvedValue(1);
      prisma.tour.update.mockResolvedValue({});
      prisma.operator.update.mockResolvedValue({});

      const res = await svc.moderate(
        'r1',
        { status: ReviewModerationStatus.APPROVED },
        'admin1',
      );

      expect(res.moderationStatus).toBe(ReviewModerationStatus.APPROVED);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't1' },
          data: expect.objectContaining({
            aggregateRating: 4.5,
            aggregateReviewCount: 3,
            // [5★,4★,3★,2★,1★] - the order the public histogram indexes into.
            ratingDistribution: [2, 1, 0, 0, 0],
            photoReviewCount: 1,
            aggregatesUpdatedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.operator.update).toHaveBeenCalled();
    });

    it('counts only APPROVED reviews with a non-empty photos array', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        tourId: 't1',
        operatorId: 'op1',
        moderationStatus: ReviewModerationStatus.PENDING,
      });
      prisma.review.update.mockResolvedValue(
        createdReview({ moderationStatus: ReviewModerationStatus.APPROVED }),
      );
      prisma.review.aggregate.mockResolvedValue({
        _count: 1,
        _avg: { rating: 5 },
      });
      prisma.review.groupBy.mockResolvedValue([{ rating: 5, _count: 1 }]);
      prisma.review.count.mockResolvedValue(0);
      prisma.tour.update.mockResolvedValue({});
      prisma.operator.update.mockResolvedValue({});

      await svc.moderate(
        'r1',
        { status: ReviewModerationStatus.APPROVED },
        'admin1',
      );

      // `source: NATIVE` is part of the contract, not incidental: an imported or
      // syndicated review must never enter a verified-booking aggregate.
      expect(prisma.review.count).toHaveBeenCalledWith({
        where: {
          tourId: 't1',
          moderationStatus: ReviewModerationStatus.APPROVED,
          source: ReviewSource.NATIVE,
          photos: { isEmpty: false },
        },
      });
    });

    it('requires a reason to reject', async () => {
      await expect(
        svc.moderate(
          'r1',
          { status: ReviewModerationStatus.REJECTED },
          'admin1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('respond', () => {
    it('rejects a response with banned language', async () => {
      await expect(
        svc.respond(
          'r1',
          { response: 'this is shit' },
          { id: 'admin1', role: Role.ADMIN },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lets an admin respond, stamped PLATFORM (LD37)', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        operatorId: 'op1',
        responseText: null,
      });
      prisma.review.update.mockResolvedValue(
        createdReview({
          responseText: 'Thank you!',
          responseAuthor: ReviewResponseAuthor.PLATFORM,
          responseAt: PAST,
        }),
      );
      const res = await svc.respond(
        'r1',
        { response: 'Thank you!' },
        { id: 'admin1', role: Role.ADMIN },
      );
      expect(res.responseText).toBe('Thank you!');
      expect(res.responseAuthor).toBe(ReviewResponseAuthor.PLATFORM);
      expect(prisma.review.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            responseAuthor: ReviewResponseAuthor.PLATFORM,
          }),
        }),
      );
    });

    it('refuses to edit a response that is already published (E.7)', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        operatorId: 'op1',
        responseText: 'Already answered',
      });
      await expect(
        svc.respond(
          'r1',
          { response: 'Revised answer' },
          { id: 'admin1', role: Role.ADMIN },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('blocks an operator at launch - responses are platform-authored (LD37)', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        operatorId: 'op1',
        responseText: null,
      });
      await expect(
        svc.respond(
          'r1',
          { response: 'Thanks' },
          { id: 'u9', role: Role.TOUR_OPERATOR },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('lets the author delete their own review', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        tourId: 't1',
        operatorId: 'op1',
        moderationStatus: ReviewModerationStatus.PENDING,
      });
      prisma.review.delete.mockResolvedValue({});
      const res = await svc.remove('r1', { id: 'u1', role: Role.USER });
      expect(res).toEqual({ id: 'r1', deleted: true });
    });

    it('blocks a non-owner non-admin from deleting', async () => {
      prisma.review.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'u1',
        tourId: 't1',
        operatorId: 'op1',
        moderationStatus: ReviewModerationStatus.APPROVED,
      });
      await expect(
        svc.remove('r1', { id: 'someone', role: Role.USER }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
