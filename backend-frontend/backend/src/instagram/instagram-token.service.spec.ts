import { Test, TestingModule } from '@nestjs/testing';
import { InstagramSyncStatus } from '@prisma/client';

import { decrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';

import { InstagramConfigService } from './instagram-config.service';
import { InstagramTokenService } from './instagram-token.service';
import { INSTAGRAM_API_PROVIDER } from './providers/instagram-api.provider';

// The token service encrypts with crypto.util, which needs ENCRYPTION_KEY.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('InstagramTokenService', () => {
  let service: InstagramTokenService;
  let prisma: {
    instagramAccount: {
      upsert: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let config: { resolve: jest.Mock };
  let provider: { resolveAccount: jest.Mock; refreshToken: jest.Mock };

  beforeEach(async () => {
    prisma = {
      instagramAccount: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
    };
    // Default: a token is configured (the seed the working connection derives
    // from). Individual tests override this to the "no token" case.
    config = {
      resolve: jest
        .fn()
        .mockResolvedValue({ hasToken: true, accessToken: 'configured-token' }),
    };
    provider = {
      resolveAccount: jest
        .fn()
        .mockResolvedValue({ userId: 'ig-real', username: 'island.tours_' }),
      refreshToken: jest.fn().mockResolvedValue({
        accessToken: 'refreshed',
        userId: '',
        expiresInSeconds: 5_000_000,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: InstagramConfigService, useValue: config },
        { provide: INSTAGRAM_API_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = module.get(InstagramTokenService);
  });

  it('stores the token ENCRYPTED, never in plaintext', async () => {
    await service.saveConnection({
      accessToken: 'super-secret-token',
      userId: 'ig-1',
      expiresInSeconds: 5_000_000,
    });

    const data = prisma.instagramAccount.upsert.mock.calls[0][0].create;
    expect(data.accessToken).not.toBe('super-secret-token');
    // Round-trips back through decrypt - proving it is ciphertext we own.
    expect(decrypt(data.accessToken)).toBe('super-secret-token');
    expect(data.igUserId).toBe('ig-1');
    expect(data.tokenExpiresAt).toBeInstanceOf(Date);
  });

  it('reads back the live stored credential for the sync', async () => {
    // A stored token that is fresh (not near expiry) is used directly - no
    // re-seed, no API call.
    await service.saveConnection({
      accessToken: 'tok-xyz',
      userId: 'ig-9',
      expiresInSeconds: 5_000_000,
    });
    const stored = prisma.instagramAccount.upsert.mock.calls[0][0].create;
    prisma.instagramAccount.findUnique.mockResolvedValue({
      igUserId: 'ig-9',
      accessToken: stored.accessToken,
      tokenExpiresAt: stored.tokenExpiresAt,
    });

    const cred = await service.readCredential();

    expect(cred).toEqual({
      igUserId: 'ig-9',
      accessToken: 'tok-xyz',
      tokenExpiresAt: stored.tokenExpiresAt,
    });
    expect(provider.resolveAccount).not.toHaveBeenCalled(); // live token, no re-seed
  });

  it('returns null credential when no token is configured', async () => {
    config.resolve.mockResolvedValue({ hasToken: false, accessToken: '' });
    expect(await service.readCredential()).toBeNull();
    expect(provider.resolveAccount).not.toHaveBeenCalled();
  });

  it('getConnection reports connected off the configured token, never leaks it', async () => {
    prisma.instagramAccount.findUnique.mockResolvedValue({
      igUserId: 'ig-1',
      tokenExpiresAt: new Date(),
      lastSyncedAt: new Date(),
      lastSyncStatus: InstagramSyncStatus.OK,
      lastSyncError: null,
    });

    const conn = await service.getConnection();

    expect(conn.connected).toBe(true);
    expect(conn.igUserId).toBe('ig-1');
    expect(conn).not.toHaveProperty('accessToken');
    expect(provider.resolveAccount).not.toHaveBeenCalled(); // status is cheap
  });

  it('getConnection reports not connected when no token is configured', async () => {
    config.resolve.mockResolvedValue({ hasToken: false, accessToken: '' });
    prisma.instagramAccount.findUnique.mockResolvedValue(null);

    const conn = await service.getConnection();

    expect(conn.connected).toBe(false);
  });

  describe('seeding from the configured token', () => {
    it('seeds the DB when there is no live stored token', async () => {
      // Fresh account (no stored token): resolve the real user id, refresh to get
      // a real expiry, and store it so the nightly refresh can take over.
      prisma.instagramAccount.findUnique.mockResolvedValue({
        igUserId: null,
        accessToken: null,
        tokenExpiresAt: null,
      });
      provider.resolveAccount.mockResolvedValue({
        userId: '17841404077807859',
        username: 'md_shahadat',
      });

      const cred = await service.readCredential();

      expect(provider.resolveAccount).toHaveBeenCalledWith('configured-token');
      expect(cred?.igUserId).toBe('17841404077807859');
      expect(cred?.accessToken).toBe('refreshed'); // the refreshed token, stored
      expect(cred?.tokenExpiresAt).toBeInstanceOf(Date);
      // Stored encrypted via saveConnection's upsert.
      expect(prisma.instagramAccount.upsert).toHaveBeenCalled();
      const stored = prisma.instagramAccount.upsert.mock.calls[0][0].create;
      expect(stored.accessToken).not.toBe('refreshed'); // ciphertext
      expect(decrypt(stored.accessToken)).toBe('refreshed');
    });

    it('re-seeds when the stored ciphertext no longer decrypts', async () => {
      // A corrupt stored token (e.g. ENCRYPTION_KEY rotation) falls back to
      // seeding from the still-valid configured token rather than dying.
      prisma.instagramAccount.findUnique.mockResolvedValue({
        igUserId: 'ig-old',
        accessToken: 'not-valid-ciphertext',
        tokenExpiresAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      });

      const cred = await service.readCredential();

      expect(provider.resolveAccount).toHaveBeenCalledWith('configured-token');
      expect(cred?.accessToken).toBe('refreshed');
    });

    it('prefers a live stored token over re-seeding', async () => {
      // saveConnection encrypts; reuse it to make a realistic stored token.
      await service.saveConnection({
        accessToken: 'db-refreshed-token',
        userId: 'ig-real',
        expiresInSeconds: 5_000_000,
      });
      const stored = prisma.instagramAccount.upsert.mock.calls[0][0].create;
      prisma.instagramAccount.findUnique.mockResolvedValue({
        igUserId: 'ig-real',
        accessToken: stored.accessToken,
        tokenExpiresAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      });

      const cred = await service.readCredential();

      expect(cred?.accessToken).toBe('db-refreshed-token');
      expect(provider.resolveAccount).not.toHaveBeenCalled(); // no re-seed
    });

    it('returns null credential when the token is invalid (/me throws)', async () => {
      prisma.instagramAccount.findUnique.mockResolvedValue({
        igUserId: null,
        accessToken: null,
        tokenExpiresAt: null,
      });
      provider.resolveAccount.mockRejectedValue(new Error('OAuthException'));
      expect(await service.readCredential()).toBeNull();
    });
  });
});
