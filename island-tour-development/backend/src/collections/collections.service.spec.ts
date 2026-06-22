/**
 * Unit tests for CollectionsService - create (cannibalization guard + slug_registry),
 * manual/dynamic tour resolution, soft delete. PrismaService and ToursService mocked.
 */
import { PrismaService } from '@/prisma/prisma.service';
import { ToursService } from '@/tours/tours.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CollectionType, SlugEntityType } from '@prisma/client';
import { CollectionsService } from './collections.service';

function createMockPrisma() {
  const mock = {
    collection: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    destination: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    slugRegistry: { create: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    slugRedirect: { updateMany: jest.fn(), deleteMany: jest.fn(), upsert: jest.fn() },
    collectionTranslation: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
    collectionPageContent: { findUnique: jest.fn(), upsert: jest.fn() },
    faq: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) => fn(mock));
  return mock;
}

const tours = { findPublicByIds: jest.fn(), findAll: jest.fn() };

describe('CollectionsService', () => {
  let service: CollectionsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ToursService, useValue: tours },
      ],
    }).compile();
    service = module.get(CollectionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1', slug: 'curacao', isActive: true });
      prisma.category.findUnique.mockResolvedValue(null); // no category clash by default
      prisma.collection.create.mockResolvedValue({ id: 'col-1', slug: 'top-10-tours' });
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('rejects a slug that collides with a category (cannibalization guard)', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' }); // 'boat-tours' exists as a category
      await expect(
        service.create({ destinationId: 'dest-1', name: 'Boat Tours', slug: 'boat-tours', collectionType: CollectionType.MANUAL, tourIds: ['t1'] }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a MANUAL collection without tourIds', async () => {
      await expect(
        service.create({ destinationId: 'dest-1', name: 'Top 10', collectionType: CollectionType.MANUAL }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a DYNAMIC collection without filterQuery', async () => {
      await expect(
        service.create({ destinationId: 'dest-1', name: 'Private Boat Tours', collectionType: CollectionType.DYNAMIC }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a manual collection + a COLLECTION slug_registry row', async () => {
      await service.create(
        { destinationId: 'dest-1', name: 'Top 10 Tours', collectionType: CollectionType.MANUAL, tourIds: ['t1', 't2'] },
        'admin',
      );
      expect(prisma.collection.create).toHaveBeenCalled();
      expect(prisma.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityType: SlugEntityType.COLLECTION, destinationSlug: 'curacao', slug: 'top-10-tours' }),
        }),
      );
    });
  });

  describe('getBySlug - tour resolution', () => {
    beforeEach(() => {
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1', isActive: true });
    });

    it('resolves MANUAL collections via ordered tourIds', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1', destinationId: 'dest-1', name: 'Top 10', slug: 'top-10-tours',
        collectionType: CollectionType.MANUAL, tourIds: ['t2', 't1'], filterQuery: null, sortOrder: 'recommended',
        isActive: true, isSeeded: false, heroImage: null, createdAt: new Date(), updatedAt: new Date(),
        translations: [],
      });
      tours.findPublicByIds.mockResolvedValue([{ id: 't2' }, { id: 't1' }]);

      const res = await service.getBySlug('curacao', 'top-10-tours');
      expect(tours.findPublicByIds).toHaveBeenCalledWith(['t2', 't1']);
      expect(res.tours).toEqual([{ id: 't2' }, { id: 't1' }]);
    });

    it('resolves DYNAMIC collections via the filterQuery → tour listing', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-2', destinationId: 'dest-1', name: 'Private Boat', slug: 'private-boat-tours',
        collectionType: CollectionType.DYNAMIC, tourIds: [], sortOrder: 'rating',
        filterQuery: { categoryId: 'cat-boat', attributes: { booking_type: 'private', boat_type: ['catamaran', 'yacht'] } },
        isActive: true, isSeeded: false, heroImage: null, createdAt: new Date(), updatedAt: new Date(),
        translations: [],
      });
      tours.findAll.mockResolvedValue({ data: [{ id: 't9' }] });

      const res = await service.getBySlug('curacao', 'private-boat-tours');
      expect(tours.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ destinationId: 'dest-1', categoryId: 'cat-boat', sort: 'rating' }),
        { booking_type: 'private', boat_type: 'catamaran,yacht' },
      );
      expect(res.tours).toEqual([{ id: 't9' }]);
    });
  });

  describe('getByIdAdmin', () => {
    it('returns the collection by id', async () => {
      const collection = { id: 'col-1', name: 'Top 10', slug: 'top-10-tours', isActive: true };
      prisma.collection.findUnique.mockResolvedValue(collection);
      const res = await service.getByIdAdmin('col-1');
      expect(prisma.collection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'col-1' } }),
      );
      expect(res).toEqual(collection);
    });

    it('throws 404 when the collection is missing', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.getByIdAdmin('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllByDestinationAdmin', () => {
    it('returns all (active + inactive) collections for a destination', async () => {
      prisma.destination.findUnique.mockResolvedValue({ id: 'dest-1' });
      const rows = [
        { id: 'col-1', isActive: true },
        { id: 'col-2', isActive: false },
      ];
      prisma.collection.findMany.mockResolvedValue(rows);
      const res = await service.getAllByDestinationAdmin('curacao');
      expect(prisma.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { destinationId: 'dest-1' } }),
      );
      expect(res).toEqual(rows);
    });

    it('throws 404 when the destination is missing', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);
      await expect(service.getAllByDestinationAdmin('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update - slug rename', () => {
    it('renames the slug: re-points the registry row and writes a 301 redirect', async () => {
      prisma.collection.findUnique.mockResolvedValue({ slug: 'old-slug', destination: { slug: 'curacao' } });
      prisma.category.findUnique.mockResolvedValue(null); // no category-slug clash
      prisma.slugRegistry.findUnique.mockResolvedValue(null); // isSlugTaken → free
      prisma.slugRegistry.findMany.mockResolvedValue([{ destinationSlug: 'curacao' }]);
      prisma.collection.update.mockResolvedValue({ id: 'col-1', slug: 'new-slug' });

      await service.update('col-1', { slug: 'new-slug' }, 'admin');

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: 'COLLECTION', entityId: 'col-1' },
        data: { slug: 'new-slug' },
      });
      expect(prisma.slugRedirect.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { destinationSlug_fromSlug: { destinationSlug: 'curacao', fromSlug: 'old-slug' } },
          create: expect.objectContaining({ fromSlug: 'old-slug', toSlug: 'new-slug', statusCode: 301 }),
        }),
      );
      expect(prisma.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ slug: 'new-slug' }) }),
      );
    });

    it('rejects a rename that collides with a category slug', async () => {
      prisma.collection.findUnique.mockResolvedValue({ slug: 'old-slug', destination: { slug: 'curacao' } });
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' }); // 'boat-tours' is a category
      await expect(service.update('col-1', { slug: 'boat-tours' }, 'admin')).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deactivates the collection and its slug_registry row', async () => {
      prisma.collection.findUnique.mockResolvedValue({ id: 'col-1', isSeeded: false });
      prisma.collection.update.mockResolvedValue({});
      await service.remove('col-1', 'admin');
      expect(prisma.collection.update).toHaveBeenCalledWith({ where: { id: 'col-1' }, data: { isActive: false } });
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.COLLECTION, entityId: 'col-1' },
        data: { isActive: false },
      });
    });
  });
});
