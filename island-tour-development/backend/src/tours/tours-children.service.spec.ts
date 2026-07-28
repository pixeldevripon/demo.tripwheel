/**
 * Unit tests for TourChildrenService.
 *
 * PrismaService and ToursService are both fully mocked - no real database
 * connection is made and no slug / ownership logic is re-executed here.
 *
 * Strategy:
 *   - assertTourAccess (private) is exercised indirectly through every public
 *     method that calls it. We verify that ToursService.findTourOrThrow and
 *     ToursService.assertOwnership are delegated to, and that their errors
 *     propagate out of the child methods unchanged.
 *   - getSchedules has its own auth-aware visibility logic that is tested
 *     comprehensively: public view of LIVE tours, hidden non-LIVE tours for
 *     unauthenticated callers, owner-operator access, and ADMIN bypass.
 *   - All CRUD child methods are tested for: happy path, 404 on parent tour,
 *     403 on non-owner operator, 404 when the child resource itself is missing.
 *   - Translation delete guards (English locale) are tested for highlights,
 *     inclusions, and tour translations.
 *   - Conflict (P2002) and not-found (P2025) Prisma errors are tested where
 *     the service explicitly handles them.
 */

import { PrismaService } from '@/prisma/prisma.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { TranslationClearMarkService } from '@/content-translation/translation-clear-mark.service';
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
  Prisma,
  Role,
  TourStatus,
} from '@prisma/client';
import { TourChildrenService } from './tours-children.service';
import { ToursService } from './tours.service';

// ── Mock factories ─────────────────────────────────────────────────────────────

function createMockToursService() {
  return {
    findTourOrThrow: jest.fn(),
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
    tourAddOn: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tourAgeBand: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
    tourFeature: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    tourFeatureTranslation: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tourLocation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    tourLocationTranslation: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    pickupLocation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    pickupLocationTranslation: {
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tourTranslation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    tour: {
      findUnique: jest.fn(),
    },
    operator: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

// ── Data fixtures ─────────────────────────────────────────────────────────────

function makeTour(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tour-1',
    name: 'Sunset Catamaran Cruise',
    slug: 'sunset-catamaran-cruise',
    status: TourStatus.DRAFT,
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
    tourId: 'tour-1',
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

function makeHighlight(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'hl-1',
    tourId: 'tour-1',
    displayOrder: 0,
    imageUrl: null,
    translations: [
      { locale: 'en', text: 'Watch the sunset', isMachineTranslated: false },
    ],
    ...overrides,
  };
}

function makeInclusion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inc-1',
    tourId: 'tour-1',
    icon: 'check',
    displayOrder: 0,
    imageUrl: null,
    translations: [
      { locale: 'en', label: 'Open bar', isMachineTranslated: false },
    ],
    ...overrides,
  };
}

function makeExclusion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'excl-1',
    tourId: 'tour-1',
    icon: 'x',
    displayOrder: 0,
    imageUrl: null,
    translations: [
      {
        locale: 'en',
        label: 'Flights not included',
        isMachineTranslated: false,
      },
    ],
    ...overrides,
  };
}

function makeFeature(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'feat-1',
    tourId: 'tour-1',
    type: 'KNOW_BEFORE_YOU_GO',
    displayOrder: 0,
    translations: [
      { locale: 'en', text: 'Bring your voucher.', isMachineTranslated: false },
    ],
    ...overrides,
  };
}

function makeLocation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'loc-1',
    tourId: 'tour-1',
    types: ['START'],
    latitude: 12.1091,
    longitude: -68.9316,
    streetAddress: null,
    addressLocality: 'Willemstad',
    addressRegion: null,
    postalCode: null,
    addressCountry: 'CW',
    minutesTo: null,
    minutesAt: null,
    displayOrder: 0,
    translations: [
      {
        locale: 'en',
        title: 'Main dock',
        shortDescription: null,
        isMachineTranslated: false,
      },
    ],
    ...overrides,
  };
}

function makePickupLocation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'pickup-1',
    tourId: 'tour-1',
    name: 'Marriott Beach Resort',
    latitude: 12.1091,
    longitude: -68.9316,
    address: '12 Main St, Willemstad',
    minutesPrior: 30,
    windowStart: '07:45',
    windowEnd: '08:15',
    displayOrder: 0,
    isActive: true,
    translations: [
      {
        locale: 'en',
        title: 'Marriott Beach Resort',
        directions: null,
        isMachineTranslated: false,
      },
    ],
    ...overrides,
  };
}

function makeAddOn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'addon-1',
    tourId: 'tour-1',
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

