/**
 * Unit tests for DestinationService.
 *
 * PrismaService is fully mocked - no real database connection is made.
 * $transaction is mocked to invoke the callback with the same mocked client,
 * so transactional and non-transactional Prisma calls use the same mock object.
 *
 * Covers: CRUD, translations, page content, FAQs, all error branches
 * (NotFoundException, ConflictException, ForbiddenException, BadRequestException),
 * and the locale / applyTranslation fall-through behaviour.
 */

import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, Region, SlugEntityType } from '@prisma/client';
import { DestinationService } from './destinations.service';
import {
  CreateDestinationDto,
  CreateDestinationFaqDto,
  DestinationQueryDto,
  FaqLocaleQueryDto,
  UpdateDestinationDto,
  UpdateDestinationFaqDto,
  UpsertDestinationPageContentDto,
  UpsertDestinationTranslationsDto,
} from './dto/destination.dto';

// ── Mock factory ──────────────────────────────────────────────────────────────

function createMockPrismaService() {
  const mock = {
    destination: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    destinationTranslation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    destinationPageContent: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    faq: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    slugRegistry: {
      create: jest.fn(),
      createMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    tour: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Default: $transaction calls the callback with the same mock object
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );

  return mock;
}

// ── Data fixtures ─────────────────────────────────────────────────────────────

function makeDestination(
  overrides: Partial<{
    id: string;
    name: string;
    slug: string;
    heroImage: string | null;
    isSeeded: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: 'dest-1',
    name: 'Curaçao',
    slug: 'curacao',
    heroImage: null,
    isSeeded: false,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

function makeFaq(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'faq-1',
    question: 'What is the best time to visit?',
    answer: 'January through June for calm seas.',
    displayOrder: 0,
    isActive: true,
    locale: Locale.en,
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('DestinationService', () => {
  let service: DestinationService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DestinationService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: FaqGroupService,
          useValue: {
            getGroups: jest.fn(),
            createGroup: jest.fn(),
            updateGroup: jest.fn(),
            deleteGroup: jest.fn(),
            upsertTranslation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DestinationService>(DestinationService);
    jest.clearAllMocks();

    // Re-apply $transaction default after clearAllMocks
    prisma.$transaction.mockImplementation(
      (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );
  });

  // ── getAll ───────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns paginated results with correct total, page, limit, and data', async () => {
      const dest = { ...makeDestination(), translations: [] };
      prisma.destination.count.mockResolvedValue(1);
      prisma.destination.findMany.mockResolvedValue([dest]);

      const query: DestinationQueryDto = {
        page: 1,
        limit: 20,
        locale: Locale.en,
      };
      const result = await service.getAll(query);

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Curaçao');
    });

    it('applies isActive filter in the where clause when provided', async () => {
      prisma.destination.count.mockResolvedValue(0);
      prisma.destination.findMany.mockResolvedValue([]);

      const query: DestinationQueryDto = {
        isActive: false,
        page: 1,
        limit: 20,
      };
      await service.getAll(query);

      expect(prisma.destination.count).toHaveBeenCalledWith({
        where: { isActive: false },
      });
      expect(prisma.destination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('omits isActive from where clause when not provided', async () => {
      prisma.destination.count.mockResolvedValue(0);
      prisma.destination.findMany.mockResolvedValue([]);

      const query: DestinationQueryDto = { page: 1, limit: 20 };
      await service.getAll(query);

      expect(prisma.destination.count).toHaveBeenCalledWith({ where: {} });
    });

    it('uses skip=10, take=5 for page=3, limit=5', async () => {
      prisma.destination.count.mockResolvedValue(20);
      prisma.destination.findMany.mockResolvedValue([]);

      const query: DestinationQueryDto = { page: 3, limit: 5 };
      await service.getAll(query);

      expect(prisma.destination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('applies locale translation when a translation row exists', async () => {
      const translation = { name: 'Curaçao NL', isMachineTranslated: false };
      const dest = { ...makeDestination(), translations: [translation] };
      prisma.destination.count.mockResolvedValue(1);
      prisma.destination.findMany.mockResolvedValue([dest]);

      const query: DestinationQueryDto = {
        locale: Locale.nl,
        page: 1,
        limit: 20,
      };
      const result = await service.getAll(query);

      expect(result.data[0].name).toBe('Curaçao NL');
      expect(result.data[0].locale).toBe(Locale.nl);
      expect(result.data[0].isMachineTranslated).toBe(false);
    });

    it('falls back to base name when no translation row exists for the requested locale', async () => {
      const dest = { ...makeDestination(), translations: [] };
      prisma.destination.count.mockResolvedValue(1);
      prisma.destination.findMany.mockResolvedValue([dest]);

      const query: DestinationQueryDto = {
        locale: Locale.nl,
        page: 1,
        limit: 20,
      };
      const result = await service.getAll(query);

      expect(result.data[0].name).toBe('Curaçao');
      expect(result.data[0].isMachineTranslated).toBe(false);
    });
  });

  // ── getActive ────────────────────────────────────────────────────────────────

  describe('getActive', () => {
    it('queries with isActive: true filter', async () => {
      prisma.destination.findMany.mockResolvedValue([]);

      await service.getActive(Locale.en);

      expect(prisma.destination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('returns localized destinations with translation applied', async () => {
      const translation = { name: 'Aruba ES', isMachineTranslated: true };
      const dest = {
        ...makeDestination({ name: 'Aruba', slug: 'aruba' }),
        translations: [translation],
        _count: { tours: 0 },
      };
      prisma.destination.findMany.mockResolvedValue([dest]);

      const result = await service.getActive(Locale.es);

      expect(result[0].name).toBe('Aruba ES');
      expect(result[0].locale).toBe(Locale.es);
      expect(result[0].isMachineTranslated).toBe(true);
    });

    it('falls back to base name when no translation exists', async () => {
      const dest = {
        ...makeDestination({ name: 'Aruba', slug: 'aruba' }),
        translations: [],
        _count: { tours: 0 },
      };
      prisma.destination.findMany.mockResolvedValue([dest]);

      const result = await service.getActive(Locale.nl);

      expect(result[0].name).toBe('Aruba');
      expect(result[0].isMachineTranslated).toBe(false);
    });

    it('defaults to Locale.en when no locale argument is passed', async () => {
      prisma.destination.findMany.mockResolvedValue([]);

      await service.getActive();

      expect(prisma.destination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            translations: expect.objectContaining({
              where: { locale: Locale.en },
            }),
          }),
        }),
      );
    });
  });

  // ── getBySlug ────────────────────────────────────────────────────────────────

  describe('getBySlug', () => {
    it('returns destination detail when slug matches', async () => {
      const translation = {
        name: 'Curaçao',
        overview: 'Overview text',
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      };
      const dest = { ...makeDestination(), translations: [translation] };
      prisma.destination.findUnique.mockResolvedValue(dest);

      const result = await service.getBySlug('curacao', Locale.en);

      expect(result.slug).toBe('curacao');
      expect(result.overview).toBe('Overview text');
      expect(result.h1Override).toBeNull();
    });

    it('throws NotFoundException when slug does not match any destination', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug('nonexistent', Locale.en)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes the slug in the NotFoundException message', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.getBySlug('ghost-island', Locale.en),
      ).rejects.toThrow('ghost-island');
    });

    it('returns null for overview and breadcrumbLabel when no translation row exists', async () => {
      const dest = { ...makeDestination(), translations: [] };
      prisma.destination.findUnique.mockResolvedValue(dest);

      const result = await service.getBySlug('curacao', Locale.nl);

      expect(result.overview).toBeNull();
      expect(result.h1Override).toBeNull();
      expect(result.breadcrumbLabel).toBeNull();
    });
  });

  // ── getById ──────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns destination detail when id matches', async () => {
      const translation = {
        name: 'Curaçao',
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      };
      const dest = { ...makeDestination(), translations: [translation] };
      prisma.destination.findUnique.mockResolvedValue(dest);

      const result = await service.getById('dest-1', Locale.en);

      expect(result.id).toBe('dest-1');
      expect(result.overview).toBeNull();
    });

    it('throws NotFoundException when id does not match any destination', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing', Locale.en)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes the id in the NotFoundException message', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(service.getById('bad-id', Locale.en)).rejects.toThrow(
        'bad-id',
      );
    });
  });

  // ── create ───────────────────────────────────────────────────────────────────

  describe('create', () => {
    const adminId = 'admin-1';

    it('calls $transaction and creates the destination inside it', async () => {
      const created = makeDestination({ slug: 'aruba' });
      prisma.destination.create.mockResolvedValue(created);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([]);

      const dto: CreateDestinationDto = {
        name: 'Aruba',
        region: Region.CARIBBEAN,
        timezone: 'America/Aruba',
      };
      const result = await service.create(dto, adminId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(created);
    });

    it('creates the reserved "tours" slug_registry row', async () => {
      const created = makeDestination({ slug: 'aruba' });
      prisma.destination.create.mockResolvedValue(created);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([]);

      const dto: CreateDestinationDto = {
        name: 'Aruba',
        region: Region.CARIBBEAN,
        timezone: 'America/Aruba',
      };
      await service.create(dto, adminId);

      expect(prisma.slugRegistry.create).toHaveBeenCalledWith({
        data: {
          destinationSlug: 'aruba',
          slug: 'tours',
          entityType: SlugEntityType.RESERVED,
          entityId: null,
        },
      });
    });

    it('seeds slug_registry rows for all active categories', async () => {
      const created = makeDestination({ slug: 'aruba' });
      const categories = [
        { id: 'cat-1', slug: 'boat-tours' },
        { id: 'cat-2', slug: 'hiking' },
      ];
      prisma.destination.create.mockResolvedValue(created);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue(categories);
      prisma.slugRegistry.createMany.mockResolvedValue({ count: 2 });

      const dto: CreateDestinationDto = {
        name: 'Aruba',
        region: Region.CARIBBEAN,
        timezone: 'America/Aruba',
      };
      await service.create(dto, adminId);

      expect(prisma.slugRegistry.createMany).toHaveBeenCalledWith({
        data: [
          {
            destinationSlug: 'aruba',
            slug: 'boat-tours',
            entityType: SlugEntityType.CATEGORY,
            entityId: 'cat-1',
          },
          {
            destinationSlug: 'aruba',
            slug: 'hiking',
            entityType: SlugEntityType.CATEGORY,
            entityId: 'cat-2',
          },
        ],
      });
    });

    it('skips slugRegistry.createMany when there are no active categories', async () => {
      const created = makeDestination({ slug: 'aruba' });
      prisma.destination.create.mockResolvedValue(created);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([]);

      await service.create(
        { name: 'Aruba', region: Region.CARIBBEAN, timezone: 'America/Aruba' },
        adminId,
      );

      expect(prisma.slugRegistry.createMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when destination slug already exists (P2002)', async () => {
      const p2002 = Object.assign(new Error('Unique constraint'), {
        code: 'P2002',
      });
      prisma.destination.create.mockRejectedValue(p2002);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([]);

      const dto: CreateDestinationDto = {
        name: 'Aruba',
        region: Region.CARIBBEAN,
        timezone: 'America/Aruba',
      };
      await expect(service.create(dto, adminId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unknown errors from destination.create unchanged', async () => {
      const unknownErr = new Error('DB connection lost');
      prisma.destination.create.mockRejectedValue(unknownErr);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          {
            name: 'Aruba',
            region: Region.CARIBBEAN,
            timezone: 'America/Aruba',
          },
          adminId,
        ),
      ).rejects.toThrow('DB connection lost');
    });

    it('auto-generates slug from name (removes diacritics, lowercases)', async () => {
      const created = makeDestination({ slug: 'curacao' });
      prisma.destination.create.mockResolvedValue(created);
      prisma.slugRegistry.create.mockResolvedValue({});
      prisma.category.findMany.mockResolvedValue([]);

      await service.create(
        {
          name: 'Curaçao',
          region: Region.CARIBBEAN,
          timezone: 'America/Curacao',
        },
        adminId,
      );

      expect(prisma.destination.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'curacao' }),
        }),
      );
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    const adminId = 'admin-1';

    it('updates destination fields and returns the updated record', async () => {
      const updated = makeDestination({
        name: 'Aruba Updated',
        isActive: true,
      });
      prisma.destination.update.mockResolvedValue(updated);

      const dto: UpdateDestinationDto = { name: 'Aruba Updated' };
      const result = await service.update('dest-1', dto, adminId);

      expect(result).toEqual(updated);
      expect(prisma.destination.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dest-1' },
          data: expect.objectContaining({ name: 'Aruba Updated' }),
        }),
      );
    });

    it('throws NotFoundException on Prisma P2025 (record not found)', async () => {
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.destination.update.mockRejectedValue(p2025);

      const dto: UpdateDestinationDto = { name: 'Ghost' };
      await expect(service.update('missing', dto, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('re-throws unknown errors from destination.update unchanged', async () => {
      const unknownErr = new Error('Timeout');
      prisma.destination.update.mockRejectedValue(unknownErr);

      await expect(service.update('dest-1', {}, adminId)).rejects.toThrow(
        'Timeout',
      );
    });

    it('updates slugRegistry.isActive when isActive is provided in dto', async () => {
      const updated = makeDestination({ isActive: false });
      prisma.destination.update.mockResolvedValue(updated);
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 3 });

      const dto: UpdateDestinationDto = { isActive: false };
      await service.update('dest-1', dto, adminId);

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { destinationSlug: updated.slug },
        data: { isActive: false },
      });
    });

    it('does not call slugRegistry.updateMany when isActive is not in dto', async () => {
      const updated = makeDestination({ name: 'Renamed' });
      prisma.destination.update.mockResolvedValue(updated);

      await service.update('dest-1', { name: 'Renamed' }, adminId);

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────────

  describe('remove', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when destination is not found inside transaction', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing', adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when destination.isSeeded is true', async () => {
      prisma.destination.findUnique.mockResolvedValue(
        makeDestination({ isSeeded: true }),
      );

      await expect(service.remove('dest-1', adminId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when destination has active non-draft tours', async () => {
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.tour.count.mockResolvedValue(3);

      await expect(service.remove('dest-1', adminId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('soft-deletes the destination and deactivates all its slugRegistry rows on success', async () => {
      const dest = makeDestination({ slug: 'curacao' });
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.tour.count.mockResolvedValue(0);
      prisma.destination.update.mockResolvedValue({ ...dest, isActive: false });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.remove('dest-1', adminId);

      expect(prisma.destination.update).toHaveBeenCalledWith({
        where: { id: 'dest-1' },
        data: { isActive: false },
      });
      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { destinationSlug: 'curacao' },
        data: { isActive: false },
      });
      expect(result).toEqual({
        message: 'Destination deactivated successfully',
      });
    });

    it('runs the entire remove flow inside a single $transaction', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.tour.count.mockResolvedValue(0);
      prisma.destination.update.mockResolvedValue({ ...dest, isActive: false });
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 0 });

      await service.remove('dest-1', adminId);

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('includes the tour count in the ConflictException message', async () => {
      prisma.destination.findUnique.mockResolvedValue(makeDestination());
      prisma.tour.count.mockResolvedValue(2);

      await expect(service.remove('dest-1', adminId)).rejects.toThrow('2');
    });
  });

  // ── getAllTranslations ────────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(service.getAllTranslations('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns all translation rows for the destination', async () => {
      const dest = makeDestination();
      const translations = [
        {
          locale: Locale.nl,
          name: 'Curaçao NL',
          overview: null,
          h1Override: null,
          breadcrumbLabel: null,
          isMachineTranslated: false,
        },
      ];
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.findMany.mockResolvedValue(translations);

      const result = await service.getAllTranslations('dest-1');

      expect(result).toEqual(translations);
      expect(prisma.destinationTranslation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { destinationId: 'dest-1' } }),
      );
    });
  });

  // ── getTranslationsByLocale ───────────────────────────────────────────────────

  describe('getTranslationsByLocale', () => {
    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.getTranslationsByLocale('missing', Locale.nl),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the translation row when found', async () => {
      const dest = makeDestination();
      const translation = {
        locale: Locale.nl,
        name: 'Curaçao NL',
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      };
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.findUnique.mockResolvedValue(translation);

      const result = await service.getTranslationsByLocale('dest-1', Locale.nl);

      expect(result).toEqual(translation);
    });

    it('returns null-filled placeholder when no translation row exists for that locale', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.findUnique.mockResolvedValue(null);

      const result = await service.getTranslationsByLocale('dest-1', Locale.nl);

      expect(result).toEqual({
        locale: Locale.nl,
        name: null,
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      });
    });
  });

  // ── upsertTranslations ───────────────────────────────────────────────────────

  describe('upsertTranslations', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      const dto: UpsertDestinationTranslationsDto = {
        fields: { name: 'Curaçao NL' },
        isMachineTranslated: false,
      };
      await expect(
        service.upsertTranslations('missing', Locale.nl, dto, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls destinationTranslation.upsert with correct create/update shape', async () => {
      const dest = makeDestination();
      const upserted = {
        locale: Locale.nl,
        name: 'Curaçao NL',
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      };
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.upsert.mockResolvedValue(upserted);

      const dto: UpsertDestinationTranslationsDto = {
        fields: { name: 'Curaçao NL' },
        isMachineTranslated: false,
      };
      const result = await service.upsertTranslations(
        'dest-1',
        Locale.nl,
        dto,
        adminId,
      );

      expect(prisma.destinationTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            destinationId_locale: {
              destinationId: 'dest-1',
              locale: Locale.nl,
            },
          },
          create: expect.objectContaining({
            destinationId: 'dest-1',
            locale: Locale.nl,
            name: 'Curaçao NL',
          }),
          update: expect.objectContaining({
            name: 'Curaçao NL',
          }),
        }),
      );
      expect(result).toEqual(upserted);
    });

    it('defaults isMachineTranslated to false when not provided in dto', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.upsert.mockResolvedValue({});

      const dto: UpsertDestinationTranslationsDto = {
        fields: { name: 'Curaçao NL' },
      };
      await service.upsertTranslations('dest-1', Locale.nl, dto, adminId);

      expect(prisma.destinationTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });
  });

  // ── deleteTranslations ───────────────────────────────────────────────────────

  describe('deleteTranslations', () => {
    const adminId = 'admin-1';

    it('throws BadRequestException when locale is English (en)', async () => {
      await expect(
        service.deleteTranslations('dest-1', Locale.en, adminId),
      ).rejects.toThrow(BadRequestException);

      // findDestinationOrThrow must NOT be called before the guard
      expect(prisma.destination.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTranslations('missing', Locale.nl, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no translation row exists for that locale (P2025)', async () => {
      const dest = makeDestination();
      const p2025 = Object.assign(new Error('Record not found'), {
        code: 'P2025',
      });
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.delete.mockRejectedValue(p2025);

      await expect(
        service.deleteTranslations('dest-1', Locale.nl, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the translation row and returns a success message on happy path', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.delete.mockResolvedValue({});

      const result = await service.deleteTranslations(
        'dest-1',
        Locale.nl,
        adminId,
      );

      expect(prisma.destinationTranslation.delete).toHaveBeenCalledWith({
        where: {
          destinationId_locale: { destinationId: 'dest-1', locale: Locale.nl },
        },
      });
      expect(result).toEqual({
        message: `Translation for locale "${Locale.nl}" deleted`,
      });
    });

    it('re-throws unknown errors from delete unchanged', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationTranslation.delete.mockRejectedValue(
        new Error('Fatal'),
      );

      await expect(
        service.deleteTranslations('dest-1', Locale.nl, adminId),
      ).rejects.toThrow('Fatal');
    });
  });

  // ── getPageContent ───────────────────────────────────────────────────────────

  describe('getPageContent', () => {
    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.getPageContent('missing', Locale.en),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the page content row when found', async () => {
      const dest = makeDestination();
      const content = {
        locale: Locale.en,
        aboutText: 'About Curaçao',
        metaTitle: 'SEO Title',
        metaDescription: 'SEO desc',
      };
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationPageContent.findUnique.mockResolvedValue(content);

      const result = await service.getPageContent('dest-1', Locale.en);

      expect(result).toEqual(content);
    });

    it('returns null-filled placeholder when no content row exists for that locale', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationPageContent.findUnique.mockResolvedValue(null);

      const result = await service.getPageContent('dest-1', Locale.nl);

      expect(result).toEqual({
        locale: Locale.nl,
        aboutText: null,
        metaTitle: null,
        metaDescription: null,
      });
    });
  });

  // ── upsertPageContent ────────────────────────────────────────────────────────

  describe('upsertPageContent', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      const dto: UpsertDestinationPageContentDto = { aboutText: 'Text' };
      await expect(
        service.upsertPageContent('missing', Locale.en, dto, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls destinationPageContent.upsert with correct shape', async () => {
      const dest = makeDestination();
      const upserted = {
        locale: Locale.en,
        aboutText: 'About text',
        metaTitle: 'Title',
        metaDescription: 'Desc',
      };
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.destinationPageContent.upsert.mockResolvedValue(upserted);

      const dto: UpsertDestinationPageContentDto = {
        aboutText: 'About text',
        metaTitle: 'Title',
        metaDescription: 'Desc',
      };
      const result = await service.upsertPageContent(
        'dest-1',
        Locale.en,
        dto,
        adminId,
      );

      expect(prisma.destinationPageContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            destinationId_locale: {
              destinationId: 'dest-1',
              locale: Locale.en,
            },
          },
          create: expect.objectContaining({
            destinationId: 'dest-1',
            locale: Locale.en,
            aboutText: 'About text',
          }),
        }),
      );
      expect(result).toEqual(upserted);
    });
  });

  // ── getFaqs ──────────────────────────────────────────────────────────────────

  describe('getFaqs', () => {
    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(service.getFaqs('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns all active FAQs for the destination when no locale filter is provided', async () => {
      const dest = makeDestination();
      const faqs = [makeFaq(), makeFaq({ id: 'faq-2', locale: Locale.nl })];
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.faq.findMany.mockResolvedValue(faqs);

      const result = await service.getFaqs('dest-1', {});

      expect(result).toEqual(faqs);
      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pageType: FAQ_PAGE_TYPE.DESTINATION,
            entityId: 'dest-1',
            isActive: true,
          }),
        }),
      );
    });

    it('adds locale filter to the where clause when locale is provided', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.faq.findMany.mockResolvedValue([]);

      const query: FaqLocaleQueryDto = { locale: Locale.nl };
      await service.getFaqs('dest-1', query);

      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locale: Locale.nl }),
        }),
      );
    });

    it('does not add locale to where clause when locale is not provided', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.faq.findMany.mockResolvedValue([]);

      await service.getFaqs('dest-1', {});

      const callArg = prisma.faq.findMany.mock.calls[0][0];
      expect(callArg.where).not.toHaveProperty('locale');
    });
  });

  // ── createFaq ────────────────────────────────────────────────────────────────

  describe('createFaq', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when destination does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      const dto: CreateDestinationFaqDto = {
        locale: Locale.en,
        question: 'Question text here?',
        answer: 'Answer text here for visitors.',
        displayOrder: 0,
      };
      await expect(service.createFaq('missing', dto, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a FAQ with pageType DESTINATION and correct entityId', async () => {
      const dest = makeDestination();
      const faq = makeFaq();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.faq.create.mockResolvedValue(faq);

      const dto: CreateDestinationFaqDto = {
        locale: Locale.en,
        question: 'Question text here?',
        answer: 'Answer text here for visitors.',
        displayOrder: 1,
      };
      const result = await service.createFaq('dest-1', dto, adminId);

      expect(prisma.faq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageType: FAQ_PAGE_TYPE.DESTINATION,
            entityId: 'dest-1',
            locale: Locale.en,
            question: 'Question text here?',
            answer: 'Answer text here for visitors.',
            displayOrder: 1,
          }),
        }),
      );
      expect(result).toEqual(faq);
    });

    it('defaults displayOrder to 0 when not provided', async () => {
      const dest = makeDestination();
      prisma.destination.findUnique.mockResolvedValue(dest);
      prisma.faq.create.mockResolvedValue(makeFaq());

      const dto: CreateDestinationFaqDto = {
        locale: Locale.en,
        question: 'Question text here?',
        answer: 'Answer text here for visitors.',
      };
      await service.createFaq('dest-1', dto, adminId);

      expect(prisma.faq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayOrder: 0 }),
        }),
      );
    });
  });

  // ── updateFaq ────────────────────────────────────────────────────────────────

  describe('updateFaq', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when no FAQ matches the given id and destinationId', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      const dto: UpdateDestinationFaqDto = {
        question: 'New question text here?',
      };
      await expect(
        service.updateFaq('dest-1', 'faq-999', dto, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the FAQ and returns the updated record', async () => {
      const existingFaq = makeFaq();
      const updatedFaq = {
        ...existingFaq,
        question: 'New question text here?',
      };
      prisma.faq.findFirst.mockResolvedValue(existingFaq);
      prisma.faq.update.mockResolvedValue(updatedFaq);

      const dto: UpdateDestinationFaqDto = {
        question: 'New question text here?',
      };
      const result = await service.updateFaq('dest-1', 'faq-1', dto, adminId);

      expect(prisma.faq.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'faq-1' },
          data: expect.objectContaining({
            question: 'New question text here?',
          }),
        }),
      );
      expect(result).toEqual(updatedFaq);
    });

    it('queries faq with pageType DESTINATION and entityId filters', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      const dto: UpdateDestinationFaqDto = {};
      await expect(
        service.updateFaq('dest-1', 'faq-1', dto, adminId),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.faq.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'faq-1',
          pageType: FAQ_PAGE_TYPE.DESTINATION,
          entityId: 'dest-1',
        },
      });
    });

    it('does not include undefined fields in the update data', async () => {
      const existingFaq = makeFaq();
      const updatedFaq = { ...existingFaq, displayOrder: 5 };
      prisma.faq.findFirst.mockResolvedValue(existingFaq);
      prisma.faq.update.mockResolvedValue(updatedFaq);

      // Only displayOrder is provided
      const dto: UpdateDestinationFaqDto = { displayOrder: 5 };
      await service.updateFaq('dest-1', 'faq-1', dto, adminId);

      const updateCall = prisma.faq.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('question');
      expect(updateCall.data).not.toHaveProperty('answer');
      expect(updateCall.data.displayOrder).toBe(5);
    });
  });

  // ── deleteFaq ────────────────────────────────────────────────────────────────

  describe('deleteFaq', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when destination does not exist (via findFirst)', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteFaq('dest-1', 'faq-999', adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the FAQ and returns a success message', async () => {
      const faq = makeFaq();
      prisma.faq.findFirst.mockResolvedValue(faq);
      prisma.faq.delete.mockResolvedValue(faq);

      const result = await service.deleteFaq('dest-1', 'faq-1', adminId);

      expect(prisma.faq.delete).toHaveBeenCalledWith({
        where: { id: 'faq-1' },
      });
      expect(result).toEqual({ message: 'FAQ deleted successfully' });
    });

    it('queries faq.findFirst with correct pageType and entityId', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteFaq('dest-1', 'faq-99', adminId),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.faq.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'faq-99',
          pageType: FAQ_PAGE_TYPE.DESTINATION,
          entityId: 'dest-1',
        },
      });
    });
  });
});
