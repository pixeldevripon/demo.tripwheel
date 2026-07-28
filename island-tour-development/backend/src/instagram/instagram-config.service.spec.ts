import { Test, TestingModule } from '@nestjs/testing';

import { decrypt, encrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';

import { InstagramConfigService } from './instagram-config.service';

process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('InstagramConfigService', () => {
  let service: InstagramConfigService;
  let findUnique: jest.Mock;
  let upsert: jest.Mock;
  const original = { ...process.env };

  beforeEach(async () => {
    findUnique = jest.fn().mockResolvedValue(null); // no dashboard row by default
    upsert = jest.fn().mockResolvedValue({});
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstagramConfigService,
        {
          provide: PrismaService,
          useValue: { instagramAccount: { findUnique, upsert } },
        },
      ],
    }).compile();
    service = module.get(InstagramConfigService);
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('resolves the DB token (decrypted); DB-only, no env fallback', async () => {
    // Even with an env var set, it is ignored - the token is DB-only.
    process.env.INSTAGRAM_ACCESS_TOKEN = 'env-token-should-be-ignored';
    findUnique.mockResolvedValue({
      configAccessToken: encrypt('dashboard-token-value'),
    });

    const cfg = await service.resolve();

    expect(cfg.accessToken).toBe('dashboard-token-value');
    expect(cfg.hasToken).toBe(true);
    expect(cfg.isConfigured).toBe(true);
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
  });

  it('no dashboard row => not configured (env is never consulted)', async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'env-token-should-be-ignored';
    findUnique.mockResolvedValue(null);

    const cfg = await service.resolve();

    expect(cfg.accessToken).toBe('');
    expect(cfg.hasToken).toBe(false);
    expect(cfg.isConfigured).toBe(false);
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
  });

  describe('credential status', () => {
    it('reports booleans off the DB token, never the value', async () => {
      findUnique.mockResolvedValue({ configAccessToken: encrypt('t') });

      const status = await service.getCredentialStatus();

      expect(status.hasAccessToken).toBe(true);
      expect(status.isConfigured).toBe(true);
      expect(status).not.toHaveProperty('accessToken');
      expect(status).not.toHaveProperty('usingEnvFallback');
    });

    it('reports not configured when the DB has no token', async () => {
      findUnique.mockResolvedValue(null);

      const status = await service.getCredentialStatus();

      expect(status.hasAccessToken).toBe(false);
      expect(status.isConfigured).toBe(false);
    });
  });

  describe('saveCredentials', () => {
    it('stores the token ENCRYPTED and re-seeds the connection', async () => {
      await service.saveCredentials({ accessToken: 'new-secret-token' });

      const update = upsert.mock.calls[0][0].update;
      // Ciphertext, not plaintext.
      expect(update.configAccessToken).not.toBe('new-secret-token');
      expect(decrypt(update.configAccessToken)).toBe('new-secret-token');
      // Saving a token invalidates the seeded working connection.
      expect(update).toMatchObject({
        igUserId: null,
        accessToken: null,
        tokenExpiresAt: null,
      });
    });

    it('an empty string clears the stored token', async () => {
      await service.saveCredentials({ accessToken: '' });
      expect(upsert.mock.calls[0][0].update.configAccessToken).toBeNull();
    });

    it('an omitted token is a no-op (leaves the stored value)', async () => {
      await service.saveCredentials({});
      expect(upsert).not.toHaveBeenCalled();
    });
  });
});
