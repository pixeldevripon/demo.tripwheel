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
import {
  BandParticipation,
  DepartureStatus,
  PickupModel,
  PricingModel,
  Role,
  SlugEntityType,
  TourApprovalStatus,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { CreateTourDto, UpdateTourDto } from './dto/tour.dto';
import { AvailabilityService } from '@/availability/availability.service';
import { FxRatesService } from '@/fx/fx-rates.service';
import { ToursService } from './tours.service';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockPrismaService() {
  const mock = {
    operator: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    // Seat-aware operator resolution (common/utils/operator.util.ts) checks
    // team seats when no direct Operator.userId row matches.
    staffMember: { findUnique: jest.fn() },
    destination: { findUnique: jest.fn(), findMany: jest.fn() },
    category: { findUnique: jest.fn(), findMany: jest.fn() },
    hub: { findUnique: jest.fn() },
    hubAllowedCategory: { findUnique: jest.fn(), count: jest.fn() },
    attributeDefinition: { findMany: jest.fn() },
    tourAttribute: { findMany: jest.fn() },
    tour: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
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
    tourAgeBand: { findMany: jest.fn(), findFirst: jest.fn() },
    departure: { findMany: jest.fn() },
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
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );
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
    // Approval workflow (conflict #1): default fixtures are APPROVED so the
    // pre-existing publish/readiness tests exercise the readiness bar, not
    // the approval gate (which has its own describe).
    approvalStatus: TourApprovalStatus.APPROVED,
    submittedAt: null,
    reviewNote: null,
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
    translations: [],
    highlights: [],
    operator: {
      companyInfo: { companyName: 'Miss Ann' },
      user: { name: 'Op Owner' },
    },
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

  let availability: {
    computeIsBookable: jest.Mock;
    resyncTourAvailability: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrismaService();
    availability = {
      computeIsBookable: jest.fn().mockResolvedValue(true),
      resyncTourAvailability: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToursService,
        { provide: PrismaService, useValue: prisma },
        { provide: AvailabilityService, useValue: availability },
        {
          provide: FxRatesService,
          // No conversion in unit tests (no ?currency) -> money falls back to source.
          useValue: {
            getDisplayRate: jest.fn().mockResolvedValue(null),
            attachMoney: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    service = module.get(ToursService);
    jest.clearAllMocks();
    // Listing card-attribute resolver (loadCardAttributes) defaults - individual
    // tests override as needed.
    prisma.tourAttribute.findMany.mockResolvedValue([]);
    prisma.attributeDefinition.findMany.mockResolvedValue([]);
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
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(
        makeTour({ operatorId: 'op-admin' }),
      );
      prisma.slugRegistry.create.mockResolvedValue({});

      await service.create(baseCreateDto, 'admin-user', Role.ADMIN);
      expect(prisma.operator.create).toHaveBeenCalledWith({
        data: { userId: 'admin-user' },
        select: { id: true },
      });
    });
  });

  // ── resolveUniqueSlug (via create) ────────────────────────────────────────────

  describe('create - slug resolution', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('uses the base slug when nothing conflicts', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);

      await service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR);
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'sunset-catamaran-cruise' }),
        }),
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
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'sunset-catamaran-cruise-bluefin-charters',
          }),
        }),
      );
    });

    it('throws 409 when the same operator already owns the slug', async () => {
      prisma.tour.findFirst.mockResolvedValueOnce({ id: 'existing' }); // ownConflict
      await expect(
        service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
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

      await expect(
        service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tour.create).not.toHaveBeenCalled();
    });
  });

  // ── create - validation + many-to-many ────────────────────────────────────────

  describe('create - categories & hubs', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('rejects when the destination is missing or inactive', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);
      await expect(
        service.create(baseCreateDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when a category is missing or inactive', async () => {
      prisma.category.findMany.mockResolvedValue([]); // none active
      await expect(
        service.create(
          { ...baseCreateDto, categoryIds: ['cat-1'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when primaryCategoryId is not one of categoryIds', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      await expect(
        service.create(
          {
            ...baseCreateDto,
            categoryIds: ['cat-1', 'cat-2'],
            primaryCategoryId: 'cat-9',
          },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates join rows with the first category primary by default and always writes a TOUR slug_registry row', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      await service.create(
        { ...baseCreateDto, categoryIds: ['cat-1', 'cat-2'] },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: {
              create: [
                { categoryId: 'cat-1', isPrimary: true },
                { categoryId: 'cat-2', isPrimary: false },
              ],
            },
            hubs: { create: [] },
          }),
        }),
      );
      expect(prisma.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityType: SlugEntityType.TOUR }),
        }),
      );
    });

    it('honours an explicit primaryCategoryId', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      await service.create(
        {
          ...baseCreateDto,
          categoryIds: ['cat-1', 'cat-2'],
          primaryCategoryId: 'cat-2',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categories: {
              create: [
                { categoryId: 'cat-1', isPrimary: false },
                { categoryId: 'cat-2', isPrimary: true },
              ],
            },
          }),
        }),
      );
    });

    it('validates each hub belongs to the destination and allows at least one of the categories', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        name: 'Playa Piscado',
        destinationId: 'dest-1',
        isActive: true,
        allowedCategories: [{ category: { id: 'cat-1', name: 'Boat Tours' } }],
      });

      await service.create(
        { ...baseCreateDto, hubIds: ['hub-1'] },
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hubs: { create: [{ hubId: 'hub-1' }] },
          }),
        }),
      );
    });

    it('rejects a hub from a different destination', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        name: 'Wrong Island Hub',
        destinationId: 'dest-OTHER',
        isActive: true,
        allowedCategories: [{ category: { id: 'cat-1', name: 'Boat Tours' } }],
      });
      await expect(
        service.create(
          { ...baseCreateDto, hubIds: ['hub-1'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a hub when none of the tour categories are allowed', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: 'Boat Tours' },
      ]);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        name: 'Snorkel Bay',
        destinationId: 'dest-1',
        isActive: true,
        allowedCategories: [{ category: { id: 'cat-OTHER', name: 'Diving' } }],
      });
      await expect(
        service.create(
          { ...baseCreateDto, hubIds: ['hub-1'] },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('flattens the response to categoryIds / primaryCategoryId / hubIds', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.create.mockResolvedValue(
        makeTour({
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [{ hubId: 'hub-1' }],
        }),
      );
      const result: any = await service.create(
        baseCreateDto,
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(result.categoryIds).toEqual(['cat-1']);
      expect(result.primaryCategoryId).toBe('cat-1');
      expect(result.hubIds).toEqual(['hub-1']);
      expect(result).not.toHaveProperty('categories');
    });
  });

  // ── create - pricing model (UNIT vs PER_PERSON unit-field isolation) ─────────

  describe('create - pricing model', () => {
    beforeEach(() => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
        timezone: 'America/Curacao',
      });
      prisma.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);
      prisma.tour.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.tour.create.mockResolvedValue(makeTour());
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('nulls out wholeUnitType/unitIncludedGuests/extraPersonPrice for a PER_PERSON tour, even when supplied', async () => {
      await service.create(
        {
          ...baseCreateDto,
          pricingModel: PricingModel.PER_PERSON,
          wholeUnitType: WholeUnitType.BOAT,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.PER_PERSON,
            wholeUnitType: null,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });

    it('passes the surcharge fields through for a GROUP unit tour', async () => {
      await service.create(
        {
          ...baseCreateDto,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
          basePrice: '500.00',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.UNIT,
            wholeUnitType: WholeUnitType.GROUP,
            unitIncludedGuests: 4,
            extraPersonPrice: '10.00',
          }),
        }),
      );
    });

    it('nulls the surcharge fields for a non-GROUP unit tour (flat whole-unit price)', async () => {
      await service.create(
        {
          ...baseCreateDto,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.BOAT,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
          basePrice: '500.00',
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tour.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.UNIT,
            wholeUnitType: WholeUnitType.BOAT,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });
  });

  // ── findAll - join filters ─────────────────────────────────────────────────────

  describe('findAll', () => {
    /**
     * Pins "now" for the date-anchored tests below.
     *
     * `findAll`'s date filter runs the real live-bookability rule, which drops
     * departures already past their booking cutoff - measured against the
     * actual clock. The fixtures use a FIXED calendar date, so each of these
     * tests silently rots the moment that date slides into the past: the
     * 09:00 case started failing on 2026-07-20 (its departure went by at 13:00
     * UTC) and the 18:00 case was hours from doing the same. Freezing the
     * clock is what makes them assert the capacity/bucket logic they are
     * actually about, rather than the calendar.
     */
    const freezeClock = () =>
      jest.useFakeTimers({
        now: new Date('2026-07-19T12:00:00.000Z'),
        // Only Date is faked: the suite awaits real promises, and faking the
        // timer queue would stall them.
        doNotFake: [
          'setTimeout',
          'setInterval',
          'setImmediate',
          'nextTick',
          'queueMicrotask',
        ],
      });

    // Unconditional, so a frozen clock never leaks into a later test even if
    // the one that froze it threw.
    afterEach(() => jest.useRealTimers());

    it('filters category/hub via the join relations and flattens results', async () => {
      prisma.tour.count.mockResolvedValue(1);
      prisma.tour.findMany.mockResolvedValue([
        makeTour({
          images: [],
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [],
        }),
      ]);

      const result = await service.findAll({
        categoryId: 'cat-1',
        hubId: 'hub-1',
        page: 1,
        limit: 20,
      });
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
      await service.findAll({
        durationMin: 60,
        durationMax: 480,
        ratingMin: 4,
        sort: 'price_asc',
        page: 1,
        limit: 20,
      } as any);
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.durationMinutesFrom).toEqual({ gte: 60, lte: 480 });
      expect(call.where.aggregateRating).toEqual({ gte: 4 });
      expect(call.orderBy).toEqual([
        { priceFrom: { sort: 'asc', nulls: 'last' } },
        { basePrice: 'asc' },
      ]);
    });

    it('filters on priceFrom (the "From $X" display anchor), not basePrice, when minPrice/maxPrice are given', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        minPrice: 50,
        maxPrice: 200,
        page: 1,
        limit: 20,
      });

      const findManyCall = prisma.tour.findMany.mock.calls[0][0];
      expect(findManyCall.where.priceFrom).toEqual({ gte: 50, lte: 200 });
      expect(findManyCall.where.basePrice).toBeUndefined();

      const countCall = prisma.tour.count.mock.calls[0][0];
      expect(countCall.where.priceFrom).toEqual({ gte: 50, lte: 200 });
    });

    it('defaults to the Recommended sort (spotlight first, then tierRank → quality → id)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 20 });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual([
        { isSponsored: 'desc' },
        { tierRank: 'asc' },
        { qualityScore: 'desc' },
        { id: 'asc' },
      ]);
    });

    it('builds AND-ed attribute filters from raw query params (dictionary keys only)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.attributeDefinition.findMany.mockResolvedValue([
        { key: 'boat_type' },
      ]); // 'nope' not in dict
      await service.findAll(
        { page: 1, limit: 20 },
        {
          boat_type: 'catamaran,yacht',
          nope: 'x',
        },
      );
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

    // ── Phase 2: cheap params ─────────────────────────────────────────────────

    it('filters multi-category via `in` (categoryIds takes precedence over categoryId)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        categoryId: 'cat-single',
        categoryIds: ['cat-a', 'cat-b'],
        page: 1,
        limit: 20,
      });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.categories).toEqual({
        some: { categoryId: { in: ['cat-a', 'cat-b'] } },
      });
    });

    it('filters by free-cancellation ceiling and pickup availability', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        cancellationMaxHours: 24,
        pickupAvailable: true,
        page: 1,
        limit: 20,
      });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.cancellationHours).toEqual({ lte: 24 });
      expect(call.where.pickupModel).toEqual({ not: PickupModel.NONE });
    });

    it('does NOT apply pickup filter when pickupAvailable is falsey', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({ page: 1, limit: 20 });
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.pickupModel).toBeUndefined();
    });

    // ── Phase 3: date-anchored availability ───────────────────────────────────

    it('date filter keeps only tours with a fitting OPEN departure (capacity math)', async () => {
      freezeClock();
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      // t-ok has 3 seats left (>= 2); t-full has 1 seat left (< 2) -> excluded.
      prisma.departure.findMany.mockResolvedValue([
        {
          tourId: 't-ok',
          capacity: 10,
          bookedCount: 7,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
        {
          tourId: 't-full',
          capacity: 10,
          bookedCount: 9,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T09:00:00.000Z'),
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
      ]);

      await service.findAll({
        destinationId: 'dest-1',
        date: '2026-07-20',
        guests: 2,
        page: 1,
        limit: 20,
      });

      const depCall = prisma.departure.findMany.mock.calls[0][0];
      expect(depCall.where).toEqual(
        expect.objectContaining({
          date: new Date('2026-07-20T00:00:00.000Z'),
          status: DepartureStatus.OPEN,
          tour: { destinationId: 'dest-1' },
        }),
      );
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: ['t-ok'] });
    });

    it('date filter narrows by time-of-day bucket (evening excludes a morning departure)', async () => {
      freezeClock();
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.departure.findMany.mockResolvedValue([
        {
          tourId: 't-morning',
          capacity: 10,
          bookedCount: 0,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T09:00:00.000Z'), // 09:00 -> morning
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
        {
          tourId: 't-evening',
          capacity: 10,
          bookedCount: 0,
          date: new Date('2026-07-20T00:00:00.000Z'),
          startTime: new Date('1970-01-01T18:00:00.000Z'), // 18:00 -> evening
          status: DepartureStatus.OPEN,
          tour: { timeZone: 'America/Curacao', bookingCutoffMinutes: 120 },
        },
      ]);

      await service.findAll({
        date: '2026-07-20',
        guests: 1,
        timeOfDay: ['evening'],
        page: 1,
        limit: 20,
      });

      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: ['t-evening'] });
    });

    it('date with no availability yields an empty id set (zero results)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      prisma.departure.findMany.mockResolvedValue([]);

      await service.findAll({
        date: '2026-07-20',
        guests: 4,
        page: 1,
        limit: 20,
      });

      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toEqual({ in: [] });
    });

    it('ignores guests/timeOfDay when no date is provided (no departure query)', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);
      await service.findAll({
        guests: 4,
        timeOfDay: ['morning'],
        page: 1,
        limit: 20,
      });
      expect(prisma.departure.findMany).not.toHaveBeenCalled();
      const call = prisma.tour.findMany.mock.calls[0][0];
      expect(call.where.id).toBeUndefined();
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
      prisma.tour.findMany.mockResolvedValue([
        makeTour({
          images: [],
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [],
        }),
      ]);
      const res = await service.search({
        q: 'catamaran',
        destinationSlug: 'curacao',
      });
      const where = prisma.tour.findMany.mock.calls[0][0].where;
      expect(where.destination).toEqual({ slug: 'curacao' });
      expect(where.status).toBe(TourStatus.LIVE);
      expect(Array.isArray(where.OR)).toBe(true);
      expect(where.OR[0]).toEqual({
        name: { contains: 'catamaran', mode: 'insensitive' },
      });
      expect(res.query).toBe('catamaran');
      expect(res.data[0].categoryIds).toEqual(['cat-1']);
    });
  });

  // ── findBySlug - flat URL (no hub nesting) ─────────────────────────────────────

  describe('findBySlug', () => {
    it('resolves purely by destination + slug (no hub condition)', async () => {
      prisma.tour.findFirst.mockResolvedValue(
        makeTour({
          images: [],
          translations: [],
          inclusions: [],
          exclusions: [],
          locations: [],
          pickupLocations: [],
          features: [],
          ageBands: [],
          addOns: [],
          languages: [],
          schedules: [],
          categories: [{ categoryId: 'cat-1', isPrimary: true }],
          hubs: [],
        }),
      );
      const result: any = await service.findBySlug('sunset-catamaran-cruise', {
        destinationSlug: 'curacao',
      });
      const whereArg = prisma.tour.findFirst.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('hub');
      expect(whereArg).not.toHaveProperty('hubId');
      expect(whereArg.destination).toEqual({ slug: 'curacao' });
      expect(result.categoryIds).toEqual(['cat-1']);
    });

    it('throws 404 when not found', async () => {
      prisma.tour.findFirst.mockResolvedValue(null);
      await expect(
        service.findBySlug('x', { destinationSlug: 'curacao' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── publish ─────────────────────────────────────────────────────────────────

  // ── Approval workflow (conflict #1: publishing is always Island Tours') ──
  describe('approval workflow', () => {
    const ready = (over: Record<string, unknown> = {}) =>
      makeTour({
        images: [
          { id: 'i1', isHero: true },
          { id: 'i2', isHero: false },
          { id: 'i3' },
          { id: 'i4' },
          { id: 'i5' },
        ],
        highlights: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
        translations: [{ overview: 'A lovely cruise overview.' }],
        approvalStatus: TourApprovalStatus.NOT_SUBMITTED,
        ...over,
      });

    it('submitForReview flips NOT_SUBMITTED -> PENDING and clears the old note', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({
          approvalStatus: TourApprovalStatus.REJECTED,
          reviewNote: 'Blurry photos',
        }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
      );

      await service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            approvalStatus: TourApprovalStatus.PENDING,
            submittedAt: expect.any(Date),
            reviewNote: null,
          },
        }),
      );
    });

    it('submitForReview runs the SAME readiness bar as publish', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      // 0 images / 0 highlights / no overview -> blocked with the full list.
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          images: [],
          highlights: [],
          translations: [],
          approvalStatus: TourApprovalStatus.NOT_SUBMITTED,
        }),
      );
      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('submitForReview 409s while already PENDING or APPROVED', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.PENDING }),
      );
      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);

      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.APPROVED }),
      );
      await expect(
        service.submitForReview('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    it('approve requires PENDING; reject stores the actionable note', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.PENDING }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.REJECTED }),
      );
      await service.rejectTour('tour-1', 'admin', 'Photos are blurry');
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            approvalStatus: TourApprovalStatus.REJECTED,
            reviewNote: 'Photos are blurry',
          },
        }),
      );

      // Not PENDING -> 409 (both verbs).
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ approvalStatus: TourApprovalStatus.NOT_SUBMITTED }),
      );
      await expect(service.approveTour('tour-1', 'admin')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.rejectTour('tour-1', 'admin', 'x')).rejects.toThrow(
        ConflictException,
      );
    });

    it('publish blocks a non-admin on an unapproved tour', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.PENDING }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('an ADMIN publish stamps the approval (publish IS the review)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        ready({ approvalStatus: TourApprovalStatus.NOT_SUBMITTED }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await service.publish('tour-1', 'admin', Role.ADMIN);
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TourStatus.LIVE,
            approvalStatus: TourApprovalStatus.APPROVED,
          }),
        }),
      );
    });
  });

  describe('publish', () => {
    const ready = () =>
      makeTour({
        images: [
          { id: 'i1', isHero: true },
          { id: 'i2', isHero: false },
          { id: 'i3' },
          { id: 'i4' },
          { id: 'i5' },
        ],
        highlights: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
        translations: [{ overview: 'A lovely cruise overview.' }],
      });

    it('publishes a ready DRAFT tour and flattens the result', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(ready());
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );

      const result: any = await service.publish(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: TourStatus.LIVE,
            publishedAt: expect.any(Date),
            isBookable: true,
            // LIVE implies APPROVED (conflict #1) - publish stamps it.
            approvalStatus: TourApprovalStatus.APPROVED,
          },
        }),
      );
      expect(availability.computeIsBookable).toHaveBeenCalledWith('tour-1');
      expect(result.categoryIds).toEqual(['cat-1']);
    });

    it('collects all readiness errors', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ images: [], translations: [], ageBands: [] }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a price (no basePrice and no age bands → blocked)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        basePrice: null,
        _count: { ageBands: 0 },
      });
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            expect.stringMatching(/price is required/i),
          ]),
        },
      });
    });

    it('allows publish when a base price is set', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({ ...ready(), basePrice: 150 });
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
    });

    it('allows publish with age bands but no base price', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        basePrice: null,
        _count: { ageBands: 2 },
      });
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
    });

    // UNIT (whole-unit/charter) tours require a base price AND a unit type -
    // age bands never satisfy the price requirement for this pricing model.
    it('blocks publish for a UNIT tour with no base price', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        pricingModel: PricingModel.UNIT,
        basePrice: null,
        wholeUnitType: WholeUnitType.BOAT,
      });
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            expect.stringMatching(/unit-priced tours require a base price/i),
          ]),
        },
      });
    });

    it('blocks publish for a UNIT tour with no unit type', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        pricingModel: PricingModel.UNIT,
        basePrice: 500,
        wholeUnitType: null,
      });
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining([
            expect.stringMatching(/unit-priced tours require a unit type/i),
          ]),
        },
      });
    });

    it('publishes a ready UNIT tour that has both a base price and a unit type', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue({
        ...ready(),
        pricingModel: PricingModel.UNIT,
        basePrice: 500,
        wholeUnitType: WholeUnitType.BOAT,
      });
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.publish('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeDefined();
    });
  });

  describe('recomputePriceFrom', () => {
    // priceFrom falls back to basePrice until age bands (TourAgeBand) are entered.
    it('anchors priceFrom to basePrice when no age bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 200 });
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(200);
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { priceFrom: 200 },
      });
    });

    it('persists basePrice as priceFrom when no age bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 99 });
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(99);
    });

    it('anchors priceFrom to the anchor (default) age band when bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({ basePrice: 200 });
      prisma.tourAgeBand.findFirst.mockResolvedValue({ price: 75 });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(75);
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { priceFrom: 75 },
      });
    });

    // UNIT (whole-unit/charter) tours anchor on basePrice directly - age bands
    // are a PER_PERSON construct and must never be queried for a UNIT tour.
    it('UNIT tours anchor priceFrom on basePrice and never query age bands', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        basePrice: 400,
        pricingModel: PricingModel.UNIT,
      });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(400);
      expect(prisma.tourAgeBand.findFirst).not.toHaveBeenCalled();
      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { priceFrom: 400 },
      });
    });

    // Founder rule: the "From $X per person" anchor is the DEFAULT band (the
    // adult reference price), never a cheaper child/senior band. The query
    // orders isDefault DESC first, so cheapest-price is only the fallback when
    // no band is flagged default.
    it('PER_PERSON tours anchor priceFrom on the DEFAULT participant age band', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        basePrice: 200,
        pricingModel: PricingModel.PER_PERSON,
      });
      prisma.tourAgeBand.findFirst.mockResolvedValue({ price: 69 });
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(69);
      expect(prisma.tourAgeBand.findFirst).toHaveBeenCalledWith({
        where: {
          tourId: 'tour-1',
          participation: BandParticipation.PARTICIPANT,
        },
        orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
        select: { price: true },
      });
    });

    it('PER_PERSON tours fall back to basePrice when no age bands exist', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        basePrice: 90,
        pricingModel: PricingModel.PER_PERSON,
      });
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);
      prisma.tour.update.mockResolvedValue({});
      const pf = await service.recomputePriceFrom('tour-1');
      expect(pf).toBe(90);
    });
  });

  // ── pause / unpause ───────────────────────────────────────────────────────────

  describe('pause / unpause', () => {
    it('pauses a LIVE tour (owner)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.PAUSED }),
      );
      const result: any = await service.pause(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );
      expect(result.status).toBe(TourStatus.PAUSED);
    });

    it('rejects pause when not LIVE', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      await expect(
        service.pause('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 403 for a non-owner operator', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-OTHER' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, operatorId: 'op-1' }),
      );
      await expect(
        service.pause('tour-1', 'user-2', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── archive / restore / remove - always-flat slug_registry ─────────────────────

  describe('archive / restore / remove', () => {
    it('archive deactivates the TOUR slug_registry row (always)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED, isActive: false }),
      );
      await service.archive('tour-1', 'admin', Role.ADMIN);
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { isActive: false },
      });
    });

    it('restore re-activates the slug_registry row', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED }),
      );
      prisma.tour.update.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      await service.restore('tour-1', 'admin', Role.ADMIN);
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { isActive: true },
      });
    });

    it('operator can only delete ARCHIVED tours', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      await expect(
        service.remove('tour-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('remove deletes the tour and starts the 90-day slug cooldown (keeps the registry row)', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED }),
      );
      prisma.tour.delete.mockResolvedValue(makeTour());
      await service.remove('tour-1', 'admin', Role.ADMIN);
      // Cooldown stamp: row is kept (isActive=false, deletedAt set), not deleted.
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
        }),
      });
      expect(prisma.tour.delete).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
      });
    });
  });

  // ── update - category/hub replacement + primary re-point ───────────────────────

  describe('update', () => {
    it('replaces the category set and re-points the primary', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({
          categories: [
            { categoryId: 'cat-1', isPrimary: false },
            { categoryId: 'cat-2', isPrimary: true },
          ],
        }),
      );

      const dto: UpdateTourDto = {
        categoryIds: ['cat-1', 'cat-2'],
        primaryCategoryId: 'cat-2',
      };
      const result = await service.update('tour-1', dto, 'admin', Role.ADMIN);

      expect(prisma.tourCategory.deleteMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
      });
      expect(prisma.tourCategory.createMany).toHaveBeenCalledWith({
        data: [
          { tourId: 'tour-1', categoryId: 'cat-1', isPrimary: false },
          { tourId: 'tour-1', categoryId: 'cat-2', isPrimary: true },
        ],
      });
      expect(result.tour.primaryCategoryId).toBe('cat-2');
    });

    it('re-points the primary among existing categories when only primaryCategoryId is given', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      prisma.tourCategory.findUnique.mockResolvedValue({ id: 'tc-2' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { primaryCategoryId: 'cat-2' },
        'admin',
        Role.ADMIN,
      );
      expect(prisma.tourCategory.updateMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        data: { isPrimary: false },
      });
      expect(prisma.tourCategory.update).toHaveBeenCalledWith({
        where: { id: 'tc-2' },
        data: { isPrimary: true },
      });
    });

    it('rejects updating an archived tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED }),
      );
      await expect(
        service.update('tour-1', { name: 'x' }, 'admin', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    // ── cancellation_hours on a published tour (access-roles matrix) ──
    // Booking deadlines derive from cancellationHours at read time, so a
    // change on a non-DRAFT tour retroactively moves existing bookings'
    // deadlines - operator-blocked, admin-only.

    it('blocks an operator changing cancellationHours on a LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, cancellationHours: 48 }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 24 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('allows the operator to send the UNCHANGED cancellationHours on a LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, cancellationHours: 48 }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 48, name: 'Renamed' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).resolves.toBeDefined();
    });

    it('lets an ADMIN change cancellationHours on a LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE, cancellationHours: 48 }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 72 },
          'admin',
          Role.ADMIN,
        ),
      ).resolves.toBeDefined();
    });

    it('lets an operator change cancellationHours while still DRAFT', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, cancellationHours: 48 }),
      );
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());
      await expect(
        service.update(
          'tour-1',
          { cancellationHours: 24 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).resolves.toBeDefined();
    });

    // ── Pricing model switch → unit fields are force-nulled/applied together ──

    it('switching pricingModel to PER_PERSON force-nulls the unit fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.BOAT,
          unitIncludedGuests: 4,
          extraPersonPrice: '10.00',
          basePrice: '500.00',
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { pricingModel: PricingModel.PER_PERSON },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.PER_PERSON,
            wholeUnitType: null,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });

    it('switching pricingModel to UNIT applies the supplied unit fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.PER_PERSON,
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        {
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
          unitIncludedGuests: 6,
          extraPersonPrice: '15.00',
        },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pricingModel: PricingModel.UNIT,
            wholeUnitType: WholeUnitType.GROUP,
            unitIncludedGuests: 6,
            extraPersonPrice: '15.00',
          }),
        }),
      );
    });

    it('switching a UNIT tour to a non-GROUP unit type nulls the surcharge fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { wholeUnitType: WholeUnitType.BOAT },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            wholeUnitType: WholeUnitType.BOAT,
            unitIncludedGuests: null,
            extraPersonPrice: null,
          }),
        }),
      );
    });

    it('keeping a GROUP unit tour still applies updated surcharge fields', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({
          status: TourStatus.DRAFT,
          pricingModel: PricingModel.UNIT,
          wholeUnitType: WholeUnitType.GROUP,
        }),
      );
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(makeTour());

      await service.update(
        'tour-1',
        { unitIncludedGuests: 2 },
        'admin',
        Role.ADMIN,
      );

      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unitIncludedGuests: 2,
          }),
        }),
      );
    });

    // ── Slug rename → auto 301 + cooldown (master slug-registry rules) ──
    it('renames the slug: re-points the registry row and writes a 301 redirect', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null); // no other tour holds the new slug
      prisma.slugRegistry.findUnique.mockResolvedValue(null); // isSlugTaken → free
      prisma.slugRegistry.findMany.mockResolvedValue([
        { destinationSlug: 'curacao' },
      ]);
      prisma.tour.update.mockResolvedValue({});
      prisma.tour.findUniqueOrThrow.mockResolvedValue(
        makeTour({ slug: 'new-slug' }),
      );

      await service.update('tour-1', { slug: 'new-slug' }, 'admin', Role.ADMIN);

      // Registry row re-pointed to the new slug.
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'tour-1' },
        data: { slug: 'new-slug' },
      });
      // Auto-301 from the old slug → new slug.
      expect(prisma.slugRedirect.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            destinationSlug_fromSlug: {
              destinationSlug: 'curacao',
              fromSlug: 'old-slug',
            },
          },
          create: expect.objectContaining({
            fromSlug: 'old-slug',
            toSlug: 'new-slug',
            statusCode: 301,
          }),
        }),
      );
      // The new slug is persisted on the tour.
      expect(prisma.tour.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'new-slug' }),
        }),
      );
    });

    it('rejects a rename onto a slug already taken by another entity', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT, slug: 'old-slug' }),
      );
      prisma.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      prisma.tour.findFirst.mockResolvedValue(null);
      // isSlugTaken → a protected row owned by a different entity holds the target slug.
      prisma.slugRegistry.findUnique.mockResolvedValue({
        entityId: 'other',
        deletedAt: null,
      });

      await expect(
        service.update('tour-1', { slug: 'taken-slug' }, 'admin', Role.ADMIN),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('locals-favourite (editorial)', () => {
    it('setLocalsFavourite flags a LIVE tour and returns it', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.LIVE }),
      );
      prisma.tour.update.mockResolvedValue({
        id: 'tour-1',
        isLocalsFavourite: true,
      });

      const result = await service.setLocalsFavourite('tour-1', true, 'admin');

      expect(prisma.tour.update).toHaveBeenCalledWith({
        where: { id: 'tour-1' },
        data: { isLocalsFavourite: true },
        select: { id: true, isLocalsFavourite: true },
      });
      expect(result).toEqual({ id: 'tour-1', isLocalsFavourite: true });
    });

    it('setLocalsFavourite rejects flagging a non-LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.DRAFT }),
      );
      await expect(
        service.setLocalsFavourite('tour-1', true, 'admin'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('setLocalsFavourite allows UN-flagging a non-LIVE tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(
        makeTour({ status: TourStatus.ARCHIVED, isLocalsFavourite: true }),
      );
      prisma.tour.update.mockResolvedValue({
        id: 'tour-1',
        isLocalsFavourite: false,
      });

      const result = await service.setLocalsFavourite('tour-1', false, 'admin');
      expect(result).toEqual({ id: 'tour-1', isLocalsFavourite: false });
    });

    it('setLocalsFavourite throws NotFound for a missing tour', async () => {
      prisma.tour.findUnique.mockResolvedValue(null);
      await expect(
        service.setLocalsFavourite('missing', true, 'admin'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.tour.update).not.toHaveBeenCalled();
    });

    it('findAllAdmin filters by isLocalsFavourite when provided', async () => {
      prisma.tour.count.mockResolvedValue(0);
      prisma.tour.findMany.mockResolvedValue([]);

      await service.findAllAdmin({ isLocalsFavourite: true });

      const whereArg = prisma.tour.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ isLocalsFavourite: true });
    });

    it('getLocalsFavouriteStats computes overall + per-destination coverage', async () => {
      // groupBy is called twice: [0] live-by-dest, [1] flagged-by-dest.
      prisma.tour.groupBy
        .mockResolvedValueOnce([
          { destinationId: 'dest-1', _count: { _all: 10 } },
          { destinationId: 'dest-2', _count: { _all: 5 } },
        ])
        .mockResolvedValueOnce([
          { destinationId: 'dest-1', _count: { _all: 3 } },
        ]);
      prisma.destination.findMany.mockResolvedValue([
        { id: 'dest-1', name: 'Aruba' },
        { id: 'dest-2', name: 'Curaçao' },
      ]);

      const stats = await service.getLocalsFavouriteStats();

      expect(stats.totalLive).toBe(15);
      expect(stats.flagged).toBe(3);
      expect(stats.pct).toBe(20); // 3/15
      expect(stats.target).toBe(30);
      // Sorted by destination name: Aruba, then Curaçao.
      expect(stats.perDestination).toEqual([
        {
          destinationId: 'dest-1',
          destinationName: 'Aruba',
          totalLive: 10,
          flagged: 3,
          pct: 30,
        },
        {
          destinationId: 'dest-2',
          destinationName: 'Curaçao',
          totalLive: 5,
          flagged: 0,
          pct: 0,
        },
      ]);
    });
  });

  // ── Badges (earned first, sponsored = paid-placement fallback; 2026-07-18) ──

  describe('deriveTourBadge (earned > sponsored fallback)', () => {
    const derive = (t: Record<string, unknown>) =>
      (service as any).deriveTourBadge({
        isSponsored: false,
        tierRank: 5,
        likelyToSellOut: false,
        likelyToSellOutOverride: null,
        publishedAt: null,
        aggregateRating: null,
        aggregateReviewCount: 0,
        ...t,
      });

    it('earned badges win over sponsored on paid placements', () => {
      expect(derive({ tierRank: 1, likelyToSellOut: true })).toBe(
        'likelyToSellOut',
      );
      expect(
        derive({
          isSponsored: true,
          aggregateRating: 4.8,
          aggregateReviewCount: 20,
        }),
      ).toBe('mostPopular');
      expect(
        derive({
          tierRank: 2,
          publishedAt: new Date(Date.now() - 5 * 86_400_000),
        }),
      ).toBe('new');
    });

    it('sponsored is the fallback for paid tiers P1-P3 and spotlight with no earned badge', () => {
      expect(derive({ tierRank: 1 })).toBe('sponsored');
      expect(
        derive({ tierRank: 3, aggregateRating: 4.8, aggregateReviewCount: 4 }),
      ).toBe('sponsored');
      expect(
        derive({
          isSponsored: true,
          aggregateRating: 4.3,
          aggregateReviewCount: 3,
        }),
      ).toBe('sponsored');
    });

    it('open tiers with nothing earned show no badge', () => {
      expect(derive({ tierRank: 4 })).toBeNull();
      expect(
        derive({ tierRank: 5, aggregateRating: 5, aggregateReviewCount: 4 }),
      ).toBeNull();
    });

    it('earned priority: sell-out > most popular > new', () => {
      expect(
        derive({
          likelyToSellOut: true,
          aggregateRating: 5,
          aggregateReviewCount: 50,
        }),
      ).toBe('likelyToSellOut');
      expect(derive({ aggregateRating: 4.6, aggregateReviewCount: 12 })).toBe(
        'mostPopular',
      );
    });
  });

  describe('applyMostPopularCap (master §3.6 "max 1 per category")', () => {
    it('keeps the badge on the first per category; later ones fall back to sponsored (paid) or none', () => {
      const items = [
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 3,
        },
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 2,
        },
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-b',
          isSponsored: false,
          tierRank: 4,
        },
        {
          badge: 'mostPopular',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 5,
        },
        {
          badge: 'new',
          primaryCategoryId: 'cat-a',
          isSponsored: false,
          tierRank: 1,
        },
      ] as any[];
      (service as any).applyMostPopularCap(items);
      expect(items.map((i) => i.badge)).toEqual([
        'mostPopular', // first in cat-a keeps it
        'sponsored', // capped, paid tier -> sponsored fallback
        'mostPopular', // first in cat-b
        null, // capped, open tier -> no badge
        'new', // other badges untouched
      ]);
    });
  });
});
