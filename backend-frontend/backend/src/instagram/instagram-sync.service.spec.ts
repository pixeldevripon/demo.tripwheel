import { Test, TestingModule } from '@nestjs/testing';
import { InstagramMediaType, InstagramSyncStatus } from '@prisma/client';

import { CloudinaryService } from '@/media-gallery/cloudinary.service';
import { PrismaService } from '@/prisma/prisma.service';

import { InstagramSyncService } from './instagram-sync.service';
import { InstagramTokenService } from './instagram-token.service';
import {
  INSTAGRAM_API_PROVIDER,
  type InstagramApiProvider,
  type InstagramMediaItem,
} from './providers/instagram-api.provider';

function imageItem(id: string): InstagramMediaItem {
  return {
    id,
    mediaType: InstagramMediaType.IMAGE,
    mediaUrl: `https://cdn.ig/${id}.jpg`,
    permalink: `https://instagram.com/p/${id}/`,
    caption: `caption ${id}`,
    timestamp: '2026-07-20T10:00:00+0000',
  };
}

function videoItem(id: string): InstagramMediaItem {
  return {
    id,
    mediaType: InstagramMediaType.VIDEO,
    mediaUrl: `https://cdn.ig/${id}.mp4`,
    posterUrl: `https://cdn.ig/${id}.jpg`,
    permalink: `https://instagram.com/reel/${id}/`,
    caption: `reel ${id}`,
    timestamp: '2026-07-21T10:00:00+0000',
  };
}

