import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import { applyTranslation, faqSelect, translationSelect } from '@/common/utils/translation.util';
import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SlugEntityType, TripStatus } from '@prisma/client';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateFaqDto,
  CreateHubDto,
  FaqLocaleQueryDto,
  HubBySlugQueryDto,
  HubQueryDto,
  UpdateFaqDto,
  UpdateHubDto,
  UpsertHubPageContentDto,
  UpsertHubTranslationsDto,
} from './dto/hub.dto';

@Injectable()
export class HubService {
  private readonly logger = new Logger(HubService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly hubSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    hubType: true,
    latitude: true,
    longitude: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private readonly hubDetailSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    hubType: true,
    latitude: true,
    longitude: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    allowedCategories: {
      select: {
        id: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    },
  } as const;

  private readonly allowedCategorySelect = {
    id: true,
    categoryId: true,
    category: { select: { id: true, name: true, slug: true } },
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findHubOrThrow(id: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: this.hubSelect,
    });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);
    return hub;
  }

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: HubQueryDto) {
    const { destinationId, isActive, page = 1, limit = 20, locale = Locale.en } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(destinationId !== undefined && { destinationId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.hub.count({ where }),
      this.prisma.hub.findMany({
        where,
        select: {
          ...this.hubSelect,
          translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const localizedData = data.map(({ translations, ...hub }) =>
      applyTranslation(hub, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(query: ActiveHubsQueryDto) {
    const { destinationId, locale = Locale.en } = query;

    const data = await this.prisma.hub.findMany({
      where: {
        isActive: true,
        ...(destinationId !== undefined && { destinationId }),
      },
      select: {
        ...this.hubDetailSelect,
        translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
      },
      orderBy: { name: 'asc' },
    });

    return data.map(({ translations, ...hub }) =>
      applyTranslation(hub, translations[0], locale),
    );
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: {
        ...this.hubDetailSelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });

    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    const { translations, ...hubData } = hub;
    const t = translations[0];

    return {
      ...applyTranslation(hubData, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async getBySlug(slug: string, query: HubBySlugQueryDto) {
    const locale = query.locale ?? Locale.en;

    const hub = await this.prisma.hub.findFirst({
      where: {
        slug,
        destination: { slug: query.destinationSlug },
      },
      select: {
        ...this.hubDetailSelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });

    if (!hub) {
      throw new NotFoundException(
        `Hub "${slug}" not found for destination "${query.destinationSlug}"`,
      );
    }

    const { translations, ...hubData } = hub;
    const t = translations[0];

    return {
      ...applyTranslation(hubData, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async create(dto: CreateHubDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id: dto.destinationId },
        select: { slug: true },
      });
      if (!destination) {
        throw new NotFoundException(`Destination ${dto.destinationId} not found`);
      }

      const hub = await tx.hub
        .create({
          data: {
            destinationId: dto.destinationId,
            name: dto.name,
            slug,
            description: dto.description,
            hubType: dto.hubType,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            createdBy: adminId,
          },
          select: { id: true },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Hub slug "${slug}" already exists for this destination`,
            );
          }
          throw err;
        });

      await tx.slugRegistry
        .create({
          data: {
            destinationSlug: destination.slug,
            slug,
            entityType: SlugEntityType.HUB,
            entityId: hub.id,
          },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Slug "${slug}" is already taken for destination "${destination.slug}"`,
            );
          }
          throw err;
        });

      if (dto.allowedCategoryIds && dto.allowedCategoryIds.length > 0) {
        await tx.hubAllowedCategory.createMany({
          data: dto.allowedCategoryIds.map((categoryId) => ({
            hubId: hub.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      this.logger.log(
        `Admin ${adminId} created hub "${dto.name}" (${hub.id}) for destination ${dto.destinationId}`,
      );

      return tx.hub.findUniqueOrThrow({
        where: { id: hub.id },
        select: this.hubDetailSelect,
      });
    });
  }

  async update(id: string, dto: UpdateHubDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hub
        .update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.hubType !== undefined && { hubType: dto.hubType }),
            ...(dto.latitude !== undefined && { latitude: dto.latitude }),
            ...(dto.longitude !== undefined && { longitude: dto.longitude }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.hubDetailSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025') throw new NotFoundException(`Hub ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.HUB, entityId: id },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated hub ${id}`);

      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    const hub = await this.findHubOrThrow(id);

    if (hub.isSeeded) {
      throw new ForbiddenException('Seeded hubs cannot be deactivated');
    }

    await this.prisma.$transaction(async (tx) => {
      const tripCount = await tx.trip.count({
        where: { hubs: { some: { hubId: id } }, isActive: true, status: { not: TripStatus.DRAFT } },
      });
      if (tripCount > 0) {
        throw new ConflictException(
          `Cannot deactivate hub: ${tripCount} active trip(s) are still assigned to it`,
        );
      }

      await tx.hub.update({ where: { id }, data: { isActive: false } });

      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.HUB, entityId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated hub ${id}`);

    return { message: 'Hub deactivated successfully' };
  }

  // ── Allowed categories ────────────────────────────────────────────────────────

  async getAllowedCategories(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubAllowedCategory.findMany({
      where: { hubId: id },
      select: this.allowedCategorySelect,
      orderBy: { category: { name: 'asc' } },
    });
  }

  async addAllowedCategory(hubId: string, dto: AddAllowedCategoryDto, adminId: string) {
    await this.findHubOrThrow(hubId);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, name: true },
    });
    if (!category) throw new NotFoundException(`Category ${dto.categoryId} not found`);

    const allowedCategory = await this.prisma.hubAllowedCategory
      .create({
        data: { hubId, categoryId: dto.categoryId },
        select: this.allowedCategorySelect,
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(
            `Category "${category.name}" is already allowed for this hub`,
          );
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} added allowed category ${dto.categoryId} to hub ${hubId}`,
    );

    return {
      message: 'Allowed category added successfully',
      allowedCategory,
    };
  }

  async removeAllowedCategory(hubId: string, categoryId: string, adminId: string) {
    await this.findHubOrThrow(hubId);

    const existing = await this.prisma.hubAllowedCategory.findUnique({
      where: { hubId_categoryId: { hubId, categoryId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Category ${categoryId} is not in the allowed list for hub ${hubId}`,
      );
    }

    await this.prisma.hubAllowedCategory.delete({
      where: { hubId_categoryId: { hubId, categoryId } },
    });

    this.logger.log(
      `Admin ${adminId} removed allowed category ${categoryId} from hub ${hubId}`,
    );

    return { message: 'Allowed category removed successfully' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubTranslation.findMany({
      where: { hubId: id },
      select: { locale: true, ...translationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findHubOrThrow(id);

    const translation = await this.prisma.hubTranslation.findUnique({
      where: { hubId_locale: { hubId: id, locale } },
      select: { locale: true, ...translationSelect },
    });

    return (
      translation ?? {
        locale,
        name: null,
        overview: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      }
    );
  }

  async upsertTranslations(
    id: string,
    locale: Locale,
    dto: UpsertHubTranslationsDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.hubTranslation.upsert({
      where: { hubId_locale: { hubId: id, locale } },
      create: {
        hubId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        name: fields.name,
        overview: fields.overview,
        h1Override: fields.h1Override,
        breadcrumbLabel: fields.breadcrumbLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.overview !== undefined && { overview: fields.overview }),
        ...(fields.h1Override !== undefined && { h1Override: fields.h1Override }),
        ...(fields.breadcrumbLabel !== undefined && { breadcrumbLabel: fields.breadcrumbLabel }),
      },
      select: { locale: true, ...translationSelect },
    });

    this.logger.log(`Admin ${adminId} upserted translation for hub ${id} [${locale}]`);
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the hub name field instead.',
      );
    }

    await this.findHubOrThrow(id);

    await this.prisma.hubTranslation
      .delete({ where: { hubId_locale: { hubId: id, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(`No translation found for locale "${locale}"`);
        }
        throw err;
      });

    this.logger.log(`Admin ${adminId} deleted translation for hub ${id} [${locale}]`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: Locale) {
    await this.findHubOrThrow(id);

    const row = await this.prisma.hubPageContent.findUnique({
      where: { hubId_locale: { hubId: id, locale } },
      select: { locale: true, aboutText: true, metaTitle: true, metaDescription: true },
    });

    return row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null };
  }

  async upsertPageContent(
    id: string,
    locale: Locale,
    dto: UpsertHubPageContentDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const result = await this.prisma.hubPageContent.upsert({
      where: { hubId_locale: { hubId: id, locale } },
      create: {
        hubId: id,
        locale,
        aboutText: dto.aboutText,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      update: {
        ...(dto.aboutText !== undefined && { aboutText: dto.aboutText }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
      select: { locale: true, aboutText: true, metaTitle: true, metaDescription: true },
    });

    this.logger.log(`Admin ${adminId} upserted page content for hub ${id} [${locale}]`);
    return result;
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findHubOrThrow(id);

    return this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.HUB,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findHubOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.HUB,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(`Admin ${adminId} created FAQ for hub ${id} [${dto.locale}]`);
    return faq;
  }

  async updateFaq(id: string, faqId: string, dto: UpdateFaqDto, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.HUB, entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for hub ${id}`);

    const updated = await this.prisma.faq.update({
      where: { id: faqId },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: faqSelect,
    });

    this.logger.log(`Admin ${adminId} updated FAQ ${faqId} for hub ${id}`);
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.HUB, entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for hub ${id}`);

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(`Admin ${adminId} deleted FAQ ${faqId} for hub ${id}`);
    return { message: 'FAQ deleted successfully' };
  }
}
