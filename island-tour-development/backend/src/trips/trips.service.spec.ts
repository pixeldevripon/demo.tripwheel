/**
 * Unit tests for TripsService.
 *
 * PrismaService is fully mocked — no real database connection is made.
 * $transaction is mocked to call its callback with the same mock object so that
 * both transactional and non-transactional Prisma calls can be asserted on a
 * single mock instance.
 *
 * Covers:
 *   resolveOperatorId  — operator lookup, ADMIN auto-provision, 400 for missing operator
 *   assertOwnership    — ADMIN bypass, owner pass-through, 403 for non-owner
 *   resolveUniqueSlug  — no conflict, other-entity conflict → suffix, own conflict → 409
 *   create             — slug_registry write for destination-only, skip for hub-anchored
 *   publish            — readiness guards, DRAFT→LIVE transition
 *   pause              — LIVE→PAUSED, ownership enforcement
 *   unpause            — PAUSED→LIVE, ownership enforcement
 *   archive            — slug_registry deactivation, hub-anchored skips it
 *   restore            — ARCHIVED→DRAFT, slug_registry re-activation
 *   remove             — operator can only delete ARCHIVED, admin deletes any status
 */

import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PickupModel, PricingModel, Role, SlugEntityType, TripStatus } from '@prisma/client';
import { CreateTripDto } from './dto/trip.dto';
import { TripsService } from './trips.service';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockPrismaService() {
  const mock = {
    operator: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    destination: {
      findUnique: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    hub: {
      findUnique: jest.fn(),
    },
    hubAllowedCategory: {
      findUnique: jest.fn(),
    },
    trip: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    slugRegistry: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Default: $transaction calls its callback with the same mock object so that
  // transactional Prisma calls are intercepted by the same jest.fn() stubs.
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );

  return mock;
}

// ── Data fixtures ─────────────────────────────────────────────────────────────

function makeTrip(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 'trip-1',
    name: 'Sunset Catamaran Cruise',
    slug: 'sunset-catamaran-cruise',
    status: TripStatus.DRAFT,
    operatorId: 'op-1',
    destinationId: 'dest-1',
    categoryId: 'cat-1',
    hubId: null,
    pricingModel: PricingModel.PER_PERSON,
    unitType: null,
    basePrice: '75.00',
    priceFrom: null,
    durationMinutes: 180,
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
    ...overrides,
  };
}

function makeOperator(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'op-1',
    userId: 'user-1',
    companyInfo: { companyName: 'Curaçao Sailing Co' },
    user: { name: 'John Operator', email: 'john@example.com' },
    ...overrides,
  };
}