describe('InstagramSyncService', () => {
  let service: InstagramSyncService;
  let prisma: {
    instagramPost: {
      findMany: jest.Mock;
      aggregate: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    instagramAccount: { findUnique: jest.Mock };
  };
  let cloudinary: {
    uploadFromUrl: jest.Mock;
    videoPosterUrl: jest.Mock;
    deleteFile: jest.Mock;
  };
  let tokens: {
    readCredential: jest.Mock;
    saveRefreshedToken: jest.Mock;
    recordSyncResult: jest.Mock;
    storeUsername: jest.Mock;
  };
  let provider: {
    refreshToken: jest.Mock;
    fetchMedia: jest.Mock;
    resolveAccount: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      instagramPost: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { displayOrder: -1 } }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      // Drives resolveFetchLimit (posts-per-sync). Default row = 24.
      instagramAccount: {
        findUnique: jest.fn().mockResolvedValue({ syncFetchLimit: 24 }),
      },
    };
    cloudinary = {
      uploadFromUrl: jest.fn().mockImplementation((url: string) =>
        Promise.resolve({
          publicId: `mirror/${url.slice(-8)}`,
          url: `https://res.cloudinary.com/ours/${url.slice(-8)}`,
          resourceType: url.endsWith('.mp4') ? 'video' : 'image',
          width: 1080,
          height: 1350,
        }),
      ),
      videoPosterUrl: jest
        .fn()
        .mockReturnValue('https://res.cloudinary.com/ours/poster.jpg'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    tokens = {
      readCredential: jest.fn().mockResolvedValue({
        igUserId: 'ig-1',
        accessToken: 'tok',
        tokenExpiresAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      }),
      saveRefreshedToken: jest.fn().mockResolvedValue(undefined),
      recordSyncResult: jest.fn().mockResolvedValue(undefined),
      storeUsername: jest.fn().mockResolvedValue(undefined),
    };
    provider = {
      refreshToken: jest.fn().mockResolvedValue({
        accessToken: 'tok2',
        userId: '',
        expiresInSeconds: 5_000_000,
      }),
      fetchMedia: jest.fn().mockResolvedValue([]),
      resolveAccount: jest
        .fn()
        .mockResolvedValue({ userId: 'ig-1', username: 'real_handle' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: CloudinaryService, useValue: cloudinary },
        { provide: InstagramTokenService, useValue: tokens },
        {
          provide: INSTAGRAM_API_PROVIDER,
          useValue: provider,
        },
      ],
    }).compile();

    service = module.get(InstagramSyncService);
  });

  it('no-ops cleanly when nothing is connected', async () => {
    tokens.readCredential.mockResolvedValue(null);

    const result = await service.syncNow();

    expect(result.ran).toBe(false);
    expect(provider.fetchMedia).not.toHaveBeenCalled();
    expect(prisma.instagramPost.create).not.toHaveBeenCalled();
  });

  it('mirrors a NEW image post into Cloudinary and creates an API row', async () => {
    provider.fetchMedia.mockResolvedValue([imageItem('m1')]);

    const result = await service.syncNow();

    expect(cloudinary.uploadFromUrl).toHaveBeenCalledWith(
      'https://cdn.ig/m1.jpg',
      'instagram',
    );
    expect(prisma.instagramPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'API',
          igMediaId: 'm1',
          mediaType: InstagramMediaType.IMAGE,
          videoUrl: null,
        }),
      }),
    );
    expect(result.created).toBe(1);
    expect(result.status).toBe(InstagramSyncStatus.OK);
  });

  it('mirrors a video as poster + video', async () => {
    provider.fetchMedia.mockResolvedValue([videoItem('v1')]);

    await service.syncNow();

    // Both the video file and its poster are mirrored.
    expect(cloudinary.uploadFromUrl).toHaveBeenCalledWith(
      'https://cdn.ig/v1.mp4',
      'instagram',
    );
    expect(cloudinary.uploadFromUrl).toHaveBeenCalledWith(
      'https://cdn.ig/v1.jpg',
      'instagram',
    );
    const data = prisma.instagramPost.create.mock.calls[0][0].data;
    expect(data.mediaType).toBe(InstagramMediaType.VIDEO);
    expect(data.videoUrl).toBeTruthy();
    expect(data.videoPublicId).toBeTruthy();
  });

  it('re-sync of a SEEN post refreshes metadata but never re-mirrors or reorders', async () => {
    prisma.instagramPost.findMany.mockResolvedValue([
      {
        id: 'row-1',
        igMediaId: 'm1',
        imagePublicId: 'p1',
        videoPublicId: null,
      },
    ]);
    provider.fetchMedia.mockResolvedValue([imageItem('m1')]);

    const result = await service.syncNow();

    expect(cloudinary.uploadFromUrl).not.toHaveBeenCalled(); // no re-upload
    expect(prisma.instagramPost.create).not.toHaveBeenCalled();
    const patch = prisma.instagramPost.update.mock.calls[0][0].data;
    expect(patch).not.toHaveProperty('displayOrder'); // curation preserved
    expect(patch).not.toHaveProperty('isActive');
    expect(patch).toHaveProperty('caption');
    expect(result.updated).toBe(1);
  });

  it('deletes API rows that fell out of the recent set and cleans their mirror', async () => {
    prisma.instagramPost.findMany.mockResolvedValue([
      {
        id: 'gone',
        igMediaId: 'old',
        imagePublicId: 'pImg',
        videoPublicId: 'pVid',
      },
    ]);
    provider.fetchMedia.mockResolvedValue([imageItem('m1')]); // 'old' not present

    const result = await service.syncNow();

    expect(prisma.instagramPost.delete).toHaveBeenCalledWith({
      where: { id: 'gone' },
    });
    expect(cloudinary.deleteFile).toHaveBeenCalledWith('pImg');
    expect(cloudinary.deleteFile).toHaveBeenCalledWith('pVid');
    expect(result.removed).toBe(1);
  });

  it('refreshes the token when it is inside the 10-day window', async () => {
    tokens.readCredential.mockResolvedValue({
      igUserId: 'ig-1',
      accessToken: 'tok',
      tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
    });
    provider.fetchMedia.mockResolvedValue([]);

    await service.syncNow();

    expect(provider.refreshToken).toHaveBeenCalledWith('tok');
    expect(tokens.saveRefreshedToken).toHaveBeenCalled();
  });

  it('does NOT refresh a token that is comfortably fresh', async () => {
    provider.fetchMedia.mockResolvedValue([]);
    await service.syncNow();
    expect(provider.refreshToken).not.toHaveBeenCalled();
  });

  it('a failed refresh records EXPIRING even when the sync itself succeeds', async () => {
    // Token inside the window, refresh throws, but the still-valid old token
    // fetches + reconciles cleanly. The run must surface EXPIRING, not overwrite
    // it with the reconcile's OK - otherwise the admin never sees the warning.
    tokens.readCredential.mockResolvedValue({
      igUserId: 'ig-1',
      accessToken: 'tok',
      tokenExpiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    provider.refreshToken.mockRejectedValue(new Error('refresh 400'));
    provider.fetchMedia.mockResolvedValue([imageItem('m1')]);

    const result = await service.syncNow();

    expect(result.created).toBe(1); // the sync still worked
    expect(result.status).toBe(InstagramSyncStatus.EXPIRING);
    // Exactly one status record, and it is the EXPIRING one (not a later OK).
    expect(tokens.recordSyncResult).toHaveBeenCalledTimes(1);
    expect(tokens.recordSyncResult).toHaveBeenCalledWith(
      InstagramSyncStatus.EXPIRING,
      expect.stringContaining('reconnect'),
    );
  });

  it('a per-item mirror failure yields PARTIAL, not a thrown run', async () => {
    provider.fetchMedia.mockResolvedValue([imageItem('m1'), imageItem('m2')]);
    cloudinary.uploadFromUrl
      .mockResolvedValueOnce({
        publicId: 'ok',
        url: 'https://res.cloudinary.com/ours/ok',
        resourceType: 'image',
        width: 1,
        height: 1,
      })
      .mockRejectedValueOnce(new Error('cloudinary down'));

    const result = await service.syncNow();

    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.status).toBe(InstagramSyncStatus.PARTIAL);
    expect(tokens.recordSyncResult).toHaveBeenCalledWith(
      InstagramSyncStatus.PARTIAL,
      expect.any(String),
    );
  });

  it('records FAILED when the media fetch itself throws', async () => {
    provider.fetchMedia.mockRejectedValue(new Error('token revoked'));

    const result = await service.syncNow();

    expect(result.status).toBe(InstagramSyncStatus.FAILED);
    expect(tokens.recordSyncResult).toHaveBeenCalledWith(
      InstagramSyncStatus.FAILED,
      'token revoked',
    );
  });
});
