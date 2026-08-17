import { encrypt, maskSecret } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import {
  UpdatePaymentProviderDto,
  PublicCompanyInfoResponseDto,
  PublicSiteInfoResponseDto,
  PublicSiteSEOResponseDto,
  PublicSocialMediaResponseDto,
  UpdateCompanyInformationsDto,
  UpdateMailchimpDto,
  UpdateReviewRequestsDto,
  UpdateIntegrationsConfigurationDto,
  UpdateMollieConfigurationDto,
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateSocialMediaDto,
  UpdateStripeConfigurationDto,
} from './dto/settings.dto';

/** "a", "a and b", "a, b and c" - for naming missing fields in one message. */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Site Info ──────────────────────────────────────────────────────────────

  async getSiteInfo() {
    return this.prisma.siteInfo.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  /**
   * Public-safe SiteInfo for the unauthenticated site (logo, WhatsApp, socials).
   *
   * Explicitly selected rather than reusing getSiteInfo(): that one returns the
   * whole row, and this response is world-readable. findFirst (not upsert) keeps
   * the endpoint read-only - an anonymous GET must never write.
   *
   * whatsappNumber is nulled when the chat is disabled so a number an admin has
   * switched off is not still sitting in a public JSON response (master 6.6
   * gates every WhatsApp surface on enableWhatsappChat).
   */
  async getPublicSiteInfo(): Promise<PublicSiteInfoResponseDto> {
    const info = await this.prisma.siteInfo.findFirst({
      where: { id: 'default' },
      select: {
        siteName: true,
        siteTagline: true,
        logo: true,
        favicon: true,
        enableWhatsappChat: true,
        whatsappNumber: true,
        enableInstagram: true,
        faqHostImage: true,
        faqHostVideo: true,
      },
    });

    const enableWhatsappChat = info?.enableWhatsappChat ?? false;

    return {
      siteName: info?.siteName ?? null,
      siteTagline: info?.siteTagline ?? null,
      logo: info?.logo || null,
      favicon: info?.favicon || null,
      enableWhatsappChat,
      whatsappNumber: enableWhatsappChat ? info?.whatsappNumber || null : null,
      // The column is NOT NULL and defaults ON, so the only fallback left is
      // "no site_info row at all" - which means an untouched install, where the
      // column default is the right answer.
      enableInstagram: info?.enableInstagram ?? true,
      // Empty string is as good as unset here - the frontend falls back to its
      // bundled avatar on null, and '' would defeat that.
      faqHostImage: info?.faqHostImage || null,
      faqHostVideo: info?.faqHostVideo || null,
    };
  }

  async updateSiteInfo(dto: UpdateSiteInfoDto) {
    return this.prisma.siteInfo.upsert({
      where: { id: 'default' },
      update: {
        ...dto,
        faqs: dto.faqs ? (dto.faqs as any) : undefined,
      },
      create: {
        id: 'default',
        ...dto,
        faqs: dto.faqs ? (dto.faqs as any) : undefined,
      },
    });
  }

  // ── Site SEO ───────────────────────────────────────────────────────────────

  async getSiteSEO() {
    return this.prisma.siteSEO.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  /**
   * Public-safe SiteSEO for the unauthenticated site's meta/OG/Twitter tags.
   *
   * Same contract as getPublicSiteInfo: explicit select, findFirst so an
   * anonymous GET never writes. The analytics IDs (GA4 / GTM / Meta Pixel) ARE
   * exposed here on purpose: they are public by nature - every one of them ships
   * in the browser as a container/measurement id the moment tracking loads, so
   * there is nothing to protect. `robotsTxt` + `autoGenerateSitemap` are crawl
   * output (they end up in the served robots.txt / sitemap), also public. The
   * only genuinely secret credentials (Meta CAPI token, Google Translate key)
   * live on IntegrationsConfiguration and never come near this projection.
   */
  async getPublicSiteSEO(): Promise<PublicSiteSEOResponseDto> {
    const seo = await this.prisma.siteSEO.findFirst({
      where: { id: 'default' },
      select: {
        metaTitle: true,
        metaDescription: true,
        metaKeywords: true,
        canonicalUrl: true,
        robotsMeta: true,
        ogTitle: true,
        ogDescription: true,
        ogImage: true,
        twitterTitle: true,
        twitterDescription: true,
        twitterImage: true,
        googleAnalyticsId: true,
        googleTagManagerId: true,
        googleSearchConsole: true,
        facebookPixelId: true,
        cookiebotCbid: true,
        robotsTxt: true,
        autoGenerateSitemap: true,
      },
    });

    return {
      metaTitle: seo?.metaTitle ?? null,
      metaDescription: seo?.metaDescription ?? null,
      metaKeywords: seo?.metaKeywords ?? null,
      canonicalUrl: seo?.canonicalUrl ?? null,
      robotsMeta: seo?.robotsMeta ?? null,
      ogTitle: seo?.ogTitle ?? null,
      ogDescription: seo?.ogDescription ?? null,
      ogImage: seo?.ogImage ?? null,
      twitterTitle: seo?.twitterTitle ?? null,
      twitterDescription: seo?.twitterDescription ?? null,
      twitterImage: seo?.twitterImage ?? null,
      googleAnalyticsId: seo?.googleAnalyticsId || null,
      googleTagManagerId: seo?.googleTagManagerId || null,
      googleSearchConsole: seo?.googleSearchConsole ?? null,
      facebookPixelId: seo?.facebookPixelId || null,
      cookiebotCbid: seo?.cookiebotCbid || null,
      robotsTxt: seo?.robotsTxt || null,
      autoGenerateSitemap: seo?.autoGenerateSitemap || null,
    };
  }

  async updateSiteSEO(dto: UpdateSiteSEODto) {
    return this.prisma.siteSEO.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });
  }

  // ── Company Information ────────────────────────────────────────────────────

  async getCompanyInformations() {
    return this.prisma.companyInformations.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  /**
   * Public-safe CompanyInformations for footer/legal surfaces. findFirst keeps
   * the anonymous GET read-only; companySize and timestamps are excluded.
   */
  async getPublicCompanyInformations(): Promise<PublicCompanyInfoResponseDto> {
    const company = await this.prisma.companyInformations.findFirst({
      where: { id: 'default' },
      select: {
        companyName: true,
        companyEmail: true,
        companyPhone: true,
        companyWebsite: true,
        companyAddress: true,
        companyCity: true,
        companyState: true,
        companyZip: true,
        companyCountry: true,
        companyVat: true,
      },
    });

    return {
      companyName: company?.companyName ?? null,
      companyEmail: company?.companyEmail ?? null,
      companyPhone: company?.companyPhone ?? null,
      companyWebsite: company?.companyWebsite ?? null,
      companyAddress: company?.companyAddress ?? null,
      companyCity: company?.companyCity ?? null,
      companyState: company?.companyState ?? null,
      companyZip: company?.companyZip ?? null,
      companyCountry: company?.companyCountry ?? null,
      companyVat: company?.companyVat ?? null,
    };
  }

  async createCompanyInformations(dto: UpdateCompanyInformationsDto) {
    return this.prisma.companyInformations.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });
  }

  async updateCompanyInformations(dto: UpdateCompanyInformationsDto) {
    return this.prisma.companyInformations.update({
      where: { id: 'default' },
      data: dto,
    });
  }

  // ── Stripe Configuration ───────────────────────────────────────────────────

  async getStripeConfiguration() {
    const config = await this.prisma.stripeConfiguration.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      ...config,
      secretKey: maskSecret(config.secretKey),
      webhookSecret: maskSecret(config.webhookSecret),
    };
  }

  async updateStripeConfiguration(dto: UpdateStripeConfigurationDto) {
    const data = {
      ...dto,
      ...(dto.secretKey && { secretKey: encrypt(dto.secretKey) }),
      ...(dto.webhookSecret && { webhookSecret: encrypt(dto.webhookSecret) }),
      // publishableKey is public - no encryption needed
    };
    const result = await this.prisma.stripeConfiguration.upsert({
      where: { id: 'default' },
      update: { ...data },
      create: { id: 'default', ...data },
    });
    return {
      ...result,
      secretKey: maskSecret(result.secretKey),
      webhookSecret: maskSecret(result.webhookSecret),
    };
  }

  // ── Active payment provider (platform switch) ───────────────────────────────

  /** The singleton payment settings row (which PSP charges at checkout). */
  async getPaymentProviderSettings() {
    const row = await this.prisma.paymentSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      id: row.id,
      activeProvider: row.activeProvider,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Which stored credentials the given PSP is still missing before it may
   * charge at checkout, as human labels in the order the settings card shows
   * them. Empty array = ready to activate.
   *
   * This list IS the activation contract, and the dashboard mirrors it in
   * `lib/settings/payment-requirements.ts` so the switch dialog can collect
   * exactly these fields up front instead of letting the switch fail. Change
   * one, change the other.
   *
   * Stripe needs the publishable key too, not just the server-side pair: the
   * checkout mounts Stripe.js with it, and refuses the payment step outright
   * when the intent comes back without one (`checkout-form.tsx`). Leaving it
   * out of this gate let an admin activate a Stripe that could not take a
   * card - the exact outcome the gate exists to prevent.
   *
   * Public because `PaymentConnectionService` gates its live probes on the
   * SAME contract - a "connection OK" for a provider this list still blocks
   * from charging would be a false certificate.
   */
  async missingProviderCredentials(
    provider: PaymentProvider,
  ): Promise<string[]> {
    if (provider === PaymentProvider.MOLLIE) {
      const mollie = await this.prisma.mollieConfiguration.findUnique({
        where: { id: 'default' },
        select: { apiKey: true },
      });
      return mollie?.apiKey ? [] : ['API key'];
    }

    const stripe = await this.prisma.stripeConfiguration.findUnique({
      where: { id: 'default' },
      select: { publishableKey: true, secretKey: true, webhookSecret: true },
    });
    const missing: string[] = [];
    if (!stripe?.publishableKey) missing.push('publishable key');
    if (!stripe?.secretKey) missing.push('secret key');
    if (!stripe?.webhookSecret) missing.push('webhook secret');
    return missing;
  }

  /**
   * Switch the checkout PSP. Guarded: the TARGET provider must already hold
   * usable credentials, otherwise the switch would brick every checkout with a
   * 503 the moment it lands. Never retroactive - existing Payment rows keep
   * their own provider and webhooks/refunds route by the row.
   */
  async updatePaymentProviderSettings(dto: UpdatePaymentProviderDto) {
    const missing = await this.missingProviderCredentials(dto.activeProvider);
    if (missing.length > 0) {
      const label =
        dto.activeProvider === PaymentProvider.MOLLIE ? 'Mollie' : 'Stripe';
      // Name every gap, not just the first - an admin fixing them one 400 at a
      // time is the slow way to find out there were three.
      throw new BadRequestException(
        `Configure the ${label} ${formatList(missing)} before making ${label} the active provider`,
      );
    }

    const row = await this.prisma.paymentSettings.upsert({
      where: { id: 'default' },
      update: { activeProvider: dto.activeProvider },
      create: { id: 'default', activeProvider: dto.activeProvider },
    });
    this.logger.log(`Active payment provider set to ${row.activeProvider}`);
    return {
      id: row.id,
      activeProvider: row.activeProvider,
      updatedAt: row.updatedAt,
    };
  }

  // ── Mollie Configuration ───────────────────────────────────────────────────

  async getMollieConfiguration() {
    const config = await this.prisma.mollieConfiguration.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      ...config,
      apiKey: maskSecret(config.apiKey),
    };
  }

  async updateMollieConfiguration(dto: UpdateMollieConfigurationDto) {
    const data = {
      ...dto,
      ...(dto.apiKey && { apiKey: encrypt(dto.apiKey) }),
    };
    const result = await this.prisma.mollieConfiguration.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
    return {
      ...result,
      apiKey: maskSecret(result.apiKey),
    };
  }

  // ── Integrations Configuration (Meta CAPI + AI translation secrets) ─────────
  // The googleTranslate* columns are DEPRECATED storage (Gemini migration,
  // 2026-07): stripped from every response so nothing can grow a new reader.

  async getIntegrationsConfiguration() {
    const config = await this.prisma.integrationsConfiguration.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    const {
      googleTranslateApiKey: _gt1,
      googleTranslateProjectId: _gt2,
      ...live
    } = config;
    return {
      ...live,
      metaCapiToken: maskSecret(config.metaCapiToken),
      translationApiKey: maskSecret(config.translationApiKey),
    };
  }

  async updateIntegrationsConfiguration(
    dto: UpdateIntegrationsConfigurationDto,
  ) {
    const data = {
      ...dto,
      // Encrypt secrets on write; a blank/omitted field leaves the stored value
      // untouched (never overwrite a saved secret with an empty string).
      ...(dto.metaCapiToken && { metaCapiToken: encrypt(dto.metaCapiToken) }),
      ...(dto.translationApiKey && {
        translationApiKey: encrypt(dto.translationApiKey),
      }),
    };
    const result = await this.prisma.integrationsConfiguration.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
    const {
      googleTranslateApiKey: _gt1,
      googleTranslateProjectId: _gt2,
      ...live
    } = result;
    return {
      ...live,
      metaCapiToken: maskSecret(result.metaCapiToken),
      translationApiKey: maskSecret(result.translationApiKey),
    };
  }

  // ── Social Media ───────────────────────────────────────────────────────────

  async getSocialMedia() {
    return this.prisma.socialMedia.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  /** Public-safe SocialMedia projection: the profile URLs, read-only. */
  async getPublicSocialMedia(): Promise<PublicSocialMediaResponseDto> {
    const social = await this.prisma.socialMedia.findFirst({
      where: { id: 'default' },
      select: {
        facebookUrl: true,
        twitterUrl: true,
        linkedinUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        tiktokUrl: true,
      },
    });

    return {
      facebookUrl: social?.facebookUrl ?? null,
      twitterUrl: social?.twitterUrl ?? null,
      linkedinUrl: social?.linkedinUrl ?? null,
      instagramUrl: social?.instagramUrl ?? null,
      youtubeUrl: social?.youtubeUrl ?? null,
      tiktokUrl: social?.tiktokUrl ?? null,
    };
  }

  async updateSocialMedia(dto: any) {
    return this.prisma.socialMedia.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });
  }

  // ── Mailchimp Configuration ────────────────────────────────────────────────

  async getMailchimp() {
    const config = await this.prisma.mailchimp.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      ...config,
      apiKey: maskSecret(config.apiKey),
    };
  }

  async updateMailchimp(dto: UpdateMailchimpDto) {
    const data = {
      ...dto,
      ...(dto.apiKey && { apiKey: encrypt(dto.apiKey) }),
    };
    const result = await this.prisma.mailchimp.upsert({
      where: { id: 'default' },
      update: { ...data },
      create: { id: 'default', ...data },
    });
    return {
      ...result,
      apiKey: maskSecret(result.apiKey),
    };
  }

  // ── Post-tour review requests (cadence) ────────────────────────────────────

  /**
   * The review-invitation schedule. Singleton, upserted on first read so the
   * dashboard always has a row to edit.
   */
  async getReviewRequests() {
    return this.prisma.reviewRequestSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  /**
   * Update the schedule.
   *
   * `enabled` is the master switch and starts FALSE: a job that mails real
   * customers is turned on deliberately by a person, never merely by deploying
   * the code that contains it. Flipping it on is logged.
   */
  async updateReviewRequests(dto: UpdateReviewRequestsDto) {
    const before = await this.getReviewRequests();
    const after = await this.prisma.reviewRequestSettings.update({
      where: { id: 'default' },
      data: { ...dto },
    });
    if (before.enabled !== after.enabled) {
      this.logger.log(
        `Post-tour review requests ${after.enabled ? 'ENABLED' : 'DISABLED'}`,
      );
    }
    return after;
  }
}
