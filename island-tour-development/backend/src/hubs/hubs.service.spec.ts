/**
 * Unit tests for HubService.
 *
 * PrismaService is fully mocked — no real database connection is made.
 * Tests cover every public method including all error paths, P2002/P2025 handling,
 * seeded-hub guards, transaction logic, slug registry writes, FAQ management,
 * allowed-category management, translation upserts, and page-content upserts.
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
import { HubType, Locale, SlugEntityType, TripStatus } from '@prisma/client';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateFaqDto,
  CreateHubDto,
  FaqLocaleQueryDto,
  HubBySlugQueryDto,
  HubQueryDto,
  UpdateFaqDto,
  UpdateHubDto,
  UpsertHubPageContentDto,
  UpsertHubTranslationsDto,
} from './dto/hub.dto';
import { HubService } from './hubs.service';

// ── Mock factory ─────────────────────────────────────────────────────────────

function createMockPrismaService() {
  const mockTx = {
    destination: { findUnique: jest.fn() },
    hub: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    slugRegistry: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    hubAllowedCategory: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    hubTranslation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    hubPageContent: {
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
    category: {
      findUnique: jest.fn(),
    },
    trip: {
      count: jest.fn(),
    },
  };

  return {
    ...mockTx,
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof mockTx) => unknown) =>
      fn(mockTx),
    ),
    _tx: mockTx, // expose for per-test access
  };
}

// ── Data fixtures ─────────────────────────────────────────────────────────────

function makeHub(overrides: Partial<{
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  description: string | null;
  isSeeded: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: 'hub-1',
    destinationId: 'dest-1',
    name: 'Klein Curaçao',
    slug: 'klein-curacao',
    description: 'A small uninhabited island.',
    isSeeded: false,
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

function makeHubDetail(overrides: Partial<ReturnType<typeof makeHub>> = {}) {
  return {
    ...makeHub(overrides),
    allowedCategories: [],
  };
}

function makeTranslation(overrides: Partial<{
  locale: Locale;
  name: string | null;
  overview: string | null;
  h1Override: string | null;
  breadcrumbLabel: string | null;
  isMachineTranslated: boolean;
}> = {}) {
  return {
    locale: Locale.nl,
    name: 'Klein Curaçao (NL)',
    overview: null,
    h1Override: null,
    breadcrumbLabel: null,
    isMachineTranslated: false,
    ...overrides,
  };
}

function makeFaq(overrides: Partial<{
  id: string;
  locale: Locale;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
}> = {}) {
  return {
    id: 'faq-1',
    locale: Locale.en,
    question: 'What should I bring?',
    answer: 'Bring sunscreen, water, and a hat.',
    displayOrder: 0,
    isActive: true,
    ...overrides,
  };
}

function makeAllowedCategory(overrides: Partial<{
  id: string;
  categoryId: string;
  category: { id: string; name: string; slug: string };
}> = {}) {
  return {
    id: 'hac-1',
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours' },
    ...overrides,
  };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('HubService', () => {
  let service: HubService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [HubService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<HubService>(HubService);
    jest.clearAllMocks();
  });

  // ── getAll ────────────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns paginated results with correct total, page, limit, and data', async () => {
      const hub = makeHub();
      prisma.hub.count.mockResolvedValue(1);
      prisma.hub.findMany.mockResolvedValue([
        { ...hub, translations: [{ name: null, isMachineTranslated: false }] },
      ]);

      const query: HubQueryDto = { page: 1, limit: 20 };
      const result = await service.getAll(query);

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Klein Curaçao');
    });

    it('applies isActive filter to where clause when provided', async () => {
      prisma.hub.count.mockResolvedValue(0);
      prisma.hub.findMany.mockResolvedValue([]);

      const query: HubQueryDto = { isActive: false, page: 1, limit: 20 };
      await service.getAll(query);

      expect(prisma.hub.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
      expect(prisma.hub.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('applies destinationId filter to where clause when provided', async () => {
      prisma.hub.count.mockResolvedValue(0);
      prisma.hub.findMany.mockResolvedValue([]);

      const query: HubQueryDto = { destinationId: 'dest-99', page: 1, limit: 20 };
      await service.getAll(query);

      expect(prisma.hub.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { destinationId: 'dest-99' } }),
      );
    });

    it('applies both isActive and destinationId filters together', async () => {
      prisma.hub.count.mockResolvedValue(0);
      prisma.hub.findMany.mockResolvedValue([]);

      const query: HubQueryDto = { destinationId: 'dest-2', isActive: true, page: 1, limit: 20 };
      await service.getAll(query);

      expect(prisma.hub.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { destinationId: 'dest-2', isActive: true } }),
      );
    });

    it('calculates skip correctly for page 2 with limit 10', async () => {
      prisma.hub.count.mockResolvedValue(25);
      prisma.hub.findMany.mockResolvedValue([]);

      const query: HubQueryDto = { page: 2, limit: 10 };
      const result = await service.getAll(query);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(prisma.hub.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('uses translation name when a translation row exists for the locale', async () => {
      const hub = makeHub({ name: 'Klein Curaçao' });
      prisma.hub.count.mockResolvedValue(1);
      prisma.hub.findMany.mockResolvedValue([
        { ...hub, translations: [{ name: 'Klein Curaçao (NL)', isMachineTranslated: true }] },
      ]);

      const query: HubQueryDto = { locale: Locale.nl };
      const result = await service.getAll(query);

      expect(result.data[0].name).toBe('Klein Curaçao (NL)');
      expect(result.data[0].isMachineTranslated).toBe(true);
    });

    it('falls back to base name when no translation row exists', async () => {
      const hub = makeHub({ name: 'Klein Curaçao' });
      prisma.hub.count.mockResolvedValue(1);
      prisma.hub.findMany.mockResolvedValue([
        { ...hub, translations: [] },
      ]);

      const query: HubQueryDto = { locale: Locale.nl };
      const result = await service.getAll(query);

      expect(result.data[0].name).toBe('Klein Curaçao');
      expect(result.data[0].isMachineTranslated).toBe(false);
    });

    it('omits isActive from where clause when not provided', async () => {
      prisma.hub.count.mockResolvedValue(0);
      prisma.hub.findMany.mockResolvedValue([]);

      const query: HubQueryDto = { page: 1, limit: 20 };
      await service.getAll(query);

      expect(prisma.hub.count).toHaveBeenCalledWith({ where: {} });
    });
  });

  // ── getActive ─────────────────────────────────────────────────────────────────

  describe('getActive', () => {
    it('returns all active hubs with translation applied', async () => {
      const hub = makeHubDetail();
      prisma.hub.findMany.mockResolvedValue([
        { ...hub, translations: [{ name: 'Klein (NL)', isMachineTranslated: false }] },
      ]);

      const query: ActiveHubsQueryDto = { locale: Locale.nl };
      const result = await service.getActive(query);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Klein (NL)');
      expect(prisma.hub.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('applies destinationId filter when provided', async () => {
      prisma.hub.findMany.mockResolvedValue([]);

      const query: ActiveHubsQueryDto = { destinationId: 'dest-7', locale: Locale.en };
      await service.getActive(query);

      expect(prisma.hub.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, destinationId: 'dest-7' } }),
      );
    });

    it('omits destinationId from where clause when not provided', async () => {
      prisma.hub.findMany.mockResolvedValue([]);

      const query: ActiveHubsQueryDto = { locale: Locale.en };
      await service.getActive(query);

      expect(prisma.hub.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('falls back to base name when no translation exists', async () => {
      const hub = makeHubDetail({ name: 'Willemstad' });
      prisma.hub.findMany.mockResolvedValue([
        { ...hub, translations: [] },
      ]);

      const query: ActiveHubsQueryDto = { locale: Locale.fr };
      const result = await service.getActive(query);

      expect(result[0].name).toBe('Willemstad');
      expect(result[0].isMachineTranslated).toBe(false);
    });

    it('sets locale on returned result matching the query locale', async () => {
      const hub = makeHubDetail();
      prisma.hub.findMany.mockResolvedValue([
        { ...hub, translations: [] },
      ]);

      const query: ActiveHubsQueryDto = { locale: Locale.es };
      const result = await service.getActive(query);

      expect(result[0].locale).toBe(Locale.es);
    });
  });

  // ── getBySlug ─────────────────────────────────────────────────────────────────

  describe('getBySlug', () => {
    it('returns hub with translated fields when slug and destinationSlug match', async () => {
      const hub = makeHubDetail();
      prisma.hub.findFirst.mockResolvedValue({
        ...hub,
        translations: [
          {
            name: 'Klein',
            overview: 'An island.',
            h1Override: 'Day Trips',
            breadcrumbLabel: 'Klein',
            isMachineTranslated: false,
          },
        ],
      });

      const query: HubBySlugQueryDto = { destinationSlug: 'curacao', locale: Locale.en };
      const result = await service.getBySlug('klein-curacao', query);

      expect(result).toBeDefined();
      expect(result.slug).toBe('klein-curacao');
      expect(result.overview).toBe('An island.');
      expect(result.h1Override).toBe('Day Trips');
      expect(result.breadcrumbLabel).toBe('Klein');
    });

    it('throws NotFoundException when hub is not found', async () => {
      prisma.hub.findFirst.mockResolvedValue(null);

      const query: HubBySlugQueryDto = { destinationSlug: 'curacao', locale: Locale.en };
      await expect(service.getBySlug('nonexistent', query)).rejects.toThrow(NotFoundException);
    });

    it('includes slug and destinationSlug in the NotFoundException message', async () => {
      prisma.hub.findFirst.mockResolvedValue(null);

      const query: HubBySlugQueryDto = { destinationSlug: 'aruba', locale: Locale.en };
      await expect(service.getBySlug('missing-hub', query)).rejects.toThrow('aruba');
    });

    it('returns null for overview, h1Override, breadcrumbLabel when no translation exists', async () => {
      const hub = makeHubDetail();
      prisma.hub.findFirst.mockResolvedValue({ ...hub, translations: [] });

      const query: HubBySlugQueryDto = { destinationSlug: 'curacao', locale: Locale.en };
      const result = await service.getBySlug('klein-curacao', query);

      expect(result.overview).toBeNull();
      expect(result.h1Override).toBeNull();
      expect(result.breadcrumbLabel).toBeNull();
    });
  });

  // ── getById ───────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns hub with translation fields when found', async () => {
      const hub = makeHubDetail();
      prisma.hub.findUnique.mockResolvedValue({
        ...hub,
        translations: [
          {
            name: 'Klein',
            overview: 'An overview.',
            h1Override: null,
            breadcrumbLabel: null,
            isMachineTranslated: false,
          },
        ],
      });

      const result = await service.getById('hub-1', Locale.en);

      expect(result).toBeDefined();
      expect(result.id).toBe('hub-1');
      expect(result.overview).toBe('An overview.');
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent', Locale.en)).rejects.toThrow(NotFoundException);
    });

    it('includes the hub id in the NotFoundException message', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing-hub-id', Locale.en)).rejects.toThrow('missing-hub-id');
    });

    it('returns null for optional fields when no translation row exists', async () => {
      const hub = makeHubDetail();
      prisma.hub.findUnique.mockResolvedValue({ ...hub, translations: [] });

      const result = await service.getById('hub-1', Locale.en);

      expect(result.overview).toBeNull();
      expect(result.h1Override).toBeNull();
      expect(result.breadcrumbLabel).toBeNull();
    });

    it('defaults locale to en when not specified', async () => {
      const hub = makeHubDetail();
      prisma.hub.findUnique.mockResolvedValue({ ...hub, translations: [] });

      const result = await service.getById('hub-1');

      expect(result.locale).toBe(Locale.en);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('runs hub create and slug registry create inside a single transaction', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      _tx.hub.create.mockResolvedValue({ id: 'hub-new' });
      _tx.slugRegistry.create.mockResolvedValue({});
      _tx.hub.findUniqueOrThrow.mockResolvedValue(makeHubDetail({ id: 'hub-new' }));

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      await service.create(dto, 'admin-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(_tx.hub.create).toHaveBeenCalledTimes(1);
      expect(_tx.slugRegistry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destinationSlug: 'curacao',
            entityType: SlugEntityType.HUB,
            entityId: 'hub-new',
          }),
        }),
      );
    });

    it('auto-generates the slug from the hub name', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      _tx.hub.create.mockResolvedValue({ id: 'hub-new' });
      _tx.slugRegistry.create.mockResolvedValue({});
      _tx.hub.findUniqueOrThrow.mockResolvedValue(makeHubDetail({ id: 'hub-new', slug: 'klein-curacao' }));

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      await service.create(dto, 'admin-1');

      expect(_tx.hub.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'klein-curacao' }),
        }),
      );
    });

    it('throws NotFoundException when destination is not found inside the transaction', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue(null);

      const dto: CreateHubDto = { destinationId: 'nonexistent-dest', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      await expect(service.create(dto, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when hub.create fails with P2002', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });

      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      _tx.hub.create.mockRejectedValue(p2002);

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      await expect(service.create(dto, 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when slugRegistry.create fails with P2002', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      _tx.hub.create.mockResolvedValue({ id: 'hub-new' });

      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      _tx.slugRegistry.create.mockRejectedValue(p2002);

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      await expect(service.create(dto, 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('creates hubAllowedCategory rows when allowedCategoryIds are provided', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      _tx.hub.create.mockResolvedValue({ id: 'hub-new' });
      _tx.slugRegistry.create.mockResolvedValue({});
      _tx.hubAllowedCategory.createMany.mockResolvedValue({ count: 2 });
      _tx.hub.findUniqueOrThrow.mockResolvedValue(makeHubDetail({ id: 'hub-new' }));

      const dto: CreateHubDto = {
        destinationId: 'dest-1',
        name: 'Klein Curaçao',
        hubType: HubType.LOCATION,
        allowedCategoryIds: ['cat-1', 'cat-2'],
      };
      await service.create(dto, 'admin-1');

      expect(_tx.hubAllowedCategory.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [
            { hubId: 'hub-new', categoryId: 'cat-1' },
            { hubId: 'hub-new', categoryId: 'cat-2' },
          ],
          skipDuplicates: true,
        }),
      );
    });

    it('skips hubAllowedCategory.createMany when allowedCategoryIds is empty or absent', async () => {
      const { _tx } = prisma;
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      _tx.hub.create.mockResolvedValue({ id: 'hub-new' });
      _tx.slugRegistry.create.mockResolvedValue({});
      _tx.hub.findUniqueOrThrow.mockResolvedValue(makeHubDetail({ id: 'hub-new' }));

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      await service.create(dto, 'admin-1');

      expect(_tx.hubAllowedCategory.createMany).not.toHaveBeenCalled();
    });

    it('returns the full hub detail from findUniqueOrThrow', async () => {
      const { _tx } = prisma;
      const expectedHub = makeHubDetail({ id: 'hub-new' });
      _tx.destination.findUnique.mockResolvedValue({ slug: 'curacao' });
      _tx.hub.create.mockResolvedValue({ id: 'hub-new' });
      _tx.slugRegistry.create.mockResolvedValue({});
      _tx.hub.findUniqueOrThrow.mockResolvedValue(expectedHub);

      const dto: CreateHubDto = { destinationId: 'dest-1', name: 'Klein Curaçao', hubType: HubType.LOCATION };
      const result = await service.create(dto, 'admin-1');

      expect(result).toEqual(expectedHub);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates hub fields inside a transaction and returns updated hub', async () => {
      const { _tx } = prisma;
      const updatedHub = makeHubDetail({ name: 'Updated Name' });
      _tx.hub.update.mockResolvedValue(updatedHub);

      const dto: UpdateHubDto = { name: 'Updated Name' };
      const result = await service.update('hub-1', dto, 'admin-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(_tx.hub.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hub-1' },
          data: expect.objectContaining({ name: 'Updated Name' }),
        }),
      );
      expect(result).toEqual(updatedHub);
    });

    it('updates slugRegistry when isActive changes', async () => {
      const { _tx } = prisma;
      _tx.hub.update.mockResolvedValue(makeHubDetail({ isActive: false }));
      _tx.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const dto: UpdateHubDto = { isActive: false };
      await service.update('hub-1', dto, 'admin-1');

      expect(_tx.slugRegistry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: SlugEntityType.HUB, entityId: 'hub-1' },
          data: { isActive: false },
        }),
      );
    });

    it('does not call slugRegistry.updateMany when isActive is not in the dto', async () => {
      const { _tx } = prisma;
      _tx.hub.update.mockResolvedValue(makeHubDetail({ name: 'New Name' }));

      const dto: UpdateHubDto = { name: 'New Name' };
      await service.update('hub-1', dto, 'admin-1');

      expect(_tx.slugRegistry.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when hub does not exist (P2025)', async () => {
      const { _tx } = prisma;
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
      _tx.hub.update.mockRejectedValue(p2025);

      const dto: UpdateHubDto = { name: 'Something' };
      await expect(service.update('nonexistent', dto, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('re-throws non-P2025 errors from hub.update', async () => {
      const { _tx } = prisma;
      const unexpectedError = new Error('DB connection failed');
      _tx.hub.update.mockRejectedValue(unexpectedError);

      const dto: UpdateHubDto = { name: 'Test' };
      await expect(service.update('hub-1', dto, 'admin-1')).rejects.toThrow('DB connection failed');
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws ForbiddenException when the hub is seeded', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub({ isSeeded: true }));

      await expect(service.remove('hub-1', 'admin-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException inside transaction when active non-draft trips exist', async () => {
      const { _tx } = prisma;
      prisma.hub.findUnique.mockResolvedValue(makeHub({ isSeeded: false }));
      _tx.trip.count.mockResolvedValue(3);

      await expect(service.remove('hub-1', 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('soft-deletes hub and updates slugRegistry when no active trips exist', async () => {
      const { _tx } = prisma;
      prisma.hub.findUnique.mockResolvedValue(makeHub({ isSeeded: false }));
      _tx.trip.count.mockResolvedValue(0);
      _tx.hub.update.mockResolvedValue({});
      _tx.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.remove('hub-1', 'admin-1');

      expect(_tx.hub.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'hub-1' }, data: { isActive: false } }),
      );
      expect(_tx.slugRegistry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: SlugEntityType.HUB, entityId: 'hub-1' },
          data: { isActive: false },
        }),
      );
      expect(result).toEqual({ message: 'Hub deactivated successfully' });
    });

    it('queries trips with correct active non-draft filter inside transaction', async () => {
      const { _tx } = prisma;
      prisma.hub.findUnique.mockResolvedValue(makeHub({ isSeeded: false }));
      _tx.trip.count.mockResolvedValue(0);
      _tx.hub.update.mockResolvedValue({});
      _tx.slugRegistry.updateMany.mockResolvedValue({ count: 1 });

      await service.remove('hub-1', 'admin-1');

      expect(_tx.trip.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            hubs: { some: { hubId: 'hub-1' } },
            isActive: true,
            status: { not: TripStatus.DRAFT },
          },
        }),
      );
    });
  });

  // ── getAllTranslations ─────────────────────────────────────────────────────────

  describe('getAllTranslations', () => {
    it('returns array of translations for an existing hub', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const translations = [makeTranslation({ locale: Locale.nl }), makeTranslation({ locale: Locale.es })];
      prisma.hubTranslation.findMany.mockResolvedValue(translations);

      const result = await service.getAllTranslations('hub-1');

      expect(result).toEqual(translations);
      expect(prisma.hubTranslation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { hubId: 'hub-1' } }),
      );
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getAllTranslations('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.hubTranslation.findMany).not.toHaveBeenCalled();
    });
  });

  // ── getTranslationsByLocale ───────────────────────────────────────────────────

  describe('getTranslationsByLocale', () => {
    it('returns the translation when it exists for the given locale', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const translation = makeTranslation({ locale: Locale.nl });
      prisma.hubTranslation.findUnique.mockResolvedValue(translation);

      const result = await service.getTranslationsByLocale('hub-1', Locale.nl);

      expect(result).toEqual(translation);
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getTranslationsByLocale('nonexistent', Locale.nl)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty shell object with locale when no translation row exists', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.hubTranslation.findUnique.mockResolvedValue(null);

      const result = await service.getTranslationsByLocale('hub-1', Locale.fr);

      expect(result).toMatchObject({
        locale: Locale.fr,
        name: null,
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      });
    });
  });

  // ── upsertTranslations ────────────────────────────────────────────────────────

  describe('upsertTranslations', () => {
    it('calls hubTranslation.upsert with correct fields for create and update', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const upsertedTranslation = makeTranslation({ locale: Locale.nl, name: 'Klein (NL)' });
      prisma.hubTranslation.upsert.mockResolvedValue(upsertedTranslation);

      const dto: UpsertHubTranslationsDto = {
        fields: { name: 'Klein (NL)', overview: 'An island.' },
        isMachineTranslated: false,
      };
      const result = await service.upsertTranslations('hub-1', Locale.nl, dto, 'admin-1');

      expect(prisma.hubTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hubId_locale: { hubId: 'hub-1', locale: Locale.nl } },
          create: expect.objectContaining({ hubId: 'hub-1', locale: Locale.nl, name: 'Klein (NL)' }),
        }),
      );
      expect(result).toEqual(upsertedTranslation);
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      const dto: UpsertHubTranslationsDto = {
        fields: { name: 'Test' },
        isMachineTranslated: false,
      };
      await expect(service.upsertTranslations('nonexistent', Locale.nl, dto, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('defaults isMachineTranslated to false when not provided', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.hubTranslation.upsert.mockResolvedValue(makeTranslation());

      const dto: UpsertHubTranslationsDto = {
        fields: { name: 'Test' },
        isMachineTranslated: undefined,
      };
      await service.upsertTranslations('hub-1', Locale.nl, dto, 'admin-1');

      expect(prisma.hubTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isMachineTranslated: false }),
          update: expect.objectContaining({ isMachineTranslated: false }),
        }),
      );
    });
  });

  // ── deleteTranslations ────────────────────────────────────────────────────────

  describe('deleteTranslations', () => {
    it('throws BadRequestException when locale is Locale.en', async () => {
      await expect(service.deleteTranslations('hub-1', Locale.en, 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.hub.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.deleteTranslations('nonexistent', Locale.nl, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.hubTranslation.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no translation row exists for the locale (P2025)', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const p2025 = Object.assign(new Error('Record not found'), { code: 'P2025' });
      prisma.hubTranslation.delete.mockRejectedValue(p2025);

      await expect(service.deleteTranslations('hub-1', Locale.nl, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes the translation and returns success message on happy path', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.hubTranslation.delete.mockResolvedValue({});

      const result = await service.deleteTranslations('hub-1', Locale.nl, 'admin-1');

      expect(prisma.hubTranslation.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hubId_locale: { hubId: 'hub-1', locale: Locale.nl } },
        }),
      );
      expect(result).toMatchObject({ message: expect.stringContaining('nl') });
    });
  });

  // ── getPageContent ────────────────────────────────────────────────────────────

  describe('getPageContent', () => {
    it('returns page content row when it exists', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const content = { locale: Locale.en, aboutText: 'An island.', metaTitle: 'Title', metaDescription: 'Desc' };
      prisma.hubPageContent.findUnique.mockResolvedValue(content);

      const result = await service.getPageContent('hub-1', Locale.en);

      expect(result).toEqual(content);
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getPageContent('nonexistent', Locale.en)).rejects.toThrow(NotFoundException);
    });

    it('returns null-filled shell when no page content row exists', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.hubPageContent.findUnique.mockResolvedValue(null);

      const result = await service.getPageContent('hub-1', Locale.de);

      expect(result).toEqual({ locale: Locale.de, aboutText: null, metaTitle: null, metaDescription: null });
    });
  });

  // ── upsertPageContent ─────────────────────────────────────────────────────────

  describe('upsertPageContent', () => {
    it('calls hubPageContent.upsert and returns the result', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const upserted = { locale: Locale.en, aboutText: 'About.', metaTitle: 'Title', metaDescription: 'Desc' };
      prisma.hubPageContent.upsert.mockResolvedValue(upserted);

      const dto: UpsertHubPageContentDto = { aboutText: 'About.', metaTitle: 'Title', metaDescription: 'Desc' };
      const result = await service.upsertPageContent('hub-1', Locale.en, dto, 'admin-1');

      expect(prisma.hubPageContent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hubId_locale: { hubId: 'hub-1', locale: Locale.en } },
          create: expect.objectContaining({ hubId: 'hub-1', locale: Locale.en, aboutText: 'About.' }),
        }),
      );
      expect(result).toEqual(upserted);
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      const dto: UpsertHubPageContentDto = { aboutText: 'About.' };
      await expect(service.upsertPageContent('nonexistent', Locale.en, dto, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getFaqs ───────────────────────────────────────────────────────────────────

  describe('getFaqs', () => {
    it('returns FAQs for an existing hub', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const faqs = [makeFaq()];
      prisma.faq.findMany.mockResolvedValue(faqs);

      const query: FaqLocaleQueryDto = {};
      const result = await service.getFaqs('hub-1', query);

      expect(result).toEqual(faqs);
      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pageType: FAQ_PAGE_TYPE.HUB,
            entityId: 'hub-1',
            isActive: true,
          }),
        }),
      );
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getFaqs('nonexistent', {})).rejects.toThrow(NotFoundException);
    });

    it('applies locale filter to where clause when locale is provided', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.faq.findMany.mockResolvedValue([]);

      const query: FaqLocaleQueryDto = { locale: Locale.nl };
      await service.getFaqs('hub-1', query);

      expect(prisma.faq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ locale: Locale.nl }),
        }),
      );
    });

    it('omits locale from where clause when not provided', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.faq.findMany.mockResolvedValue([]);

      const query: FaqLocaleQueryDto = {};
      await service.getFaqs('hub-1', query);

      const callArg = prisma.faq.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
      expect(callArg.where).not.toHaveProperty('locale');
    });
  });

  // ── createFaq ─────────────────────────────────────────────────────────────────

  describe('createFaq', () => {
    it('creates FAQ with FAQ_PAGE_TYPE.HUB and returns the result', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const faq = makeFaq();
      prisma.faq.create.mockResolvedValue(faq);

      const dto: CreateFaqDto = {
        locale: Locale.en,
        question: 'What should I bring?',
        answer: 'Bring sunscreen, water, and a hat.',
        displayOrder: 0,
      };
      const result = await service.createFaq('hub-1', dto, 'admin-1');

      expect(prisma.faq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pageType: FAQ_PAGE_TYPE.HUB,
            entityId: 'hub-1',
            locale: Locale.en,
            question: 'What should I bring?',
          }),
        }),
      );
      expect(result).toEqual(faq);
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      const dto: CreateFaqDto = {
        locale: Locale.en,
        question: 'What should I bring?',
        answer: 'Bring sunscreen and water.',
      };
      await expect(service.createFaq('nonexistent', dto, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('defaults displayOrder to 0 when not provided', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.faq.create.mockResolvedValue(makeFaq());

      const dto: CreateFaqDto = {
        locale: Locale.en,
        question: 'What should I bring?',
        answer: 'Bring sunscreen and water.',
      };
      await service.createFaq('hub-1', dto, 'admin-1');

      expect(prisma.faq.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayOrder: 0 }),
        }),
      );
    });
  });

  // ── updateFaq ─────────────────────────────────────────────────────────────────

  describe('updateFaq', () => {
    it('updates FAQ fields and returns the updated FAQ', async () => {
      const faq = makeFaq();
      prisma.faq.findFirst.mockResolvedValue(faq);
      const updatedFaq = makeFaq({ question: 'Updated question?' });
      prisma.faq.update.mockResolvedValue(updatedFaq);

      const dto: UpdateFaqDto = { question: 'Updated question?' };
      const result = await service.updateFaq('hub-1', 'faq-1', dto, 'admin-1');

      expect(prisma.faq.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'faq-1', pageType: FAQ_PAGE_TYPE.HUB, entityId: 'hub-1' },
        }),
      );
      expect(prisma.faq.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'faq-1' },
          data: expect.objectContaining({ question: 'Updated question?' }),
        }),
      );
      expect(result).toEqual(updatedFaq);
    });

    it('throws NotFoundException when FAQ is not found for this hub', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      const dto: UpdateFaqDto = { question: 'Updated?' };
      await expect(service.updateFaq('hub-1', 'nonexistent-faq', dto, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.faq.update).not.toHaveBeenCalled();
    });
  });

  // ── deleteFaq ─────────────────────────────────────────────────────────────────

  describe('deleteFaq', () => {
    it('deletes FAQ and returns success message', async () => {
      const faq = makeFaq();
      prisma.faq.findFirst.mockResolvedValue(faq);
      prisma.faq.delete.mockResolvedValue(faq);

      const result = await service.deleteFaq('hub-1', 'faq-1', 'admin-1');

      expect(prisma.faq.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'faq-1', pageType: FAQ_PAGE_TYPE.HUB, entityId: 'hub-1' },
        }),
      );
      expect(prisma.faq.delete).toHaveBeenCalledWith({ where: { id: 'faq-1' } });
      expect(result).toEqual({ message: 'FAQ deleted successfully' });
    });

    it('throws NotFoundException when FAQ is not found for this hub', async () => {
      prisma.faq.findFirst.mockResolvedValue(null);

      await expect(service.deleteFaq('hub-1', 'nonexistent-faq', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.faq.delete).not.toHaveBeenCalled();
    });
  });

  // ── getAllowedCategories ───────────────────────────────────────────────────────

  describe('getAllowedCategories', () => {
    it('returns allowed categories ordered by category name ascending', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      const categories = [
        makeAllowedCategory({ id: 'hac-1', categoryId: 'cat-1', category: { id: 'cat-1', name: 'Boat Tours', slug: 'boat-tours' } }),
        makeAllowedCategory({ id: 'hac-2', categoryId: 'cat-2', category: { id: 'cat-2', name: 'Snorkeling', slug: 'snorkeling' } }),
      ];
      prisma.hubAllowedCategory.findMany.mockResolvedValue(categories);

      const result = await service.getAllowedCategories('hub-1');

      expect(result).toEqual(categories);
      expect(prisma.hubAllowedCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hubId: 'hub-1' },
          orderBy: { category: { name: 'asc' } },
        }),
      );
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.getAllowedCategories('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prisma.hubAllowedCategory.findMany).not.toHaveBeenCalled();
    });
  });

  // ── addAllowedCategory ────────────────────────────────────────────────────────

  describe('addAllowedCategory', () => {
    it('creates hubAllowedCategory and returns the result with message', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Boat Tours' });
      const allowedCategory = makeAllowedCategory();
      prisma.hubAllowedCategory.create.mockResolvedValue(allowedCategory);

      const dto: AddAllowedCategoryDto = { categoryId: 'cat-1' };
      const result = await service.addAllowedCategory('hub-1', dto, 'admin-1');

      expect(prisma.hubAllowedCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { hubId: 'hub-1', categoryId: 'cat-1' },
        }),
      );
      expect(result).toMatchObject({
        message: 'Allowed category added successfully',
        allowedCategory,
      });
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      const dto: AddAllowedCategoryDto = { categoryId: 'cat-1' };
      await expect(service.addAllowedCategory('nonexistent', dto, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when category does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.category.findUnique.mockResolvedValue(null);

      const dto: AddAllowedCategoryDto = { categoryId: 'nonexistent-cat' };
      await expect(service.addAllowedCategory('hub-1', dto, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.hubAllowedCategory.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when category is already allowed (P2002)', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Boat Tours' });
      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      prisma.hubAllowedCategory.create.mockRejectedValue(p2002);

      const dto: AddAllowedCategoryDto = { categoryId: 'cat-1' };
      await expect(service.addAllowedCategory('hub-1', dto, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── removeAllowedCategory ─────────────────────────────────────────────────────

  describe('removeAllowedCategory', () => {
    it('deletes allowed category and returns success message', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.hubAllowedCategory.findUnique.mockResolvedValue(makeAllowedCategory());
      prisma.hubAllowedCategory.delete.mockResolvedValue({});

      const result = await service.removeAllowedCategory('hub-1', 'cat-1', 'admin-1');

      expect(prisma.hubAllowedCategory.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hubId_categoryId: { hubId: 'hub-1', categoryId: 'cat-1' } },
        }),
      );
      expect(result).toEqual({ message: 'Allowed category removed successfully' });
    });

    it('throws NotFoundException when hub does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(null);

      await expect(service.removeAllowedCategory('nonexistent', 'cat-1', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when allowed-category link does not exist', async () => {
      prisma.hub.findUnique.mockResolvedValue(makeHub());
      prisma.hubAllowedCategory.findUnique.mockResolvedValue(null);

      await expect(service.removeAllowedCategory('hub-1', 'cat-999', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.hubAllowedCategory.delete).not.toHaveBeenCalled();
    });
  });
});
