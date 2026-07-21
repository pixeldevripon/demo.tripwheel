import { decrypt, encrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  PublicCompanyInfoResponseDto,
  PublicSiteInfoResponseDto,
  PublicSiteSEOResponseDto,
  PublicSocialMediaResponseDto,
  UpdateCompanyInformationsDto,
  UpdateMailchimpDto,
  UpdateMollieConfigurationDto,
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateSocialMediaDto,
  UpdateStripeConfigurationDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Masks an encrypted secret for display: bullet prefix + last 4 plaintext chars. */
  private maskSecret(encrypted: string | null): string | null {
    if (!encrypted) return null;
    return '••••••••' + decrypt(encrypted).slice(-4);
  }

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
      enableInstagram: info?.enableInstagram ?? false,
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
   * anonymous GET never writes, and analytics IDs / verification codes /
   * robots.txt stay out of the world-readable response.
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
        googleSearchConsole: true,
        cookiebotCbid: true,
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
      googleSearchConsole: seo?.googleSearchConsole ?? null,
      cookiebotCbid: seo?.cookiebotCbid || null,
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
      secretKey: config.secretKey
        ? '••••••••' + decrypt(config.secretKey).slice(-4)
        : null,
      webhookSecret: config.webhookSecret
        ? '••••••••' + decrypt(config.webhookSecret).slice(-4)
        : null,
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
      secretKey: result.secretKey
        ? '••••••••' + decrypt(result.secretKey).slice(-4)
        : null,
      webhookSecret: result.webhookSecret
        ? '••••••••' + decrypt(result.webhookSecret).slice(-4)
        : null,
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
      apiKey: config.apiKey
        ? '••••••••' + decrypt(config.apiKey).slice(-4)
        : null,
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
      apiKey: result.apiKey
        ? '••••••••' + decrypt(result.apiKey).slice(-4)
        : null,
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
      apiKey: this.maskSecret(config.apiKey),
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
      apiKey: this.maskSecret(result.apiKey),
    };
  }
}
