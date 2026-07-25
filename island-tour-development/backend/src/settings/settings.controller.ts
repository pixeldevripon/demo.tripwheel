import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@prisma/client';
import { Public } from '@/auth/decorators/public.decorator';
import { RequirePermissions } from '@/auth/decorators/require-permissions.decorator';
import { SettingsService } from './settings.service';
import {
  UpdateCompanyInformationsDto,
  UpdateMailchimpDto,
  UpdateReviewRequestsDto,
  UpdateMollieConfigurationDto,
  UpdatePaymentProviderDto,
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateSocialMediaDto,
  UpdateIntegrationsConfigurationDto,
  UpdateStripeConfigurationDto,
} from './dto/settings.dto';
import {
  ApiGetPublicCompanyInfoDocs,
  ApiGetPublicSiteInfoDocs,
  ApiGetPublicSiteSEODocs,
  ApiGetPublicSocialMediaDocs,
  ApiGetSiteInfoDocs,
  ApiUpdateSiteInfoDocs,
  ApiGetSiteSEODocs,
  ApiUpdateSiteSEODocs,
  ApiGetIntegrationsConfigurationDocs,
  ApiGetStripeConfigurationDocs,
  ApiUpdateIntegrationsConfigurationDocs,
  ApiUpdateStripeConfigurationDocs,
  ApiGetMollieConfigurationDocs,
  ApiUpdateMollieConfigurationDocs,
  ApiGetPaymentProviderDocs,
  ApiUpdatePaymentProviderDocs,
  ApiGetCompanyInformationsDocs,
  ApiUpdateCompanyInformationsDocs,
  ApiGetSocialMediaDocs,
  ApiUpdateSocialMediaDocs,
  ApiGetMailchimpDocs,
  ApiGetReviewRequestsDocs,
  ApiUpdateMailchimpDocs,
  ApiUpdateReviewRequestsDocs,
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
   * GET /settings/public/site
   *
   * Public-safe SiteInfo for the unauthenticated marketing site: logo, favicon,
   * tagline, and the WhatsApp/Instagram flags. The public site has no session,
   * so it cannot use GET /settings/site (VIEW_SETTINGS) - without this route the
   * footer/NeedHelp WhatsApp links have no number to point at (master 6.6).
   *
   * Security: @Public, so the service hand-picks the response fields. This
   * controller also serves Stripe/Mollie config - never widen this to the
   * full row. Registered above `site/:x`-style routes is not a concern here, but
   * it must stay a sibling of the guarded routes so the contrast is obvious.
   */
  @Get('public/site')
  @Public()
  @ApiGetPublicSiteInfoDocs()
  getPublicSiteInfo() {
    return this.settingsService.getPublicSiteInfo();
  }

  /**
   * GET /settings/public/seo
   *
   * Public-safe SiteSEO for the marketing site's meta/OG/Twitter tags plus the
   * Search Console verification token (public by design - its only job is to be
   * rendered in the public <head>). Same contract as public/site: the service
   * hand-picks fields, so analytics IDs never reach an unauthenticated response.
   */
  @Get('public/seo')
  @Public()
  @ApiGetPublicSiteSEODocs()
  getPublicSiteSEO() {
    return this.settingsService.getPublicSiteSEO();
  }

  /**
   * GET /settings/public/social-media
   *
   * The four public social profile URLs for the marketing site footer.
   */
  @Get('public/social-media')
  @Public()
  @ApiGetPublicSocialMediaDocs()
  getPublicSocialMedia() {
    return this.settingsService.getPublicSocialMedia();
  }

  /**
   * GET /settings/public/company
   *
   * Public-safe company/legal details for the marketing site footer and legal
   * pages. Excludes companySize and record timestamps.
   */
  @Get('public/company')
  @Public()
  @ApiGetPublicCompanyInfoDocs()
  getPublicCompanyInformations() {
    return this.settingsService.getPublicCompanyInformations();
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

  // ── Integrations (Meta CAPI + Google Translate secrets) ──────────────────────

  /**
   * GET /settings/integrations
   *
   * Server-side integration secrets (Meta CAPI token, Google Translate key), with
   * the secrets MASKED. Security: requires MANAGE_SETTINGS.
   */
  @Get('integrations')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiGetIntegrationsConfigurationDocs()
  getIntegrationsConfiguration() {
    return this.settingsService.getIntegrationsConfiguration();
  }

  /**
   * PATCH /settings/integrations
   *
   * Update integration secrets. An omitted/blank secret leaves the stored value
   * untouched. Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('integrations')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateIntegrationsConfigurationDocs()
  updateIntegrationsConfiguration(
    @Body() dto: UpdateIntegrationsConfigurationDto,
  ) {
    return this.settingsService.updateIntegrationsConfiguration(dto);
  }

  // ── Active payment provider (platform switch) ───────────────────────────────

  /**
   * GET /settings/payment/provider
   *
   * Which PSP (Stripe or Mollie) charges travellers at checkout.
   * Security: requires MANAGE_SETTINGS (Admin only).
   */
  @Get('payment/provider')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiGetPaymentProviderDocs()
  getPaymentProviderSettings() {
    return this.settingsService.getPaymentProviderSettings();
  }

  /**
   * PATCH /settings/payment/provider
   *
   * Switch the checkout PSP. Rejected (400) when the target provider has no
   * usable credentials yet - a switch must never brick the checkout.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('payment/provider')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdatePaymentProviderDocs()
  updatePaymentProviderSettings(@Body() dto: UpdatePaymentProviderDto) {
    return this.settingsService.updatePaymentProviderSettings(dto);
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

  // ── Mailchimp Configuration ────────────────────────────────────────────────

  /**
   * GET /settings/mailchimp
   *
   * Retrieves Mailchimp configuration (API key masked).
   * Security: requires MANAGE_SETTINGS (Admin only).
   */
  @Get('mailchimp')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiGetMailchimpDocs()
  getMailchimp() {
    return this.settingsService.getMailchimp();
  }

  /**
   * PATCH /settings/mailchimp
   *
   * Updates Mailchimp configuration. The API key is encrypted at rest.
   * Security: requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('mailchimp')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateMailchimpDocs()
  updateMailchimp(@Body() dto: UpdateMailchimpDto) {
    return this.settingsService.updateMailchimp(dto);
  }

  // ── Post-tour review requests (cadence) ────────────────────────────────────

  /**
   * GET /settings/review-requests
   *
   * The post-tour review invitation schedule.
   * Security: requires VIEW_SETTINGS.
   */
  @Get('review-requests')
  @RequirePermissions(Permission.VIEW_SETTINGS)
  @ApiGetReviewRequestsDocs()
  getReviewRequests() {
    return this.settingsService.getReviewRequests();
  }

  /**
   * PATCH /settings/review-requests
   *
   * Updates the schedule. `enabled` is the master switch for a job that emails
   * real customers, so this is throttled and requires MANAGE_SETTINGS.
   */
  @Throttle({ medium: { limit: 5, ttl: 60000 } })
  @Patch('review-requests')
  @RequirePermissions(Permission.MANAGE_SETTINGS)
  @ApiUpdateReviewRequestsDocs()
  updateReviewRequests(@Body() dto: UpdateReviewRequestsDto) {
    return this.settingsService.updateReviewRequests(dto);
  }
}
