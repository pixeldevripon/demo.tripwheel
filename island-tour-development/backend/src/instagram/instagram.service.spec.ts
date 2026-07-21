import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InstagramLayout,
  InstagramMediaType,
  InstagramSource,
} from '@prisma/client';
import { InstagramService } from './instagram.service';

function createMockPrismaService() {
  return {
    siteInfo: {
      findFirst: jest.fn().mockResolvedValue({ enableInstagram: true }),
    },
    instagramAccount: {
      findUnique: jest.fn().mockResolvedValue({
        username: 'island.tours_',
        profileUrl: '',
        layout: InstagramLayout.GRID,
      }),
      upsert: jest.fn(),
    },
    instagramPost: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    destination: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
}

/** A public-read row, as the narrowed `select` returns it. */
function tile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tile-1',
    mediaType: InstagramMediaType.IMAGE,
    permalink: 'https://www.instagram.com/p/abc/',
    imageUrl: 'https://cdn.example/reef.jpg',
    videoUrl: null,
    caption: 'Sunset sail',
    altText: null,
    isPinned: false,
    width: 768,
    height: 674,
    ...overrides,
  };
}

describe('InstagramService', () => {
  let service: InstagramService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InstagramService>(InstagramService);
  });

  // ── Public feed ─────────────────────────────────────────────────────────────

  describe('getPublicFeed', () => {
    it('reports disabled, and reads no tiles, when the kill switch is off', async () => {
      prisma.siteInfo.findFirst.mockResolvedValue({ enableInstagram: false });

      const feed = await service.getPublicFeed();

      expect(feed.enabled).toBe(false);
      expect(feed.posts).toEqual([]);
      expect(prisma.instagramPost.findMany).not.toHaveBeenCalled();
    });

    it('reports disabled when switched on but empty - a handle row over an empty grid is worse than no section', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([]);

      const feed = await service.getPublicFeed();

      expect(feed.enabled).toBe(false);
      // The handle still comes back: the dashboard shows it either way.
      expect(feed.username).toBe('island.tours_');
    });

    it('derives the profile URL from the handle when none is stored', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([tile()]);

      const feed = await service.getPublicFeed();

      expect(feed.profileUrl).toBe('https://www.instagram.com/island.tours_');
    });

    it('falls back to the profile link when a tile has no permalink, so no tile is a dead link', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([
        tile({ permalink: '' }),
      ]);

      const feed = await service.getPublicFeed();

      expect(feed.posts[0].href).toBe(
        'https://www.instagram.com/island.tours_',
      );
    });

    it('serves a video tile as poster + video, so the grid can paint before the loop starts', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([
        tile({
          mediaType: InstagramMediaType.VIDEO,
          imageUrl: 'https://cdn.example/poster.jpg',
          videoUrl: 'https://cdn.example/reel.mp4',
        }),
      ]);

      const feed = await service.getPublicFeed();

      expect(feed.posts[0]).toMatchObject({
        imageUrl: 'https://cdn.example/poster.jpg',
        videoUrl: 'https://cdn.example/reel.mp4',
        mediaType: InstagramMediaType.VIDEO,
      });
    });

    describe('alt text', () => {
      it('prefers the admin override', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([
          tile({ altText: 'Catamaran at sunset', caption: 'whatever #tag' }),
        ]);

        const feed = await service.getPublicFeed();

        expect(feed.posts[0].alt).toBe('Catamaran at sunset');
      });

      it('strips hashtags, mentions and URLs out of a caption', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([
          tile({
            caption:
              'Turtles at Playa Piskado #turtles @island.tours_ https://t.co/x',
          }),
        ]);

        const feed = await service.getPublicFeed();

        expect(feed.posts[0].alt).toBe('Turtles at Playa Piskado');
      });

      it('never returns empty - these tiles are links', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([
          tile({ caption: '#curacao #sunset', altText: null }),
        ]);

        const feed = await service.getPublicFeed();

        expect(feed.posts[0].alt).toBe('Instagram post');
      });
    });

    describe('layout', () => {
      it.each([
        [InstagramLayout.GRID, 6],
        [InstagramLayout.GALLERY, 15],
      ])('asks for %s-worth of tiles by default (%i)', async (layout, take) => {
        prisma.instagramAccount.findUnique.mockResolvedValue({
          username: 'island.tours_',
          profileUrl: '',
          layout,
        });
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        const feed = await service.getPublicFeed();

        expect(feed.layout).toBe(layout);
        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take }),
        );
      });

      it('an explicit limit still wins over the layout default', async () => {
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        await service.getPublicFeed(undefined, 3);

        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({ take: 3 }),
        );
      });

      it('reports the layout even when the section is switched off', async () => {
        prisma.siteInfo.findFirst.mockResolvedValue({ enableInstagram: false });

        const feed = await service.getPublicFeed();

        expect(feed.layout).toBe(InstagramLayout.GRID);
      });
    });

    describe('destination scoping', () => {
      it('adds tiles pinned to the island to the brand-wide set', async () => {
        prisma.destination.findUnique.mockResolvedValue({
          id: 'dest-1',
          isActive: true,
        });
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        await service.getPublicFeed('curacao');

        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: [{ destinationId: null }, { destinationId: 'dest-1' }],
            }),
          }),
        );
      });

      it('falls back to brand-wide for an inactive island', async () => {
        prisma.destination.findUnique.mockResolvedValue({
          id: 'dest-1',
          isActive: false,
        });
        prisma.instagramPost.findMany.mockResolvedValue([tile()]);

        await service.getPublicFeed('curacao');

        expect(prisma.instagramPost.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ destinationId: null }),
          }),
        );
      });
    });
  });

  // ── Account ─────────────────────────────────────────────────────────────────

  describe('updateAccount', () => {
    beforeEach(() => {
      prisma.instagramAccount.upsert.mockResolvedValue({
        id: 'default',
        username: 'island.tours_',
        profileUrl: '',
        layout: InstagramLayout.GRID,
      });
    });

    it.each([
      ['@island.tours_', 'island.tours_'],
      ['island.tours_', 'island.tours_'],
      ['https://www.instagram.com/island.tours_', 'island.tours_'],
      ['https://instagram.com/island.tours_/?hl=en', 'island.tours_'],
    ])('normalizes %s to the bare handle', async (input, expected) => {
      await service.updateAccount({ username: input }, 'admin-1');

      expect(prisma.instagramAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ username: expected }),
        }),
      );
    });
  });

  describe('getAccount', () => {
    it('never writes - an unconfigured platform must not be seeded by a GET', async () => {
      prisma.instagramAccount.findUnique.mockResolvedValue(null);

      const account = await service.getAccount();

      expect(account).toEqual({
        id: 'default',
        username: null,
        profileUrl: null,
        // An unconfigured feed still reports a layout, so the dashboard's
        // selector always has a value to show.
        layout: InstagramLayout.GRID,
      });
      expect(prisma.instagramAccount.upsert).not.toHaveBeenCalled();
    });
  });

  // ── Tiles ───────────────────────────────────────────────────────────────────

  describe('createPost', () => {
    it('appends to the end of the grid instead of sharing slot 0', async () => {
      prisma.instagramPost.findFirst.mockResolvedValue({ displayOrder: 4 });
      prisma.instagramPost.create.mockResolvedValue({
        id: 'tile-9',
        source: InstagramSource.MANUAL,
        mediaType: InstagramMediaType.IMAGE,
        permalink: '',
        imageUrl: 'https://cdn.example/a.jpg',
        imagePublicId: null,
        videoUrl: null,
        caption: null,
        altText: null,
        width: null,
        height: null,
        displayOrder: 5,
        isActive: true,
        isPinned: false,
        destinationId: null,
        postedAt: null,
        syncedAt: null,
        destination: null,
      });

      await service.createPost(
        { imageUrl: 'https://cdn.example/a.jpg' },
        'admin-1',
      );

      expect(prisma.instagramPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ displayOrder: 5 }),
        }),
      );
    });

    it.each([
      ['a video', 'https://cdn.example/reel.mp4', InstagramMediaType.VIDEO],
      ['no video', undefined, InstagramMediaType.IMAGE],
    ])(
      'derives mediaType from %s rather than trusting the client',
      async (_label, videoUrl, expected) => {
        prisma.instagramPost.create.mockResolvedValue({
          id: 'tile-9',
          source: InstagramSource.MANUAL,
          mediaType: expected,
          permalink: '',
          imageUrl: 'https://cdn.example/a.jpg',
          imagePublicId: null,
          videoUrl: videoUrl ?? null,
          caption: null,
          altText: null,
          width: null,
          height: null,
          displayOrder: 0,
          isActive: true,
          destinationId: null,
          postedAt: null,
          syncedAt: null,
          destination: null,
        });

        await service.createPost(
          { imageUrl: 'https://cdn.example/a.jpg', videoUrl },
          'admin-1',
        );

        expect(prisma.instagramPost.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ mediaType: expected }),
          }),
        );
      },
    );

    it('honours a CAROUSEL_ALBUM badge on a still tile', async () => {
      prisma.instagramPost.create.mockResolvedValue({
        id: 'tile-9',
        source: InstagramSource.MANUAL,
        mediaType: InstagramMediaType.CAROUSEL_ALBUM,
        permalink: '',
        imageUrl: 'https://cdn.example/a.jpg',
        imagePublicId: null,
        videoUrl: null,
        caption: null,
        altText: null,
        width: null,
        height: null,
        displayOrder: 0,
        isActive: true,
        isPinned: false,
        destinationId: null,
        postedAt: null,
        syncedAt: null,
        destination: null,
      });

      await service.createPost(
        {
          imageUrl: 'https://cdn.example/a.jpg',
          mediaType: InstagramMediaType.CAROUSEL_ALBUM,
        },
        'admin-1',
      );

      expect(prisma.instagramPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mediaType: InstagramMediaType.CAROUSEL_ALBUM,
          }),
        }),
      );
    });

    it('a video beats a requested badge - a reel cannot be labelled a carousel', async () => {
      prisma.instagramPost.create.mockResolvedValue({
        id: 'tile-9',
        source: InstagramSource.MANUAL,
        mediaType: InstagramMediaType.VIDEO,
        permalink: '',
        imageUrl: 'https://cdn.example/a.jpg',
        imagePublicId: null,
        videoUrl: 'https://cdn.example/reel.mp4',
        caption: null,
        altText: null,
        width: null,
        height: null,
        displayOrder: 0,
        isActive: true,
        isPinned: false,
        destinationId: null,
        postedAt: null,
        syncedAt: null,
        destination: null,
      });

      await service.createPost(
        {
          imageUrl: 'https://cdn.example/a.jpg',
          videoUrl: 'https://cdn.example/reel.mp4',
          mediaType: InstagramMediaType.CAROUSEL_ALBUM,
        },
        'admin-1',
      );

      expect(prisma.instagramPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mediaType: InstagramMediaType.VIDEO,
          }),
        }),
      );
    });

    it('rejects a destination that does not exist', async () => {
      prisma.destination.findUnique.mockResolvedValue(null);

      await expect(
        service.createPost(
          { imageUrl: 'https://cdn.example/a.jpg', destinationId: 'nope' },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.instagramPost.create).not.toHaveBeenCalled();
    });
  });

  describe('updatePost', () => {
    const syncedRow = {
      id: 'tile-1',
      source: InstagramSource.API,
      mediaType: InstagramMediaType.IMAGE,
      permalink: 'https://www.instagram.com/p/abc/',
      imageUrl: 'https://cdn.example/a.jpg',
      imagePublicId: null,
      videoUrl: null,
      caption: 'from instagram',
      altText: null,
      width: null,
      height: null,
      displayOrder: 0,
      isActive: true,
      isPinned: false,
      destinationId: null,
      postedAt: null,
      syncedAt: null,
      destination: null,
    };

    it('refuses edits to fields the sync owns - the next run would revert them', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(syncedRow);

      await expect(
        service.updatePost(
          'tile-1',
          { caption: 'my better caption' },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.instagramPost.update).not.toHaveBeenCalled();
    });

    it('still allows curation on a synced tile (order, visibility, pinning, alt)', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(syncedRow);
      prisma.instagramPost.update.mockResolvedValue({
        ...syncedRow,
        isActive: false,
      });

      await service.updatePost(
        'tile-1',
        { isActive: false, altText: 'Reef at noon' },
        'admin-1',
      );

      expect(prisma.instagramPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            altText: 'Reef at noon',
          }),
        }),
      );
    });

    it('retypes the tile to VIDEO when a video is attached', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue({
        ...syncedRow,
        source: InstagramSource.MANUAL,
      });
      prisma.instagramPost.update.mockResolvedValue(syncedRow);

      await service.updatePost(
        'tile-1',
        { videoUrl: 'https://cdn.example/reel.mp4' },
        'admin-1',
      );

      expect(prisma.instagramPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            videoUrl: 'https://cdn.example/reel.mp4',
            mediaType: InstagramMediaType.VIDEO,
          }),
        }),
      );
    });

    it('clearing the video turns it back into a photo tile', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue({
        ...syncedRow,
        source: InstagramSource.MANUAL,
        mediaType: InstagramMediaType.VIDEO,
        videoUrl: 'https://cdn.example/reel.mp4',
      });
      prisma.instagramPost.update.mockResolvedValue(syncedRow);

      await service.updatePost('tile-1', { videoUrl: '' }, 'admin-1');

      expect(prisma.instagramPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            videoUrl: null,
            mediaType: InstagramMediaType.IMAGE,
          }),
        }),
      );
    });

    it('leaves the tile type alone when the patch does not mention the video', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue({
        ...syncedRow,
        source: InstagramSource.MANUAL,
        mediaType: InstagramMediaType.VIDEO,
        videoUrl: 'https://cdn.example/reel.mp4',
      });
      prisma.instagramPost.update.mockResolvedValue(syncedRow);

      await service.updatePost('tile-1', { isActive: false }, 'admin-1');

      const patch = prisma.instagramPost.update.mock.calls[0][0].data;
      expect(patch).not.toHaveProperty('mediaType');
      expect(patch).not.toHaveProperty('videoUrl');
    });

    it('404s on an unknown tile', async () => {
      prisma.instagramPost.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePost('gone', { isActive: false }, 'admin-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorderPosts', () => {
    it('rejects a payload naming a tile twice', async () => {
      await expect(
        service.reorderPosts(
          {
            items: [
              { id: 'a', displayOrder: 0 },
              { id: 'a', displayOrder: 1 },
            ],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a payload referencing a tile that no longer exists', async () => {
      prisma.instagramPost.findMany.mockResolvedValue([{ id: 'a' }]);

      await expect(
        service.reorderPosts(
          {
            items: [
              { id: 'a', displayOrder: 0 },
              { id: 'ghost', displayOrder: 1 },
            ],
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('applies the whole new order in one transaction', async () => {
      prisma.instagramPost.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValueOnce([]);

      await service.reorderPosts(
        {
          items: [
            { id: 'a', displayOrder: 1 },
            { id: 'b', displayOrder: 0 },
          ],
        },
        'admin-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.instagramPost.update).toHaveBeenCalledTimes(2);
    });
  });
});
