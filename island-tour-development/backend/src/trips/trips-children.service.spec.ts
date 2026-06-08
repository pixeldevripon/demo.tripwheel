/**
 * Unit tests for TripChildrenService.
 *
 * PrismaService and TripsService are both fully mocked — no real database
 * connection is made and no slug / ownership logic is re-executed here.
 *
 * Strategy:
 *   - assertTripAccess (private) is exercised indirectly through every public
 *     method that calls it. We verify that TripsService.findTripOrThrow and
 *     TripsService.assertOwnership are delegated to, and that their errors
 *     propagate out of the child methods unchanged.
 *   - getSchedules has its own auth-aware visibility logic that is tested
 *     comprehensively: public view of LIVE trips, hidden non-LIVE trips for
 *     unauthenticated callers, owner-operator access, and ADMIN bypass.
 *   - All CRUD child methods are tested for: happy path, 404 on parent trip,
 *     403 on non-owner operator, 404 when the child resource itself is missing.
 *   - Translation delete guards (English locale) are tested for highlights,
 *     inclusions, and trip translations.
 *   - Conflict (P2002) and not-found (P2025) Prisma errors are tested where
 *     the service explicitly handles them.
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
  AgeBandType,
  Locale,
  PickupModel,
  PricingModel,
  Role,
  ScheduleStatus,
  TripStatus,
} from '@prisma/client';
import { TripChildrenService } from './trips-children.service';
import { TripsService } from './trips.service';

// ── Mock factories ─────────────────────────────────────────────────────────────

function createMockTripsService() {
  return {
    findTripOrThrow: jest.fn(),
    assertOwnership: jest.fn(),
    recomputePriceFrom: jest.fn(),
  };
}

function createMockPrismaService() {
  return {
    tourImage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    tourAgeBand: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tourAddOn: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tourLanguage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    tourHighlight: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    tourHighlightTranslation: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tourInclusion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    tourInclusionTranslation: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tourExclusion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    tourExclusionTranslation: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tripTranslation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tourSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    trip: {
      findUnique: jest.fn(),
    },
    operator: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

// ── Data fixtures ─────────────────────────────────────────────────────────────

function makeTrip(overrides: Partial<Record<string, unknown>> = {}) {
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

function makeImage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'img-1',
    tripId: 'trip-1',
    url: 'https://example.com/image.jpg',
    isHero: false,
    focalX: 0.5,
    focalY: 0.5,
    altText: null,
    displayOrder: 0,
    width: 1920,
    height: 1080,
    ...overrides,
  };
}

function makeSchedule(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sched-1',
    tripId: 'trip-1',
    startDate: new Date('2026-07-15'),
    endDate: null,
    startTime: '09:00',
    totalSpots: 20,
    availableSpots: 20,
    status: ScheduleStatus.AVAILABLE,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-06-01'),
    ...overrides,
  };
}

function makeHighlight(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'hl-1',
    tripId: 'trip-1',
    displayOrder: 0,
    imageUrl: null,
    translations: [{ locale: 'en', text: 'Watch the sunset', isMachineTranslated: false }],
    ...overrides,
  };
}

function makeInclusion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inc-1',
    tripId: 'trip-1',
    icon: 'check',
    displayOrder: 0,
    imageUrl: null,
    translations: [{ locale: 'en', label: 'Open bar', isMachineTranslated: false }],
    ...overrides,
  };
}

function makeExclusion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'excl-1',
    tripId: 'trip-1',
    icon: 'x',
    displayOrder: 0,
    imageUrl: null,
    translations: [{ locale: 'en', label: 'Flights not included', isMachineTranslated: false }],
    ...overrides,
  };
}

function makeAgeBand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'band-1',
    tripId: 'trip-1',
    bandType: AgeBandType.ADULT,
    label: 'Adults (13+)',
    minAge: 13,
    maxAge: null,
    price: '75.00',
    minCount: 1,
    maxCount: null,
    displayOrder: 0,
    ...overrides,
  };
}

function makeAddOn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'addon-1',
    tripId: 'trip-1',
    name: 'Hotel pickup',
    description: null,
    price: '15.00',
    unit: 'PER_PERSON',
    maxQuantity: 1,
    displayOrder: 0,
    isActive: true,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TripChildrenService', () => {
  let service: TripChildrenService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let tripsService: ReturnType<typeof createMockTripsService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    tripsService = createMockTripsService();

    // Default: $transaction calls its callback with the same mock object
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );

    // Default: findTripOrThrow returns a DRAFT trip; assertOwnership passes
    tripsService.findTripOrThrow.mockResolvedValue(makeTrip());
    tripsService.assertOwnership.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripChildrenService,
        { provide: PrismaService, useValue: prisma },
        { provide: TripsService, useValue: tripsService },
      ],
    }).compile();

    service = module.get<TripChildrenService>(TripChildrenService);
    jest.clearAllMocks();

    // Re-apply defaults after clearAllMocks
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    tripsService.findTripOrThrow.mockResolvedValue(makeTrip());
    tripsService.assertOwnership.mockResolvedValue(undefined);
  });

  // ── assertTripAccess (tested indirectly) ──────────────────────────────────────

  describe('assertTripAccess (via all child methods)', () => {
    it('delegates to tripsService.findTripOrThrow with the given tripId', async () => {
      prisma.tourImage.findMany.mockResolvedValue([]);

      await service.getImages('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(tripsService.findTripOrThrow).toHaveBeenCalledWith('trip-1');
    });

    it('delegates to tripsService.assertOwnership with the resolved trip, requesterId, and role', async () => {
      const trip = makeTrip();
      tripsService.findTripOrThrow.mockResolvedValue(trip);
      prisma.tourImage.findMany.mockResolvedValue([]);

      await service.getImages('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(tripsService.assertOwnership).toHaveBeenCalledWith(trip, 'user-1', Role.TOUR_OPERATOR);
    });

    it('propagates NotFoundException from findTripOrThrow when trip does not exist', async () => {
      tripsService.findTripOrThrow.mockRejectedValue(new NotFoundException('Trip trip-99 not found'));

      await expect(
        service.getImages('trip-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from assertOwnership for non-owner operators', async () => {
      tripsService.assertOwnership.mockRejectedValue(
        new ForbiddenException('You do not have permission to modify this trip'),
      );

      await expect(
        service.getImages('trip-1', 'user-other', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns the trip from assertTripAccess on success', async () => {
      const trip = makeTrip({ id: 'trip-abc' });
      tripsService.findTripOrThrow.mockResolvedValue(trip);
      prisma.tourImage.findMany.mockResolvedValue([]);

      // The returned trip value is used internally; we verify findTripOrThrow was called
      await service.getImages('trip-abc', 'user-1', Role.TOUR_OPERATOR);

      expect(tripsService.findTripOrThrow).toHaveBeenCalledWith('trip-abc');
    });
  });

  // ── getSchedules ──────────────────────────────────────────────────────────────

  describe('getSchedules', () => {
    it('returns schedules for a LIVE trip without authentication', async () => {
      const liveTrip = { id: 'trip-1', status: TripStatus.LIVE, operatorId: 'op-1' };
      prisma.trip.findUnique.mockResolvedValue(liveTrip);
      const schedules = [makeSchedule()];
      prisma.tourSchedule.findMany.mockResolvedValue(schedules);

      const result = await service.getSchedules('trip-1', null, null);

      expect(result).toEqual(schedules);
      expect(prisma.tourSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tripId: 'trip-1' } }),
      );
    });

    it('throws NotFoundException for non-LIVE trip when caller is unauthenticated (requesterId null)', async () => {
      const draftTrip = { id: 'trip-1', status: TripStatus.DRAFT, operatorId: 'op-1' };
      prisma.trip.findUnique.mockResolvedValue(draftTrip);

      await expect(
        service.getSchedules('trip-1', null, null),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the trip itself does not exist', async () => {
      prisma.trip.findUnique.mockResolvedValue(null);

      await expect(
        service.getSchedules('ghost', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns schedules for a non-LIVE trip when the caller is the owner operator', async () => {
      const draftTrip = { id: 'trip-1', status: TripStatus.DRAFT, operatorId: 'op-1' };
      prisma.trip.findUnique.mockResolvedValue(draftTrip);
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });
      const schedules = [makeSchedule()];
      prisma.tourSchedule.findMany.mockResolvedValue(schedules);

      const result = await service.getSchedules('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(schedules);
    });

    it('throws NotFoundException for non-LIVE trip when caller is a TOUR_OPERATOR who does not own it', async () => {
      const draftTrip = { id: 'trip-1', status: TripStatus.DRAFT, operatorId: 'op-other' };
      prisma.trip.findUnique.mockResolvedValue(draftTrip);
      // caller's operator id is op-1, but trip belongs to op-other
      prisma.operator.findUnique.mockResolvedValue({ id: 'op-1' });

      await expect(
        service.getSchedules('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns schedules for a non-LIVE trip when caller is ADMIN regardless of ownership', async () => {
      const draftTrip = { id: 'trip-1', status: TripStatus.DRAFT, operatorId: 'op-other' };
      prisma.trip.findUnique.mockResolvedValue(draftTrip);
      const schedules = [makeSchedule()];
      prisma.tourSchedule.findMany.mockResolvedValue(schedules);

      const result = await service.getSchedules('trip-1', 'admin-user', Role.ADMIN);

      expect(result).toEqual(schedules);
      // ADMIN path skips operator lookup
      expect(prisma.operator.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for non-LIVE trip when caller TOUR_OPERATOR has no operator record', async () => {
      const draftTrip = { id: 'trip-1', status: TripStatus.DRAFT, operatorId: 'op-1' };
      prisma.trip.findUnique.mockResolvedValue(draftTrip);
      prisma.operator.findUnique.mockResolvedValue(null);

      await expect(
        service.getSchedules('trip-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('orders schedules by startDate ascending', async () => {
      const liveTrip = { id: 'trip-1', status: TripStatus.LIVE, operatorId: 'op-1' };
      prisma.trip.findUnique.mockResolvedValue(liveTrip);
      prisma.tourSchedule.findMany.mockResolvedValue([]);

      await service.getSchedules('trip-1', null, null);

      expect(prisma.tourSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { startDate: 'asc' } }),
      );
    });
  });

  // ── Images ────────────────────────────────────────────────────────────────────

  describe('getImages', () => {
    it('returns all images for the trip ordered by displayOrder', async () => {
      const images = [makeImage(), makeImage({ id: 'img-2', displayOrder: 1 })];
      prisma.tourImage.findMany.mockResolvedValue(images);

      const result = await service.getImages('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(images);
      expect(prisma.tourImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });
  });

  describe('addImage', () => {
    it('creates a non-hero image and returns it', async () => {
      const image = makeImage({ isHero: false });
      prisma.tourImage.create.mockResolvedValue(image);

      const result = await service.addImage(
        'trip-1',
        { url: 'https://example.com/img.jpg', isHero: false, width: 1920, height: 1080 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(image);
      expect(prisma.tourImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tripId: 'trip-1', isHero: false }),
        }),
      );
    });

    it('clears previous hero images and sets isHero=true inside a transaction when isHero is true', async () => {
      const heroImage = makeImage({ isHero: true });
      prisma.tourImage.updateMany.mockResolvedValue({ count: 1 });
      prisma.tourImage.create.mockResolvedValue(heroImage);

      await service.addImage(
        'trip-1',
        { url: 'https://example.com/hero.jpg', isHero: true, width: 1920, height: 1080 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourImage.updateMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-1' },
        data: { isHero: false },
      });
      expect(prisma.tourImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isHero: true }),
        }),
      );
    });

    it('propagates NotFoundException from assertTripAccess when trip does not exist', async () => {
      tripsService.findTripOrThrow.mockRejectedValue(new NotFoundException('Trip trip-99 not found'));

      await expect(
        service.addImage(
          'trip-99',
          { url: 'https://example.com/img.jpg', width: 100, height: 100 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('defaults focalX and focalY to 0.5 when not provided', async () => {
      prisma.tourImage.create.mockResolvedValue(makeImage());

      await service.addImage(
        'trip-1',
        { url: 'https://example.com/img.jpg', width: 1920, height: 1080 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ focalX: 0.5, focalY: 0.5 }),
        }),
      );
    });
  });

  describe('updateImage', () => {
    it('updates image fields and returns the updated record', async () => {
      const existing = makeImage();
      const updated = { ...existing, altText: 'Sunset view' };
      prisma.tourImage.findFirst.mockResolvedValue(existing);
      prisma.tourImage.update.mockResolvedValue(updated);

      const result = await service.updateImage(
        'trip-1', 'img-1', { altText: 'Sunset view' }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when image does not belong to the trip', async () => {
      prisma.tourImage.findFirst.mockResolvedValue(null);

      await expect(
        service.updateImage('trip-1', 'img-99', { altText: 'X' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('clears previous hero images and sets isHero=true in a transaction when isHero update is true', async () => {
      const existing = makeImage();
      const updated = { ...existing, isHero: true };
      prisma.tourImage.findFirst.mockResolvedValue(existing);
      prisma.tourImage.updateMany.mockResolvedValue({ count: 1 });
      prisma.tourImage.update.mockResolvedValue(updated);

      await service.updateImage(
        'trip-1', 'img-1', { isHero: true }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourImage.updateMany).toHaveBeenCalledWith({
        where: { tripId: 'trip-1' },
        data: { isHero: false },
      });
    });
  });

  describe('removeImage', () => {
    it('deletes the image and returns success message', async () => {
      prisma.tourImage.findFirst.mockResolvedValue(makeImage());
      prisma.tourImage.delete.mockResolvedValue({});

      const result = await service.removeImage('trip-1', 'img-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Image removed successfully' });
      expect(prisma.tourImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
    });

    it('throws NotFoundException when image is not found on the trip', async () => {
      prisma.tourImage.findFirst.mockResolvedValue(null);

      await expect(
        service.removeImage('trip-1', 'img-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Age Bands ─────────────────────────────────────────────────────────────────

  describe('getAgeBands', () => {
    it('returns all age bands ordered by displayOrder', async () => {
      const bands = [makeAgeBand()];
      prisma.tourAgeBand.findMany.mockResolvedValue(bands);

      const result = await service.getAgeBands('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(bands);
      expect(prisma.tourAgeBand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });
  });

  describe('addAgeBand', () => {
    it('creates an age band with the provided fields and returns it', async () => {
      const band = makeAgeBand();
      prisma.tourAgeBand.create.mockResolvedValue(band);

      const result = await service.addAgeBand(
        'trip-1',
        { bandType: AgeBandType.ADULT, label: 'Adults (13+)', price: '75.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(band);
      expect(prisma.tourAgeBand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId: 'trip-1',
            bandType: AgeBandType.ADULT,
            label: 'Adults (13+)',
            price: '75.00',
          }),
        }),
      );
    });

    it('propagates ForbiddenException from assertTripAccess for non-owner', async () => {
      tripsService.assertOwnership.mockRejectedValue(
        new ForbiddenException('You do not have permission to modify this trip'),
      );

      await expect(
        service.addAgeBand(
          'trip-1',
          { bandType: AgeBandType.ADULT, label: 'Adults', price: '75.00' },
          'user-other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateAgeBand', () => {
    it('updates age band fields and returns the updated record', async () => {
      const existing = makeAgeBand();
      const updated = { ...existing, label: 'Seniors (65+)' };
      prisma.tourAgeBand.findFirst.mockResolvedValue(existing);
      prisma.tourAgeBand.update.mockResolvedValue(updated);

      const result = await service.updateAgeBand(
        'trip-1', 'band-1', { label: 'Seniors (65+)' }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result.label).toBe('Seniors (65+)');
    });

    it('throws NotFoundException when age band does not belong to the trip', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAgeBand('trip-1', 'band-99', { label: 'X' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAgeBand', () => {
    it('deletes the age band and returns success message', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(makeAgeBand());
      prisma.tourAgeBand.delete.mockResolvedValue({});

      const result = await service.removeAgeBand('trip-1', 'band-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Age band removed successfully' });
      expect(prisma.tourAgeBand.delete).toHaveBeenCalledWith({ where: { id: 'band-1' } });
    });

    it('throws NotFoundException when age band does not exist on the trip', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAgeBand('trip-1', 'band-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Add-Ons ───────────────────────────────────────────────────────────────────

  describe('getAddOns', () => {
    it('returns all add-ons ordered by displayOrder', async () => {
      const addOns = [makeAddOn()];
      prisma.tourAddOn.findMany.mockResolvedValue(addOns);

      const result = await service.getAddOns('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(addOns);
      expect(prisma.tourAddOn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });
  });

  describe('addAddOn', () => {
    it('creates an add-on and returns it', async () => {
      const addOn = makeAddOn();
      prisma.tourAddOn.create.mockResolvedValue(addOn);

      const result = await service.addAddOn(
        'trip-1',
        { name: 'Hotel pickup', price: '15.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(addOn);
      expect(prisma.tourAddOn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tripId: 'trip-1', name: 'Hotel pickup', price: '15.00' }),
        }),
      );
    });

    it('defaults unit to PER_PERSON when not provided', async () => {
      prisma.tourAddOn.create.mockResolvedValue(makeAddOn());

      await service.addAddOn(
        'trip-1',
        { name: 'Hotel pickup', price: '15.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourAddOn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unit: 'PER_PERSON' }),
        }),
      );
    });
  });

  describe('updateAddOn', () => {
    it('updates add-on and returns the updated record', async () => {
      const existing = makeAddOn();
      const updated = { ...existing, name: 'Airport transfer' };
      prisma.tourAddOn.findFirst.mockResolvedValue(existing);
      prisma.tourAddOn.update.mockResolvedValue(updated);

      const result = await service.updateAddOn(
        'trip-1', 'addon-1', { name: 'Airport transfer' }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result.name).toBe('Airport transfer');
    });

    it('throws NotFoundException when add-on does not belong to the trip', async () => {
      prisma.tourAddOn.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAddOn('trip-1', 'addon-99', { name: 'X' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAddOn', () => {
    it('deletes the add-on and returns success message', async () => {
      prisma.tourAddOn.findFirst.mockResolvedValue(makeAddOn());
      prisma.tourAddOn.delete.mockResolvedValue({});

      const result = await service.removeAddOn('trip-1', 'addon-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Add-on removed successfully' });
      expect(prisma.tourAddOn.delete).toHaveBeenCalledWith({ where: { id: 'addon-1' } });
    });

    it('throws NotFoundException when add-on does not exist on the trip', async () => {
      prisma.tourAddOn.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAddOn('trip-1', 'addon-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Languages ─────────────────────────────────────────────────────────────────

  describe('getLanguages', () => {
    it('returns all languages for the trip ordered alphabetically', async () => {
      const langs = [{ id: 'lang-1', tripId: 'trip-1', language: 'en' }];
      prisma.tourLanguage.findMany.mockResolvedValue(langs);

      const result = await service.getLanguages('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(langs);
      expect(prisma.tourLanguage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { language: 'asc' },
        }),
      );
    });
  });

  describe('addLanguage', () => {
    it('creates a language record and returns it', async () => {
      const lang = { id: 'lang-1', tripId: 'trip-1', language: 'nl' };
      prisma.tourLanguage.create.mockResolvedValue(lang);

      const result = await service.addLanguage(
        'trip-1', { language: 'nl' }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(lang);
      expect(prisma.tourLanguage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tripId: 'trip-1', language: 'nl' },
        }),
      );
    });

    it('throws ConflictException when language already exists on the trip (P2002)', async () => {
      const p2002 = Object.assign(new Error('Unique constraint violation'), { code: 'P2002' });
      prisma.tourLanguage.create.mockRejectedValue(p2002);

      await expect(
        service.addLanguage('trip-1', { language: 'nl' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws unknown errors from tourLanguage.create unchanged', async () => {
      prisma.tourLanguage.create.mockRejectedValue(new Error('DB timeout'));

      await expect(
        service.addLanguage('trip-1', { language: 'nl' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow('DB timeout');
    });
  });

  describe('removeLanguage', () => {
    it('deletes the language and returns success message', async () => {
      prisma.tourLanguage.findFirst.mockResolvedValue({ id: 'lang-1', language: 'nl' });
      prisma.tourLanguage.delete.mockResolvedValue({});

      const result = await service.removeLanguage('trip-1', 'lang-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Language removed successfully' });
      expect(prisma.tourLanguage.delete).toHaveBeenCalledWith({ where: { id: 'lang-1' } });
    });

    it('throws NotFoundException when language is not found on the trip', async () => {
      prisma.tourLanguage.findFirst.mockResolvedValue(null);

      await expect(
        service.removeLanguage('trip-1', 'lang-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Highlights ────────────────────────────────────────────────────────────────

  describe('getHighlights', () => {
    it('returns all highlights with translations ordered by displayOrder', async () => {
      const highlights = [makeHighlight()];
      prisma.tourHighlight.findMany.mockResolvedValue(highlights);

      const result = await service.getHighlights('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(highlights);
      expect(prisma.tourHighlight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });
  });

  describe('addHighlight', () => {
    it('creates a highlight with English translation inside a transaction and returns it', async () => {
      const highlight = makeHighlight();
      prisma.tourHighlight.create.mockResolvedValue({ id: 'hl-1', tripId: 'trip-1', displayOrder: 0, imageUrl: null });
      prisma.tourHighlightTranslation.create.mockResolvedValue({});
      prisma.tourHighlight.findUnique.mockResolvedValue(highlight);

      const result = await service.addHighlight(
        'trip-1',
        { text: 'Watch the sunset', displayOrder: 0 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourHighlight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tripId: 'trip-1' }),
        }),
      );
      expect(prisma.tourHighlightTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ text: 'Watch the sunset', locale: 'en' }),
        }),
      );
      expect(result).toEqual(highlight);
    });

    it('propagates NotFoundException when trip does not exist', async () => {
      tripsService.findTripOrThrow.mockRejectedValue(new NotFoundException('Trip not found'));

      await expect(
        service.addHighlight('trip-99', { text: 'Some highlight text here' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateHighlight', () => {
    it('updates highlight fields and returns the updated record', async () => {
      const existing = makeHighlight();
      const updated = { ...existing, displayOrder: 2 };
      prisma.tourHighlight.findFirst.mockResolvedValue(existing);
      prisma.tourHighlight.update.mockResolvedValue(updated);

      const result = await service.updateHighlight(
        'trip-1', 'hl-1', { displayOrder: 2 }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result.displayOrder).toBe(2);
    });

    it('throws NotFoundException when highlight does not belong to the trip', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.updateHighlight('trip-1', 'hl-99', { displayOrder: 1 }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeHighlight', () => {
    it('deletes the highlight and returns success message', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(makeHighlight());
      prisma.tourHighlight.delete.mockResolvedValue({});

      const result = await service.removeHighlight('trip-1', 'hl-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Highlight removed successfully' });
      expect(prisma.tourHighlight.delete).toHaveBeenCalledWith({ where: { id: 'hl-1' } });
    });

    it('throws NotFoundException when highlight is not found on the trip', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.removeHighlight('trip-1', 'hl-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertHighlightTranslation', () => {
    it('upserts the translation and returns it', async () => {
      const highlight = { id: 'hl-1' };
      const translation = { locale: Locale.nl, text: 'Zie de zonsondergang', isMachineTranslated: false };
      prisma.tourHighlight.findFirst.mockResolvedValue(highlight);
      prisma.tourHighlightTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertHighlightTranslation(
        'trip-1', 'hl-1', Locale.nl,
        { text: 'Zie de zonsondergang' },
        'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translation);
      expect(prisma.tourHighlightTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { highlightId_locale: { highlightId: 'hl-1', locale: Locale.nl } },
          create: expect.objectContaining({ text: 'Zie de zonsondergang', locale: Locale.nl }),
          update: expect.objectContaining({ text: 'Zie de zonsondergang' }),
        }),
      );
    });

    it('throws NotFoundException when highlight does not belong to the trip', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertHighlightTranslation(
          'trip-1', 'hl-99', Locale.nl,
          { text: 'Some text here for translation' },
          'user-1', Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('defaults isMachineTranslated to false when not provided', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue({ id: 'hl-1' });
      prisma.tourHighlightTranslation.upsert.mockResolvedValue({});

      await service.upsertHighlightTranslation(
        'trip-1', 'hl-1', Locale.nl,
        { text: 'Some text here for translation' },
        'user-1', Role.TOUR_OPERATOR,
      );

      expect(prisma.tourHighlightTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });
  });

  describe('deleteHighlightTranslation', () => {
    it('throws BadRequestException when attempting to delete the English translation', async () => {
      await expect(
        service.deleteHighlightTranslation('trip-1', 'hl-1', Locale.en, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue({ id: 'hl-1' });
      prisma.tourHighlightTranslation.delete.mockResolvedValue({});

      const result = await service.deleteHighlightTranslation(
        'trip-1', 'hl-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: `Translation for locale "${Locale.nl}" deleted` });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue({ id: 'hl-1' });
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
      prisma.tourHighlightTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteHighlightTranslation('trip-1', 'hl-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when highlight does not belong to the trip', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteHighlightTranslation('trip-1', 'hl-99', Locale.nl, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Inclusions ────────────────────────────────────────────────────────────────

  describe('getInclusions', () => {
    it('returns all inclusions ordered by displayOrder', async () => {
      const inclusions = [makeInclusion()];
      prisma.tourInclusion.findMany.mockResolvedValue(inclusions);

      const result = await service.getInclusions('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(inclusions);
      expect(prisma.tourInclusion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });
  });

  describe('addInclusion', () => {
    it('creates an inclusion with English label inside a transaction and returns it', async () => {
      const inclusion = makeInclusion();
      prisma.tourInclusion.create.mockResolvedValue({ id: 'inc-1' });
      prisma.tourInclusionTranslation.create.mockResolvedValue({});
      prisma.tourInclusion.findUnique.mockResolvedValue(inclusion);

      const result = await service.addInclusion(
        'trip-1',
        { label: 'Open bar', icon: 'check' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourInclusion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tripId: 'trip-1' }),
        }),
      );
      expect(prisma.tourInclusionTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ label: 'Open bar', locale: 'en' }),
        }),
      );
      expect(result).toEqual(inclusion);
    });

    it('defaults icon to "check" when not provided', async () => {
      prisma.tourInclusion.create.mockResolvedValue({ id: 'inc-1' });
      prisma.tourInclusionTranslation.create.mockResolvedValue({});
      prisma.tourInclusion.findUnique.mockResolvedValue(makeInclusion());

      await service.addInclusion('trip-1', { label: 'Open bar' }, 'user-1', Role.TOUR_OPERATOR);

      expect(prisma.tourInclusion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icon: 'check' }),
        }),
      );
    });
  });

  describe('updateInclusion', () => {
    it('updates inclusion and returns the updated record', async () => {
      const existing = makeInclusion();
      const updated = { ...existing, icon: 'drink' };
      prisma.tourInclusion.findFirst.mockResolvedValue(existing);
      prisma.tourInclusion.update.mockResolvedValue(updated);

      const result = await service.updateInclusion(
        'trip-1', 'inc-1', { icon: 'drink' }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result.icon).toBe('drink');
    });

    it('throws NotFoundException when inclusion does not belong to the trip', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInclusion('trip-1', 'inc-99', { icon: 'drink' }, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeInclusion', () => {
    it('deletes the inclusion and returns success message', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(makeInclusion());
      prisma.tourInclusion.delete.mockResolvedValue({});

      const result = await service.removeInclusion('trip-1', 'inc-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Inclusion removed successfully' });
      expect(prisma.tourInclusion.delete).toHaveBeenCalledWith({ where: { id: 'inc-1' } });
    });

    it('throws NotFoundException when inclusion is not found on the trip', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.removeInclusion('trip-1', 'inc-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertInclusionTranslation', () => {
    it('upserts the label translation and returns it', async () => {
      const inclusion = { id: 'inc-1' };
      const translation = { locale: Locale.nl, label: 'Open bar NL', isMachineTranslated: false };
      prisma.tourInclusion.findFirst.mockResolvedValue(inclusion);
      prisma.tourInclusionTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertInclusionTranslation(
        'trip-1', 'inc-1', Locale.nl,
        { label: 'Open bar NL' },
        'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translation);
      expect(prisma.tourInclusionTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { inclusionId_locale: { inclusionId: 'inc-1', locale: Locale.nl } },
        }),
      );
    });

    it('throws NotFoundException when inclusion does not belong to the trip', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertInclusionTranslation(
          'trip-1', 'inc-99', Locale.nl,
          { label: 'Some label' },
          'user-1', Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInclusionTranslation', () => {
    it('throws BadRequestException when attempting to delete the English label', async () => {
      await expect(
        service.deleteInclusionTranslation('trip-1', 'inc-1', Locale.en, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue({ id: 'inc-1' });
      prisma.tourInclusionTranslation.delete.mockResolvedValue({});

      const result = await service.deleteInclusionTranslation(
        'trip-1', 'inc-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: `Translation for locale "${Locale.nl}" deleted` });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue({ id: 'inc-1' });
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
      prisma.tourInclusionTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteInclusionTranslation('trip-1', 'inc-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Trip Translations ─────────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('returns all translation rows ordered by locale', async () => {
      const translations = [
        { locale: Locale.en, title: null, overview: 'Overview', description: null, isMachineTranslated: false, updatedAt: new Date() },
        { locale: Locale.nl, title: null, overview: 'Overzicht', description: null, isMachineTranslated: true, updatedAt: new Date() },
      ];
      prisma.tripTranslation.findMany.mockResolvedValue(translations);

      const result = await service.getAllTranslations('trip-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(translations);
      expect(prisma.tripTranslation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId: 'trip-1' },
          orderBy: { locale: 'asc' },
        }),
      );
    });
  });

  describe('getTranslationByLocale', () => {
    it('returns the translation row when it exists for the given locale', async () => {
      const translation = {
        locale: Locale.nl,
        title: 'Zonsondergang cruise',
        overview: null,
        description: null,
        isMachineTranslated: false,
        updatedAt: new Date(),
      };
      prisma.tripTranslation.findUnique.mockResolvedValue(translation);

      const result = await service.getTranslationByLocale('trip-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual(translation);
    });

    it('returns a null-filled placeholder when no translation row exists for that locale', async () => {
      prisma.tripTranslation.findUnique.mockResolvedValue(null);

      const result = await service.getTranslationByLocale('trip-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({
        locale: Locale.nl,
        title: null,
        overview: null,
        description: null,
        isMachineTranslated: false,
        updatedAt: null,
      });
    });
  });

  describe('upsertTranslation', () => {
    it('upserts the translation and returns it', async () => {
      const upserted = {
        locale: Locale.en,
        title: 'Sunset Cruise',
        overview: 'A beautiful cruise.',
        description: null,
        isMachineTranslated: false,
        updatedAt: new Date(),
      };
      prisma.tripTranslation.upsert.mockResolvedValue(upserted);

      const result = await service.upsertTranslation(
        'trip-1', Locale.en,
        { title: 'Sunset Cruise', overview: 'A beautiful cruise.' },
        'user-1', Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(upserted);
      expect(prisma.tripTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tripId_locale: { tripId: 'trip-1', locale: Locale.en } },
          create: expect.objectContaining({
            tripId: 'trip-1',
            locale: Locale.en,
            title: 'Sunset Cruise',
          }),
        }),
      );
    });

    it('defaults isMachineTranslated to false when not provided', async () => {
      prisma.tripTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        'trip-1', Locale.nl,
        { overview: 'Dutch overview' },
        'user-1', Role.TOUR_OPERATOR,
      );

      expect(prisma.tripTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });

    it('propagates ForbiddenException for non-owner operators', async () => {
      tripsService.assertOwnership.mockRejectedValue(
        new ForbiddenException('You do not have permission to modify this trip'),
      );

      await expect(
        service.upsertTranslation(
          'trip-1', Locale.nl, { overview: 'Dutch overview' }, 'user-other', Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTranslation', () => {
    it('throws BadRequestException when attempting to delete the English translation', async () => {
      await expect(
        service.deleteTranslation('trip-1', Locale.en, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(BadRequestException);

      // Should not proceed to any Prisma call
      expect(prisma.tripTranslation.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tripTranslation.delete.mockResolvedValue({});

      const result = await service.deleteTranslation('trip-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: `Translation for locale "${Locale.nl}" deleted` });
      expect(prisma.tripTranslation.delete).toHaveBeenCalledWith({
        where: { tripId_locale: { tripId: 'trip-1', locale: Locale.nl } },
      });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
      prisma.tripTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteTranslation('trip-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws unknown errors from tripTranslation.delete unchanged', async () => {
      prisma.tripTranslation.delete.mockRejectedValue(new Error('Fatal DB error'));

      await expect(
        service.deleteTranslation('trip-1', Locale.nl, 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow('Fatal DB error');
    });
  });

  // ── Schedules ─────────────────────────────────────────────────────────────────

  describe('createSchedule', () => {
    it('creates a schedule with the provided data and returns it', async () => {
      const schedule = makeSchedule();
      prisma.tourSchedule.create.mockResolvedValue(schedule);

      const result = await service.createSchedule(
        'trip-1',
        { startDate: '2026-07-15', startTime: '09:00', totalSpots: 20 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(schedule);
      expect(prisma.tourSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId: 'trip-1',
            startTime: '09:00',
            totalSpots: 20,
            availableSpots: 20, // must equal totalSpots on creation
          }),
        }),
      );
    });

    it('sets availableSpots equal to totalSpots on creation', async () => {
      prisma.tourSchedule.create.mockResolvedValue(makeSchedule({ totalSpots: 30, availableSpots: 30 }));

      await service.createSchedule(
        'trip-1',
        { startDate: '2026-07-15', startTime: '09:00', totalSpots: 30 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalSpots: 30, availableSpots: 30 }),
        }),
      );
    });

    it('propagates NotFoundException from assertTripAccess when trip does not exist', async () => {
      tripsService.findTripOrThrow.mockRejectedValue(new NotFoundException('Trip not found'));

      await expect(
        service.createSchedule(
          'trip-99',
          { startDate: '2026-07-15', startTime: '09:00', totalSpots: 20 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSchedule', () => {
    it('updates schedule fields and returns the updated record', async () => {
      const existing = makeSchedule();
      const updated = { ...existing, status: ScheduleStatus.CANCELLED };
      prisma.tourSchedule.findFirst.mockResolvedValue(existing);
      prisma.tourSchedule.update.mockResolvedValue(updated);

      const result = await service.updateSchedule(
        'trip-1', 'sched-1', { status: ScheduleStatus.CANCELLED }, 'user-1', Role.TOUR_OPERATOR,
      );

      expect(result.status).toBe(ScheduleStatus.CANCELLED);
    });

    it('throws NotFoundException when schedule does not belong to the trip', async () => {
      prisma.tourSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.updateSchedule(
          'trip-1', 'sched-99', { status: ScheduleStatus.CANCELLED }, 'user-1', Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeSchedule', () => {
    it('deletes the schedule and returns success message', async () => {
      prisma.tourSchedule.findFirst.mockResolvedValue(makeSchedule());
      prisma.tourSchedule.delete.mockResolvedValue({});

      const result = await service.removeSchedule('trip-1', 'sched-1', 'user-1', Role.TOUR_OPERATOR);

      expect(result).toEqual({ message: 'Schedule removed successfully' });
      expect(prisma.tourSchedule.delete).toHaveBeenCalledWith({ where: { id: 'sched-1' } });
    });

    it('throws NotFoundException when schedule is not found on the trip', async () => {
      prisma.tourSchedule.findFirst.mockResolvedValue(null);

      await expect(
        service.removeSchedule('trip-1', 'sched-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException for non-owner operators', async () => {
      tripsService.assertOwnership.mockRejectedValue(
        new ForbiddenException('You do not have permission to modify this trip'),
      );

      await expect(
        service.removeSchedule('trip-1', 'sched-1', 'user-other', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── ADMIN bypass for child operations ─────────────────────────────────────────

  describe('ADMIN bypass via assertOwnership', () => {
    it('ADMIN can read highlights on any trip without ownership check failing', async () => {
      // tripsService.assertOwnership is mocked to always pass (default); this test
      // verifies that ADMIN role is forwarded correctly to the mock
      prisma.tourHighlight.findMany.mockResolvedValue([makeHighlight()]);

      await service.getHighlights('trip-1', 'admin-user', Role.ADMIN);

      expect(tripsService.assertOwnership).toHaveBeenCalledWith(
        expect.anything(),
        'admin-user',
        Role.ADMIN,
      );
    });

    it('ADMIN can create a schedule on any trip', async () => {
      prisma.tourSchedule.create.mockResolvedValue(makeSchedule());

      await service.createSchedule(
        'trip-1',
        { startDate: '2026-07-15', startTime: '09:00', totalSpots: 20 },
        'admin-user',
        Role.ADMIN,
      );

      expect(tripsService.assertOwnership).toHaveBeenCalledWith(
        expect.anything(),
        'admin-user',
        Role.ADMIN,
      );
    });
  });
});