function makeAgeBand(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'band-1',
    tourId: 'tour-1',
    label: 'Adult',
    minAge: 13,
    maxAge: null,
    price: '79.00',
    priceOriginal: null,
    priceNet: null,
    isDefault: true,
    displayOrder: 0,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TourChildrenService', () => {
  let service: TourChildrenService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let toursService: ReturnType<typeof createMockToursService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    toursService = createMockToursService();

    // Default: $transaction calls its callback with the same mock object
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );

    // Default: findTourOrThrow returns a DRAFT tour; assertOwnership passes
    toursService.findTourOrThrow.mockResolvedValue(makeTour());
    toursService.assertOwnership.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TourChildrenService,
        { provide: PrismaService, useValue: prisma },
        { provide: ToursService, useValue: toursService },
        {
          provide: ContentTranslationEnqueuer,
          useValue: { enqueue: jest.fn(), enqueueForPageType: jest.fn() },
        },
        {
          provide: TranslationClearMarkService,
          useValue: {
            mark: jest.fn().mockResolvedValue(undefined),
            markForPageType: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<TourChildrenService>(TourChildrenService);
    jest.clearAllMocks();

    // Re-apply defaults after clearAllMocks
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
    toursService.findTourOrThrow.mockResolvedValue(makeTour());
    toursService.assertOwnership.mockResolvedValue(undefined);
  });

  // ── assertTourAccess (tested indirectly) ──────────────────────────────────────

  describe('assertTourAccess (via all child methods)', () => {
    it('delegates to toursService.findTourOrThrow with the given tourId', async () => {
      prisma.tourImage.findMany.mockResolvedValue([]);

      await service.getImages('tour-1', 'user-1', Role.TOUR_OPERATOR);

      expect(toursService.findTourOrThrow).toHaveBeenCalledWith('tour-1');
    });

    it('delegates to toursService.assertOwnership with the resolved tour, requesterId, and role', async () => {
      const tour = makeTour();
      toursService.findTourOrThrow.mockResolvedValue(tour);
      prisma.tourImage.findMany.mockResolvedValue([]);

      await service.getImages('tour-1', 'user-1', Role.TOUR_OPERATOR);

      expect(toursService.assertOwnership).toHaveBeenCalledWith(
        tour,
        'user-1',
        Role.TOUR_OPERATOR,
      );
    });

    it('propagates NotFoundException from findTourOrThrow when tour does not exist', async () => {
      toursService.findTourOrThrow.mockRejectedValue(
        new NotFoundException('Tour tour-99 not found'),
      );

      await expect(
        service.getImages('tour-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from assertOwnership for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.getImages('tour-1', 'user-other', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns the tour from assertTourAccess on success', async () => {
      const tour = makeTour({ id: 'tour-abc' });
      toursService.findTourOrThrow.mockResolvedValue(tour);
      prisma.tourImage.findMany.mockResolvedValue([]);

      // The returned tour value is used internally; we verify findTourOrThrow was called
      await service.getImages('tour-abc', 'user-1', Role.TOUR_OPERATOR);

      expect(toursService.findTourOrThrow).toHaveBeenCalledWith('tour-abc');
    });
  });

  describe('getImages', () => {
    it('returns all images for the tour ordered by displayOrder', async () => {
      const images = [makeImage(), makeImage({ id: 'img-2', displayOrder: 1 })];
      prisma.tourImage.findMany.mockResolvedValue(images);

      const result = await service.getImages(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(images);
      expect(prisma.tourImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
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
        'tour-1',
        {
          url: 'https://example.com/img.jpg',
          isHero: false,
          width: 1920,
          height: 1080,
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(image);
      expect(prisma.tourImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tourId: 'tour-1', isHero: false }),
        }),
      );
    });

    it('clears previous hero images and sets isHero=true inside a transaction when isHero is true', async () => {
      const heroImage = makeImage({ isHero: true });
      prisma.tourImage.updateMany.mockResolvedValue({ count: 1 });
      prisma.tourImage.create.mockResolvedValue(heroImage);

      await service.addImage(
        'tour-1',
        {
          url: 'https://example.com/hero.jpg',
          isHero: true,
          width: 1920,
          height: 1080,
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourImage.updateMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        data: { isHero: false },
      });
      expect(prisma.tourImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isHero: true }),
        }),
      );
    });

    it('propagates NotFoundException from assertTourAccess when tour does not exist', async () => {
      toursService.findTourOrThrow.mockRejectedValue(
        new NotFoundException('Tour tour-99 not found'),
      );

      await expect(
        service.addImage(
          'tour-99',
          { url: 'https://example.com/img.jpg', width: 100, height: 100 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('defaults focalX and focalY to 0.5 when not provided', async () => {
      prisma.tourImage.create.mockResolvedValue(makeImage());

      await service.addImage(
        'tour-1',
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
        'tour-1',
        'img-1',
        { altText: 'Sunset view' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when image does not belong to the tour', async () => {
      prisma.tourImage.findFirst.mockResolvedValue(null);

      await expect(
        service.updateImage(
          'tour-1',
          'img-99',
          { altText: 'X' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('clears previous hero images and sets isHero=true in a transaction when isHero update is true', async () => {
      const existing = makeImage();
      const updated = { ...existing, isHero: true };
      prisma.tourImage.findFirst.mockResolvedValue(existing);
      prisma.tourImage.updateMany.mockResolvedValue({ count: 1 });
      prisma.tourImage.update.mockResolvedValue(updated);

      await service.updateImage(
        'tour-1',
        'img-1',
        { isHero: true },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourImage.updateMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        data: { isHero: false },
      });
    });
  });

  describe('removeImage', () => {
    it('deletes the image and returns success message', async () => {
      prisma.tourImage.findFirst.mockResolvedValue(makeImage());
      prisma.tourImage.delete.mockResolvedValue({});

      const result = await service.removeImage(
        'tour-1',
        'img-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Image removed successfully' });
      expect(prisma.tourImage.delete).toHaveBeenCalledWith({
        where: { id: 'img-1' },
      });
    });

    it('throws NotFoundException when image is not found on the tour', async () => {
      prisma.tourImage.findFirst.mockResolvedValue(null);

      await expect(
        service.removeImage('tour-1', 'img-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Age Bands ─────────────────────────────────────────────────────────────────

  describe('getAddOns', () => {
    it('returns all add-ons ordered by displayOrder', async () => {
      const addOns = [makeAddOn()];
      prisma.tourAddOn.findMany.mockResolvedValue(addOns);

      const result = await service.getAddOns(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(addOns);
      expect(prisma.tourAddOn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
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
        'tour-1',
        { name: 'Hotel pickup', price: '15.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(addOn);
      expect(prisma.tourAddOn.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tourId: 'tour-1',
            name: 'Hotel pickup',
            price: '15.00',
          }),
        }),
      );
    });

    it('defaults unit to PER_PERSON when not provided', async () => {
      prisma.tourAddOn.create.mockResolvedValue(makeAddOn());

      await service.addAddOn(
        'tour-1',
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
        'tour-1',
        'addon-1',
        { name: 'Airport transfer' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result.name).toBe('Airport transfer');
    });

    it('throws NotFoundException when add-on does not belong to the tour', async () => {
      prisma.tourAddOn.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAddOn(
          'tour-1',
          'addon-99',
          { name: 'X' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeAddOn', () => {
    it('deletes the add-on and returns success message', async () => {
      prisma.tourAddOn.findFirst.mockResolvedValue(makeAddOn());
      prisma.tourAddOn.delete.mockResolvedValue({});

      const result = await service.removeAddOn(
        'tour-1',
        'addon-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Add-on removed successfully' });
      expect(prisma.tourAddOn.delete).toHaveBeenCalledWith({
        where: { id: 'addon-1' },
      });
    });

    it('throws NotFoundException when add-on does not exist on the tour', async () => {
      prisma.tourAddOn.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAddOn('tour-1', 'addon-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Age Bands ─────────────────────────────────────────────────────────────────

  describe('getAgeBands', () => {
    it('returns age bands ordered by default first, then displayOrder', async () => {
      const bands = [makeAgeBand()];
      prisma.tourAgeBand.findMany.mockResolvedValue(bands);

      const result = await service.getAgeBands(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(bands);
      expect(prisma.tourAgeBand.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
          orderBy: [{ isDefault: 'desc' }, { displayOrder: 'asc' }],
        }),
      );
    });
  });

  describe('addAgeBand', () => {
    it('creates a band and recomputes priceFrom inside the transaction', async () => {
      const band = makeAgeBand({ isDefault: false });
      prisma.tourAgeBand.create.mockResolvedValue(band);

      const result = await service.addAgeBand(
        'tour-1',
        { bandType: AgeBandType.ADULT, label: 'Adult', price: '79.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(band);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourAgeBand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tourId: 'tour-1', label: 'Adult' }),
        }),
      );
      expect(toursService.recomputePriceFrom).toHaveBeenCalledWith(
        'tour-1',
        prisma,
      );
    });

    it('clears other default bands when the new band is the default', async () => {
      prisma.tourAgeBand.create.mockResolvedValue(makeAgeBand());
      prisma.tourAgeBand.updateMany.mockResolvedValue({ count: 1 });

      await service.addAgeBand(
        'tour-1',
        {
          bandType: AgeBandType.ADULT,
          label: 'Adult',
          price: '79.00',
          isDefault: true,
        },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourAgeBand.updateMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        data: { isDefault: false },
      });
    });

    it('rejects an age range where maxAge is below minAge', async () => {
      await expect(
        service.addAgeBand(
          'tour-1',
          {
            bandType: AgeBandType.CHILD,
            label: 'Child',
            price: '40.00',
            minAge: 12,
            maxAge: 4,
          },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tourAgeBand.create).not.toHaveBeenCalled();
    });

    // Age bands are a PER_PERSON pricing construct - UNIT (whole-unit/charter)
    // tours use a single guests count + extra-person surcharge instead.
    it('rejects adding an age band to a UNIT-priced tour', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        pricingModel: PricingModel.UNIT,
      });

      await expect(
        service.addAgeBand(
          'tour-1',
          { bandType: AgeBandType.ADULT, label: 'Adult', price: '79.00' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toMatchObject({
        response: {
          message: expect.stringMatching(
            /Unit-priced tours use a single guests count/i,
          ),
        },
      });
      expect(prisma.tourAgeBand.create).not.toHaveBeenCalled();
    });

    it('allows adding an age band to a PER_PERSON-priced tour', async () => {
      prisma.tour.findUnique.mockResolvedValue({
        pricingModel: PricingModel.PER_PERSON,
      });
      const band = makeAgeBand({ isDefault: false });
      prisma.tourAgeBand.create.mockResolvedValue(band);

      const result = await service.addAgeBand(
        'tour-1',
        { bandType: AgeBandType.ADULT, label: 'Adult', price: '79.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(band);
      expect(prisma.tourAgeBand.create).toHaveBeenCalled();
    });
  });

  describe('updateAgeBand', () => {
    it('updates fields and recomputes priceFrom', async () => {
      const existing = makeAgeBand();
      const updated = { ...existing, price: '85.00' };
      prisma.tourAgeBand.findFirst.mockResolvedValue(existing);
      prisma.tourAgeBand.update.mockResolvedValue(updated);

      const result = await service.updateAgeBand(
        'tour-1',
        'band-1',
        { price: '85.00' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(updated);
      expect(toursService.recomputePriceFrom).toHaveBeenCalledWith(
        'tour-1',
        prisma,
      );
    });

    it('throws NotFoundException when the band does not belong to the tour', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);

      await expect(
        service.updateAgeBand(
          'tour-1',
          'band-99',
          { price: '85.00' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates the resulting range against the stored bound when one side is omitted', async () => {
      // Stored minAge=13; incoming maxAge=4 → invalid range.
      prisma.tourAgeBand.findFirst.mockResolvedValue(
        makeAgeBand({ minAge: 13, maxAge: null }),
      );

      await expect(
        service.updateAgeBand(
          'tour-1',
          'band-1',
          { maxAge: 4 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('clears other defaults when isDefault is set to true', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(
        makeAgeBand({ isDefault: false }),
      );
      prisma.tourAgeBand.update.mockResolvedValue(makeAgeBand());
      prisma.tourAgeBand.updateMany.mockResolvedValue({ count: 1 });

      await service.updateAgeBand(
        'tour-1',
        'band-1',
        { isDefault: true },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourAgeBand.updateMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        data: { isDefault: false },
      });
    });
  });

  describe('removeAgeBand', () => {
    it('deletes the band, recomputes priceFrom, and returns a success message', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(makeAgeBand());
      prisma.tourAgeBand.delete.mockResolvedValue({});

      const result = await service.removeAgeBand(
        'tour-1',
        'band-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Age band removed successfully' });
      expect(prisma.tourAgeBand.delete).toHaveBeenCalledWith({
        where: { id: 'band-1' },
      });
      expect(toursService.recomputePriceFrom).toHaveBeenCalledWith(
        'tour-1',
        prisma,
      );
    });

    it('throws NotFoundException when the band does not exist on the tour', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAgeBand(
          'tour-1',
          'band-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when the band is referenced by a booking (FK restrict)', async () => {
      prisma.tourAgeBand.findFirst.mockResolvedValue(makeAgeBand());
      prisma.tourAgeBand.delete.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.removeAgeBand('tour-1', 'band-1', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── Languages ─────────────────────────────────────────────────────────────────

  describe('getLanguages', () => {
    it('returns all languages for the tour ordered alphabetically', async () => {
      const langs = [{ id: 'lang-1', tourId: 'tour-1', language: 'en' }];
      prisma.tourLanguage.findMany.mockResolvedValue(langs);

      const result = await service.getLanguages(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(langs);
      expect(prisma.tourLanguage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
          orderBy: { language: 'asc' },
        }),
      );
    });
  });

  describe('addLanguage', () => {
    it('creates a language record and returns it', async () => {
      const lang = { id: 'lang-1', tourId: 'tour-1', language: 'nl' };
      prisma.tourLanguage.create.mockResolvedValue(lang);

      const result = await service.addLanguage(
        'tour-1',
        { language: 'nl' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(lang);
      expect(prisma.tourLanguage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { tourId: 'tour-1', language: 'nl' },
        }),
      );
    });

    it('throws ConflictException when language already exists on the tour (P2002)', async () => {
      const p2002 = Object.assign(new Error('Unique constraint violation'), {
        code: 'P2002',
      });
      prisma.tourLanguage.create.mockRejectedValue(p2002);

      await expect(
        service.addLanguage(
          'tour-1',
          { language: 'nl' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws unknown errors from tourLanguage.create unchanged', async () => {
      prisma.tourLanguage.create.mockRejectedValue(new Error('DB timeout'));

      await expect(
        service.addLanguage(
          'tour-1',
          { language: 'nl' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow('DB timeout');
    });
  });

  describe('removeLanguage', () => {
    it('deletes the language and returns success message', async () => {
      prisma.tourLanguage.findFirst.mockResolvedValue({
        id: 'lang-1',
        language: 'nl',
      });
      prisma.tourLanguage.delete.mockResolvedValue({});

      const result = await service.removeLanguage(
        'tour-1',
        'lang-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Language removed successfully' });
      expect(prisma.tourLanguage.delete).toHaveBeenCalledWith({
        where: { id: 'lang-1' },
      });
    });

    it('throws NotFoundException when language is not found on the tour', async () => {
      prisma.tourLanguage.findFirst.mockResolvedValue(null);

      await expect(
        service.removeLanguage(
          'tour-1',
          'lang-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Highlights ────────────────────────────────────────────────────────────────

  describe('getHighlights', () => {
    it('returns all highlights with translations ordered by displayOrder', async () => {
      const highlights = [makeHighlight()];
      prisma.tourHighlight.findMany.mockResolvedValue(highlights);

      const result = await service.getHighlights(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(highlights);
      expect(prisma.tourHighlight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });
  });

  describe('addHighlight', () => {
    it('creates a highlight with English translation inside a transaction and returns it', async () => {
      const highlight = makeHighlight();
      prisma.tourHighlight.create.mockResolvedValue({
        id: 'hl-1',
        tourId: 'tour-1',
        displayOrder: 0,
        imageUrl: null,
      });
      prisma.tourHighlightTranslation.create.mockResolvedValue({});
      prisma.tourHighlight.findUnique.mockResolvedValue(highlight);

      const result = await service.addHighlight(
        'tour-1',
        { text: 'Watch the sunset', displayOrder: 0 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourHighlight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tourId: 'tour-1' }),
        }),
      );
      expect(prisma.tourHighlightTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text: 'Watch the sunset',
            locale: 'en',
          }),
        }),
      );
      expect(result).toEqual(highlight);
    });

    it('propagates NotFoundException when tour does not exist', async () => {
      toursService.findTourOrThrow.mockRejectedValue(
        new NotFoundException('Tour not found'),
      );

      await expect(
        service.addHighlight(
          'tour-99',
          { text: 'Some highlight text here' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
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
        'tour-1',
        'hl-1',
        { displayOrder: 2 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result.displayOrder).toBe(2);
    });

    it('throws NotFoundException when highlight does not belong to the tour', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.updateHighlight(
          'tour-1',
          'hl-99',
          { displayOrder: 1 },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeHighlight', () => {
    it('deletes the highlight and returns success message', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(makeHighlight());
      prisma.tourHighlight.delete.mockResolvedValue({});

      const result = await service.removeHighlight(
        'tour-1',
        'hl-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Highlight removed successfully' });
      expect(prisma.tourHighlight.delete).toHaveBeenCalledWith({
        where: { id: 'hl-1' },
      });
    });

    it('throws NotFoundException when highlight is not found on the tour', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.removeHighlight(
          'tour-1',
          'hl-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertHighlightTranslation', () => {
    it('upserts the translation and returns it', async () => {
      const highlight = { id: 'hl-1' };
      const translation = {
        locale: Locale.nl,
        text: 'Zie de zonsondergang',
        isMachineTranslated: false,
      };
      prisma.tourHighlight.findFirst.mockResolvedValue(highlight);
      prisma.tourHighlightTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertHighlightTranslation(
        'tour-1',
        'hl-1',
        Locale.nl,
        { text: 'Zie de zonsondergang' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translation);
      expect(prisma.tourHighlightTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            highlightId_locale: { highlightId: 'hl-1', locale: Locale.nl },
          },
          create: expect.objectContaining({
            text: 'Zie de zonsondergang',
            locale: Locale.nl,
          }),
          update: expect.objectContaining({ text: 'Zie de zonsondergang' }),
        }),
      );
    });

    it('throws NotFoundException when highlight does not belong to the tour', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertHighlightTranslation(
          'tour-1',
          'hl-99',
          Locale.nl,
          { text: 'Some text here for translation' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('defaults isMachineTranslated to false when not provided', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue({ id: 'hl-1' });
      prisma.tourHighlightTranslation.upsert.mockResolvedValue({});

      await service.upsertHighlightTranslation(
        'tour-1',
        'hl-1',
        Locale.nl,
        { text: 'Some text here for translation' },
        'user-1',
        Role.TOUR_OPERATOR,
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
        service.deleteHighlightTranslation(
          'tour-1',
          'hl-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue({ id: 'hl-1' });
      prisma.tourHighlightTranslation.delete.mockResolvedValue({});

      const result = await service.deleteHighlightTranslation(
        'tour-1',
        'hl-1',
        Locale.nl,
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({
        message: `Translation for locale "${Locale.nl}" deleted`,
      });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue({ id: 'hl-1' });
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.tourHighlightTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteHighlightTranslation(
          'tour-1',
          'hl-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when highlight does not belong to the tour', async () => {
      prisma.tourHighlight.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteHighlightTranslation(
          'tour-1',
          'hl-99',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Inclusions ────────────────────────────────────────────────────────────────

  describe('getInclusions', () => {
    it('returns all inclusions ordered by displayOrder', async () => {
      const inclusions = [makeInclusion()];
      prisma.tourInclusion.findMany.mockResolvedValue(inclusions);

      const result = await service.getInclusions(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(inclusions);
      expect(prisma.tourInclusion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
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
        'tour-1',
        { label: 'Open bar', icon: 'check' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourInclusion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tourId: 'tour-1' }),
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

      await service.addInclusion(
        'tour-1',
        { label: 'Open bar' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

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
        'tour-1',
        'inc-1',
        { icon: 'drink' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result.icon).toBe('drink');
    });

    it('throws NotFoundException when inclusion does not belong to the tour', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInclusion(
          'tour-1',
          'inc-99',
          { icon: 'drink' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeInclusion', () => {
    it('deletes the inclusion and returns success message', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(makeInclusion());
      prisma.tourInclusion.delete.mockResolvedValue({});

      const result = await service.removeInclusion(
        'tour-1',
        'inc-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Inclusion removed successfully' });
      expect(prisma.tourInclusion.delete).toHaveBeenCalledWith({
        where: { id: 'inc-1' },
      });
    });

    it('throws NotFoundException when inclusion is not found on the tour', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.removeInclusion(
          'tour-1',
          'inc-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertInclusionTranslation', () => {
    it('upserts the label translation and returns it', async () => {
      const inclusion = { id: 'inc-1' };
      const translation = {
        locale: Locale.nl,
        label: 'Open bar NL',
        isMachineTranslated: false,
      };
      prisma.tourInclusion.findFirst.mockResolvedValue(inclusion);
      prisma.tourInclusionTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertInclusionTranslation(
        'tour-1',
        'inc-1',
        Locale.nl,
        { label: 'Open bar NL' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translation);
      expect(prisma.tourInclusionTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            inclusionId_locale: { inclusionId: 'inc-1', locale: Locale.nl },
          },
        }),
      );
    });

    it('throws NotFoundException when inclusion does not belong to the tour', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertInclusionTranslation(
          'tour-1',
          'inc-99',
          Locale.nl,
          { label: 'Some label' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteInclusionTranslation', () => {
    it('throws BadRequestException when attempting to delete the English label', async () => {
      await expect(
        service.deleteInclusionTranslation(
          'tour-1',
          'inc-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue({ id: 'inc-1' });
      prisma.tourInclusionTranslation.delete.mockResolvedValue({});

      const result = await service.deleteInclusionTranslation(
        'tour-1',
        'inc-1',
        Locale.nl,
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({
        message: `Translation for locale "${Locale.nl}" deleted`,
      });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      prisma.tourInclusion.findFirst.mockResolvedValue({ id: 'inc-1' });
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.tourInclusionTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteInclusionTranslation(
          'tour-1',
          'inc-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Tour Translations ─────────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('returns all translation rows ordered by locale', async () => {
      const translations = [
        {
          locale: Locale.en,
          title: null,
          overview: 'Overview',
          description: null,
          isMachineTranslated: false,
          updatedAt: new Date(),
        },
        {
          locale: Locale.nl,
          title: null,
          overview: 'Overzicht',
          description: null,
          isMachineTranslated: true,
          updatedAt: new Date(),
        },
      ];
      prisma.tourTranslation.findMany.mockResolvedValue(translations);

      const result = await service.getAllTranslations(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translations);
      expect(prisma.tourTranslation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
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
      prisma.tourTranslation.findUnique.mockResolvedValue(translation);

      const result = await service.getTranslationByLocale(
        'tour-1',
        Locale.nl,
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translation);
    });

    it('returns a null-filled placeholder when no translation row exists for that locale', async () => {
      prisma.tourTranslation.findUnique.mockResolvedValue(null);

      const result = await service.getTranslationByLocale(
        'tour-1',
        Locale.nl,
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({
        locale: Locale.nl,
        title: null,
        overview: null,
        description: null,
        shortDescription: null,
        whatToBring: [],
        knowBeforeYouGo: [],
        notSuitableFor: [],
        whatToExpectIntro: null,
        categoryDisplay: null,
        localTipTitle: null,
        localTipBody: null,
        operatorNote: null,
        meetingPointText: null,
        metaTitle: null,
        metaDescription: null,
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
      prisma.tourTranslation.upsert.mockResolvedValue(upserted);

      const result = await service.upsertTranslation(
        'tour-1',
        Locale.en,
        { title: 'Sunset Cruise', overview: 'A beautiful cruise.' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(upserted);
      expect(prisma.tourTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId_locale: { tourId: 'tour-1', locale: Locale.en } },
          create: expect.objectContaining({
            tourId: 'tour-1',
            locale: Locale.en,
            title: 'Sunset Cruise',
          }),
        }),
      );
    });

    it('defaults isMachineTranslated to false when not provided', async () => {
      prisma.tourTranslation.upsert.mockResolvedValue({});

      await service.upsertTranslation(
        'tour-1',
        Locale.nl,
        { overview: 'Dutch overview' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });

    it('propagates ForbiddenException for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.upsertTranslation(
          'tour-1',
          Locale.nl,
          { overview: 'Dutch overview' },
          'user-other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTranslation', () => {
    it('throws BadRequestException when attempting to delete the English translation', async () => {
      await expect(
        service.deleteTranslation(
          'tour-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);

      // Should not proceed to any Prisma call
      expect(prisma.tourTranslation.delete).not.toHaveBeenCalled();
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tourTranslation.delete.mockResolvedValue({});

      const result = await service.deleteTranslation(
        'tour-1',
        Locale.nl,
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({
        message: `Translation for locale "${Locale.nl}" deleted`,
      });
      expect(prisma.tourTranslation.delete).toHaveBeenCalledWith({
        where: { tourId_locale: { tourId: 'tour-1', locale: Locale.nl } },
      });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.tourTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteTranslation(
          'tour-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws unknown errors from tourTranslation.delete unchanged', async () => {
      prisma.tourTranslation.delete.mockRejectedValue(
        new Error('Fatal DB error'),
      );

      await expect(
        service.deleteTranslation(
          'tour-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow('Fatal DB error');
    });
  });

  // ── Schedules ─────────────────────────────────────────────────────────────────

  describe('getExclusions', () => {
    it('calls assertTourAccess then returns all exclusions ordered by displayOrder', async () => {
      const exclusions = [makeExclusion()];
      prisma.tourExclusion.findMany.mockResolvedValue(exclusions);

      const result = await service.getExclusions(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(exclusions);
      expect(toursService.findTourOrThrow).toHaveBeenCalledWith('tour-1');
      expect(prisma.tourExclusion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId: 'tour-1' },
          orderBy: { displayOrder: 'asc' },
        }),
      );
    });

    it('propagates NotFoundException from assertTourAccess when tour does not exist', async () => {
      toursService.findTourOrThrow.mockRejectedValue(
        new NotFoundException('Tour not found'),
      );

      await expect(
        service.getExclusions('tour-99', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from assertTourAccess for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.getExclusions('tour-1', 'user-other', Role.TOUR_OPERATOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addExclusion', () => {
    it('creates an exclusion with English label inside a transaction and returns it', async () => {
      const exclusion = makeExclusion();
      prisma.tourExclusion.create.mockResolvedValue({ id: 'excl-1' });
      prisma.tourExclusionTranslation.create.mockResolvedValue({});
      prisma.tourExclusion.findUnique.mockResolvedValue(exclusion);

      const result = await service.addExclusion(
        'tour-1',
        { label: 'Flights not included', icon: 'x' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.tourExclusion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tourId: 'tour-1' }),
        }),
      );
      expect(prisma.tourExclusionTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            label: 'Flights not included',
            locale: 'en',
          }),
        }),
      );
      expect(result).toEqual(exclusion);
    });

    it('defaults icon to "x" when not provided', async () => {
      prisma.tourExclusion.create.mockResolvedValue({ id: 'excl-1' });
      prisma.tourExclusionTranslation.create.mockResolvedValue({});
      prisma.tourExclusion.findUnique.mockResolvedValue(makeExclusion());

      await service.addExclusion(
        'tour-1',
        { label: 'Flights not included' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourExclusion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icon: 'x' }),
        }),
      );
    });

    it('propagates NotFoundException when tour does not exist', async () => {
      toursService.findTourOrThrow.mockRejectedValue(
        new NotFoundException('Tour not found'),
      );

      await expect(
        service.addExclusion(
          'tour-99',
          { label: 'Flights not included' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.addExclusion(
          'tour-1',
          { label: 'Flights not included' },
          'user-other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateExclusion', () => {
    it('updates exclusion fields and returns the updated record', async () => {
      const existing = makeExclusion();
      const updated = { ...existing, icon: 'circle-x', displayOrder: 2 };
      prisma.tourExclusion.findFirst.mockResolvedValue(existing);
      prisma.tourExclusion.update.mockResolvedValue(updated);

      const result = await service.updateExclusion(
        'tour-1',
        'excl-1',
        { icon: 'circle-x', displayOrder: 2 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result.icon).toBe('circle-x');
      expect(result.displayOrder).toBe(2);
      expect(prisma.tourExclusion.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'excl-1' } }),
      );
    });

    it('throws NotFoundException when exclusion does not belong to the tour', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.updateExclusion(
          'tour-1',
          'excl-99',
          { icon: 'x' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from assertTourAccess for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.updateExclusion(
          'tour-1',
          'excl-1',
          { icon: 'x' },
          'user-other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeExclusion', () => {
    it('deletes the exclusion and returns success message', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue(makeExclusion());
      prisma.tourExclusion.delete.mockResolvedValue({});

      const result = await service.removeExclusion(
        'tour-1',
        'excl-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({ message: 'Exclusion removed successfully' });
      expect(prisma.tourExclusion.delete).toHaveBeenCalledWith({
        where: { id: 'excl-1' },
      });
    });

    it('throws NotFoundException when exclusion is not found on the tour', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.removeExclusion(
          'tour-1',
          'excl-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.removeExclusion(
          'tour-1',
          'excl-1',
          'user-other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('upsertExclusionTranslation', () => {
    it('upserts the label translation and returns it', async () => {
      const exclusion = { id: 'excl-1' };
      const translation = {
        locale: Locale.nl,
        label: 'Vluchten niet inbegrepen',
        isMachineTranslated: false,
      };
      prisma.tourExclusion.findFirst.mockResolvedValue(exclusion);
      prisma.tourExclusionTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertExclusionTranslation(
        'tour-1',
        'excl-1',
        Locale.nl,
        { label: 'Vluchten niet inbegrepen' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual(translation);
      expect(prisma.tourExclusionTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            exclusionId_locale: { exclusionId: 'excl-1', locale: Locale.nl },
          },
          create: expect.objectContaining({
            label: 'Vluchten niet inbegrepen',
            locale: Locale.nl,
          }),
          update: expect.objectContaining({
            label: 'Vluchten niet inbegrepen',
          }),
        }),
      );
    });

    it('defaults isMachineTranslated to false when not provided', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue({ id: 'excl-1' });
      prisma.tourExclusionTranslation.upsert.mockResolvedValue({});

      await service.upsertExclusionTranslation(
        'tour-1',
        'excl-1',
        Locale.nl,
        { label: 'Vluchten niet inbegrepen' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourExclusionTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });

    it('throws NotFoundException when exclusion does not belong to the tour', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.upsertExclusionTranslation(
          'tour-1',
          'excl-99',
          Locale.nl,
          { label: 'Some label' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates ForbiddenException from assertTourAccess for non-owner operators', async () => {
      toursService.assertOwnership.mockRejectedValue(
        new ForbiddenException(
          'You do not have permission to modify this tour',
        ),
      );

      await expect(
        service.upsertExclusionTranslation(
          'tour-1',
          'excl-1',
          Locale.nl,
          { label: 'Some label' },
          'user-other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteExclusionTranslation', () => {
    it('throws BadRequestException when attempting to delete the English translation', async () => {
      await expect(
        service.deleteExclusionTranslation(
          'tour-1',
          'excl-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);

      // Should not proceed to any Prisma call for the exclusion lookup
      expect(prisma.tourExclusion.findFirst).not.toHaveBeenCalled();
    });

    it('deletes a non-English translation and returns success message', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue({ id: 'excl-1' });
      prisma.tourExclusionTranslation.delete.mockResolvedValue({});

      const result = await service.deleteExclusionTranslation(
        'tour-1',
        'excl-1',
        Locale.nl,
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(result).toEqual({
        message: `Translation for locale "${Locale.nl}" deleted`,
      });
      expect(prisma.tourExclusionTranslation.delete).toHaveBeenCalledWith({
        where: {
          exclusionId_locale: { exclusionId: 'excl-1', locale: Locale.nl },
        },
      });
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue({ id: 'excl-1' });
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.tourExclusionTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteExclusionTranslation(
          'tour-1',
          'excl-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when exclusion does not belong to the tour', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteExclusionTranslation(
          'tour-1',
          'excl-99',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-throws unknown errors from tourExclusionTranslation.delete unchanged', async () => {
      prisma.tourExclusion.findFirst.mockResolvedValue({ id: 'excl-1' });
      prisma.tourExclusionTranslation.delete.mockRejectedValue(
        new Error('DB timeout'),
      );

      await expect(
        service.deleteExclusionTranslation(
          'tour-1',
          'excl-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow('DB timeout');
    });
  });

  // ── ADMIN bypass for child operations ─────────────────────────────────────────

  describe('ADMIN bypass via assertOwnership', () => {
    it('ADMIN can read inclusions on any tour without ownership check failing', async () => {
      // toursService.assertOwnership is mocked to always pass (default); this test
      // verifies that ADMIN role is forwarded correctly to the mock
      prisma.tourInclusion.findMany.mockResolvedValue([makeInclusion()]);

      await service.getInclusions('tour-1', 'admin-user', Role.ADMIN);

      expect(toursService.assertOwnership).toHaveBeenCalledWith(
        expect.anything(),
        'admin-user',
        Role.ADMIN,
      );
    });
  });

  // ── Features ──────────────────────────────────────────────────────────────────

  describe('getFeatures', () => {
    it('returns features ordered by type then displayOrder', async () => {
      const feat = makeFeature();
      prisma.tourFeature.findMany.mockResolvedValue([feat]);

      const result = await service.getFeatures(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourFeature.findMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        select: expect.objectContaining({
          id: true,
          type: true,
          translations: expect.anything(),
        }),
        orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
      });
      expect(result).toEqual([feat]);
    });

    it('propagates NotFoundException from assertTourAccess', async () => {
      toursService.findTourOrThrow.mockRejectedValue(new NotFoundException());

      await expect(
        service.getFeatures('bad-tour', 'user-1', Role.TOUR_OPERATOR),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addFeature', () => {
    it('creates a feature with an EN translation in a transaction', async () => {
      const feat = makeFeature();
      prisma.tourFeature.create.mockResolvedValue({ id: 'feat-1' });
      prisma.tourFeatureTranslation.create.mockResolvedValue({});
      prisma.tourFeature.findUnique.mockResolvedValue(feat);

      const result = await service.addFeature(
        'tour-1',
        { type: 'KNOW_BEFORE_YOU_GO' as any, text: 'Bring your voucher.' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourFeature.create).toHaveBeenCalled();
      expect(prisma.tourFeatureTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locale: 'en',
            text: 'Bring your voucher.',
          }),
        }),
      );
      expect(result).toEqual(feat);
    });

    it('propagates ForbiddenException from assertTourAccess', async () => {
      toursService.assertOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.addFeature(
          'tour-1',
          { type: 'KNOW_BEFORE_YOU_GO' as any, text: 'x' },
          'other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateFeature', () => {
    it('updates type and displayOrder on an existing feature', async () => {
      const updated = makeFeature({ displayOrder: 1 });
      prisma.tourFeature.findFirst.mockResolvedValue({ id: 'feat-1' });
      prisma.tourFeature.update.mockResolvedValue(updated);

      const result = await service.updateFeature(
        'tour-1',
        'feat-1',
        { displayOrder: 1 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourFeature.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'feat-1' } }),
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when feature does not belong to the tour', async () => {
      prisma.tourFeature.findFirst.mockResolvedValue(null);

      await expect(
        service.updateFeature(
          'tour-1',
          'feat-99',
          {},
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeFeature', () => {
    it('deletes a feature and returns a success message', async () => {
      prisma.tourFeature.findFirst.mockResolvedValue({ id: 'feat-1' });
      prisma.tourFeature.delete.mockResolvedValue({});

      const result = await service.removeFeature(
        'tour-1',
        'feat-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourFeature.delete).toHaveBeenCalledWith({
        where: { id: 'feat-1' },
      });
      expect(result).toEqual({ message: 'Feature removed successfully' });
    });

    it('throws NotFoundException when feature is not found', async () => {
      prisma.tourFeature.findFirst.mockResolvedValue(null);

      await expect(
        service.removeFeature(
          'tour-1',
          'feat-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertFeatureTranslation', () => {
    it('upserts a translation for a non-EN locale', async () => {
      prisma.tourFeature.findFirst.mockResolvedValue({ id: 'feat-1' });
      const translation = {
        locale: Locale.nl,
        text: 'Breng uw voucher.',
        isMachineTranslated: false,
      };
      prisma.tourFeatureTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertFeatureTranslation(
        'tour-1',
        'feat-1',
        Locale.nl,
        { text: 'Breng uw voucher.' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourFeatureTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            featureId_locale: { featureId: 'feat-1', locale: Locale.nl },
          },
        }),
      );
      expect(result).toEqual(translation);
    });
  });

  describe('deleteFeatureTranslation', () => {
    it('throws BadRequestException when deleting the EN translation', async () => {
      await expect(
        service.deleteFeatureTranslation(
          'tour-1',
          'feat-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when translation row does not exist (P2025)', async () => {
      prisma.tourFeature.findFirst.mockResolvedValue({ id: 'feat-1' });
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.tourFeatureTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteFeatureTranslation(
          'tour-1',
          'feat-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Locations ─────────────────────────────────────────────────────────────────

  describe('getLocations', () => {
    it('returns locations ordered by displayOrder', async () => {
      const loc = makeLocation();
      prisma.tourLocation.findMany.mockResolvedValue([loc]);

      const result = await service.getLocations(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocation.findMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        select: expect.objectContaining({
          id: true,
          types: true,
          translations: expect.anything(),
        }),
        orderBy: { displayOrder: 'asc' },
      });
      expect(result).toEqual([loc]);
    });
  });

  describe('addLocation', () => {
    it('creates a location with an EN translation in a transaction', async () => {
      const loc = makeLocation();
      prisma.tourLocation.create.mockResolvedValue({ id: 'loc-1' });
      prisma.tourLocationTranslation.create.mockResolvedValue({});
      prisma.tourLocation.findUnique.mockResolvedValue(loc);

      const result = await service.addLocation(
        'tour-1',
        { types: ['START'], title: 'Main dock' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocation.create).toHaveBeenCalled();
      expect(prisma.tourLocationTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ locale: 'en', title: 'Main dock' }),
        }),
      );
      expect(result).toEqual(loc);
    });

    it('propagates ForbiddenException from assertTourAccess', async () => {
      toursService.assertOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.addLocation(
          'tour-1',
          { types: ['START'], title: 'x' },
          'other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateLocation', () => {
    it('updates geo fields on an existing location', async () => {
      const updated = makeLocation({ latitude: 12.5, longitude: -69.0 });
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      prisma.tourLocation.update.mockResolvedValue(updated);

      const result = await service.updateLocation(
        'tour-1',
        'loc-1',
        { latitude: 12.5, longitude: -69.0 },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'loc-1' } }),
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when location does not belong to the tour', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLocation(
          'tour-1',
          'loc-99',
          {},
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeLocation', () => {
    it('deletes a location and returns a success message', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      prisma.tourLocation.delete.mockResolvedValue({});

      const result = await service.removeLocation(
        'tour-1',
        'loc-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocation.delete).toHaveBeenCalledWith({
        where: { id: 'loc-1' },
      });
      expect(result).toEqual({ message: 'Location removed successfully' });
    });

    it('throws NotFoundException when location is not found', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.removeLocation(
          'tour-1',
          'loc-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertLocationTranslation', () => {
    it('upserts a title translation for a non-EN locale', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      const translation = {
        locale: Locale.nl,
        title: 'Hoofdkade',
        shortDescription: null,
        isMachineTranslated: false,
      };
      prisma.tourLocationTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertLocationTranslation(
        'tour-1',
        'loc-1',
        Locale.nl,
        { title: 'Hoofdkade' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocationTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            locationId_locale: { locationId: 'loc-1', locale: Locale.nl },
          },
        }),
      );
      expect(result).toEqual(translation);
    });
  });

  describe('upsertLocationTranslation - per-field clears', () => {
    it('clears ONLY the short description, keeping the title', async () => {
      // The bug this covers: clearing one field used to delete the whole row,
      // so emptying an itinerary stop's description also wiped its title.
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      prisma.tourLocationTranslation.upsert.mockResolvedValue({});

      await service.upsertLocationTranslation(
        'tour-1',
        'loc-1',
        Locale.nl,
        { title: 'Hoofdkade', shortDescription: '  ' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocationTranslation.delete).not.toHaveBeenCalled();
      expect(prisma.tourLocationTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            title: 'Hoofdkade',
            shortDescription: '',
          }),
        }),
      );
    });

    it('clears the title too - the row still survives to hold the pair', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      prisma.tourLocationTranslation.upsert.mockResolvedValue({});

      await service.upsertLocationTranslation(
        'tour-1',
        'loc-1',
        Locale.nl,
        { title: '', shortDescription: 'Blijft staan.' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.tourLocationTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            title: '',
            shortDescription: 'Blijft staan.',
          }),
        }),
      );
    });

    it('refuses to blank the English title - it is the source', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });

      await expect(
        service.upsertLocationTranslation(
          'tour-1',
          'loc-1',
          Locale.en,
          { title: '' },
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.tourLocationTranslation.upsert).not.toHaveBeenCalled();
    });
  });

  describe('deleteLocationTranslation', () => {
    it('throws BadRequestException when deleting the EN translation', async () => {
      await expect(
        service.deleteLocationTranslation(
          'tour-1',
          'loc-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when translation row does not exist (P2025)', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.tourLocationTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteLocationTranslation(
          'tour-1',
          'loc-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when location does not belong to the tour', async () => {
      prisma.tourLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteLocationTranslation(
          'tour-1',
          'loc-99',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Pickup Locations ──────────────────────────────────────────────────────────

  describe('getPickupLocations', () => {
    it('returns pickup locations ordered by displayOrder', async () => {
      const pickup = makePickupLocation();
      prisma.pickupLocation.findMany.mockResolvedValue([pickup]);

      const result = await service.getPickupLocations(
        'tour-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.pickupLocation.findMany).toHaveBeenCalledWith({
        where: { tourId: 'tour-1' },
        select: expect.objectContaining({
          id: true,
          name: true,
          translations: expect.anything(),
        }),
        orderBy: { displayOrder: 'asc' },
      });
      expect(result).toEqual([pickup]);
    });
  });

  describe('addPickupLocation', () => {
    it('creates a pickup location with an EN title translation in a transaction', async () => {
      const pickup = makePickupLocation();
      prisma.pickupLocation.create.mockResolvedValue({ id: 'pickup-1' });
      prisma.pickupLocationTranslation.create.mockResolvedValue({});
      prisma.pickupLocation.findUnique.mockResolvedValue(pickup);

      const result = await service.addPickupLocation(
        'tour-1',
        { name: 'Marriott Beach Resort' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.pickupLocation.create).toHaveBeenCalled();
      expect(prisma.pickupLocationTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            locale: 'en',
            title: 'Marriott Beach Resort',
          }),
        }),
      );
      expect(result).toEqual(pickup);
    });

    it('uses dto.title for the EN translation when provided separately from name', async () => {
      const pickup = makePickupLocation();
      prisma.pickupLocation.create.mockResolvedValue({ id: 'pickup-1' });
      prisma.pickupLocationTranslation.create.mockResolvedValue({});
      prisma.pickupLocation.findUnique.mockResolvedValue(pickup);

      await service.addPickupLocation(
        'tour-1',
        { name: 'Marriott', title: 'Marriott Beach Resort - lobby entrance' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.pickupLocationTranslation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Marriott Beach Resort - lobby entrance',
          }),
        }),
      );
    });

    it('propagates ForbiddenException from assertTourAccess', async () => {
      toursService.assertOwnership.mockRejectedValue(new ForbiddenException());

      await expect(
        service.addPickupLocation(
          'tour-1',
          { name: 'x' },
          'other',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updatePickupLocation', () => {
    it('updates address fields on an existing pickup location', async () => {
      const updated = makePickupLocation({ address: '99 Ocean Ave' });
      prisma.pickupLocation.findFirst.mockResolvedValue({ id: 'pickup-1' });
      prisma.pickupLocation.update.mockResolvedValue(updated);

      const result = await service.updatePickupLocation(
        'tour-1',
        'pickup-1',
        { address: '99 Ocean Ave' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.pickupLocation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'pickup-1' } }),
      );
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when pickup location does not belong to the tour', async () => {
      prisma.pickupLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePickupLocation(
          'tour-1',
          'pickup-99',
          {},
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removePickupLocation', () => {
    it('deletes a pickup location and returns a success message', async () => {
      prisma.pickupLocation.findFirst.mockResolvedValue({ id: 'pickup-1' });
      prisma.pickupLocation.delete.mockResolvedValue({});

      const result = await service.removePickupLocation(
        'tour-1',
        'pickup-1',
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.pickupLocation.delete).toHaveBeenCalledWith({
        where: { id: 'pickup-1' },
      });
      expect(result).toEqual({
        message: 'Pickup location removed successfully',
      });
    });

    it('throws NotFoundException when pickup location is not found', async () => {
      prisma.pickupLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.removePickupLocation(
          'tour-1',
          'pickup-99',
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertPickupLocationTranslation', () => {
    it('upserts a title + directions translation for a non-EN locale', async () => {
      prisma.pickupLocation.findFirst.mockResolvedValue({ id: 'pickup-1' });
      const translation = {
        locale: Locale.nl,
        title: 'Marriott strandresort',
        directions: null,
        isMachineTranslated: false,
      };
      prisma.pickupLocationTranslation.upsert.mockResolvedValue(translation);

      const result = await service.upsertPickupLocationTranslation(
        'tour-1',
        'pickup-1',
        Locale.nl,
        { title: 'Marriott strandresort' },
        'user-1',
        Role.TOUR_OPERATOR,
      );

      expect(prisma.pickupLocationTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            pickupLocationId_locale: {
              pickupLocationId: 'pickup-1',
              locale: Locale.nl,
            },
          },
        }),
      );
      expect(result).toEqual(translation);
    });
  });

  describe('deletePickupLocationTranslation', () => {
    it('throws BadRequestException when deleting the EN translation', async () => {
      await expect(
        service.deletePickupLocationTranslation(
          'tour-1',
          'pickup-1',
          Locale.en,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when translation row does not exist (P2025)', async () => {
      prisma.pickupLocation.findFirst.mockResolvedValue({ id: 'pickup-1' });
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.pickupLocationTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deletePickupLocationTranslation(
          'tour-1',
          'pickup-1',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when pickup location does not belong to the tour', async () => {
      prisma.pickupLocation.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePickupLocationTranslation(
          'tour-1',
          'pickup-99',
          Locale.nl,
          'user-1',
          Role.TOUR_OPERATOR,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
