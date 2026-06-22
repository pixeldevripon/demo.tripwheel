import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { SettingsService } from './settings.service';
import {
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateSocialMediaDto,
  UpdateStripeConfigurationDto,
  UpdateMollieConfigurationDto,
  UpdateCompanyInformationsDto,
} from './dto/settings.dto';
import {
  ApiGetSiteInfoDocs,
  ApiUpdateSiteInfoDocs,
  ApiGetSiteSEODocs,
  ApiUpdateSiteSEODocs,
  ApiGetStripeConfigurationDocs,
  ApiUpdateStripeConfigurationDocs,
  ApiGetMollieConfigurationDocs,
  ApiUpdateMollieConfigurationDocs,
  ApiGetCompanyInformationsDocs,
  ApiUpdateCompanyInformationsDocs,
  ApiGetSocialMediaDocs,
  ApiUpdateSocialMediaDocs,
} from './settings.swagger';

@ApiTags('Settings')
@Controller('settings')
/**
 * SettingsController - manages platform-wide configurations.
 *
 * ## Access-Control Strategy
 * This controller follows the permission-based RBAC pattern:
 *
 *   - `@RequirePermissions(Permission.VIEW_SETTINGS)` gates read access to configuration.
 *   - `@RequirePermissions(Permission.MANAGE_SETTINGS)` gates write access to sensitive configs.
 *   - Read-only site/company info is generally accessible to authenticated users for UI rendering.
 *   - Sensitive payment and system configurations are locked to ADMIN via MANAGE_SETTINGS.
 */
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ── Site Info ──────────────────────────────────────────────────────────────

  /**
   * GET /settings/site
   *
   * Returns core site configuration like name, logo, and active features.
   * Security: requires VIEW_SETTINGS.
   */
  @Get('site')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetSiteInfoDocs()
  getSiteInfo() {
    return this.settingsService.getSiteInfo();
  }

  /**
   * PATCH /settings/site
   *
   * Updates site-wide parameters.
   * Security: requires MANAGE_SETTINGS.
   */
  @Patch('site')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateSiteInfoDocs()
  updateSiteInfo(@Body() dto: UpdateSiteInfoDto) {
    return this.settingsService.updateSiteInfo(dto);
  }

  // ── Site SEO ───────────────────────────────────────────────────────────────

  /**
   * GET /settings/seo
   *
   * Fetches global SEO metadata and tracking IDs.
   * Security: requires VIEW_SETTINGS.
   */
  @Get('seo')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetSiteSEODocs()
  getSiteSEO() {
    return this.settingsService.getSiteSEO();
  }

  /**
   * PATCH /settings/seo
   *
   * Updates global SEO meta tags and social graph information.
   * Security: requires MANAGE_SETTINGS.
   */
  @Patch('seo')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateSiteSEODocs()
  updateSiteSEO(@Body() dto: UpdateSiteSEODto) {
    return this.settingsService.updateSiteSEO(dto);
  }

  // ── Payment Configuration (Stripe) ──────────────────────────────────────────

  /**
   * GET /settings/payment/stripe
   *
   * Retrieves Stripe public keys and enabled methods.
   * Security: requires MANAGE_SETTINGS (Admin only).
   */
  @Get('payment/stripe')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiGetStripeConfigurationDocs()
  getStripeConfiguration() {
    return this.settingsService.getStripeConfiguration();
  }

  /**
   * POST /settings/payment/stripe
   *
   * Initial ingestion of Stripe API keys.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Post('payment/stripe')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateStripeConfigurationDocs()
  ingestStripeConfiguration(@Body() dto: UpdateStripeConfigurationDto) {
    return this.settingsService.updateStripeConfiguration(dto);
  }

  /**
   * PATCH /settings/payment/stripe
   *
   * Updates existing Stripe configuration.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('payment/stripe')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateStripeConfigurationDocs()
  updateStripeConfiguration(@Body() dto: UpdateStripeConfigurationDto) {
    return this.settingsService.updateStripeConfiguration(dto);
  }

  // ── Payment Configuration (Mollie) ──────────────────────────────────────────

  /**
   * GET /settings/payment/mollie
   *
   * Retrieves Mollie public configuration.
   * Security: requires MANAGE_SETTINGS (Admin only).
   */
  @Get('payment/mollie')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiGetMollieConfigurationDocs()
  getMollieConfiguration() {
    return this.settingsService.getMollieConfiguration();
  }

  /**
   * POST /settings/payment/mollie
   *
   * Initial ingestion of Mollie API keys.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Post('payment/mollie')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateMollieConfigurationDocs()
  ingestMollieConfiguration(@Body() dto: UpdateMollieConfigurationDto) {
    return this.settingsService.updateMollieConfiguration(dto);
  }

  /**
   * PATCH /settings/payment/mollie
   *
   * Updates existing Mollie configuration.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('payment/mollie')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateMollieConfigurationDocs()
  updateMollieConfiguration(@Body() dto: UpdateMollieConfigurationDto) {
    return this.settingsService.updateMollieConfiguration(dto);
  }

  // ── Company Information ────────────────────────────────────────────────────

  /**
   * GET /settings/company
   *
   * Returns the company profile (contact details, address).
   * Security: requires VIEW_SETTINGS.
   */
  @Get('company')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetCompanyInformationsDocs()
  getCompanyInformations() {
    return this.settingsService.getCompanyInformations();
  }

  /**
   * POST /settings/company
   *
   * Creates initial company information record.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Post('company')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateCompanyInformationsDocs()
  createCompanyInformations(@Body() dto: UpdateCompanyInformationsDto) {
    return this.settingsService.createCompanyInformations(dto);
  }

  /**
   * PATCH /settings/company
   *
   * Full or partial update of company information.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 10, ttl: 60000 } })
  @Patch('company')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateCompanyInformationsDocs()
  updateCompanyInformations(@Body() dto: UpdateCompanyInformationsDto) {
    return this.settingsService.updateCompanyInformations(dto);
  }

  // ── Social Media ───────────────────────────────────────────────────────────

  /**
   * GET /settings/social-media
   *
   * Returns the platform's social media links.
   * Security: requires VIEW_SETTINGS.
   */
  @Get('social-media')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetSocialMediaDocs()
  getSocialMedia() {
    return this.settingsService.getSocialMedia();
  }

  /**
   * PATCH /settings/social-media
   *
   * Updates platform-wide social media links.
   * Security: requires MANAGE_SETTINGS.
   */
  @Patch('social-media')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateSocialMediaDocs()
  updateSocialMedia(@Body() dto: UpdateSocialMediaDto) {
    return this.settingsService.updateSocialMedia(dto);
  }
}
  