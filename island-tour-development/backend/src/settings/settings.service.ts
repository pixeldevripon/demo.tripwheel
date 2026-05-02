import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  UpdateSiteInfoDto,
  UpdateSiteSEODto,
  UpdateCompanyInformationsDto,
  UpdateStripeConfigurationDto,
  UpdateMollieConfigurationDto,
} from './dto/settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.stripeConfiguration.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  async updateStripeConfiguration(dto: UpdateStripeConfigurationDto) {
    return this.prisma.stripeConfiguration.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });
  }

  // ── Mollie Configuration ───────────────────────────────────────────────────

  async getMollieConfiguration() {
    return this.prisma.mollieConfiguration.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  async updateMollieConfiguration(dto: UpdateMollieConfigurationDto) {
    return this.prisma.mollieConfiguration.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });
  }
}
