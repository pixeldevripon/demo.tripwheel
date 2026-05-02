import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import {
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateStripeConfigurationDto,
  UpdateMollieConfigurationDto,
  UpdateCompanyInformationsDto,
} from './dto/settings.dto';

function createMockSettingsService() {
  return {
    getSiteInfo: jest.fn(),
    updateSiteInfo: jest.fn(),
    getSiteSEO: jest.fn(),
    updateSiteSEO: jest.fn(),
    getCompanyInformations: jest.fn(),
    createCompanyInformations: jest.fn(),
    updateCompanyInformations: jest.fn(),
    getStripeConfiguration: jest.fn(),
    updateStripeConfiguration: jest.fn(),
    getMollieConfiguration: jest.fn(),
    updateMollieConfiguration: jest.fn(),
  };
}

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: ReturnType<typeof createMockSettingsService>;

  beforeEach(async () => {
    service = createMockSettingsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        { provide: SettingsService, useValue: service },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
  });

  it('is correctly instantiated and injected', () => {
    expect(controller).toBeDefined();
  });

  // ── Site Info ──────────────────────────────────────────────────────────────

  describe('getSiteInfo', () => {
    it('delegates retrieval of core site configuration to the service layer', async () => {
      service.getSiteInfo.mockResolvedValue({ id: 'default', siteName: 'Test' });
      const result = await controller.getSiteInfo();
      expect(result).toEqual({ id: 'default', siteName: 'Test' });
      expect(service.getSiteInfo).toHaveBeenCalled();
    });
  });

  describe('updateSiteInfo', () => {
    it('delegates site configuration updates to the service layer with the provided DTO', async () => {
      const dto: UpdateSiteInfoDto = { siteName: 'Updated Site' };
      await controller.updateSiteInfo(dto);
      expect(service.updateSiteInfo).toHaveBeenCalledWith(dto);
    });
  });

  // ── Site SEO ───────────────────────────────────────────────────────────────

  describe('getSiteSEO', () => {
    it('delegates retrieval of global SEO metadata to the service layer', async () => {
      await controller.getSiteSEO();
      expect(service.getSiteSEO).toHaveBeenCalled();
    });
  });

  describe('updateSiteSEO', () => {
    it('delegates SEO metadata updates to the service layer with the provided DTO', async () => {
      const dto: UpdateSiteSEODto = { metaTitle: 'New Title' };
      await controller.updateSiteSEO(dto);
      expect(service.updateSiteSEO).toHaveBeenCalledWith(dto);
    });
  });

  // ── Stripe Configuration ───────────────────────────────────────────────────

  describe('Stripe Configuration Management', () => {
    it('getStripeConfiguration delegates public config retrieval to the service layer', async () => {
      await controller.getStripeConfiguration();
      expect(service.getStripeConfiguration).toHaveBeenCalled();
    });

    it('ingestStripeConfiguration handles initial key setup via the service layer', async () => {
      const dto: UpdateStripeConfigurationDto = { secretKey: 'sk_test' };
      await controller.ingestStripeConfiguration(dto);
      expect(service.updateStripeConfiguration).toHaveBeenCalledWith(dto);
    });

    it('updateStripeConfiguration performs maintenance updates via the service layer', async () => {
      const dto: UpdateStripeConfigurationDto = { publishableKey: 'pk_test' };
      await controller.updateStripeConfiguration(dto);
      expect(service.updateStripeConfiguration).toHaveBeenCalledWith(dto);
    });
  });

  // ── Mollie Configuration Management ────────────────────────────────────────

  describe('Mollie Configuration Management', () => {
    it('getMollieConfiguration delegates public config retrieval to the service layer', async () => {
      await controller.getMollieConfiguration();
      expect(service.getMollieConfiguration).toHaveBeenCalled();
    });

    it('ingestMollieConfiguration handles initial key setup via the service layer', async () => {
      const dto: UpdateMollieConfigurationDto = { apiKey: 'key_1' };
      await controller.ingestMollieConfiguration(dto);
      expect(service.updateMollieConfiguration).toHaveBeenCalledWith(dto);
    });

    it('updateMollieConfiguration performs maintenance updates via the service layer', async () => {
      const dto: UpdateMollieConfigurationDto = { apiKey: 'key_2' };
      await controller.updateMollieConfiguration(dto);
      expect(service.updateMollieConfiguration).toHaveBeenCalledWith(dto);
    });
  });

  // ── Company Information Management ─────────────────────────────────────────

  describe('Company Profile Management', () => {
    it('getCompanyInformations retrieves the company profile from the service layer', async () => {
      await controller.getCompanyInformations();
      expect(service.getCompanyInformations).toHaveBeenCalled();
    });

    it('createCompanyInformations handles initial profile creation via the service layer', async () => {
      const dto: UpdateCompanyInformationsDto = { companyName: 'Island Tour Ltd' };
      await controller.createCompanyInformations(dto);
      expect(service.createCompanyInformations).toHaveBeenCalledWith(dto);
    });

    it('updateCompanyInformations performs full or partial profile updates via the service layer', async () => {
      const dto: UpdateCompanyInformationsDto = { companyEmail: 'contact@island.com' };
      await controller.updateCompanyInformations(dto);
      expect(service.updateCompanyInformations).toHaveBeenCalledWith(dto);
    });
  });

  // ── Access Control Metadata ────────────────────────────────────────────────

  describe('Permission Guard Integration (Metadata)', () => {
    function getPermission(methodName: keyof SettingsController) {
      return Reflect.getMetadata('permissions', SettingsController.prototype[methodName]);
    }

    it('getSiteInfo endpoint is gated by VIEW_SETTINGS permission', () => {
      expect(getPermission('getSiteInfo')).toContain('VIEW_SETTINGS');
    });

    it('ingestStripeConfiguration endpoint has a strict rate limit of 5 requests per minute', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITmedium', SettingsController.prototype.ingestStripeConfiguration);
      expect(limit).toBe(5);
    });

    it('ingestMollieConfiguration endpoint has a strict rate limit of 5 requests per minute', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITmedium', SettingsController.prototype.ingestMollieConfiguration);
      expect(limit).toBe(5);
    });

    it('createCompanyInformations endpoint has a rate limit of 10 requests per minute', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITmedium', SettingsController.prototype.createCompanyInformations);
      expect(limit).toBe(10);
    });

    it('updateSiteInfo endpoint is gated by MANAGE_SETTINGS permission', () => {
      expect(getPermission('updateSiteInfo')).toContain('MANAGE_SETTINGS');
    });

    it('getSiteSEO endpoint is gated by VIEW_SETTINGS permission', () => {
      expect(getPermission('getSiteSEO')).toContain('VIEW_SETTINGS');
    });

    it('updateSiteSEO endpoint is gated by MANAGE_SETTINGS permission', () => {
      expect(getPermission('updateSiteSEO')).toContain('MANAGE_SETTINGS');
    });

    it('getCompanyInformations endpoint is gated by VIEW_SETTINGS permission', () => {
      expect(getPermission('getCompanyInformations')).toContain('VIEW_SETTINGS');
    });

    it('updateCompanyInformations endpoint is gated by MANAGE_SETTINGS permission', () => {
      expect(getPermission('updateCompanyInformations')).toContain('MANAGE_SETTINGS');
    });

    it('getStripeConfiguration endpoint is gated by MANAGE_SETTINGS permission', () => {
      expect(getPermission('getStripeConfiguration')).toContain('MANAGE_SETTINGS');
    });

    it('getMollieConfiguration endpoint is gated by MANAGE_SETTINGS permission', () => {
      expect(getPermission('getMollieConfiguration')).toContain('MANAGE_SETTINGS');
    });

    it('updateStripeConfiguration endpoint has a strict rate limit of 5 requests per minute', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITmedium', SettingsController.prototype.updateStripeConfiguration);
      expect(limit).toBe(5);
    });

    it('updateMollieConfiguration endpoint has a strict rate limit of 5 requests per minute', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITmedium', SettingsController.prototype.updateMollieConfiguration);
      expect(limit).toBe(5);
    });

    it('updateCompanyInformations endpoint has a rate limit of 10 requests per minute', () => {
      const limit = Reflect.getMetadata('THROTTLER:LIMITmedium', SettingsController.prototype.updateCompanyInformations);
      expect(limit).toBe(10);
    });
  });
});
