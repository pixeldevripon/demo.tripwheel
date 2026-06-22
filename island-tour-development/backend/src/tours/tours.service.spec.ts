/**
 * Unit tests for ToursService (V2 §4/§5: multi-category, multi-hub, flat tour URLs).
 *
 * PrismaService is fully mocked. $transaction invokes its callback with the same
 * mock so transactional and non-transactional calls hit the same jest.fn() stubs.
 *
 * Covers: resolveOperatorId, assertOwnership, resolveUniqueSlug, create (multi-category
 * validation + primary + per-hub allowed-category + always-flat slug_registry),
 * findAll (join filters), findBySlug (flat), publish guards, pause/unpause, archive,
 * restore, remove, and update (category/hub replacement + primary re-point).
 */

import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PickupModel, PricingModel, Role, SlugEntityType, TourStatus } from '@prisma/client';
import { CreateTourDto, UpdateTourDto } from './dto/tour.dto';
import { ToursService } from './tours.service';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockPrismaService() {
  const mock = {
    operator: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    destination: { findUnique: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    hub: { findUnique: jest.fn() },
    hubAllowedCategory: { findUnique: jest.fn(), count: jest.fn() },
    attributeDefinition: { findMany: jest.fn() },
    tour: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tourCategory: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    tourHub: { deleteMany: jest.fn(), createMany: jest.fn() },
    tourAgeBand: { findMany: jest.fn() },
    slugRegistry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    slugRedirect: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) => fn(mock));
  return mock;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTour(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tour-1',
    name: 'Sunset Catamaran Cruise',
    slug: 'sunset-catamaran-cruise',
    status: TourStatus.DRAFT,
    operatorId: 'op-1',
    destinationId: 'dest-1',
    pricingModel: PricingModel.PER_PERSON,
    wholeUnitType: null,
    basePrice: '75.00',
    priceFrom: null,
    durationMinutesFrom: 180,
    pickupModel: PickupModel.NONE,
    maxPartySize: 20,
    minPartySize: 1,
    bookingCutoffMinutes: 120,
    cancellationHours: 24,
    h1Override: null,
    breadcrumbLabel: null,
    aggregateRating: null,
    aggregateReviewCount: 0,
    isSponsored: false,
    isActive: true,
    publishedAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    categories: [{ categoryId: 'cat-1', isPrimary: true }],
    hubs: [],
    ...overrides,
  };
}

const baseCreateDto: CreateTourDto = {
  name: 'Sunset Catamaran Cruise',
  destinationId: 'dest-1',
  categoryIds: ['cat-1'],
  pricingModel: PricingModel.PER_PERSON,
  pickupModel: PickupModel.NONE,
};

