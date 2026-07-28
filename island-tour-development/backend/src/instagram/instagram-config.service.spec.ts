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
      expect(status.maskedAccessToken).toBeNull();
    });

    it('masks the stored token to bullets + its last 4 characters', async () => {
      findUnique.mockResolvedValue({
        configAccessToken: encrypt('IGAAsecretpayloadWQZD'),
      });

      const status = await service.getCredentialStatus();

      expect(status.maskedAccessToken).toBe('••••••••WQZD');
      // The mask must never carry enough to reconstruct the credential.
      expect(status.maskedAccessToken).not.toContain('secretpayload');
    });

    // A rotated ENCRYPTION_KEY leaves ciphertext that no longer decrypts: the
    // token is "set" but unusable, and the null mask is what tells the admin.
    it('reports a stored-but-undecryptable token as set with no mask', async () => {
      findUnique.mockResolvedValue({ configAccessToken: 'not:valid:cipher' });

      const status = await service.getCredentialStatus();

      expect(status.hasAccessToken).toBe(true);
      expect(status.maskedAccessToken).toBeNull();
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

    // The dashboard's token input is write-only and can re-submit an unchanged
    // value; treating that as a reconnect tore down a working feed.
    it('re-submitting the SAME token is a no-op, not a reconnect', async () => {
      findUnique.mockResolvedValue({
        configAccessToken: encrypt('already-stored-token'),
      });

      await service.saveCredentials({
        accessToken: '  already-stored-token  ',
      });

      expect(upsert).not.toHaveBeenCalled();
    });

    it('a DIFFERENT token still re-seeds the connection', async () => {
      findUnique.mockResolvedValue({
        configAccessToken: encrypt('already-stored-token'),
      });

      await service.saveCredentials({ accessToken: 'a-brand-new-token' });

      const update = upsert.mock.calls[0][0].update;
      // The NEW value must actually land - a reconnect that nulled the
      // connection without storing the new token would still pass the
      // assertions below.
      expect(decrypt(update.configAccessToken)).toBe('a-brand-new-token');
      expect(update).toMatchObject({
        igUserId: null,
        accessToken: null,
        tokenExpiresAt: null,
      });
    });

    // Clearing must still go through even though '' can never "match" a stored
    // token - it is the explicit disconnect.
    it('clears the token even when one is stored', async () => {
      findUnique.mockResolvedValue({ configAccessToken: encrypt('stored') });

      await service.saveCredentials({ accessToken: '' });

      expect(upsert.mock.calls[0][0].update.configAccessToken).toBeNull();
    });
  });
});
