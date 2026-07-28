/**
 * Unit tests for CollectionsService - create (cannibalization guard + slug_registry),
 * manual/dynamic tour resolution, soft delete. PrismaService and ToursService mocked.
 */
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { TranslationClearMarkService } from '@/content-translation/translation-clear-mark.service';
import { ToursService } from '@/tours/tours.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CollectionStatus,
  CollectionType,
  SlugEntityType,
} from '@prisma/client';
import { CollectionsService } from './collections.service';

function createMockPrisma() {
  const mock = {
    collection: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    destination: { findUnique: jest.fn() },
    category: { findUnique: jest.fn() },
    tour: { findMany: jest.fn() },
    slugRegistry: {
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    slugRedirect: {
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
    },
    collectionTranslation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    collectionPageContent: { findUnique: jest.fn(), upsert: jest.fn() },
    collectionTour: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    collectionTourRationale: { upsert: jest.fn() },
    faq: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );
  return mock;
}

const tours = { findPublicByIds: jest.fn(), findAll: jest.fn() };
const faqGroups = {
  getGroups: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  upsertTranslation: jest.fn(),
};

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
        { provide: FaqGroupService, useValue: faqGroups },
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
    service = module.get(CollectionsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        slug: 'curacao',
        isActive: true,
      });
      prisma.category.findUnique.mockResolvedValue(null); // no category clash by default
      prisma.collection.create.mockResolvedValue({
        id: 'col-1',
        slug: 'top-10-tours',
      });
      prisma.slugRegistry.create.mockResolvedValue({});
    });

    it('rejects a slug that collides with a category (cannibalization guard)', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' }); // 'boat-tours' exists as a category
      await expect(
        service.create(
          {
            destinationId: 'dest-1',
            name: 'Boat Tours',
            slug: 'boat-tours',
            collectionType: CollectionType.MANUAL,
            tourIds: ['t1'],
          },
          'admin',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a MANUAL collection without tourIds', async () => {
      await expect(
        service.create(
          {
            destinationId: 'dest-1',
            name: 'Top 10',
            collectionType: CollectionType.MANUAL,
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a DYNAMIC collection without filterQuery', async () => {
      await expect(
        service.create(
          {
            destinationId: 'dest-1',
            name: 'Private Boat Tours',
            collectionType: CollectionType.DYNAMIC,
          },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a manual collection + a COLLECTION slug_registry row', async () => {
      await service.create(
        {
          destinationId: 'dest-1',
          name: 'Top 10 Tours',
          collectionType: CollectionType.MANUAL,
          tourIds: ['t1', 't2'],
        },
        'admin',
      );
      expect(prisma.collection.create).toHaveBeenCalled();
      expect(prisma.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: SlugEntityType.COLLECTION,
            destinationSlug: 'curacao',
            slug: 'top-10-tours',
          }),
        }),
      );
    });
  });

  describe('getBySlug - tour resolution', () => {
    beforeEach(() => {
      prisma.destination.findUnique.mockResolvedValue({
        id: 'dest-1',
        isActive: true,
      });
    });

    it('resolves MANUAL collections via ordered tourIds', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        destinationId: 'dest-1',
        name: 'Top 10',
        slug: 'top-10-tours',
        collectionType: CollectionType.MANUAL,
        status: CollectionStatus.PUBLISHED,
        tourIds: ['t2', 't1'],
        filterQuery: null,
        sortOrder: 'recommended',
        isActive: true,
        isSeeded: false,
        heroImage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        translations: [],
      });
      tours.findPublicByIds.mockResolvedValue([{ id: 't2' }, { id: 't1' }]);

      const res = await service.getBySlug('curacao', 'top-10-tours');
      expect(tours.findPublicByIds).toHaveBeenCalledWith(
        ['t2', 't1'],
        undefined, // no ?currency on getBySlug -> source-currency cards
      );
      expect(res.tours).toEqual([{ id: 't2' }, { id: 't1' }]);
    });

    it('resolves DYNAMIC collections via the filterQuery → tour listing', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-2',
        destinationId: 'dest-1',
        name: 'Private Boat',
        slug: 'private-boat-tours',
        collectionType: CollectionType.DYNAMIC,
        status: CollectionStatus.PUBLISHED,
        tourIds: [],
        sortOrder: 'rating',
        filterQuery: {
          categoryId: 'cat-boat',
          attributes: {
            booking_type: 'private',
            boat_type: ['catamaran', 'yacht'],
          },
        },
        isActive: true,
        isSeeded: false,
        heroImage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        translations: [],
      });
      tours.findAll.mockResolvedValue({ data: [{ id: 't9' }] });

      const res = await service.getBySlug('curacao', 'private-boat-tours');
      expect(tours.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationId: 'dest-1',
          categoryId: 'cat-boat',
          sort: 'rating',
        }),
        { booking_type: 'private', boat_type: 'catamaran,yacht' },
      );
      expect(res.tours).toEqual([{ id: 't9' }]);
    });

    it.each([
      ['DRAFT', { status: CollectionStatus.DRAFT, isActive: true }],
      ['deactivated', { status: CollectionStatus.PUBLISHED, isActive: false }],
    ])('404s on a %s collection - this route is public', async (_, state) => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-3',
        destinationId: 'dest-1',
        name: 'Unpublished',
        slug: 'unpublished',
        collectionType: CollectionType.MANUAL,
        tourIds: [],
        filterQuery: null,
        sortOrder: 'recommended',
        isSeeded: false,
        heroImage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        translations: [],
        ...state,
      });

      await expect(service.getBySlug('curacao', 'unpublished')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getByIdAdmin', () => {
    it('returns the collection by id', async () => {
      const collection = {
        id: 'col-1',
        name: 'Top 10',
        slug: 'top-10-tours',
        isActive: true,
      };
      prisma.collection.findUnique.mockResolvedValue(collection);
      const res = await service.getByIdAdmin('col-1');
      expect(prisma.collection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'col-1' } }),
      );
      expect(res).toEqual(collection);
    });

    it('throws 404 when the collection is missing', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.getByIdAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
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
      await expect(service.getAllByDestinationAdmin('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update - slug rename', () => {
    it('renames the slug: re-points the registry row and writes a 301 redirect', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        slug: 'old-slug',
        destination: { slug: 'curacao' },
      });
      prisma.category.findUnique.mockResolvedValue(null); // no category-slug clash
      prisma.slugRegistry.findUnique.mockResolvedValue(null); // isSlugTaken → free
      prisma.slugRegistry.findMany.mockResolvedValue([
        { destinationSlug: 'curacao' },
      ]);
      prisma.collection.update.mockResolvedValue({
        id: 'col-1',
        slug: 'new-slug',
      });

      await service.update('col-1', { slug: 'new-slug' }, 'admin');

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: 'COLLECTION', entityId: 'col-1' },
        data: { slug: 'new-slug' },
      });
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
      expect(prisma.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'new-slug' }),
        }),
      );
    });

    it('rejects a rename that collides with a category slug', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        slug: 'old-slug',
        destination: { slug: 'curacao' },
      });
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' }); // 'boat-tours' is a category
      await expect(
        service.update('col-1', { slug: 'boat-tours' }, 'admin'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deactivates the collection and its slug_registry row', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        isSeeded: false,
      });
      prisma.collection.update.mockResolvedValue({});
      await service.remove('col-1', 'admin');
      expect(prisma.collection.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: { isActive: false },
      });
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.COLLECTION, entityId: 'col-1' },
        data: { isActive: false },
      });
    });
  });

  describe('upsertTourRationale - word limit', () => {
    it('rejects a rationale longer than 20 words (400)', async () => {
      const tooLong = Array.from({ length: 21 }, (_, i) => `word${i}`).join(
        ' ',
      );
      await expect(
        service.upsertTourRationale(
          'col-1',
          'tour-1',
          'en' as any,
          { rationale: tooLong },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.collectionTour.findUnique).not.toHaveBeenCalled();
    });

    it('throws 404 when the tour is not a member of the collection', async () => {
      prisma.collectionTour.findUnique.mockResolvedValue(null);
      await expect(
        service.upsertTourRationale(
          'col-1',
          'tour-x',
          'en' as any,
          { rationale: 'A short rationale' },
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('upserts a valid (≤20 word) rationale and echoes the tourId', async () => {
      prisma.collectionTour.findUnique.mockResolvedValue({ id: 'ct-1' });
      prisma.collectionTourRationale.upsert.mockResolvedValue({
        id: 'r-1',
        locale: 'en',
        rationale: 'Sea turtles, no signal.',
      });
      const res = await service.upsertTourRationale(
        'col-1',
        'tour-1',
        'en',
        { rationale: 'Sea turtles, no signal.' },
        'admin',
      );
      expect(prisma.collectionTourRationale.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            collectionTourId_locale: { collectionTourId: 'ct-1', locale: 'en' },
          },
        }),
      );
      expect(res).toEqual(
        expect.objectContaining({
          tourId: 'tour-1',
          rationale: 'Sea turtles, no signal.',
        }),
      );
    });
  });

  describe('updateStatus - publish guard (G5)', () => {
    it('rejects DRAFT→PUBLISHED for a MANUAL collection missing heroImage / en copy / rationales (422)', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        status: CollectionStatus.DRAFT,
        collectionType: CollectionType.MANUAL,
        heroImage: null,
      });
      prisma.collectionTranslation.findUnique.mockResolvedValue(null); // no en H1/overview
      prisma.collectionTour.findMany.mockResolvedValue([
        { tourId: 't1', translations: [] },
      ]); // no rationale

      await expect(
        service.updateStatus('col-1', CollectionStatus.PUBLISHED, 'admin'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.collection.update).not.toHaveBeenCalled();
    });

    it('publishes a MANUAL collection when every requirement is met', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        status: CollectionStatus.DRAFT,
        collectionType: CollectionType.MANUAL,
        heroImage: 'https://cdn/x.jpg',
      });
      prisma.collectionTranslation.findUnique.mockResolvedValue({
        h1Override: 'The 10 best things.',
        overview: 'Intro.',
      });
      prisma.collectionTour.findMany.mockResolvedValue([
        {
          tourId: 't1',
          translations: [{ rationale: 'Sea turtles, no signal.' }],
        },
      ]);
      prisma.collection.update.mockResolvedValue({
        id: 'col-1',
        status: CollectionStatus.PUBLISHED,
      });

      const res = await service.updateStatus(
        'col-1',
        CollectionStatus.PUBLISHED,
        'admin',
      );
      expect(prisma.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'col-1' },
          data: { status: CollectionStatus.PUBLISHED },
        }),
      );
      expect(res).toEqual(
        expect.objectContaining({ status: CollectionStatus.PUBLISHED }),
      );
    });

    it('publishes a DYNAMIC collection without per-tour rationales', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-2',
        status: CollectionStatus.DRAFT,
        collectionType: CollectionType.DYNAMIC,
        heroImage: 'https://cdn/y.jpg',
      });
      prisma.collectionTranslation.findUnique.mockResolvedValue({
        h1Override: 'Private boat tours.',
        overview: 'Intro.',
      });
      prisma.collection.update.mockResolvedValue({
        id: 'col-2',
        status: CollectionStatus.PUBLISHED,
      });

      const res = await service.updateStatus(
        'col-2',
        CollectionStatus.PUBLISHED,
        'admin',
      );
      expect(prisma.collectionTour.findMany).not.toHaveBeenCalled();
      expect(res).toEqual(
        expect.objectContaining({ status: CollectionStatus.PUBLISHED }),
      );
    });
  });

  describe('replaceTours', () => {
    it('rejects membership changes on a DYNAMIC collection', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-2',
        collectionType: CollectionType.DYNAMIC,
        destinationId: 'dest-1',
      });
      await expect(
        service.replaceTours(
          'col-2',
          { tours: [{ tourId: 't1', position: 0 }] },
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('diffs membership (preserving kept rows), re-normalizes positions, syncs tourIds', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        collectionType: CollectionType.MANUAL,
        destinationId: 'dest-1',
      });
      prisma.tour.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      // Existing members: t2 @0, t1 @1 (both remain → no delete, rows preserved).
      prisma.collectionTour.findMany.mockResolvedValue([
        { id: 'ct-1', tourId: 't2', position: 0 },
        { id: 'ct-2', tourId: 't1', position: 1 },
      ]);

      await service.replaceTours(
        'col-1',
        {
          tours: [
            { tourId: 't1', position: 5 },
            { tourId: 't2', position: 2 },
          ],
        },
        'admin',
      );

      // Sorted by position → [t2, t1]; both kept, so no deletions and no creates.
      expect(prisma.collectionTour.deleteMany).not.toHaveBeenCalled();
      expect(prisma.collectionTour.create).not.toHaveBeenCalled();
      // Kept rows are re-positioned to a dense 0..n by the submitted order.
      expect(prisma.collectionTour.update).toHaveBeenCalledWith({
        where: { id: 'ct-1' },
        data: { position: 0 },
      });
      expect(prisma.collectionTour.update).toHaveBeenCalledWith({
        where: { id: 'ct-2' },
        data: { position: 1 },
      });
      expect(prisma.collection.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: { tourIds: ['t2', 't1'] },
      });
    });

    it('deletes only removed members and creates only new ones', async () => {
      prisma.collection.findUnique.mockResolvedValue({
        id: 'col-1',
        collectionType: CollectionType.MANUAL,
        destinationId: 'dest-1',
      });
      prisma.tour.findMany.mockResolvedValue([{ id: 't1' }, { id: 't3' }]);
      // Existing: t1 @0, t2 @1. New payload: t1, t3 → remove t2, add t3, keep t1.
      prisma.collectionTour.findMany.mockResolvedValue([
        { id: 'ct-1', tourId: 't1', position: 0 },
        { id: 'ct-2', tourId: 't2', position: 1 },
      ]);

      await service.replaceTours(
        'col-1',
        {
          tours: [
            { tourId: 't1', position: 0 },
            { tourId: 't3', position: 1 },
          ],
        },
        'admin',
      );

      expect(prisma.collectionTour.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['ct-2'] } },
      });
      expect(prisma.collectionTour.update).toHaveBeenCalledWith({
        where: { id: 'ct-1' },
        data: { position: 0 },
      });
      expect(prisma.collectionTour.create).toHaveBeenCalledWith({
        data: { collectionId: 'col-1', tourId: 't3', position: 1 },
      });
      expect(prisma.collection.update).toHaveBeenCalledWith({
        where: { id: 'col-1' },
        data: { tourIds: ['t1', 't3'] },
      });
    });
  });
});
