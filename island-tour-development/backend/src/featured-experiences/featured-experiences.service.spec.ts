import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FeaturedExperiencesService } from './featured-experiences.service';

function createMockPrismaService() {
  return {
    featuredExperience: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
}

/** A stored card, as the service selects it. */
function cardRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'fx-1',
    title: 'Sunset Cruises',
    videoUrl: 'https://cdn/clip.mp4',
    posterUrl: 'https://cdn/poster.jpg',
    displayOrder: 0,
    isActive: true,
    ...over,
  };
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
  });

  // ── resolvePublic ────────────────────────────────────────────────────────────

  describe('resolvePublic', () => {
    it('returns active cards in display order with the poster as the image', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([
        cardRow({ id: 'fx-1', title: 'Sunset Cruises', displayOrder: 0 }),
        cardRow({ id: 'fx-2', title: 'Scuba Diving', displayOrder: 1 }),
      ]);

      const result = await service.resolvePublic();

      expect(prisma.featuredExperience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        }),
      );
      expect(result).toEqual([
        {
          id: 'fx-1',
          title: 'Sunset Cruises',
          image: 'https://cdn/poster.jpg',
          videoUrl: 'https://cdn/clip.mp4',
        },
        {
          id: 'fx-2',
          title: 'Scuba Diving',
          image: 'https://cdn/poster.jpg',
          videoUrl: 'https://cdn/clip.mp4',
        },
      ]);
    });

    it('drops a card with no poster (a grey rectangle is not a card)', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue([
        cardRow({ id: 'fx-1', posterUrl: null }),
        cardRow({ id: 'fx-2', title: 'Scuba Diving' }),
      ]);

      const result = await service.resolvePublic();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('fx-2');
    });

    it('caps the public deck at 8 by display order', async () => {
      prisma.featuredExperience.findMany.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) =>
          cardRow({ id: `fx-${i}`, displayOrder: i }),
        ),
      );

      const result = await service.resolvePublic();

      expect(result).toHaveLength(8);
      expect(result[0].id).toBe('fx-0');
      expect(result[7].id).toBe('fx-7');
    });
  });

  // ── Admin CRUD ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a standalone card from the typed label with defaults', async () => {
      prisma.featuredExperience.create.mockResolvedValue(cardRow());

      await service.create({ title: 'Sunset Cruises' }, 'admin-1');

      expect(prisma.featuredExperience.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            title: 'Sunset Cruises',
            videoUrl: null,
            posterUrl: null,
            displayOrder: 0,
            isActive: true,
          },
        }),
      );
    });
  });

  describe('update', () => {
    it('writes only the provided fields', async () => {
      prisma.featuredExperience.update.mockResolvedValue(
        cardRow({ title: 'Boat Tours' }),
      );

      await service.update('fx-1', { title: 'Boat Tours' }, 'admin-1');

      expect(prisma.featuredExperience.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fx-1' },
          data: { title: 'Boat Tours' },
        }),
      );
    });

    it('maps a missing row to 404', async () => {
      prisma.featuredExperience.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.update('nope', { title: 'X' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the card', async () => {
      prisma.featuredExperience.delete.mockResolvedValue(cardRow());

      await service.remove('fx-1', 'admin-1');

      expect(prisma.featuredExperience.delete).toHaveBeenCalledWith({
        where: { id: 'fx-1' },
      });
    });

    it('maps a missing row to 404', async () => {
      prisma.featuredExperience.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.remove('nope', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
