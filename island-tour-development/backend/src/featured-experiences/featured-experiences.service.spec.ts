import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FeaturedEntityType, HubStatus, Locale } from '@prisma/client';
import { FeaturedExperiencesService } from './featured-experiences.service';

const CURACAO = { id: 'dest-cur', slug: 'curacao' };
const ARUBA = { id: 'dest-aru', slug: 'aruba' };

function createMockPrismaService() {
  return {
    featuredExperience: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    category: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    hub: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    destination: {
      findMany: jest.fn().mockResolvedValue([CURACAO, ARUBA]),
      findUnique: jest.fn(),
    },
    tourCategory: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

/** A featured row as the service selects it. */
function featuredRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'fx-1',
    entityType: FeaturedEntityType.CATEGORY,
    entityId: 'cat-1',
    destinationId: null,
    videoUrl: null,
    posterUrl: null,
    displayOrder: 0,
    ...over,
  };
}

function categoryRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'cat-1',
    name: 'Snorkeling',
    slug: 'snorkeling',
    heroImage: null,
    ogImage: null,
    isActive: true,
    translations: [],
    ...over,
  };
}

function hubRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'hub-1',
    name: 'Klein Curacao',
    slug: 'klein-curacao',
    heroImage: null,
    ogImage: null,
    isActive: true,
    status: HubStatus.PUBLISHED,
    destinationId: CURACAO.id,
    destination: { slug: CURACAO.slug, isActive: true },
    translations: [],
    _count: { tourHubs: 3 },
    ...over,
  };
}

/** One live tour for (category, destination), repeated `count` times. */
function tourLinks(categoryId: string, destinationId: string, count: number) {
  return Array.from({ length: count }, () => ({
    categoryId,
    tour: { destinationId },
  }));
}

