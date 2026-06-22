/**
 * Unit tests for AttributesService - dictionary CRUD + validated per-tour assignment (V2 §7).
 * PrismaService and ToursService are mocked.
 */
import { PrismaService } from '@/prisma/prisma.service';
import { ToursService } from '@/tours/tours.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttributeDataType, Role } from '@prisma/client';
import { AttributesService } from './attributes.service';

function createMockPrisma() {
  const mock = {
    attributeDefinition: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tourAttribute: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    destination: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    tour: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  // service uses the array form: $transaction([...upserts])
  mock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  return mock;
}

const tours = { findTourOrThrow: jest.fn(), assertOwnership: jest.fn() };

describe('AttributesService', () => {
  let service: AttributesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ToursService, useValue: tours },
      ],
    }).compile();
    service = module.get(AttributesService);
    jest.clearAllMocks();
    tours.findTourOrThrow.mockResolvedValue({ id: 'tour-1', operatorId: 'op-1' });
    tours.assertOwnership.mockResolvedValue(undefined);
  });

  // ── Dictionary ────────────────────────────────────────────────────────────────

  describe('getAllDefinitions', () => {
    it('builds an OR (global + category) filter when category is given', async () => {
      prisma.attributeDefinition.findMany.mockResolvedValue([]);
      await service.getAllDefinitions({ category: 'boat-tours' });
      expect(prisma.attributeDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: [{ appliesToCategories: { isEmpty: true } }, { appliesToCategories: { has: 'boat-tours' } }],
          }),
        }),
      );
    });

    it('filters to globals only when globalOnly is set', async () => {
      prisma.attributeDefinition.findMany.mockResolvedValue([]);
      await service.getAllDefinitions({ globalOnly: true });
      expect(prisma.attributeDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ appliesToCategories: { isEmpty: true } }) }),
      );
    });
  });

  describe('createDefinition', () => {
    it('rejects ENUM without allowedValues', async () => {
      await expect(
        service.createDefinition({ key: 'boat_type', displayName: 'Boat Type', dataType: AttributeDataType.ENUM }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an ENUM with allowedValues', async () => {
      prisma.attributeDefinition.create.mockResolvedValue({ key: 'boat_type' });
      await service.createDefinition(
        { key: 'boat_type', displayName: 'Boat Type', dataType: AttributeDataType.ENUM, allowedValues: ['catamaran'] },
        'admin',
      );
      expect(prisma.attributeDefinition.create).toHaveBeenCalled();
    });

    it('maps a unique-constraint violation to 409', async () => {
      prisma.attributeDefinition.create.mockRejectedValue({ code: 'P2002' });
      await expect(
        service.createDefinition({ key: 'booking_type', displayName: 'x', dataType: AttributeDataType.BOOLEAN }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeDefinition', () => {
    it('soft-deactivates (does not hard delete)', async () => {
      prisma.attributeDefinition.findUnique.mockResolvedValue({ key: 'boat_type', dataType: AttributeDataType.ENUM });
      prisma.attributeDefinition.update.mockResolvedValue({});
      await service.removeDefinition('boat_type', 'admin');
      expect(prisma.attributeDefinition.update).toHaveBeenCalledWith({ where: { key: 'boat_type' }, data: { isActive: false } });
    });
  });

  // ── Per-tour assignment + validation ───────────────────────────────────────────

  describe('setTourAttributes', () => {
    const mockDefs = (defs: any[]) => prisma.attributeDefinition.findMany.mockResolvedValue(defs);

    beforeEach(() => {
      prisma.tourAttribute.findMany.mockResolvedValue([]);
    });

    it('rejects an unknown attribute key', async () => {
      mockDefs([]); // dictionary lookup returns nothing
      await expect(
        service.setTourAttributes('tour-1', { attributes: [{ key: 'nope', value: 'x' }] }, 'u', Role.ADMIN),
      ).rejects.toThrow(/Unknown attribute/);
    });

    it('rejects a bad BOOLEAN value', async () => {
      mockDefs([{ key: 'free_cancellation', dataType: AttributeDataType.BOOLEAN, allowedValues: null }]);
      await expect(
        service.setTourAttributes('tour-1', { attributes: [{ key: 'free_cancellation', value: 'maybe' }] }, 'u', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an ENUM value not in allowedValues', async () => {
      mockDefs([{ key: 'boat_type', dataType: AttributeDataType.ENUM, allowedValues: ['catamaran', 'yacht'] }]);
      await expect(
        service.setTourAttributes('tour-1', { attributes: [{ key: 'boat_type', value: 'banana' }] }, 'u', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('normalizes ENUM_MULTI (comma list) to a JSON array and upserts', async () => {
      mockDefs([{ key: 'wildlife_type', dataType: AttributeDataType.ENUM_MULTI, allowedValues: ['turtles', 'coral', 'rays'] }]);
      await service.setTourAttributes('tour-1', { attributes: [{ key: 'wildlife_type', value: 'turtles, coral' }] }, 'u', Role.ADMIN);
      expect(prisma.tourAttribute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tourId_attributeKey: { tourId: 'tour-1', attributeKey: 'wildlife_type' } },
          create: { tourId: 'tour-1', attributeKey: 'wildlife_type', attributeValue: '["turtles","coral"]' },
          update: { attributeValue: '["turtles","coral"]' },
        }),
      );
    });

    it('rejects ENUM_MULTI with an invalid member', async () => {
      mockDefs([{ key: 'wildlife_type', dataType: AttributeDataType.ENUM_MULTI, allowedValues: ['turtles'] }]);
      await expect(
        service.setTourAttributes('tour-1', { attributes: [{ key: 'wildlife_type', value: 'turtles,sharks' }] }, 'u', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an INTEGER that is not an integer', async () => {
      mockDefs([{ key: 'minimum_age', dataType: AttributeDataType.INTEGER, allowedValues: null }]);
      await expect(
        service.setTourAttributes('tour-1', { attributes: [{ key: 'minimum_age', value: '12.5' }] }, 'u', Role.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate keys in the payload', async () => {
      await expect(
        service.setTourAttributes(
          'tour-1',
          { attributes: [{ key: 'free_cancellation', value: 'true' }, { key: 'free_cancellation', value: 'false' }] },
          'u',
          Role.ADMIN,
        ),
      ).rejects.toThrow(/Duplicate/);
    });

    it('enforces ownership before writing', async () => {
      mockDefs([{ key: 'free_cancellation', dataType: AttributeDataType.BOOLEAN, allowedValues: null }]);
      await service.setTourAttributes('tour-1', { attributes: [{ key: 'free_cancellation', value: 'true' }] }, 'u', Role.TOUR_OPERATOR);
      expect(tours.findTourOrThrow).toHaveBeenCalledWith('tour-1');
      expect(tours.assertOwnership).toHaveBeenCalledWith({ id: 'tour-1', operatorId: 'op-1' }, 'u', Role.TOUR_OPERATOR);
    });
  });

  describe('getFilters', () => {
    it('404s for an unknown destination', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'boat-tours', isActive: true });
      await expect(service.getFilters('nope', 'boat-tours')).rejects.toThrow(NotFoundException);
    });

    it('returns applicable filters with value counts + price range', async () => {
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1', isActive: true });
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', slug: 'boat-tours', isActive: true });
      prisma.attributeDefinition.findMany.mockResolvedValue([
        { key: 'boat_type', displayName: 'Boat Type', dataType: AttributeDataType.ENUM, filterDisplayType: 'RADIO', isSortable: false, sortOrder: 1 },
        { key: 'wildlife_type', displayName: 'Wildlife', dataType: AttributeDataType.ENUM_MULTI, filterDisplayType: 'CHECKBOX', isSortable: false, sortOrder: 2 },
      ]);
      prisma.tour.findMany.mockResolvedValue([
        { id: 't1', basePrice: 75, durationMinutesFrom: 180 },
        { id: 't2', basePrice: 120, durationMinutesFrom: 480 },
      ]);
      prisma.tourAttribute.findMany.mockResolvedValue([
        { attributeKey: 'boat_type', attributeValue: 'catamaran' },
        { attributeKey: 'boat_type', attributeValue: 'catamaran' },
        { attributeKey: 'boat_type', attributeValue: 'yacht' },
        { attributeKey: 'wildlife_type', attributeValue: '["turtles","coral"]' },
      ]);

      const res = await service.getFilters('curacao', 'boat-tours');
      expect(res.total).toBe(2);
      expect(res.priceRange).toEqual({ min: 75, max: 120 });
      expect(res.durationRange).toEqual({ min: 180, max: 480 });
      const boat = res.filters.find((f) => f.key === 'boat_type')!;
      expect(boat.values).toEqual([
        { value: 'catamaran', count: 2 },
        { value: 'yacht', count: 1 },
      ]);
      const wildlife = res.filters.find((f) => f.key === 'wildlife_type')!;
      // ENUM_MULTI JSON array is split into members
      expect(wildlife.values).toEqual(expect.arrayContaining([
        { value: 'turtles', count: 1 },
        { value: 'coral', count: 1 },
      ]));
    });
  });

  describe('deleteTourAttribute', () => {
    it('maps a missing row to 404', async () => {
      prisma.tourAttribute.delete.mockRejectedValue({ code: 'P2025' });
      await expect(service.deleteTourAttribute('tour-1', 'boat_type', 'u', Role.ADMIN)).rejects.toThrow(NotFoundException);
    });
  });
});
