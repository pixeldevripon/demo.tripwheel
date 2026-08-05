import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { SitemapService } from './sitemap.service';

function createMockPrismaService() {
  return {
    destination: { findMany: jest.fn() },
    tour: { findMany: jest.fn() },
    tourCategory: { findMany: jest.fn() },
    hub: { findMany: jest.fn() },
    collection: { findMany: jest.fn() },
    page: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

describe('SitemapService', () => {
  let service: SitemapService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  const D1 = new Date('2026-01-01T00:00:00.000Z');
  const D2 = new Date('2026-06-01T00:00:00.000Z');

  beforeEach(async () => {
    prisma = createMockPrismaService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitemapService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<SitemapService>(SitemapService);
    jest.clearAllMocks();
  });

  it('emits a locale-less path per indexable entity, typed correctly', async () => {
    prisma.destination.findMany.mockResolvedValue([
      { slug: 'curacao', updatedAt: D1 },
    ]);
    prisma.tour.findMany.mockResolvedValue([
      { slug: 'boat-trip', updatedAt: D2, destination: { slug: 'curacao' } },
    ]);
    prisma.tourCategory.findMany.mockResolvedValue([]);
    prisma.hub.findMany.mockResolvedValue([
      { slug: 'westpunt', updatedAt: D1, destination: { slug: 'curacao' } },
    ]);
    prisma.collection.findMany.mockResolvedValue([
      {
        slug: 'family-favourites',
        updatedAt: D1,
        destination: { slug: 'curacao' },
      },
    ]);

    const entries = await service.getEntries();

    expect(entries).toEqual(
      expect.arrayContaining([
        {
          path: '/curacao',
          lastModified: D1.toISOString(),
          type: 'destination',
        },
        {
          path: '/curacao/boat-trip',
          lastModified: D2.toISOString(),
          type: 'tour',
        },
        {
          path: '/curacao/westpunt',
          lastModified: D1.toISOString(),
          type: 'hub',
        },
        {
          path: '/curacao/family-favourites',
          lastModified: D1.toISOString(),
          type: 'collection',
        },
      ]),
    );
  });

  it('collapses tour-category links into one URL per pair with the freshest timestamp', async () => {
    prisma.destination.findMany.mockResolvedValue([]);
    prisma.tour.findMany.mockResolvedValue([]);
    prisma.hub.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([]);
    // Three LIVE tours in the same (destination, category) - one URL, newest date.
    prisma.tourCategory.findMany.mockResolvedValue([
      {
        category: { slug: 'boat-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'curacao' } },
      },
      {
        category: { slug: 'boat-tours', updatedAt: D1 },
        tour: { updatedAt: D2, destination: { slug: 'curacao' } },
      },
      {
        category: { slug: 'boat-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'curacao' } },
      },
    ]);

    const entries = await service.getEntries();
    const categoryEntries = entries.filter((e) => e.type === 'category');

    expect(categoryEntries).toEqual([
      {
        path: '/curacao/boat-tours',
        lastModified: D2.toISOString(),
        type: 'category',
      },
    ]);
  });

  it('omits a (destination, category) pair below the 3-tour page bar', async () => {
    prisma.destination.findMany.mockResolvedValue([]);
    prisma.tour.findMany.mockResolvedValue([]);
    prisma.hub.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([]);
    // Master §2.4: two tours means the page is draft, so advertising the URL
    // would be a soft-404 in the sitemap. The 3-tour pair beside it stays.
    prisma.tourCategory.findMany.mockResolvedValue([
      {
        category: { slug: 'buggy-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'curacao' } },
      },
      {
        category: { slug: 'buggy-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'curacao' } },
      },
      ...Array.from({ length: 3 }, () => ({
        category: { slug: 'off-road-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'curacao' } },
      })),
    ]);

    const entries = await service.getEntries();

    expect(
      entries.filter((e) => e.type === 'category').map((e) => e.path),
    ).toEqual(['/curacao/off-road-tours']);
  });

  it('counts the bar per (destination, category) pair, not per category', async () => {
    prisma.destination.findMany.mockResolvedValue([]);
    prisma.tour.findMany.mockResolvedValue([]);
    prisma.hub.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([]);
    // The same category is well stocked on Curacao and thin on Aruba: only
    // Curacao's page renders, so only Curacao's URL is listed.
    prisma.tourCategory.findMany.mockResolvedValue([
      ...Array.from({ length: 3 }, () => ({
        category: { slug: 'boat-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'curacao' } },
      })),
      {
        category: { slug: 'boat-tours', updatedAt: D1 },
        tour: { updatedAt: D1, destination: { slug: 'aruba' } },
      },
    ]);

    const entries = await service.getEntries();

    expect(
      entries.filter((e) => e.type === 'category').map((e) => e.path),
    ).toEqual(['/curacao/boat-tours']);
  });

  it('gates every query on published + active status', async () => {
    prisma.destination.findMany.mockResolvedValue([]);
    prisma.tour.findMany.mockResolvedValue([]);
    prisma.tourCategory.findMany.mockResolvedValue([]);
    prisma.hub.findMany.mockResolvedValue([]);
    prisma.collection.findMany.mockResolvedValue([]);

    await service.getEntries();

    expect(prisma.tour.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'LIVE',
          isActive: true,
          destination: { isActive: true },
        }),
      }),
    );
    expect(prisma.hub.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          isActive: true,
        }),
      }),
    );
    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          isActive: true,
        }),
      }),
    );
  });
});