describe('ToursService', () => {
  let service: ToursService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToursService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ToursService);
    jest.clearAllMocks();
  });

  // ── resolveOperatorId (exercised via create / findMyTours) ────────────────────

  describe('resolveOperatorId', () => {
    it('throws 400 when a TOUR_OPERATOR has no operator profile', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      await expect(
        service.create(baseCreateDto, 'user-x', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-provisions an operator profile for ADMIN', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      prisma.operator.create.mockResolvedValue({ id: 'op-admin' });
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1', slug: 'curacao', isActive: true });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour({ operatorId: 'op-admin' }));
      prisma.slugRegistry.create.mockResolvedValue({});

      await service.create(baseCreateDto, 'admin-user', Role.ADMIN);
      expect(prisma.operator.create).toHaveBeenCalledWith({ data: { userId: 'admin-user' }, select: { id: true } });
    });
  });

  // ── resolveUniqueSlug (via create) ────────────────────────────────────────────

  describe('create - slug resolution', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1', slug: 'curacao', isActive: true });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('uses the base slug when nothing conflicts', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);

      await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'sunset-catamaran-cruise' }) }),
      );
    });

    it('appends the operator name when the slug is taken by another entity', async () => {
      // own-conflict check (false), then base conflict via registry, then candidate free
      prisma.tour.findFirst
        .mockResolvedValueOnce(null) // ownConflict
        .mockResolvedValueOnce(null) // base tour conflict
        .mockResolvedValueOnce(null); // candidate tour
      prisma.slugRegistry.findUnique
        .mockResolvedValueOnce({ id: 'reg-1' }) // base registry conflict
        .mockResolvedValueOnce(null); // candidate registry free
      prisma.operator.findUnique.mockResolvedValue({
        id: 'op-1',
        companyInfo: { companyName: 'Bluefin Charters' },
        user: { name: 'Bob' },
      });

      await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'sunset-catamaran-cruise-bluefin-charters' }) }),
      );
    });

    it('throws 409 when the same operator already owns the slug', async () => {
      prisma.tour.findFirst.mockResolvedValueOnce({ id: 'existing' }); // ownConflict
      await expect(service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR)).rejects.toThrow(ConflictException);
    });

    it('throws 409 (never appends a number) when both base and operator-name slug are taken', async () => {
      prisma.tour.findFirst
        .mockResolvedValueOnce(null) // ownConflict
        .mockResolvedValueOnce(null) // base tour conflict
        .mockResolvedValueOnce(null); // candidate tour
      prisma.slugRegistry.findUnique
        .mockResolvedValueOnce({ id: 'reg-1' }) // base registry conflict
        .mockResolvedValueOnce({ id: 'reg-2' }); // candidate registry also taken
      prisma.operator.findUnique.mockResolvedValue({
        id: 'op-1',
        companyInfo: { companyName: 'Bluefin Charters' },
        user: { name: 'Bob' },
      });

      await expect(service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR)).rejects.toThrow(ConflictException);
      expect(prisma.tour.create).not.toHaveBeenCalled();
    });
  });

  // ── create - validation + many-to-many ────────────────────────────────────────

  describe('create - categories & hubs', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1', slug: 'curacao', isActive: true });
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('rejects when the destination is missing or inactive', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);
      await expect(service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('rejects when a category is missing or inactive', async () => {
      prisma.category.findMany.mockResolvedValue([]); // none active
      await expect(
        service.create({ ...baseCreateDto, categoryIds: ['cat-1'] }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when primaryCategoryId is not one of categoryIds', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]);
      await expect(
        service.create(
          { ...baseCreateDto, categoryIds: ['cat-1', 'cat-2'], primaryCategoryId: 'cat-9' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates join rows with the first category primary by default and always writes a TOUR slug_registry row', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]);
      await service.create({ ...baseCreateDto, categoryIds: ['cat-1', 'cat-2'] }, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: { create: [
              { categoryId: 'cat-1', isPrimary: true },
              { categoryId: 'cat-2', isPrimary: false },
            ] },
            hubs: { create: [] },
          }),
        }),
      );
      expect(prisma.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ entityType: SlugEntityType.TOUR }) }),
      );
    });

    it('honours an explicit primaryCategoryId', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]);
      await service.create(
        { ...baseCreateDto, categoryIds: ['cat-1', 'cat-2'], primaryCategoryId: 'cat-2' },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: { create: [
              { categoryId: 'cat-1', isPrimary: false },
              { categoryId: 'cat-2', isPrimary: true },
            ] },
          }),
        }),
      );
    });

    it('validates each hub belongs to the destination and allows at least one of the categories', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({ id: 'hub-1', destinationId: 'dest-1', isActive: true });
      prisma.hubAllowedCategory.count.mockResolvedValue(1);

      await service.create({ ...baseCreateDto, hubIds: ['hub-1'] }, 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.hubAllowedCategory.count).toHaveBeenCalledWith({
        where: { hubId: 'hub-1', categoryId: { in: ['cat-1'] } },
      });
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ hubs: { create: [{ hubId: 'hub-1' }] } }) }),
      );
    });

    it('rejects a hub from a different destination', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({ id: 'hub-1', destinationId: 'dest-OTHER', isActive: true });
      await expect(
        service.create({ ...baseCreateDto, hubIds: ['hub-1'] }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a hub when none of the tour categories are allowed', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({ id: 'hub-1', destinationId: 'dest-1', isActive: true });
      prisma.hubAllowedCategory.count.mockResolvedValue(0);
      await expect(
        service.create({ ...baseCreateDto, hubIds: ['hub-1'] }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('flattens the response to categoryIds / primaryCategoryId / hubIds', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.create.mockResolvedValue(
        makeTour({ categories: [{ categoryId: 'cat-1', isPrimary: true }], hubs: [{ hubId: 'hub-1' }] }),
      );
      const result: any = await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);
      expect(result.categoryIds).toEqual(['cat-1']);
      expect(result.primaryCategoryId).toBe('cat-1');
      expect(result.hubIds).toEqual(['hub-1']);
      expect(result).not.toHaveProperty('categories');
    });
  });

  // ── findAll - join filters ─────────────────────────────────────────────────────

  describe('findAll', () => {
    it('filters category/hub via the join relations and flattens results', async () => {
      prisma.tour.count.mockResolvedValue(1);
      prisma.tour.findMany.mockResolvedValue([makeTour({ images: [], categories: [{ categoryId: 'cat-1', isPrimary: true }], hubs: [] })]);

      const result = await service.findAll({ categoryId: 'cat-1', hubId: 'hub-1', page: 1, limit: 20 } as any);
      expect(prisma.tour.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categories: { some: { categoryId: 'cat-1' } },
            hubs: { some: { hubId: 'hub-1' } },
            status: TourStatus.LIVE,
            isActive: true,
          }),
        }),
      );
      expect(result.data[0].categoryIds).toEqual(['cat-1']);
    });

    it('applies duration/rating filters and the requested sort', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({ durationMin: 60, durationMax: 480, ratingMin: 4, sort: 'price_asc', page: 1, limit: 20 } as any);
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.durationMinutesFrom).toEqual({ gte: 60, lte: 480 });
      expect(call.where.aggregateRating).toEqual({ gte: 4 });
      expect(call.orderBy).toEqual([{ basePrice: { sort: 'asc', nulls: 'last' } }]);
    });

    it('defaults to the Recommended sort (sponsored → rating → reviews → recency)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 20 } as any);
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.orderBy[0]).toEqual({ isSponsored: 'desc' });
    });

    it('builds AND-ed attribute filters from raw query params (dictionary keys only)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.attributeDefinition.findMany.mockResolvedValue([{ key: 'boat_type' }]); // 'nope' not in dict
      await service.findAll({ page: 1, limit: 20 } as any, { boat_type: 'catamaran,yacht', nope: 'x' });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.AND).toEqual([
        {
          attributes: {
            some: {
              attributeKey: 'boat_type',
              OR: [
                { attributeValue: 'catamaran' },
                { attributeValue: { contains: '"catamaran"' } },
                { attributeValue: 'yacht' },
                { attributeValue: { contains: '"yacht"' } },
              ],
            },
          },
        },
      ]);
    });
  });

  // ── search ────────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('short-circuits (no DB query) for terms under 2 chars', async () => {
      const res = await service.search({ q: 'a' });
      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
      expect(prisma.tour.findMany).not.toHaveBeenCalled();
    });

    it('searches across name/translations/category/hub/highlights and flattens results', async () => {
      prisma.tour.count.mockResolvedValue(1);
      prisma.tour.findMany.mockResolvedValue([makeTour({ images: [], categories: [{ categoryId: 'cat-1', isPrimary: true }], hubs: [] })]);
      const res = await service.search({ q: 'catamaran', destinationSlug: 'curacao' });
      const where = prisma.tour.findMany.mock.calls[0][0].where;
      expect(where.destination).toEqual({ slug: 'curacao' });
      expect(where.status).toBe(TourStatus.LIVE);
      expect(Array.isArray(where.OR)).toBe(true);
      expect(where.OR[0]).toEqual({ name: { contains: 'catamaran', mode: 'insensitive' } });
      expect(res.query).toBe('catamaran');
      expect(res.data[0].categoryIds).toEqual(['cat-1']);
    });
  });

  // ── findBySlug - flat URL (no hub nesting) ─────────────────────────────────────

  describe('findBySlug', () => {
    it('resolves purely by destination + slug (no hub condition)', async () => {
      prisma.tour.findFirst.mockResolvedValue(
        makeTour({ images: [], translations: [], highlights: [], inclusions: [], exclusions: [], ageBands: [], addOns: [], languages: [], schedules: [], categories: [{ categoryId: 'cat-1', isPrimary: true }], hubs: [] }),
      );
      const result: any = await service.findBySlug('sunset-catamaran-cruise', { destinationSlug: 'curacao' } as any);
      const whereArg = prisma.tour.findFirst.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('hub');
      expect(whereArg).not.toHaveProperty('hubId');
      expect(whereArg.destination).toEqual({ slug: 'curacao' });
      expect(result.categoryIds).toEqual(['cat-1']);
    });

    it('throws 404 when not found', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      await expect(service.findBySlug('x', { destinationSlug: 'curacao' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ── publish ─────────────────────────────────────────────────────────────────

  describe('publish', () => {
    const ready = () =>
      makeTour({
        images: [{ id: 'i1', isHero: true }, { id: 'i2', isHero: false }, { id: 'i3' }, { id: 'i4' }, { id: 'i5' }],
        highlights: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
        translations: [{ overview: 'A lovely cruise overview.' }],
      });

    it('publishes a ready DRAFT tour and flattens the result', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(ready());
      prisma.tour.update.mockResolvedValue(makeTour({ status: TourStatus.LIVE }));

      const result: any = await service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: TourStatus.LIVE, publishedAt: expect.any(Date) } }),
      );
      expect(result.categoryIds).toEqual(['cat-1']);
    });

    it('collects all readiness errors', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(makeTour({ images: [], highlights: [], translations: [], ageBands: [] }));
      await expect(service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('requires a price (no basePrice and no age bands → blocked)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({ ...ready(), basePrice: null, ageBands: [] });
      await expect(service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR)).rejects.toMatchObject({
        response: { message: expect.arrayContaining([expect.stringMatching(/price is required/i)]) },
      });
    });

    it('allows publish when a base price is set', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({ ...ready(), basePrice: 150 });
      prisma.tour.update.mockResolvedValue(makeTour({ status: TourStatus.LIVE }));
      await expect(service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR)).resolves.toBeDefined();
    });
  });

  describe('recomputePriceFrom', () => {
    // priceFrom anchors off basePrice until age bands (TourAgeBand) are entered.
    it('anchors priceFrom to basePrice', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 200 });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(200);
      expect(prisma.tour.update).toHaveBeenCalledWith({ where: { id: 'tour-1' }, data: { priceFrom: 200 } });
    });

    it('persists basePrice as priceFrom', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 99 });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(99);
    });
  });

  // ── pause / unpause ───────────────────────────────────────────────────────────

  describe('pause / unpause', () => {
    it('pauses a LIVE tour (owner)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.LIVE }));
      prisma.tour.update.mockResolvedValue(makeTour({ status: TourStatus.PAUSED }));
      const result: any = await service.pause('tour-1', 'user-1', Role.TOUR_OPERATOR);
      expect(result.status).toBe(TourStatus.PAUSED);
    });

    it('rejects pause when not LIVE', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.DRAFT }));
      await expect(service.pause('tour-1', 'user-1', Role.TOUR_OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('throws 403 for a non-owner operator', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-OTHER' });
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.LIVE, operatorId: 'op-1' }));
      await expect(service.pause('tour-1', 'user-2', Role.TOUR_OPERATOR)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── archive / restore / remove - always-flat slug_registry ─────────────────────

  describe('archive / restore / remove', () => {
    it('archive deactivates the TOUR slug_registry row (always)', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.LIVE }));
      prisma.tour.update.mockResolvedValue(makeTour({ status: TourStatus.ARCHIVED, isActive: false }));
      await service.archive('tour-1', 'admin', Role.ADMIN);
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { isActive: false },
      });
    });

    it('restore re-activates the slug_registry row', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.ARCHIVED }));
      prisma.tour.update.mockResolvedValue(makeTour({ status: TourStatus.DRAFT }));
      await service.restore('tour-1', 'admin', Role.ADMIN);
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { isActive: true },
      });
    });

    it('operator can only delete ARCHIVED tours', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.LIVE }));
      await expect(service.remove('tour-1', 'user-1', Role.TOUR_OPERATOR)).rejects.toThrow(BadRequestException);
    });

    it('remove deletes the tour and starts the 90-day slug cooldown (keeps the registry row)', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.ARCHIVED }));
      prisma.tour.delete.mockResolvedValue(makeTour());
      await service.remove('tour-1', 'admin', Role.ADMIN);
      // Cooldown stamp: row is kept (isActive=false, deletedAt set), not deleted.
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      });
      expect(prisma.tour.delete).toHaveBeenCalledWith({ where: { id: 'tour-1' } });
    });
  });

  // ── update - category/hub replacement + primary re-point ───────────────────────

  describe('update', () => {
    it('replaces the category set and re-points the primary', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.DRAFT }));
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }, { id: 'cat-2' }]);
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({ categories: [{ categoryId: 'cat-1', isPrimary: false }, { categoryId: 'cat-2', isPrimary: true }] }),
      );

      const dto: UpdateTourDto = { categoryIds: ['cat-1', 'cat-2'], primaryCategoryId: 'cat-2' };
      const result = await service.update('tour-1', dto, 'admin', Role.ADMIN);

      expect(prisma.tourCategory.deleteMany).toHaveBeenCalledWith({ where: { tourId: 'tour-1' } });
      expect(prisma.tourCategory.createMany).toHaveBeenCalledWith({
        data: [
          { tourId: 'tour-1', categoryId: 'cat-1', isPrimary: false },
          { tourId: 'tour-1', categoryId: 'cat-2', isPrimary: true },
        ],
      });
      expect(result.tour.primaryCategoryId).toBe('cat-2');
    });

    it('re-points the primary among existing categories when only primaryCategoryId is given', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.DRAFT }));
      prisma.tourCategory.findUnique.mockResolvedValue({ id: 'tc-2' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update('tour-1', { primaryCategoryId: 'cat-2' }, 'admin', Role.ADMIN);
      expect(prisma.tourCategory.updateMany).toHaveBeenCalledWith({ where: { tourId: 'tour-1' }, data: { isPrimary: false } });
      expect(prisma.tourCategory.update).toHaveBeenCalledWith({ where: { id: 'tc-2' }, data: { isPrimary: true } });
    });

    it('rejects updating an archived tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.ARCHIVED }));
      await expect(service.update('tour-1', { name: 'x' }, 'admin', Role.ADMIN)).rejects.toThrow(BadRequestException);
    });

    // ── Slug rename → auto 301 + cooldown (master slug-registry rules) ──
    it('renames the slug: re-points the registry row and writes a 301 redirect', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }));
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null); // no other tour holds the new slug
      prisma.slugRegistry.findUnique.mockResolvedValue(null); // isSlugTaken → free
      prisma.slugRegistry.findMany.mockResolvedValue([{ destinationSlug: 'curacao' }]);
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour({ slug: 'new-slug' }));

      await service.update('tour-1', { slug: 'new-slug' }, 'admin', Role.ADMIN);

      // Registry row re-pointed to the new slug.
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { slug: 'new-slug' },
      });
      // Auto-301 from the old slug → new slug.
      expect(prisma.slugRedirect.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { destinationSlug_fromSlug: { destinationSlug: 'curacao', fromSlug: 'old-slug' } },
          create: expect.objectContaining({ fromSlug: 'old-slug', toSlug: 'new-slug', statusCode: 301 }),
        }),
      );
      // The new slug is persisted on the tour.
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'new-slug' }) }),
      );
    });

    it('rejects a rename onto a slug already taken by another entity', async () => {
      prisma.tour.findUnique.mockResolvedValue(makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }));
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null);
      // isSlugTaken → a protected row owned by a different entity holds the target slug.
      prisma.slugRegistry.findUnique.mockResolvedValue({ entityId: 'other', deletedAt: null });

      await expect(
        service.update('tour-1', { slug: 'taken-slug' }, 'admin', Role.ADMIN),
      ).rejects.toThrow(ConflictException);
    });
  });
});
