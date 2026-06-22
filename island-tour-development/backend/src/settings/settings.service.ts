import { decrypt, encrypt } from '@/common/utils/crypto.util';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import {
  UpdateCompanyInformationsDto,
  UpdateMailchimpDto,
  UpdateMollieConfigurationDto,
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateSMTPDto,
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

  async updateSocialMedia(dto: any) {
    return this.prisma.socialMedia.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });
  }

  // ── SMTP Configuration ───────────────────────────────────────────────────--

  async getSMTP() {
    const config = await this.prisma.sMTP.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    return {
      ...config,
      smtpPassword: this.maskSecret(config.smtpPassword),
    };
  }

  async updateSMTP(dto: UpdateSMTPDto) {
    const data = {
      ...dto,
      ...(dto.smtpPassword && { smtpPassword: encrypt(dto.smtpPassword) }),
    };
    const result = await this.prisma.sMTP.upsert({
      where: { id: 'default' },
      update: { ...data },
      create: { id: 'default', ...data },
    });
    return {
      ...result,
      smtpPassword: this.maskSecret(result.smtpPassword),
    };
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
