/**
 * RecommendationsService - the featured-card gate (external + internal), placement
 * filtering, the internal live-resolver, source validation on create, and the
 * seed-protect delete. PrismaService and the translation enqueuer are mocked.
 */
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CollectionStatus,
  Currency,
  HubStatus,
  RecommendationPlacement,
  RecommendationRefType,
  RecommendationSource,
  TourStatus,
} from '@prisma/client';
import { RecommendationsService } from './recommendations.service';

const { THANK_YOU_PAGE, CONFIRMATION_EMAIL } = RecommendationPlacement;

function createMockPrisma() {
  return {
    recommendation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recommendationTranslation: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    recommendationCategory: { findUnique: jest.fn() },
    tour: { findUnique: jest.fn() },
    destination: { findUnique: jest.fn() },
    collection: { findUnique: jest.fn() },
    hub: { findUnique: jest.fn() },
  };
}

/** An enabled EXTERNAL row that passes the gate, with English copy. */
function externalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-ext',
    source: RecommendationSource.EXTERNAL,
    categoryId: null,
    isEnabled: true,
    displayOrder: 0,
    isSeeded: false,
    placements: [THANK_YOU_PAGE],
    refType: null,
    refId: null,
    imageUrl: 'https://cdn.test/hotel.jpg',
    linkUrl: 'https://airbnb.com/x',
    rating: null,
    reviewCount: null,
    sleeps: null,
    priceAmount: null,
    currency: Currency.USD,
    translations: [
      {
        locale: 'en',
        eyebrow: null,
        areaLabel: null,
        title: 'Palm Suite',
        description: 'Line one\nLine two',
        ctaLabel: null,
        isMachineTranslated: false,
      },
    ],
    ...overrides,
  };
}

function internalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-int',
    source: RecommendationSource.INTERNAL,
    categoryId: null,
    isEnabled: true,
    displayOrder: 0,
    isSeeded: false,
    placements: [THANK_YOU_PAGE],
    refType: RecommendationRefType.TOUR,
    refId: 'tour-1',
    imageUrl: null,
    linkUrl: null,
    rating: null,
    reviewCount: null,
    sleeps: null,
    priceAmount: null,
    currency: Currency.USD,
    translations: [],
    ...overrides,
  };
}

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const enqueuer = { enqueue: jest.fn(), enqueueForPageType: jest.fn() };

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContentTranslationEnqueuer, useValue: enqueuer },
      ],
    }).compile();
    service = module.get(RecommendationsService);
    jest.clearAllMocks();
  });

  describe('getFeatured (public read)', () => {
    it('returns the hidden payload when nothing qualifies', async () => {
      prisma.recommendation.findMany.mockResolvedValue([]);
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(false);
      expect(res.title).toBeNull();
      expect(res.currency).toBe(Currency.USD);
    });

    it('features the first COMPLETE external row and marks it external', async () => {
      prisma.recommendation.findMany.mockResolvedValue([externalRow()]);
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(true);
      expect(res.external).toBe(true);
      expect(res.title).toBe('Palm Suite');
      expect(res.linkUrl).toBe('https://airbnb.com/x');
      expect(res.descriptionLines).toEqual(['Line one', 'Line two']);
    });

    it('skips an incomplete external row (missing image) and keeps walking', async () => {
      prisma.recommendation.findMany.mockResolvedValue([
        externalRow({ id: 'a', imageUrl: null }),
        externalRow({ id: 'b', displayOrder: 1 }),
      ]);
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(true);
      expect(res.title).toBe('Palm Suite');
    });

    it('filters by placement in the query (has)', async () => {
      prisma.recommendation.findMany.mockResolvedValue([]);
      await service.getFeatured('en', CONFIRMATION_EMAIL);
      expect(prisma.recommendation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isEnabled: true, placements: { has: CONFIRMATION_EMAIL } },
        }),
      );
    });

    it('resolves an INTERNAL tour that is LIVE and links same-tab', async () => {
      prisma.recommendation.findMany.mockResolvedValue([internalRow()]);
      prisma.tour.findUnique.mockResolvedValue({
        name: 'Sunset Cruise',
        slug: 'sunset-cruise',
        status: TourStatus.LIVE,
        isActive: true,
        isBookable: true,
        ogImage: null,
        destination: { slug: 'curacao', isActive: true },
        images: [{ url: 'https://cdn.test/tour.jpg' }],
      });
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(true);
      expect(res.external).toBe(false);
      expect(res.title).toBe('Sunset Cruise');
      expect(res.imageUrl).toBe('https://cdn.test/tour.jpg');
      expect(res.linkUrl).toBe('/curacao/sunset-cruise');
    });

    it('skips an INTERNAL tour that is not LIVE', async () => {
      prisma.recommendation.findMany.mockResolvedValue([internalRow()]);
      prisma.tour.findUnique.mockResolvedValue({
        name: 'Draft Tour',
        slug: 'draft',
        status: TourStatus.DRAFT,
        isActive: true,
        isBookable: true,
        ogImage: null,
        destination: { slug: 'curacao' },
        images: [{ url: 'https://cdn.test/tour.jpg' }],
      });
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(false);
    });

    it('skips an INTERNAL row whose entity resolves live but has no image', async () => {
      prisma.recommendation.findMany.mockResolvedValue([
        internalRow({ refType: RecommendationRefType.COLLECTION, refId: 'c1' }),
      ]);
      prisma.collection.findUnique.mockResolvedValue({
        name: 'Best of Curacao',
        slug: 'best-of',
        heroImage: null,
        ogImage: null,
        status: CollectionStatus.PUBLISHED,
        isActive: true,
        destination: { slug: 'curacao' },
      });
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(false);
    });

    it('links a destination-only internal recommendation to /{slug}', async () => {
      prisma.recommendation.findMany.mockResolvedValue([
        internalRow({
          refType: RecommendationRefType.DESTINATION,
          refId: 'd1',
        }),
      ]);
      prisma.destination.findUnique.mockResolvedValue({
        name: 'Curaçao',
        slug: 'curacao',
        heroImage: 'https://cdn.test/dest.jpg',
        isActive: true,
      });
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.linkUrl).toBe('/curacao');
      expect(res.title).toBe('Curaçao');
    });

    it('skips an INTERNAL hub that is not PUBLISHED', async () => {
      prisma.recommendation.findMany.mockResolvedValue([
        internalRow({ refType: RecommendationRefType.HUB, refId: 'h1' }),
      ]);
      prisma.hub.findUnique.mockResolvedValue({
        name: 'Klein',
        slug: 'klein',
        heroImage: 'https://cdn.test/hub.jpg',
        ogImage: null,
        status: HubStatus.DRAFT,
        isActive: true,
        destination: { slug: 'curacao' },
      });
      const res = await service.getFeatured('en', THANK_YOU_PAGE);
      expect(res.enabled).toBe(false);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.recommendation.create.mockResolvedValue({ id: 'new-id' });
      // findOne() re-reads via describeAll() -> findMany, so the created row must
      // be discoverable there.
      prisma.recommendation.findMany.mockResolvedValue([
        { ...externalRow({ id: 'new-id' }), category: null },
      ]);
    });

    it('rejects an EXTERNAL recommendation with no title', async () => {
      await expect(
        service.create({ source: RecommendationSource.EXTERNAL }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an INTERNAL recommendation with no refType/refId', async () => {
      await expect(
        service.create({ source: RecommendationSource.INTERNAL }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates an EXTERNAL row with English copy and enqueues translation', async () => {
      await service.create(
        { source: RecommendationSource.EXTERNAL, title: 'Palm Suite' },
        'admin',
      );
      expect(prisma.recommendation.create).toHaveBeenCalled();
      expect(enqueuer.enqueue).toHaveBeenCalledWith('recommendation', 'new-id');
    });

    it('creates an INTERNAL row without copy and does NOT enqueue translation', async () => {
      prisma.tour.findUnique.mockResolvedValue({ id: 'tour-1' });
      await service.create(
        {
          source: RecommendationSource.INTERNAL,
          refType: RecommendationRefType.TOUR,
          refId: 'tour-1',
        },
        'admin',
      );
      expect(enqueuer.enqueue).not.toHaveBeenCalled();
    });

    it('rejects an INTERNAL recommendation whose refId does not exist', async () => {
      prisma.tour.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          {
            source: RecommendationSource.INTERNAL,
            refType: RecommendationRefType.TOUR,
            refId: 'ghost',
          },
          'admin',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a non-existent categoryId with 400', async () => {
      prisma.recommendationCategory.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          {
            source: RecommendationSource.EXTERNAL,
            title: 'X',
            categoryId: 'nope',
          },
          'admin',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('rejects a PATCH to INTERNAL that leaves no refType/refId', async () => {
      prisma.recommendation.findUnique.mockResolvedValue({
        source: RecommendationSource.EXTERNAL,
        refType: null,
        refId: null,
      });
      await expect(
        service.update('x', { source: RecommendationSource.INTERNAL }, 'admin'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.recommendation.update).not.toHaveBeenCalled();
    });

    it('404s an unknown recommendation', async () => {
      prisma.recommendation.findUnique.mockResolvedValue(null);
      await expect(
        service.update('x', { isEnabled: false }, 'admin'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('refuses to delete a seeded recommendation (403)', async () => {
      prisma.recommendation.findUnique.mockResolvedValue({
        id: 'x',
        isSeeded: true,
      });
      await expect(service.remove('x', 'admin')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.recommendation.delete).not.toHaveBeenCalled();
    });

    it('404s an unknown recommendation', async () => {
      prisma.recommendation.findUnique.mockResolvedValue(null);
      await expect(service.remove('x', 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('hard-deletes a non-seeded recommendation', async () => {
      prisma.recommendation.findUnique.mockResolvedValue({
        id: 'x',
        isSeeded: false,
      });
      prisma.recommendation.delete.mockResolvedValue({});
      await service.remove('x', 'admin');
      expect(prisma.recommendation.delete).toHaveBeenCalledWith({
        where: { id: 'x' },
      });
    });
  });

  describe('upsertTranslation', () => {
    beforeEach(() => {
      prisma.recommendation.findUnique.mockResolvedValue({ id: 'x' });
      prisma.recommendationTranslation.upsert.mockResolvedValue({
        locale: 'nl',
      });
    });

    it('enqueues a re-translation only when the English copy changes', async () => {
      await service.upsertTranslation(
        'x',
        'en',
        { fields: { title: 'T' } },
        'a',
      );
      expect(enqueuer.enqueue).toHaveBeenCalledWith('recommendation', 'x');
    });

    it('does not enqueue for a non-English locale', async () => {
      await service.upsertTranslation(
        'x',
        'nl',
        { fields: { title: 'T' } },
        'a',
      );
      expect(enqueuer.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('findAll (featuredPlacements)', () => {
    it('marks exactly one winner per surface across the list', async () => {
      prisma.recommendation.findMany.mockResolvedValue([
        { ...externalRow({ id: 'a', displayOrder: 0 }), category: null },
        { ...externalRow({ id: 'b', displayOrder: 1 }), category: null },
      ]);
      const res = await service.findAll();
      expect(res.find((r) => r.id === 'a')?.featuredPlacements).toEqual([
        THANK_YOU_PAGE,
      ]);
      expect(res.find((r) => r.id === 'b')?.featuredPlacements).toEqual([]);
    });
  });
});