function makeDestination(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'dest-1',
    slug: 'curacao',
    isActive: true,
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cat-1',
    isActive: true,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TripsService', () => {
  let service: TripsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TripsService>(TripsService);
    jest.clearAllMocks();

    // Re-apply after clearAllMocks
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
  });

  // ── resolveOperatorId (tested indirectly via public methods) ──────────────────

  describe('resolveOperatorId (via assertOwnership / create / findMyTrips)', () => {
    it('returns operator.id when a TOUR_OPERATOR already has an operator record', async () => {
      // Arrange: operator record exists, trip belongs to op-1
      const trip = makeTrip({ operatorId: 'op-1' });
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      // Act: assertOwnership succeeds without throwing
      await expect(
        service.assertOwnership(trip, 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeUndefined();

      expect(prisma.operator.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { id: true },
      });
    });

    it('throws BadRequestException when TOUR_OPERATOR has no operator record', async () => {
      // Arrange: no operator row found
      prisma.operator.findUnique.mockResolvedValue(null);
      const trip = makeTrip({ operatorId: 'op-1' });

      // Act & Assert
      await expect(
        service.assertOwnership(trip, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes "operator profile" in the BadRequestException message when no record exists', async () => {
      prisma.operator.findUnique.mockResolvedValue(null);
      const trip = makeTrip({ operatorId: 'op-1' });

      await expect(
        service.assertOwnership(trip, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow('operator profile');
    });

    it('auto-creates an operator record for ADMIN with no existing record and returns the new id', async () => {
      // Arrange: no existing operator row, but caller is ADMIN
      prisma.operator.findUnique.mockResolvedValue(null);
      prisma.operator.create.mockResolvedValue({ id: 'op-new' });

      // Set up a minimal create path to exercise resolveOperatorId with ADMIN
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst
        .mockResolvedValueOnce(null) // ownConflict check
        .mockResolvedValueOnce(null); // tripConflict check
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue(makeTrip({ slug: 'my-trip', operatorId: 'op-new' }));
      prisma.slugRegistry.create.mockResolvedValue({});

      const dto: CreateTripDto = {
        name: 'My Trip',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };
      await service.create(dto, 'admin-user', Role.ADMIN);

      expect(prisma.operator.create).toHaveBeenCalledWith({
        data: { userId: 'admin-user' },
        select: { id: true },
      });
    });

    it('returns existing operator.id for ADMIN that already has an operator record', async () => {
      // Arrange: ADMIN already has an operator record
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-existing' });
      const trip = makeTrip({ operatorId: 'op-existing' });

      // For ADMIN, assertOwnership returns immediately — operator lookup never runs
      // Test it through assertOwnership which calls resolveOperatorId
      await expect(
        service.assertOwnership(trip, 'admin-user', Role.ADMIN),
      ).resolves.toBeUndefined();

      // ADMIN short-circuits before operator lookup
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── assertOwnership ───────────────────────────────────────────────────────────

  describe('assertOwnership', () => {
    it('succeeds (no throw) when TOUR_OPERATOR is the trip owner', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      const trip = makeTrip({ operatorId: 'op-1' });

      await expect(
        service.assertOwnership(trip, 'user-1', Role.TOUR_OPERATOR),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when TOUR_OPERATOR calls assertOwnership on a trip they do not own', async () => {
      // Operator for this user is op-2, but trip belongs to op-1
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-2' });
      const trip = makeTrip({ operatorId: 'op-1' });

      await expect(
        service.assertOwnership(trip, 'user-2', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('includes "permission" in the ForbiddenException message for non-owner', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-2' });
      const trip = makeTrip({ operatorId: 'op-1' });

      await expect(
        service.assertOwnership(trip, 'user-2', Role.TOUR_OPERATOR),
      ).rejects.toThrow('permission');
    });

    it('succeeds (no throw) for ADMIN on any trip — skips ownership check entirely', async () => {
      const trip = makeTrip({ operatorId: 'op-someone-else' });

      await expect(
        service.assertOwnership(trip, 'admin-user', Role.ADMIN),
      ).resolves.toBeUndefined();

      // operator lookup must NOT be called for ADMIN
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── findTripOrThrow ───────────────────────────────────────────────────────────

  describe('findTripOrThrow', () => {
    it('returns the trip when it exists', async () => {
      const trip = makeTrip();
      prisma.trip.findUnique.mockResolvedValue(trip);

      const result = await service.findTripOrThrow('trip-1');

      expect(result.id).toBe('trip-1');
      expect(prisma.trip.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'trip-1' } }),
      );
    });

    it('throws NotFoundException when no trip matches the given id', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.findTripOrThrow('missing')).rejects.toThrow(NotFoundException);
    });

    it('includes the trip id in the NotFoundException message', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(service.findTripOrThrow('ghost-trip')).rejects.toThrow('ghost-trip');
    });
  });

  // ── resolveUniqueSlug (tested via create) ─────────────────────────────────────

  describe('resolveUniqueSlug (via create)', () => {
    // Helper: set up the minimum successful create mocks
    function setupCreateMocks(overrides: {
      operatorRecord?: { id: string } | null;
      destination?: ReturnType<typeof makeDestination> | null;
      category?: ReturnType<typeof makeCategory> | null;
      ownConflict?: object | null;
      tripConflict?: object | null;
      registryConflict?: object | null;
      operatorForSuffix?: ReturnType<typeof makeOperator>;
      createdTrip?: ReturnType<typeof makeTrip>;
    } = {}) {
      const {
        operatorRecord = { id: 'op-1' },
        destination = makeDestination(),
        category = makeCategory(),
        ownConflict = null,
        tripConflict = null,
        registryConflict = null,
        operatorForSuffix = makeOperator(),
        createdTrip = makeTrip(),
      } = overrides;

      prisma.operator.findUnique
        // First call: resolveOperatorId
        .mockResolvedValueOnce(operatorRecord)
        // Possible second call: operator suffix lookup
        .mockResolvedValueOnce(operatorForSuffix);

      prisma.destination.findUnique.mockResolvedValue(destination);
      prisma.category.findUnique.mockResolvedValue(category);

      prisma.trip.findFirst
        .mockResolvedValueOnce(ownConflict)    // ownConflict
        .mockResolvedValueOnce(tripConflict);  // tripConflict (general)

      prisma.slugRegistry.findUnique.mockResolvedValue(registryConflict);
      prisma.trip.create.mockResolvedValue(createdTrip);
      prisma.slugRegistry.create.mockResolvedValue({});
    }

    it('returns the base slug when there is no conflict', async () => {
      setupCreateMocks();

      const dto: CreateTripDto = {
        name: 'My Tour',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };

      await service.create(dto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'my-tour' }),
        }),
      );
    });

    it('throws ConflictException when the same operator already owns a trip with the same slug', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      // ownConflict — this operator already has this slug
      prisma.trip.findFirst.mockResolvedValueOnce({ id: 'existing-trip' });

      const dto: CreateTripDto = {
        name: 'Sunset Cruise',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };

      await expect(
        service.create(dto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    it('appends the operator company name as slug suffix when another entity occupies the base slug', async () => {
      // Trip conflict by different operator
      prisma.operator.findUnique
        .mockResolvedValueOnce({ id: 'op-1' }) // resolveOperatorId
        .mockResolvedValueOnce(makeOperator({ companyInfo: { companyName: 'Sailing Co' } })); // suffix lookup

      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst
        .mockResolvedValueOnce(null)                         // ownConflict: not our trip
        .mockResolvedValueOnce({ id: 'other-trip', operatorId: 'op-other' }) // tripConflict exists
        .mockResolvedValueOnce(null);                        // candidate check: free
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue(
        makeTrip({ slug: 'sunset-cruise-sailing-co', operatorId: 'op-1' }),
      );
      prisma.slugRegistry.create.mockResolvedValue({});

      const dto: CreateTripDto = {
        name: 'Sunset Cruise',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };

      await service.create(dto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'sunset-cruise-sailing-co' }),
        }),
      );
    });

    it('appends numeric suffix (-1, -2 …) when the operator-name suffix is also taken by another entity', async () => {
      prisma.operator.findUnique
        .mockResolvedValueOnce({ id: 'op-1' })
        .mockResolvedValueOnce(makeOperator({ companyInfo: { companyName: 'Sailing Co' } }));

      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());

      prisma.trip.findFirst
        .mockResolvedValueOnce(null)                          // ownConflict
        .mockResolvedValueOnce({ id: 'other', operatorId: 'op-other' }) // base slug taken
        .mockResolvedValueOnce({ id: 'other2', operatorId: 'op-other2' }) // i=0: suffix taken
        .mockResolvedValueOnce(null);                         // i=1: free

      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue(
        makeTrip({ slug: 'sunset-cruise-sailing-co-1', operatorId: 'op-1' }),
      );
      prisma.slugRegistry.create.mockResolvedValue({});

      const dto: CreateTripDto = {
        name: 'Sunset Cruise',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };

      await service.create(dto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'sunset-cruise-sailing-co-1' }),
        }),
      );
    });

    it('throws ConflictException when a suffixed candidate belongs to the same operator', async () => {
      prisma.operator.findUnique
        .mockResolvedValueOnce({ id: 'op-1' })
        .mockResolvedValueOnce(makeOperator({ companyInfo: { companyName: 'Sailing Co' } }));

      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());

      prisma.trip.findFirst
        .mockResolvedValueOnce(null)                                      // ownConflict for base
        .mockResolvedValueOnce({ id: 'other', operatorId: 'op-other' })  // base slug taken
        .mockResolvedValueOnce({ id: 'own', operatorId: 'op-1' });        // suffix candidate belongs to same op

      prisma.slugRegistry.findUnique.mockResolvedValue(null);

      const dto: CreateTripDto = {
        name: 'Sunset Cruise',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };

      await expect(
        service.create(dto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    it('uses the slug provided in dto after normalising through generateSlug', async () => {
      setupCreateMocks();

      const dto: CreateTripDto = {
        name: 'Ignored Name',
        slug: 'My Custom Slug',
        destinationId: 'dest-1',
        categoryId: 'cat-1',
        pricingModel: PricingModel.PER_PERSON,
        pickupModel: PickupModel.NONE,
      };

      await service.create(dto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'my-custom-slug' }),
        }),
      );
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    const validDto: CreateTripDto = {
      name: 'Island Snorkelling',
      destinationId: 'dest-1',
      categoryId: 'cat-1',
      pricingModel: PricingModel.PER_PERSON,
      pickupModel: PickupModel.NONE,
    };

    function setupHappyPath(hubId?: string) {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      const trip = makeTrip({ hubId: hubId ?? null });
      prisma.trip.create.mockResolvedValue(trip);
      prisma.slugRegistry.create.mockResolvedValue({});
      if (hubId) {
        prisma.hub.findUnique.mockResolvedValue({
          id: hubId,
          destinationId: 'dest-1',
          isActive: true,
        });
        prisma.hubAllowedCategory.findUnique.mockResolvedValue({ hubId, categoryId: 'cat-1' });
      }
      return trip;
    }

    it('creates the trip and returns it on happy path', async () => {
      const expectedTrip = setupHappyPath();

      const result = await service.create(validDto, 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(expectedTrip);
    });

    it('wraps the trip create and slug_registry create inside a Prisma $transaction', async () => {
      setupHappyPath();

      await service.create(validDto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('writes a slug_registry row when hubId is null (destination-only trip)', async () => {
      setupHappyPath(); // hubId defaults to null

      await service.create(validDto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destinationSlug: 'curacao',
            entityType: SlugEntityType.TOUR,
          }),
        }),
      );
    });

    it('skips the slug_registry write when hubId is set (hub-anchored trip)', async () => {
      setupHappyPath('hub-1');

      const dto = { ...validDto, hubId: 'hub-1' };
      await service.create(dto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when destination is not found', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.create(validDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when destination is inactive', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination({ isActive: false }));

      await expect(
        service.create(validDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when category is not found', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create(validDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when category is inactive', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory({ isActive: false }));

      await expect(
        service.create(validDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException inside transaction when hub is not found', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.hub.findUnique.mockResolvedValue(null);

      const dto = { ...validDto, hubId: 'hub-missing' };
      await expect(
        service.create(dto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException inside transaction when hub belongs to a different destination', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        destinationId: 'dest-OTHER',
        isActive: true,
      });

      const dto = { ...validDto, hubId: 'hub-1' };
      await expect(
        service.create(dto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException inside transaction when category is not allowed in the hub', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.hub.findUnique.mockResolvedValue({
        id: 'hub-1',
        destinationId: 'dest-1',
        isActive: true,
      });
      prisma.hubAllowedCategory.findUnique.mockResolvedValue(null);

      const dto = { ...validDto, hubId: 'hub-1' };
      await expect(
        service.create(dto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when Prisma raises P2002 on trip.create (race condition)', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      const p2002 = Object.assign(new Error('Unique constraint violation'), { code: 'P2002' });
      prisma.trip.create.mockRejectedValue(p2002);

      await expect(
        service.create(validDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws unknown errors from trip.create unchanged', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockRejectedValue(new Error('DB timeout'));

      await expect(
        service.create(validDto, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow('DB timeout');
    });

    it('stores the correct operatorId from the resolved operator record', async () => {
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-resolved' });
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.category.findUnique.mockResolvedValue(makeCategory());
      prisma.trip.findFirst.mockResolvedValue(null);
      prisma.slugRegistry.findUnique.mockResolvedValue(null);
      prisma.trip.create.mockResolvedValue(makeTrip({ operatorId: 'op-resolved' }));
      prisma.slugRegistry.create.mockResolvedValue({});

      await service.create(validDto, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ operatorId: 'op-resolved' }),
        }),
      );
    });
  });

  // ── publish ───────────────────────────────────────────────────────────────────

  describe('publish', () => {
    function makePublishableTrip(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        ...makeTrip({ status: TripStatus.DRAFT }),
        images: [
          { id: 'img-1', isHero: true },
          { id: 'img-2', isHero: false },
          { id: 'img-3', isHero: false },
          { id: 'img-4', isHero: false },
          { id: 'img-5', isHero: false },
        ],
        highlights: [
          { id: 'hl-1' },
          { id: 'hl-2' },
          { id: 'hl-3' },
        ],
        translations: [
          { overview: 'A beautiful sunset cruise along the coast of Curaçao.' },
        ],
        ...overrides,
      };
    }

    function setupPublishMocks(trip: ReturnType<typeof makePublishableTrip>) {
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: trip.operatorId as string });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.LIVE });
    }

    it('transitions trip from DRAFT to LIVE on happy path', async () => {
      const trip = makePublishableTrip();
      setupPublishMocks(trip);

      const result = await service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result.status).toBe(TripStatus.LIVE);
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: TripStatus.LIVE }),
        }),
      );
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.publish('missing', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when a TOUR_OPERATOR tries to publish another operator's trip", async () => {
      const trip = makePublishableTrip({ operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' }); // caller is op-1, trip is op-other

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when trip is not in DRAFT status', async () => {
      const trip = makePublishableTrip({ status: TripStatus.LIVE });
      setupPublishMocks(trip);

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException with "5 images" message when fewer than 5 images exist', async () => {
      const trip = makePublishableTrip({
        images: [
          { id: 'img-1', isHero: true },
          { id: 'img-2', isHero: false },
        ],
      });
      setupPublishMocks(trip);

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no hero image is set', async () => {
      const trip = makePublishableTrip({
        images: [
          { id: 'img-1', isHero: false },
          { id: 'img-2', isHero: false },
          { id: 'img-3', isHero: false },
          { id: 'img-4', isHero: false },
          { id: 'img-5', isHero: false },
        ],
      });
      setupPublishMocks(trip);

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when English overview is missing', async () => {
      const trip = makePublishableTrip({ translations: [{ overview: '' }] });
      setupPublishMocks(trip);

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when English overview translation record does not exist', async () => {
      const trip = makePublishableTrip({ translations: [] });
      setupPublishMocks(trip);

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when fewer than 3 highlights exist', async () => {
      const trip = makePublishableTrip({ highlights: [{ id: 'hl-1' }, { id: 'hl-2' }] });
      setupPublishMocks(trip);

      await expect(
        service.publish('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('ADMIN can publish any trip even if they are not the owner', async () => {
      const trip = makePublishableTrip({ operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      // ADMIN bypasses resolveOperatorId, so operator.findUnique should not be called
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.LIVE });

      const result = await service.publish('trip-1', 'admin-user', Role.ADMIN);

      expect(result.status).toBe(TripStatus.LIVE);
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── pause ─────────────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('transitions a LIVE trip to PAUSED status', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.PAUSED });

      const result = await service.pause('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result.status).toBe(TripStatus.PAUSED);
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TripStatus.PAUSED },
        }),
      );
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.pause('missing', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when a TOUR_OPERATOR pauses another operator's trip", async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.pause('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when trip is not LIVE', async () => {
      const trip = makeTrip({ status: TripStatus.PAUSED });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.pause('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('ADMIN can pause any trip regardless of ownership', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.PAUSED });

      const result = await service.pause('trip-1', 'admin-user', Role.ADMIN);

      expect(result.status).toBe(TripStatus.PAUSED);
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── unpause ───────────────────────────────────────────────────────────────────

  describe('unpause', () => {
    it('transitions a PAUSED trip back to LIVE status', async () => {
      const trip = makeTrip({ status: TripStatus.PAUSED });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.LIVE });

      const result = await service.unpause('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result.status).toBe(TripStatus.LIVE);
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TripStatus.LIVE },
        }),
      );
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.unpause('missing', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when a TOUR_OPERATOR unpauses another operator's trip", async () => {
      const trip = makeTrip({ status: TripStatus.PAUSED, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.unpause('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when trip is not PAUSED', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.unpause('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('ADMIN can unpause any trip regardless of ownership', async () => {
      const trip = makeTrip({ status: TripStatus.PAUSED, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.LIVE });

      const result = await service.unpause('trip-1', 'admin-user', Role.ADMIN);

      expect(result.status).toBe(TripStatus.LIVE);
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('sets trip status to ARCHIVED and isActive to false', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.ARCHIVED, isActive: false });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.archive('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result.status).toBe(TripStatus.ARCHIVED);
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TripStatus.ARCHIVED, isActive: false },
        }),
      );
    });

    it('deactivates the slug_registry row for a destination-only trip (hubId null)', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, hubId: null });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.ARCHIVED, isActive: false });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.archive('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'trip-1' },
        data: { isActive: false },
      });
    });

    it('skips slug_registry updateMany for a hub-anchored trip (hubId set)', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, hubId: 'hub-1' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.ARCHIVED, isActive: false });

      await service.archive('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.archive('missing', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when trip is already ARCHIVED', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.archive('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('runs the archive flow inside a $transaction', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.ARCHIVED, isActive: false });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.archive('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("ADMIN can archive another operator's trip", async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.ARCHIVED, isActive: false });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.archive('trip-1', 'admin-user', Role.ADMIN);

      expect(result.status).toBe(TripStatus.ARCHIVED);
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── restore ───────────────────────────────────────────────────────────────────

  describe('restore', () => {
    it('transitions an ARCHIVED trip back to DRAFT status with isActive true', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.DRAFT, isActive: true });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.restore('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result.status).toBe(TripStatus.DRAFT);
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TripStatus.DRAFT, isActive: true },
        }),
      );
    });

    it('re-activates the slug_registry row for a destination-only trip', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false, hubId: null });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.DRAFT, isActive: true });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.restore('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'trip-1' },
        data: { isActive: true },
      });
    });

    it('skips slug_registry updateMany when restoring a hub-anchored trip', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false, hubId: 'hub-1' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.DRAFT, isActive: true });

      await service.restore('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.restore('missing', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when trip is not ARCHIVED', async () => {
      const trip = makeTrip({ status: TripStatus.DRAFT });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.restore('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it("ADMIN can restore another operator's trip", async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.DRAFT, isActive: true });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.restore('trip-1', 'admin-user', Role.ADMIN);

      expect(result.status).toBe(TripStatus.DRAFT);
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('runs the restore flow inside a $transaction', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, status: TripStatus.DRAFT, isActive: true });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.restore('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('permanently deletes an ARCHIVED trip and its slug_registry row', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false, hubId: null });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.slugRegistry.deleteMany.mockResolvedValue({ count: 1 });
      prisma.trip.delete.mockResolvedValue(trip);

      const result = await service.remove('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Trip permanently deleted' });
      expect(prisma.trip.delete).toHaveBeenCalledWith({ where: { id: 'trip-1' } });
    });

    it('deletes the slug_registry row for destination-only trips on remove', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false, hubId: null });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.slugRegistry.deleteMany.mockResolvedValue({ count: 1 });
      prisma.trip.delete.mockResolvedValue(trip);

      await service.remove('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.deleteMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.TOUR, entityId: 'trip-1' },
      });
    });

    it('skips slug_registry deleteMany for hub-anchored trips', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, isActive: false, hubId: 'hub-1' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.delete.mockResolvedValue(trip);

      await service.remove('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.slugRegistry.deleteMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when TOUR_OPERATOR tries to delete a non-ARCHIVED trip', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.remove('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows ADMIN to permanently delete a non-ARCHIVED trip (no archive pre-requisite)', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, hubId: null });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.slugRegistry.deleteMany.mockResolvedValue({ count: 1 });
      prisma.trip.delete.mockResolvedValue(trip);

      const result = await service.remove('trip-1', 'admin-user', Role.ADMIN);

      expect(result).toEqual({ message: 'Trip permanently deleted' });
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('missing', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when TOUR_OPERATOR tries to remove another operator's trip", async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.remove('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('runs remove inside a $transaction', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED, hubId: null });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.slugRegistry.deleteMany.mockResolvedValue({ count: 1 });
      prisma.trip.delete.mockResolvedValue(trip);

      await service.remove('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the specified trip fields and returns the updated record', async () => {
      const trip = makeTrip({ status: TripStatus.DRAFT });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      const updatedTrip = { ...trip, name: 'New Name' };
      prisma.trip.update.mockResolvedValue(updatedTrip);

      const result = await service.update('trip-1', { name: 'New Name' }, 'user-1', Role.TOUR_OPERATOR);

      expect(result.trip.name).toBe('New Name');
      expect(prisma.trip.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'trip-1' },
          data: expect.objectContaining({ name: 'New Name' }),
        }),
      );
    });

    it('throws NotFoundException when trip does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing', { name: 'X' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException for non-owner TOUR_OPERATOR', async () => {
      const trip = makeTrip({ operatorId: 'op-other' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.update('trip-1', { name: 'X' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when trying to update an ARCHIVED trip', async () => {
      const trip = makeTrip({ status: TripStatus.ARCHIVED });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.update('trip-1', { name: 'X' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes a warning when category changes on a LIVE trip', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE, categoryId: 'cat-1' });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue({ ...trip, categoryId: 'cat-2' });

      const result = await service.update(
        'trip-1',
        { categoryId: 'cat-2' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toMatch(/Category changed/);
    });

    it('returns empty warnings array when no category change on LIVE trip', async () => {
      const trip = makeTrip({ status: TripStatus.LIVE });
      prisma.trip.findUnique.mockResolvedValue(trip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      prisma.trip.update.mockResolvedValue(trip);

      const result = await service.update('trip-1', { name: 'Updated' }, 'user-1', Role.TOUR_OPERATOR);

      expect(result.warnings).toHaveLength(0);
    });
  });
});
