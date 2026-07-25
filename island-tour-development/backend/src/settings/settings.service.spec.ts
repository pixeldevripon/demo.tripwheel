import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateCompanyInformationsDto,
  UpdateStripeConfigurationDto,
  UpdateMollieConfigurationDto,
} from './dto/settings.dto';

function createMockPrismaService() {
  return {
    siteInfo: {
      upsert: jest.fn(),
    },
    siteSEO: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    companyInformations: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    stripeConfiguration: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    mollieConfiguration: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    paymentSettings: {
      upsert: jest.fn(),
    },
  };
}

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  // ── Site Info ──────────────────────────────────────────────────────────────

  describe('getSiteInfo', () => {
    it('returns the site configuration using the default singleton ID', async () => {
      const mockResult = { id: 'default', siteName: 'Test' };
      prisma.siteInfo.upsert.mockResolvedValue(mockResult);

      const result = await service.getSiteInfo();

      expect(result).toEqual(mockResult);
      expect(prisma.siteInfo.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
      });
    });

    it('propagates database errors when upsert fails', async () => {
      prisma.siteInfo.upsert.mockRejectedValue(new Error('DB Error'));
      await expect(service.getSiteInfo()).rejects.toThrow('DB Error');
    });
  });

  describe('updateSiteInfo', () => {
    it('persists site updates using the default singleton ID', async () => {
      const dto: UpdateSiteInfoDto = { siteName: 'New Name' };
      const mockResult = { id: 'default', ...dto };
      prisma.siteInfo.upsert.mockResolvedValue(mockResult);

      const result = await service.updateSiteInfo(dto);

      expect(result).toEqual(mockResult);
      expect(prisma.siteInfo.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        update: expect.objectContaining({ siteName: 'New Name' }),
        create: expect.objectContaining({
          id: 'default',
          siteName: 'New Name',
        }),
      });
    });

    it('correctly transforms and stores FAQ items as a JSON structure', async () => {
      const dto: UpdateSiteInfoDto = { faqs: [{ question: 'Q', answer: 'A' }] };
      prisma.siteInfo.upsert.mockResolvedValue({ id: 'default', ...dto });

      await service.updateSiteInfo(dto);

      expect(prisma.siteInfo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ faqs: dto.faqs }),
        }),
      );
    });

    it('gracefully handles null or missing FAQ inputs', async () => {
      const dto: UpdateSiteInfoDto = { faqs: null as any };
      prisma.siteInfo.upsert.mockResolvedValue({ id: 'default' });

      await service.updateSiteInfo(dto);

      expect(prisma.siteInfo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.not.objectContaining({ faqs: null }),
        }),
      );
    });
  });

  // ── Site SEO ───────────────────────────────────────────────────────────────

  describe('getSiteSEO', () => {
    it('returns global SEO metadata using the default singleton ID', async () => {
      const mockResult = { id: 'default', metaTitle: 'SEO' };
      prisma.siteSEO.upsert.mockResolvedValue(mockResult);

      const result = await service.getSiteSEO();

      expect(result).toEqual(mockResult);
      expect(prisma.siteSEO.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
      });
    });
  });

  describe('getPublicSiteSEO', () => {
    it('exposes the public-by-nature tracking IDs and crawl-output fields', async () => {
      prisma.siteSEO.findFirst.mockResolvedValue({
        metaTitle: 'Title',
        metaDescription: 'Desc',
        metaKeywords: 'a,b',
        canonicalUrl: 'https://x.test',
        robotsMeta: 'index, follow',
        ogTitle: 'OG',
        ogDescription: 'OGd',
        ogImage: 'https://x.test/og.png',
        twitterTitle: 'TW',
        twitterDescription: 'TWd',
        twitterImage: 'https://x.test/tw.png',
        googleAnalyticsId: 'G-ABC123',
        googleTagManagerId: 'GTM-XYZ',
        googleSearchConsole: 'verify-token',
        facebookPixelId: '1234567890',
        cookiebotCbid: 'cbid-uuid',
        robotsTxt: 'User-agent: *\nAllow: /',
        autoGenerateSitemap: 'true',
      });

      const result = await service.getPublicSiteSEO();

      // findFirst (never a write) on the default singleton.
      expect(prisma.siteSEO.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'default' } }),
      );
      expect(result.googleAnalyticsId).toBe('G-ABC123');
      expect(result.googleTagManagerId).toBe('GTM-XYZ');
      expect(result.facebookPixelId).toBe('1234567890');
      expect(result.robotsTxt).toBe('User-agent: *\nAllow: /');
      expect(result.autoGenerateSitemap).toBe('true');
    });

    it('coerces empty strings and a missing row to null', async () => {
      prisma.siteSEO.findFirst.mockResolvedValue({
        googleAnalyticsId: '',
        googleTagManagerId: '',
        facebookPixelId: '',
        robotsTxt: '',
        autoGenerateSitemap: '',
      });

      const result = await service.getPublicSiteSEO();

      expect(result.googleAnalyticsId).toBeNull();
      expect(result.googleTagManagerId).toBeNull();
      expect(result.facebookPixelId).toBeNull();
      expect(result.robotsTxt).toBeNull();
      expect(result.autoGenerateSitemap).toBeNull();
    });
  });

  describe('updateSiteSEO', () => {
    it('persists SEO metadata updates using the default singleton ID', async () => {
      const dto: UpdateSiteSEODto = { metaTitle: 'New SEO' };
      const mockResult = { id: 'default', ...dto };
      prisma.siteSEO.upsert.mockResolvedValue(mockResult);

      const result = await service.updateSiteSEO(dto);

      expect(result).toEqual(mockResult);
      expect(prisma.siteSEO.upsert).toHaveBeenCalledWith({
        where: { id: 'default' },
        update: dto,
        create: { id: 'default', ...dto },
      });
    });
  });

  // ── Company Informations ───────────────────────────────────────────────────

  describe('getCompanyInformations', () => {
    it('returns company profile using the default singleton ID', async () => {
      const mockResult = { id: 'default', companyName: 'Company' };
      prisma.companyInformations.upsert.mockResolvedValue(mockResult);

      const result = await service.getCompanyInformations();

      expect(result).toEqual(mockResult);
    });
  });

  describe('createCompanyInformations', () => {
    it('initializes company profile record via upsert', async () => {
      const dto: UpdateCompanyInformationsDto = { companyName: 'New Company' };
      const mockResult = { id: 'default', ...dto };
      prisma.companyInformations.upsert.mockResolvedValue(mockResult);

      const result = await service.createCompanyInformations(dto);

      expect(result).toEqual(mockResult);
      expect(prisma.companyInformations.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'default' } }),
      );
    });
  });

  describe('updateCompanyInformations', () => {
    it('performs a direct update on the existing company record', async () => {
      const dto: UpdateCompanyInformationsDto = { companyPhone: '123' };
      const mockResult = { id: 'default', ...dto };
      prisma.companyInformations.update.mockResolvedValue(mockResult);

      const result = await service.updateCompanyInformations(dto);

      expect(result).toEqual(mockResult);
      expect(prisma.companyInformations.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: dto,
      });
    });
  });

  // ── Stripe Configuration ───────────────────────────────────────────────────

  describe('getStripeConfiguration', () => {
    it('returns Stripe settings via the default singleton ID', async () => {
      const dbResult = {
        id: 'default',
        paymentLabel: 'Stripe',
        secretKey: null,
        webhookSecret: null,
      };
      prisma.stripeConfiguration.upsert.mockResolvedValue(dbResult);

      const result = await service.getStripeConfiguration();

      expect(result).toEqual({
        id: 'default',
        paymentLabel: 'Stripe',
        secretKey: null,
        webhookSecret: null,
      });
    });
  });

  describe('updateStripeConfiguration', () => {
    it('persists Stripe configuration updates via upsert', async () => {
      const dto: UpdateStripeConfigurationDto = { publishableKey: 'pk_test' };
      const dbResult = {
        id: 'default',
        publishableKey: 'pk_test',
        secretKey: null,
        webhookSecret: null,
      };
      prisma.stripeConfiguration.upsert.mockResolvedValue(dbResult);

      const result = await service.updateStripeConfiguration(dto);

      expect(result).toEqual({
        id: 'default',
        publishableKey: 'pk_test',
        secretKey: null,
        webhookSecret: null,
      });
      expect(prisma.stripeConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'default' } }),
      );
    });
  });

  // ── Mollie Configuration ───────────────────────────────────────────────────

  describe('getMollieConfiguration', () => {
    it('returns Mollie settings via the default singleton ID', async () => {
      const dbResult = { id: 'default', paymentLabel: 'Mollie', apiKey: null };
      prisma.mollieConfiguration.upsert.mockResolvedValue(dbResult);

      const result = await service.getMollieConfiguration();

      expect(result).toEqual({
        id: 'default',
        paymentLabel: 'Mollie',
        apiKey: null,
      });
    });
  });

  describe('updateMollieConfiguration', () => {
    it('persists Mollie configuration updates via upsert', async () => {
      const dto: UpdateMollieConfigurationDto = { apiKey: 'live_test' };
      // DB returns null for apiKey to avoid decrypt being called on plain text
      const dbResult = { id: 'default', apiKey: null };
      prisma.mollieConfiguration.upsert.mockResolvedValue(dbResult);

      const result = await service.updateMollieConfiguration(dto);

      expect(result).toEqual({ id: 'default', apiKey: null });
      expect(prisma.mollieConfiguration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'default' } }),
      );
    });
  });

  // ── Active payment provider switch ───────────────────────────────────────────

  describe('getPaymentProviderSettings', () => {
    it('upserts and returns the singleton (STRIPE default)', async () => {
      const row = {
        id: 'default',
        activeProvider: 'STRIPE',
        updatedAt: new Date(),
      };
      prisma.paymentSettings.upsert.mockResolvedValue(row);

      const result = await service.getPaymentProviderSettings();

      expect(result.activeProvider).toBe('STRIPE');
      expect(prisma.paymentSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'default' } }),
      );
    });
  });

  describe('updatePaymentProviderSettings', () => {
    it('switches to MOLLIE when a Mollie API key is configured', async () => {
      prisma.mollieConfiguration.findUnique.mockResolvedValue({
        apiKey: 'encrypted-key',
      });
      const row = {
        id: 'default',
        activeProvider: 'MOLLIE',
        updatedAt: new Date(),
      };
      prisma.paymentSettings.upsert.mockResolvedValue(row);

      const result = await service.updatePaymentProviderSettings({
        activeProvider: 'MOLLIE',
      } as never);

      expect(result.activeProvider).toBe('MOLLIE');
    });

    it('rejects switching to MOLLIE without an API key (would brick checkout)', async () => {
      prisma.mollieConfiguration.findUnique.mockResolvedValue({ apiKey: '' });

      await expect(
        service.updatePaymentProviderSettings({
          activeProvider: 'MOLLIE',
        } as never),
      ).rejects.toThrow('Configure the Mollie API key');
      expect(prisma.paymentSettings.upsert).not.toHaveBeenCalled();
    });

    it('rejects switching to STRIPE without secret + webhook secret', async () => {
      prisma.stripeConfiguration.findUnique.mockResolvedValue({
        secretKey: 'enc',
        webhookSecret: '',
      });

      await expect(
        service.updatePaymentProviderSettings({
          activeProvider: 'STRIPE',
        } as never),
      ).rejects.toThrow('Configure the Stripe secret key');
      expect(prisma.paymentSettings.upsert).not.toHaveBeenCalled();
    });
  });
});