describe('FeaturedExperiencesService', () => {
  let service: FeaturedExperiencesService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeaturedExperiencesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FeaturedExperiencesService>(
      FeaturedExperiencesService,
    );
    jest.clearAllMocks();
    prisma.destination.findMany.mockResolvedValue([CURACAO, ARUBA]);
    prisma.featuredExperience.findFirst.mockResolvedValue(null);
  });

  describe('resolvePublic - categories', () => {
    it('resolves a category card to a real destination-scoped URL', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([categoryRow()]);
      prisma.tourCategory.findMany.mockResolvedValue(
        tourLinks('cat-1', CURACAO.id, 2),
      );

      const [card] = await service.resolvePublic(Locale.en);

      expect(card.href).toBe('/curacao/snorkeling');
      expect(card.title).toBe('Snorkeling');
    });

    it('prefers the locale translation for the title', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([
        categoryRow({ translations: [{ name: 'Snorkelen' }] }),
      ]);
      prisma.tourCategory.findMany.mockResolvedValue(
        tourLinks('cat-1', CURACAO.id, 1),
      );

      const [card] = await service.resolvePublic(Locale.nl);

      expect(card.title).toBe('Snorkelen');
    });

    it('picks the destination where the category has the most live tours', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([categoryRow()]);
      prisma.tourCategory.findMany.mockResolvedValue([
        ...tourLinks('cat-1', CURACAO.id, 1),
        ...tourLinks('cat-1', ARUBA.id, 4),
      ]);

      const [card] = await service.resolvePublic(Locale.en);

      expect(card.href).toBe('/aruba/snorkeling');
    });

    it('drops a category with no live tours anywhere - the page would 404', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([categoryRow()]);
      prisma.tourCategory.findMany.mockResolvedValue([]);

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });

    it('drops a deactivated category', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([
        categoryRow({ isActive: false }),
      ]);
      prisma.tourCategory.findMany.mockResolvedValue(
        tourLinks('cat-1', CURACAO.id, 2),
      );

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });

    it('drops a pinned row whose own destination has no live tours', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([
        featuredRow({ destinationId: ARUBA.id }),
      ]);
      prisma.category.findMany.mockResolvedValue([categoryRow()]);
      // Tours exist, but on the other island.
      prisma.tourCategory.findMany.mockResolvedValue(
        tourLinks('cat-1', CURACAO.id, 5),
      );

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });

    it('drops an orphan row whose category no longer exists', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([]);
      prisma.tourCategory.findMany.mockResolvedValue([]);

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });

    it('falls back to the OG image when there is no hero image', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([
        categoryRow({ ogImage: 'https://cdn/og.jpg' }),
      ]);
      prisma.tourCategory.findMany.mockResolvedValue(
        tourLinks('cat-1', CURACAO.id, 1),
      );

      const [card] = await service.resolvePublic(Locale.en);

      expect(card.image).toBe('https://cdn/og.jpg');
    });

    it("the card poster beats the entity's own images", async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([
        featuredRow({ posterUrl: 'https://cdn/poster.jpg' }),
      ]);
      prisma.category.findMany.mockResolvedValue([
        categoryRow({
          heroImage: 'https://cdn/hero.jpg',
          ogImage: 'https://cdn/og.jpg',
        }),
      ]);
      prisma.tourCategory.findMany.mockResolvedValue(
        tourLinks('cat-1', CURACAO.id, 1),
      );

      const [card] = await service.resolvePublic(Locale.en);

      expect(card.image).toBe('https://cdn/poster.jpg');
    });
  });

  describe('resolvePublic - hubs', () => {
    const hubFeatured = featuredRow({
      id: 'fx-hub',
      entityType: FeaturedEntityType.HUB,
      entityId: 'hub-1',
    });

    it('resolves a hub against its own destination', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([hubFeatured]);
      prisma.hub.findMany.mockResolvedValue([hubRow()]);

      const [card] = await service.resolvePublic(Locale.en);

      expect(card.href).toBe('/curacao/klein-curacao');
    });

    it('drops an unpublished hub', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([hubFeatured]);
      prisma.hub.findMany.mockResolvedValue([
        hubRow({ status: HubStatus.DRAFT }),
      ]);

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });

    it('drops a hub with no live tours', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([hubFeatured]);
      prisma.hub.findMany.mockResolvedValue([
        hubRow({ _count: { tourHubs: 0 } }),
      ]);

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });

    it('drops a hub pinned to an island that is not its own', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([
        { ...hubFeatured, destinationId: ARUBA.id },
      ]);
      prisma.hub.findMany.mockResolvedValue([hubRow()]);

      expect(await service.resolvePublic(Locale.en)).toEqual([]);
    });
  });

  describe('resolvePublic - scoping', () => {
    it('matches only show-everywhere rows on the global homepage', async () => {
      await service.resolvePublic(Locale.en);

      expect(prisma.featuredExperience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, destinationId: null },
        }),
      );
    });

    it('also picks up pinned rows on a destination page', async () => {
      prisma.destination.findUnique.mockResolvedValue({
        id: CURACAO.id,
        isActive: true,
      });

      await service.resolvePublic(Locale.en, 'curacao');

      const where = prisma.featuredExperience.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { destinationId: null },
        { destinationId: CURACAO.id },
      ]);
    });
  });

  describe('create', () => {
    it('refuses to feature the same entity twice at the same scope', async () => {
      // No unique index can express this: destinationId is nullable and Postgres
      // treats NULLs as distinct, so two "show everywhere" rows would both pass.
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.featuredExperience.findFirst.mockResolvedValue({
        id: 'fx-existing',
      });

      await expect(
        service.create(
          { entityType: FeaturedEntityType.CATEGORY, entityId: 'cat-1' },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.featuredExperience.create).not.toHaveBeenCalled();
    });

    it('allows the same entity pinned to a different destination', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      prisma.destination.findUnique.mockResolvedValue({ id: ARUBA.id });
      prisma.featuredExperience.findFirst.mockResolvedValue(null);
      prisma.featuredExperience.create.mockResolvedValue({});

      await service.create(
        {
          entityType: FeaturedEntityType.CATEGORY,
          entityId: 'cat-1',
          destinationId: ARUBA.id,
        },
        'admin-1',
      );

      expect(prisma.featuredExperience.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ destinationId: ARUBA.id }),
        }),
      );
      expect(prisma.featuredExperience.create).toHaveBeenCalled();
    });

    it('rejects an entity id that does not exist (there is no FK to catch it)', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          { entityType: FeaturedEntityType.CATEGORY, entityId: 'nope' },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.featuredExperience.create).not.toHaveBeenCalled();
    });

    it('rejects pinning a hub to an island other than its own', async () => {
      prisma.hub.findUnique
        .mockResolvedValueOnce({ id: 'hub-1' })
        .mockResolvedValueOnce({ destinationId: CURACAO.id });
      prisma.destination.findUnique.mockResolvedValue({ id: ARUBA.id });

      await expect(
        service.create(
          {
            entityType: FeaturedEntityType.HUB,
            entityId: 'hub-1',
            destinationId: ARUBA.id,
          },
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /**
   * The admin list carries what the EDITOR needs to draw the real card: the
   * target's name and the photo the card falls back to when it has no poster.
   * Without those, curating a visual carousel means reading a list of ids.
   */
  describe('list', () => {
    it("labels each row and carries the target's fallback photo", async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([
        categoryRow({ heroImage: 'https://cdn/hero.jpg' }),
      ]);

      const [row] = await service.list();

      expect(row.entityName).toBe('Snorkeling');
      expect(row.entityImage).toBe('https://cdn/hero.jpg');
    });

    it('carries the poster untouched - the editor resolves the preference itself', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([
        featuredRow({ posterUrl: 'https://cdn/poster.jpg' }),
      ]);
      prisma.category.findMany.mockResolvedValue([
        categoryRow({ heroImage: 'https://cdn/hero.jpg' }),
      ]);

      const [row] = await service.list();

      expect(row.posterUrl).toBe('https://cdn/poster.jpg');
      // NOT collapsed into entityImage: the editor has to show that the
      // fallback exists and what it is, or "clear the poster" is a blind move.
      expect(row.entityImage).toBe('https://cdn/hero.jpg');
    });

    it('surfaces a deleted target as nulls rather than hiding the row', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([featuredRow()]);
      prisma.category.findMany.mockResolvedValue([]);

      const [row] = await service.list();

      expect(row.entityName).toBeNull();
      expect(row.entityImage).toBeNull();
    });
  });
});
