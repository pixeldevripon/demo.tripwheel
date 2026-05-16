/**
 * Unit tests for CategoryService.
 *
 * PrismaService is fully mocked — no real database connection is made.
 * Tests cover every public method: happy paths, all error branches, pagination,
 * locale translation fallback, transaction semantics (slug_registry + featuredSlot
 * seeding on create, soft-delete via remove), and the English-translation guard in
 * deleteTranslations.
 */

import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Locale, SlugEntityType, TripStatus } from '@prisma/client';
import { CategoryService } from './categories.service';
import {
  CategoryQueryDto,
  CreateCategoryDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  UpdateCategoryDto,
  UpdateFaqDto,
  UpsertCategoryPageContentDto,
  UpsertCategoryTranslationsDto,
} from './dto/category.dto';

// ── Mock factory ──────────────────────────────────────────────────────────────

/**
 * Build a mock PrismaService with jest.fn() stubs for every Prisma model
 * method used by CategoryService.  The `$transaction` mock executes the
 * callback immediately with itself so that transaction-internal Prisma calls
 * can be asserted on the same mock object.
 */
function createMockPrismaService() {
  const mock = {
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    categoryTranslation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    categoryPageContent: {
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
    featuredSlot: {
      createMany: jest.fn(),
    },
    destination: {
      findMany: jest.fn(),
    },
    slugRegistry: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
    },
    trip: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  // Default: $transaction executes the callback synchronously with the mock itself
  mock.$transaction.mockImplementation((fn: (tx: typeof mock) => unknown) =>
    fn(mock),
  );

  return mock;
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function makeCategoryRecord(overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isSeeded: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 'cat-1',
    name: 'Boat Tours',
    slug: 'boat-tours',
    isActive: true,
    isSeeded: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

function makeFaqRecord(overrides: Partial<{
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
}> = {}) {
  return {
    id: 'faq-1',
    question: 'What is included?',
    answer: 'A life jacket and snorkeling gear.',
    displayOrder: 0,
    isActive: true,
    locale: Locale.en,
    ...overrides,
  };
}

function makeTranslationRecord(overrides: Partial<{
  locale: Locale;
  name: string | null;
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  isMachineTranslated: boolean;
}> = {}) {
  return {
    locale: Locale.nl,
    name: 'Boottochten',
    overview: 'Ontdek de mooiste boottochten.',
    h1Override: 'Boottochten op Curaçao',
    breadcrumbLabel: 'Boottochten',
    isMachineTranslated: false,
    ...overrides,
  };
}

// ── Prisma error helper ───────────────────────────────────────────────────────

function makePrismaError(code: string) {
  const err = new Error(`Prisma error ${code}`);
  (err as any).code = code;
  return err;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
    jest.clearAllMocks();

    // Re-apply default $transaction behaviour after clearAllMocks resets it
    prisma.$transaction.mockImplementation((fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
  });

  // ── getAll ─────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns paginated results with correct total, page, limit, and data', async () => {
      const cats = [
        { ...makeCategoryRecord(), translations: [{ name: null, isMachineTranslated: false }] },
      ];
      prisma.category.count.mockResolvedValue(1);
      prisma.category.findMany.mockResolvedValue(cats);

      const query: CategoryQueryDto = { page: 1, limit: 20, locale: Locale.en };
      const result = await service.getAll(query);

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data).toHaveLength(1);
    });

    it('applies isActive filter to both count and findMany when provided', async () => {
      prisma.category.count.mockResolvedValue(0);
      prisma.category.findMany.mockResolvedValue([]);

      const query: CategoryQueryDto = { isActive: true, page: 1, limit: 20, locale: Locale.en };
      await service.getAll(query);

      expect(prisma.category.count).toHaveBeenCalledWith({ where: { isActive: true } });
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('omits isActive filter when not provided in query', async () => {
      prisma.category.count.mockResolvedValue(0);
      prisma.category.findMany.mockResolvedValue([]);

      const query: CategoryQueryDto = { page: 1, limit: 20, locale: Locale.en };
      await service.getAll(query);

      expect(prisma.category.count).toHaveBeenCalledWith({ where: {} });
    });

    it('calculates skip correctly for page 2 with limit 10', async () => {
      prisma.category.count.mockResolvedValue(25);
      prisma.category.findMany.mockResolvedValue([]);

      const query: CategoryQueryDto = { page: 2, limit: 10, locale: Locale.en };
      await service.getAll(query);

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('applies locale translation via applyTranslation when translation row exists', async () => {
      const cats = [
        {
          ...makeCategoryRecord({ name: 'Boat Tours' }),
          translations: [{ name: 'Boottochten', isMachineTranslated: false }],
        },
      ];
      prisma.category.count.mockResolvedValue(1);
      prisma.category.findMany.mockResolvedValue(cats);

      const query: CategoryQueryDto = { page: 1, limit: 20, locale: Locale.nl };
      const result = await service.getAll(query);

      expect(result.data[0].name).toBe('Boottochten');
      expect(result.data[0].locale).toBe(Locale.nl);
      expect(result.data[0].isMachineTranslated).toBe(false);
    });

    it('falls back to base name when no translation row exists for locale', async () => {
      const cats = [
        {
          ...makeCategoryRecord({ name: 'Boat Tours' }),
          translations: [],
        },
      ];
      prisma.category.count.mockResolvedValue(1);
      prisma.category.findMany.mockResolvedValue(cats);

      const query: CategoryQueryDto = { page: 1, limit: 20, locale: Locale.nl };
      const result = await service.getAll(query);

      expect(result.data[0].name).toBe('Boat Tours');
      expect(result.data[0].isMachineTranslated).toBe(false);
    });

    it('uses locale=en as default when no locale provided in query', async () => {
      prisma.category.count.mockResolvedValue(0);
      prisma.category.findMany.mockResolvedValue([]);

      const query: CategoryQueryDto = {};
      await service.getAll(query);

      // findMany should filter translations by locale en (default)
      expect(prisma.category.findMany).toHaveBeenCalledWith(
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

  // ── getActive ──────────────────────────────────────────────────────────────

  describe('getActive', () => {
    it('queries only active categories', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await service.getActive(Locale.en);

      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('applies translation when translation row exists for locale', async () => {
      const data = [
        {
          ...makeCategoryRecord({ name: 'Boat Tours' }),
          translations: [{ name: 'Boottochten', isMachineTranslated: true }],
        },
      ];
      prisma.category.findMany.mockResolvedValue(data);

      const result = await service.getActive(Locale.nl);

      expect(result[0].name).toBe('Boottochten');
      expect(result[0].locale).toBe(Locale.nl);
      expect(result[0].isMachineTranslated).toBe(true);
    });

    it('falls back to base name when no translation row exists', async () => {
      const data = [
        {
          ...makeCategoryRecord({ name: 'Snorkeling' }),
          translations: [],
        },
      ];
      prisma.category.findMany.mockResolvedValue(data);

      const result = await service.getActive(Locale.nl);

      expect(result[0].name).toBe('Snorkeling');
    });

    it('defaults to Locale.en when locale param is omitted', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      await service.getActive();

      expect(prisma.category.findMany).toHaveBeenCalledWith(
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

  // ── getBySlug ──────────────────────────────────────────────────────────────

  describe('getBySlug', () => {
    it('returns category detail when slug matches', async () => {
      const translation = makeTranslationRecord({ locale: Locale.nl });
      prisma.category.findUnique.mockResolvedValue({
        ...makeCategoryRecord(),
        translations: [translation],
      });

      const result = await service.getBySlug('boat-tours', Locale.nl);

      expect(result.slug).toBe('boat-tours');
      expect(result.name).toBe(translation.name);
      expect(result.overview).toBe(translation.overview);
      expect(result.h1Override).toBe(translation.h1Override);
      expect(result.breadcrumbLabel).toBe(translation.breadcrumbLabel);
    });

    it('returns null for optional fields when no translation exists', async () => {
      prisma.category.findUnique.mockResolvedValue({
        ...makeCategoryRecord(),
        translations: [],
      });

      const result = await service.getBySlug('boat-tours', Locale.nl);

      expect(result.overview).toBeNull();
      expect(result.h1Override).toBeNull();
      expect(result.breadcrumbLabel).toBeNull();
    });

    it('throws NotFoundException when slug does not match any category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug('nonexistent-slug', Locale.en)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes the slug in the NotFoundException message', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getBySlug('missing-slug', Locale.en)).rejects.toThrow(
        'missing-slug',
      );
    });

    it('queries Prisma with where: { slug } and the requested locale for translations', async () => {
      prisma.category.findUnique.mockResolvedValue({
        ...makeCategoryRecord(),
        translations: [],
      });

      await service.getBySlug('boat-tours', Locale.nl);

      expect(prisma.category.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'boat-tours' } }),
      );
    });
  });

  // ── getById ────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns category detail when ID matches', async () => {
      const translation = makeTranslationRecord({ locale: Locale.en });
      prisma.category.findUnique.mockResolvedValue({
        ...makeCategoryRecord({ id: 'cat-42' }),
        translations: [translation],
      });

      const result = await service.getById('cat-42', Locale.en);

      expect(result.id).toBe('cat-42');
      expect(result.overview).toBe(translation.overview);
    });

    it('returns null for optional fields when no translation exists', async () => {
      prisma.category.findUnique.mockResolvedValue({
        ...makeCategoryRecord(),
        translations: [],
      });

      const result = await service.getById('cat-1', Locale.nl);

      expect(result.overview).toBeNull();
      expect(result.h1Override).toBeNull();
      expect(result.breadcrumbLabel).toBeNull();
    });

    it('throws NotFoundException when ID does not match any category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getById('bad-id', Locale.en)).rejects.toThrow(NotFoundException);
    });

    it('includes the category id in the NotFoundException message', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing-id', Locale.en)).rejects.toThrow('missing-id');
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateCategoryDto = { name: 'Boat Tours' };
    const adminId = 'admin-1';

    it('creates category inside a $transaction', async () => {
      const created = makeCategoryRecord({ id: 'cat-new' });
      prisma.category.create.mockResolvedValue(created);
      prisma.featuredSlot.createMany.mockResolvedValue({ count: 3 });
      prisma.destination.findMany.mockResolvedValue([]);

      await service.create(dto, adminId);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('auto-generates a slug from the category name', async () => {
      const created = makeCategoryRecord({ id: 'cat-new', slug: 'boat-tours' });
      prisma.category.create.mockResolvedValue(created);
      prisma.featuredSlot.createMany.mockResolvedValue({ count: 3 });
      prisma.destination.findMany.mockResolvedValue([]);

      await service.create({ name: 'Boat Tours' }, adminId);

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'boat-tours' }),
        }),
      );
    });

    it('seeds exactly 3 FeaturedSlot rows with slots 1, 2, 3 and AVAILABLE status', async () => {
      const created = makeCategoryRecord({ id: 'cat-new' });
      prisma.category.create.mockResolvedValue(created);
      prisma.featuredSlot.createMany.mockResolvedValue({ count: 3 });
      prisma.destination.findMany.mockResolvedValue([]);

      await service.create(dto, adminId);

      expect(prisma.featuredSlot.createMany).toHaveBeenCalledWith({
        data: [
          { categoryId: 'cat-new', slotNumber: 1, status: 'AVAILABLE' },
          { categoryId: 'cat-new', slotNumber: 2, status: 'AVAILABLE' },
          { categoryId: 'cat-new', slotNumber: 3, status: 'AVAILABLE' },
        ],
      });
    });

    it('inserts one slug_registry row per active destination', async () => {
      const created = makeCategoryRecord({ id: 'cat-new', slug: 'boat-tours' });
      prisma.category.create.mockResolvedValue(created);
      prisma.featuredSlot.createMany.mockResolvedValue({ count: 3 });
      prisma.destination.findMany.mockResolvedValue([
        { slug: 'curacao' },
        { slug: 'aruba' },
      ]);

      await service.create(dto, adminId);

      expect(prisma.slugRegistry.createMany).toHaveBeenCalledWith({
        data: [
          {
            destinationSlug: 'curacao',
            slug: 'boat-tours',
            entityType: SlugEntityType.CATEGORY,
            entityId: 'cat-new',
          },
          {
            destinationSlug: 'aruba',
            slug: 'boat-tours',
            entityType: SlugEntityType.CATEGORY,
            entityId: 'cat-new',
          },
        ],
      });
    });

    it('skips slug_registry insert when no active destinations exist', async () => {
      const created = makeCategoryRecord({ id: 'cat-new' });
      prisma.category.create.mockResolvedValue(created);
      prisma.featuredSlot.createMany.mockResolvedValue({ count: 3 });
      prisma.destination.findMany.mockResolvedValue([]);

      await service.create(dto, adminId);

      expect(prisma.slugRegistry.createMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException on Prisma P2002 (duplicate slug)', async () => {
      prisma.category.create.mockRejectedValue(makePrismaError('P2002'));

      await expect(service.create(dto, adminId)).rejects.toThrow(ConflictException);
    });

    it('re-throws non-P2002 Prisma errors as-is', async () => {
      const dbError = makePrismaError('P2003');
      prisma.category.create.mockRejectedValue(dbError);

      await expect(service.create(dto, adminId)).rejects.toThrow(dbError);
    });

    it('returns the created category record', async () => {
      const created = makeCategoryRecord({ id: 'cat-new' });
      prisma.category.create.mockResolvedValue(created);
      prisma.featuredSlot.createMany.mockResolvedValue({ count: 3 });
      prisma.destination.findMany.mockResolvedValue([]);

      const result = await service.create(dto, adminId);

      expect(result).toEqual(created);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    const adminId = 'admin-1';

    it('updates category name inside a $transaction', async () => {
      const updated = makeCategoryRecord({ name: 'Sunset Cruises' });
      prisma.category.update.mockResolvedValue(updated);

      const dto: UpdateCategoryDto = { name: 'Sunset Cruises' };
      const result = await service.update('cat-1', dto, adminId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('updates isActive field when provided', async () => {
      const updated = makeCategoryRecord({ isActive: false });
      prisma.category.update.mockResolvedValue(updated);
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 2 });

      const dto: UpdateCategoryDto = { isActive: false };
      await service.update('cat-1', dto, adminId);

      expect(prisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-1' },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it('updates slugRegistry.updateMany when isActive is included in dto', async () => {
      prisma.category.update.mockResolvedValue(makeCategoryRecord({ isActive: false }));
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const dto: UpdateCategoryDto = { isActive: false };
      await service.update('cat-1', dto, adminId);

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.CATEGORY, entityId: 'cat-1' },
        data: { isActive: false },
      });
    });

    it('does NOT call slugRegistry.updateMany when isActive is not in dto', async () => {
      prisma.category.update.mockResolvedValue(makeCategoryRecord({ name: 'New Name' }));

      const dto: UpdateCategoryDto = { name: 'New Name' };
      await service.update('cat-1', dto, adminId);

      expect(prisma.slugRegistry.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException on Prisma P2025 (record not found)', async () => {
      prisma.category.update.mockRejectedValue(makePrismaError('P2025'));

      const dto: UpdateCategoryDto = { name: 'Ghost' };
      await expect(service.update('nonexistent', dto, adminId)).rejects.toThrow(NotFoundException);
    });

    it('re-throws non-P2025 Prisma errors as-is', async () => {
      const dbError = makePrismaError('P2003');
      prisma.category.update.mockRejectedValue(dbError);

      const dto: UpdateCategoryDto = { name: 'X' };
      await expect(service.update('cat-1', dto, adminId)).rejects.toThrow(dbError);
    });
  });

  // ── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('bad-id', adminId)).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when category isSeeded = true', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord({ isSeeded: true }));

      await expect(service.remove('cat-1', adminId)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws ConflictException when active non-draft trips are assigned to the category', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord({ isSeeded: false }));
      prisma.trip.count.mockResolvedValue(2);

      await expect(service.remove('cat-1', adminId)).rejects.toThrow(ConflictException);
    });

    it('soft-deletes category (sets isActive = false) when no trips', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord({ isSeeded: false }));
      prisma.trip.count.mockResolvedValue(0);
      prisma.category.update.mockResolvedValue(makeCategoryRecord({ isActive: false }));
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.remove('cat-1', adminId);

      expect(prisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cat-1' },
          data: { isActive: false },
        }),
      );
    });

    it('sets all slug_registry rows for the category to isActive = false', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord({ isSeeded: false }));
      prisma.trip.count.mockResolvedValue(0);
      prisma.category.update.mockResolvedValue(makeCategoryRecord({ isActive: false }));
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.remove('cat-1', adminId);

      expect(prisma.slugRegistry.updateMany).toHaveBeenCalledWith({
        where: { entityType: SlugEntityType.CATEGORY, entityId: 'cat-1' },
        data: { isActive: false },
      });
    });

    it('returns success message on happy path', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord({ isSeeded: false }));
      prisma.trip.count.mockResolvedValue(0);
      prisma.category.update.mockResolvedValue(makeCategoryRecord({ isActive: false }));
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.remove('cat-1', adminId);

      expect(result).toEqual({ message: 'Category deactivated successfully' });
    });

    it('checks trip count using correct TripStatus filter (not: DRAFT, isActive: true)', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord({ isSeeded: false }));
      prisma.trip.count.mockResolvedValue(0);
      prisma.category.update.mockResolvedValue(makeCategoryRecord({ isActive: false }));
      prisma.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.remove('cat-1', adminId);

      expect(prisma.trip.count).toHaveBeenCalledWith({
        where: {
          categoryId: 'cat-1',
          isActive: true,
          status: { not: TripStatus.DRAFT },
        },
      });
    });
  });

  // ── getAllTranslations ──────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getAllTranslations('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns all translation rows for the category', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const translations = [makeTranslationRecord(), makeTranslationRecord({ locale: Locale.es })];
      prisma.categoryTranslation.findMany.mockResolvedValue(translations);

      const result = await service.getAllTranslations('cat-1');

      expect(result).toEqual(translations);
      expect(prisma.categoryTranslation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { categoryId: 'cat-1' } }),
      );
    });

    it('returns empty array when no translations exist', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryTranslation.findMany.mockResolvedValue([]);

      const result = await service.getAllTranslations('cat-1');

      expect(result).toEqual([]);
    });
  });

  // ── getTranslationsByLocale ────────────────────────────────────────────────

  describe('getTranslationsByLocale', () => {
    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getTranslationsByLocale('bad-id', Locale.nl)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the translation when found for the given locale', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const translation = makeTranslationRecord({ locale: Locale.nl });
      prisma.categoryTranslation.findUnique.mockResolvedValue(translation);

      const result = await service.getTranslationsByLocale('cat-1', Locale.nl);

      expect(result).toEqual(translation);
    });

    it('returns a null-filled placeholder when no translation row exists for locale', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryTranslation.findUnique.mockResolvedValue(null);

      const result = await service.getTranslationsByLocale('cat-1', Locale.nl);

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

  // ── upsertTranslations ─────────────────────────────────────────────────────

  describe('upsertTranslations', () => {
    const adminId = 'admin-1';
    const dto: UpsertCategoryTranslationsDto = {
      fields: { name: 'Boottochten', overview: 'Ontdek de mooiste boottochten.' },
      isMachineTranslated: false,
    };

    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertTranslations('bad-id', Locale.nl, dto, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls categoryTranslation.upsert with correct create and update payloads', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const upserted = makeTranslationRecord({ locale: Locale.nl });
      prisma.categoryTranslation.upsert.mockResolvedValue(upserted);

      await service.upsertTranslations('cat-1', Locale.nl, dto, adminId);

      expect(prisma.categoryTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { categoryId_locale: { categoryId: 'cat-1', locale: Locale.nl } },
          create: expect.objectContaining({
            categoryId: 'cat-1',
            locale: Locale.nl,
            name: 'Boottochten',
            isMachineTranslated: false,
          }),
          update: expect.objectContaining({
            isMachineTranslated: false,
            name: 'Boottochten',
          }),
        }),
      );
    });

    it('uses isMachineTranslated = false when not provided in dto', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryTranslation.upsert.mockResolvedValue(makeTranslationRecord());

      const dtoWithout: UpsertCategoryTranslationsDto = {
        fields: { name: 'X' },
      };
      await service.upsertTranslations('cat-1', Locale.nl, dtoWithout, adminId);

      expect(prisma.categoryTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });

    it('returns the upserted translation row', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const upserted = makeTranslationRecord({ locale: Locale.nl });
      prisma.categoryTranslation.upsert.mockResolvedValue(upserted);

      const result = await service.upsertTranslations('cat-1', Locale.nl, dto, adminId);

      expect(result).toEqual(upserted);
    });
  });

  // ── deleteTranslations ─────────────────────────────────────────────────────

  describe('deleteTranslations', () => {
    const adminId = 'admin-1';

    it('throws BadRequestException when locale is Locale.en', async () => {
      await expect(
        service.deleteTranslations('cat-1', Locale.en, adminId),
      ).rejects.toThrow(BadRequestException);

      // Category lookup should be skipped entirely
      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteTranslations('bad-id', Locale.nl, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when no translation row exists for the locale', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryTranslation.delete.mockRejectedValue(makePrismaError('P2025'));

      await expect(
        service.deleteTranslations('cat-1', Locale.nl, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes the translation row on success', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryTranslation.delete.mockResolvedValue(makeTranslationRecord());

      await service.deleteTranslations('cat-1', Locale.nl, adminId);

      expect(prisma.categoryTranslation.delete).toHaveBeenCalledWith({
        where: { categoryId_locale: { categoryId: 'cat-1', locale: Locale.nl } },
      });
    });

    it('returns success message on happy path', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryTranslation.delete.mockResolvedValue(makeTranslationRecord());

      const result = await service.deleteTranslations('cat-1', Locale.nl, adminId);

      expect(result.message).toContain(String(Locale.nl));
    });

    it('re-throws non-P2025 errors from categoryTranslation.delete', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const dbError = makePrismaError('P2003');
      prisma.categoryTranslation.delete.mockRejectedValue(dbError);

      await expect(
        service.deleteTranslations('cat-1', Locale.nl, adminId),
      ).rejects.toThrow(dbError);
    });
  });

  // ── getPageContent ─────────────────────────────────────────────────────────

  describe('getPageContent', () => {
    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getPageContent('bad-id', Locale.en)).rejects.toThrow(NotFoundException);
    });

    it('returns page content row when it exists for the locale', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const row = { locale: Locale.nl, aboutText: 'Over boottochten', metaTitle: 'Title', metaDescription: 'Desc' };
      prisma.categoryPageContent.findUnique.mockResolvedValue(row);

      const result = await service.getPageContent('cat-1', Locale.nl);

      expect(result).toEqual(row);
    });

    it('returns null-filled placeholder when no page content row exists for locale', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.categoryPageContent.findUnique.mockResolvedValue(null);

      const result = await service.getPageContent('cat-1', Locale.nl);

      expect(result).toEqual({ locale: Locale.nl, aboutText: null, metaTitle: null, metaDescription: null });
    });
  });

  // ── upsertPageContent ──────────────────────────────────────────────────────

  describe('upsertPageContent', () => {
    const adminId = 'admin-1';
    const dto: UpsertCategoryPageContentDto = {
      aboutText: 'About boat tours',
      metaTitle: 'Best Boat Tours',
      metaDescription: 'Discover boat tours',
    };

    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertPageContent('bad-id', Locale.en, dto, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls categoryPageContent.upsert with correct payload', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const upserted = { locale: Locale.en, ...dto };
      prisma.categoryPageContent.upsert.mockResolvedValue(upserted);

      await service.upsertPageContent('cat-1', Locale.en, dto, adminId);

      expect(prisma.categoryPageContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { categoryId_locale: { categoryId: 'cat-1', locale: Locale.en } },
          create: expect.objectContaining({
            categoryId: 'cat-1',
            locale: Locale.en,
            aboutText: dto.aboutText,
          }),
          update: expect.objectContaining({ aboutText: dto.aboutText }),
        }),
      );
    });

    it('returns the upserted page content row', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const upserted = { locale: Locale.en, ...dto };
      prisma.categoryPageContent.upsert.mockResolvedValue(upserted);

      const result = await service.upsertPageContent('cat-1', Locale.en, dto, adminId);

      expect(result).toEqual(upserted);
    });
  });

  // ── getFaqs ────────────────────────────────────────────────────────────────

  describe('getFaqs', () => {
    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.getFaqs('bad-id', {})).rejects.toThrow(NotFoundException);
    });

    it('returns all FAQs when no locale filter is provided', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const faqs = [makeFaqRecord(), makeFaqRecord({ locale: Locale.nl, id: 'faq-2' })];
      prisma.faq.findMany.mockResolvedValue(faqs);

      const query: FaqLocaleQueryDto = {};
      const result = await service.getFaqs('cat-1', query);

      expect(result).toEqual(faqs);
      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pageType: FAQ_PAGE_TYPE.CATEGORY,
            entityId: 'cat-1',
            isActive: true,
          }),
        }),
      );
    });

    it('filters by locale when locale is provided in query', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.faq.findMany.mockResolvedValue([makeFaqRecord({ locale: Locale.nl })]);

      const query: FaqLocaleQueryDto = { locale: Locale.nl };
      await service.getFaqs('cat-1', query);

      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locale: Locale.nl }),
        }),
      );
    });

    it('does NOT include locale in where clause when query.locale is undefined', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.faq.findMany.mockResolvedValue([]);

      await service.getFaqs('cat-1', {});

      const call = prisma.faq.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('locale');
    });
  });

  // ── createFaq ──────────────────────────────────────────────────────────────

  describe('createFaq', () => {
    const adminId = 'admin-1';
    const dto: CreateFaqDto = {
      locale: Locale.en,
      question: 'What is included?',
      answer: 'A life jacket and snorkeling gear.',
      displayOrder: 0,
    };

    it('throws NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.createFaq('bad-id', dto, adminId)).rejects.toThrow(NotFoundException);
    });

    it('creates FAQ with pageType = FAQ_PAGE_TYPE.CATEGORY and the category entityId', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const created = makeFaqRecord();
      prisma.faq.create.mockResolvedValue(created);

      await service.createFaq('cat-1', dto, adminId);

      expect(prisma.faq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageType: FAQ_PAGE_TYPE.CATEGORY,
            entityId: 'cat-1',
            locale: Locale.en,
            question: dto.question,
            answer: dto.answer,
          }),
        }),
      );
    });

    it('uses displayOrder = 0 when dto.displayOrder is undefined', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      prisma.faq.create.mockResolvedValue(makeFaqRecord());

      const dtoWithout: CreateFaqDto = {
        locale: Locale.en,
        question: 'What is included?',
        answer: 'A life jacket.',
      };
      await service.createFaq('cat-1', dtoWithout, adminId);

      expect(prisma.faq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayOrder: 0 }),
        }),
      );
    });

    it('returns the created FAQ record', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategoryRecord());
      const created = makeFaqRecord();
      prisma.faq.create.mockResolvedValue(created);

      const result = await service.createFaq('cat-1', dto, adminId);

      expect(result).toEqual(created);
    });
  });

  // ── updateFaq ──────────────────────────────────────────────────────────────

  describe('updateFaq', () => {
    const adminId = 'admin-1';
    const dto: UpdateFaqDto = { question: 'Is food included?', answer: 'Yes, light snacks.' };

    it('throws NotFoundException when category not found (faq.findFirst returns null)', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(service.updateFaq('cat-1', 'faq-1', dto, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('looks up FAQ using categoryId, pageType, and faqId together', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(service.updateFaq('cat-1', 'faq-1', dto, adminId)).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.faq.findFirst).toHaveBeenCalledWith({
        where: { id: 'faq-1', pageType: FAQ_PAGE_TYPE.CATEGORY, entityId: 'cat-1' },
      });
    });

    it('updates FAQ fields when FAQ exists for the category', async () => {
      prisma.faq.findFirst.mockResolvedValue(makeFaqRecord());
      const updated = makeFaqRecord({ question: dto.question! });
      prisma.faq.update.mockResolvedValue(updated);

      await service.updateFaq('cat-1', 'faq-1', dto, adminId);

      expect(prisma.faq.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'faq-1' },
          data: expect.objectContaining({ question: dto.question }),
        }),
      );
    });

    it('returns the updated FAQ record', async () => {
      prisma.faq.findFirst.mockResolvedValue(makeFaqRecord());
      const updated = makeFaqRecord({ question: 'Is food included?' });
      prisma.faq.update.mockResolvedValue(updated);

      const result = await service.updateFaq('cat-1', 'faq-1', dto, adminId);

      expect(result).toEqual(updated);
    });
  });

  // ── deleteFaq ──────────────────────────────────────────────────────────────

  describe('deleteFaq', () => {
    const adminId = 'admin-1';

    it('throws NotFoundException when FAQ not found for the category', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(service.deleteFaq('cat-1', 'faq-1', adminId)).rejects.toThrow(NotFoundException);
      expect(prisma.faq.delete).not.toHaveBeenCalled();
    });

    it('looks up FAQ using categoryId, pageType, and faqId', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(service.deleteFaq('cat-1', 'faq-99', adminId)).rejects.toThrow(NotFoundException);

      expect(prisma.faq.findFirst).toHaveBeenCalledWith({
        where: { id: 'faq-99', pageType: FAQ_PAGE_TYPE.CATEGORY, entityId: 'cat-1' },
      });
    });

    it('deletes the FAQ by id on success', async () => {
      prisma.faq.findFirst.mockResolvedValue(makeFaqRecord());
      prisma.faq.delete.mockResolvedValue(makeFaqRecord());

      await service.deleteFaq('cat-1', 'faq-1', adminId);

      expect(prisma.faq.delete).toHaveBeenCalledWith({ where: { id: 'faq-1' } });
    });

    it('returns success message on happy path', async () => {
      prisma.faq.findFirst.mockResolvedValue(makeFaqRecord());
      prisma.faq.delete.mockResolvedValue(makeFaqRecord());

      const result = await service.deleteFaq('cat-1', 'faq-1', adminId);

      expect(result).toEqual({ message: 'FAQ deleted successfully' });
    });
  });
});
