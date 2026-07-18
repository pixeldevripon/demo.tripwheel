import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import {
  applyTranslation,
  faqSelect,
  translationSelect,
} from '@/common/utils/translation.util';
import { generateSlug, RESERVED_GLOBAL_SLUGS } from '@/common/utils/slug.util';
import { DEFAULT_DESTINATION_TIMEZONES } from '@/common/validators/is-iana-timezone.validator';
import {
  clearCooledDownDestinationSlugs,
  markDestinationSlugsDeleted,
} from '@/common/utils/slug-registry.util';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SlugEntityType, TourStatus } from '@prisma/client';
import {
  CreateDestinationDto,
  CreateFaqDto,
  DestinationQueryDto,
  FaqLocaleQueryDto,
  UpdateDestinationDto,
  UpdateFaqDto,
  UpsertDestinationPageContentDto,
  UpsertDestinationTranslationsDto,
} from './dto/destination.dto';

@Injectable()
export class DestinationService {
  private readonly logger = new Logger(DestinationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqGroups: FaqGroupService,
  ) {}

  private readonly destinationSelect = {
    id: true,
    name: true,
    slug: true,
    heroImage: true,
    region: true,
    country: true,
    latitude: true,
    longitude: true,
    timezone: true,
    currency: true,
    language: true,
    galleryImages: true,
    ogImage: true,
    parentDestinationId: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findDestinationOrThrow(id: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: this.destinationSelect,
    });
    if (!destination)
      throw new NotFoundException(`Destination ${id} not found`);
    return destination;
  }

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: DestinationQueryDto) {
    const { isActive, page = 1, limit = 20, locale = Locale.en } = query;
    const skip = (page - 1) * limit;

    const where = { ...(isActive !== undefined && { isActive }) };

    const [total, data] = await Promise.all([
      this.prisma.destination.count({ where }),
      this.prisma.destination.findMany({
        where,
        select: {
          ...this.destinationSelect,
          translations: {
            where: { locale },
            select: { name: true, isMachineTranslated: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const localizedData = data.map(({ translations, ...dest }) =>
      applyTranslation(dest, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(locale: Locale = Locale.en) {
    const data = await this.prisma.destination.findMany({
      where: { isActive: true },
      select: {
        ...this.destinationSelect,
        // Live (published) tours only — drives the homepage "Explore islands" count.
        _count: { select: { tours: { where: { status: TourStatus.LIVE } } } },
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return data.map(({ translations, _count, ...dest }) => ({
      ...applyTranslation(dest, translations[0], locale),
      tourCount: _count.tours,
    }));
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        ...this.destinationSelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });
    if (!destination)
      throw new NotFoundException(`Destination ${id} not found`);

    const { translations, ...dest } = destination;
    const t = translations[0];

    return {
      ...applyTranslation(dest, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async getBySlug(slug: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug },
      select: {
        ...this.destinationSelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });
    if (!destination)
      throw new NotFoundException(`Destination with slug "${slug}" not found`);

    const { translations, ...dest } = destination;
    const t = translations[0];

    return {
      ...applyTranslation(dest, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async create(dto: CreateDestinationDto, adminId: string) {
    const slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    // Global static pages (legal pages, search, ...) live at the same path
    // level as destinations; a destination with one of those slugs would be
    // unreachable behind the static route.
    if (RESERVED_GLOBAL_SLUGS.has(slug)) {
      throw new ConflictException(
        `Destination slug "${slug}" is reserved for a platform page`,
      );
    }

    // Timezone is required platform data (all tour/departure math anchors to it).
    // Prefer the admin's IANA value; otherwise derive a known launch zone from the
    // slug; never default silently to Curaçao for a non-Curaçao island.
    const timezone = dto.timezone ?? DEFAULT_DESTINATION_TIMEZONES[slug];
    if (!timezone) {
      throw new BadRequestException(
        `Timezone is required for destination "${slug}". Provide a valid IANA timezone (e.g. "America/Aruba").`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination
        .create({
          data: {
            name: dto.name,
            slug,
            heroImage: dto.heroImage,
            region: dto.region,
            country: dto.country ?? null,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            timezone,
            currency: dto.currency ?? null,
            language: dto.language ?? null,
            galleryImages: dto.galleryImages ?? [],
            ogImage: dto.ogImage ?? null,
            parentDestinationId: dto.parentDestinationId ?? null,
            createdBy: adminId,
          },
          select: this.destinationSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Destination slug "${slug}" already exists`,
            );
          }
          throw err;
        });

      // Clear any cooled-down ghosts if this destination slug was force-deleted < 90 days ago.
      await clearCooledDownDestinationSlugs(tx, destination.slug);

      await tx.slugRegistry.create({
        data: {
          destinationSlug: destination.slug,
          slug: 'tours',
          entityType: SlugEntityType.RESERVED,
          entityId: null,
        },
      });

      const categories = await tx.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      });

      if (categories.length > 0) {
        await tx.slugRegistry.createMany({
          data: categories.map((cat) => ({
            destinationSlug: destination.slug,
            slug: cat.slug,
            entityType: SlugEntityType.CATEGORY,
            entityId: cat.id,
          })),
        });
      }

      this.logger.log(
        `Admin ${adminId} created destination "${dto.name}" (${destination.id}), ` +
          `seeded ${categories.length} category slug(s) + 1 reserved`,
      );

      return destination;
    });
  }

  async update(id: string, dto: UpdateDestinationDto, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.destination
        .update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
            ...(dto.region !== undefined && { region: dto.region }),
            ...(dto.country !== undefined && { country: dto.country }),
            ...(dto.latitude !== undefined && { latitude: dto.latitude }),
            ...(dto.longitude !== undefined && { longitude: dto.longitude }),
            ...(dto.timezone !== undefined && { timezone: dto.timezone }),
            ...(dto.currency !== undefined && { currency: dto.currency }),
            ...(dto.language !== undefined && { language: dto.language }),
            ...(dto.galleryImages !== undefined && {
              galleryImages: dto.galleryImages,
            }),
            ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.destinationSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025')
            throw new NotFoundException(`Destination ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { destinationSlug: updated.slug },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated destination ${id}`);
      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    await this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id },
        select: this.destinationSelect,
      });
      if (!destination)
        throw new NotFoundException(`Destination ${id} not found`);

      if (destination.isSeeded) {
        throw new ForbiddenException(
          'Seeded destinations cannot be deactivated',
        );
      }

      const tourCount = await tx.tour.count({
        where: {
          destinationId: id,
          isActive: true,
          status: { not: TourStatus.DRAFT },
        },
      });
      if (tourCount > 0) {
        throw new ConflictException(
          `Cannot deactivate destination: ${tourCount} active tour(s) are still assigned to it`,
        );
      }

      await tx.destination.update({ where: { id }, data: { isActive: false } });

      await tx.slugRegistry.updateMany({
        where: { destinationSlug: destination.slug },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated destination ${id}`);
    return { message: 'Destination deactivated successfully' };
  }

  async forceDelete(id: string, adminId: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: { id: true, slug: true, isSeeded: true },
    });
    if (!destination)
      throw new NotFoundException(`Destination ${id} not found`);

    if (destination.isSeeded) {
      throw new ForbiddenException(
        'Seeded destinations cannot be permanently deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Master slug-registry rule: hard delete starts the 90-day reuse cooldown across the
      // whole destination namespace (categories, hubs, tours, reserved) - rows are kept,
      // marked isActive=false + deletedAt=now, and cleared on re-seed after the cooldown.
      await markDestinationSlugsDeleted(tx, destination.slug);
      // Cascade via Prisma schema handles: hubs, translations, FAQs, page content, featured experiences
      await tx.destination.delete({ where: { id } });
    });

    this.logger.log(`Admin ${adminId} permanently deleted destination ${id}`);
    return { message: 'Destination permanently deleted' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findDestinationOrThrow(id);

    return this.prisma.destinationTranslation.findMany({
      where: { destinationId: id },
      select: { locale: true, ...translationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findDestinationOrThrow(id);

    const translation = await this.prisma.destinationTranslation.findUnique({
      where: { destinationId_locale: { destinationId: id, locale } },
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
    dto: UpsertDestinationTranslationsDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.destinationTranslation.upsert({
      where: { destinationId_locale: { destinationId: id, locale } },
      create: {
        destinationId: id,
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
        ...(fields.h1Override !== undefined && {
          h1Override: fields.h1Override,
        }),
        ...(fields.breadcrumbLabel !== undefined && {
          breadcrumbLabel: fields.breadcrumbLabel,
        }),
      },
      select: { locale: true, ...translationSelect },
    });

    this.logger.log(
      `Admin ${adminId} upserted translation for destination ${id} [${locale}]`,
    );
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the destination name field instead.',
      );
    }

    await this.findDestinationOrThrow(id);

    await this.prisma.destinationTranslation
      .delete({
        where: { destinationId_locale: { destinationId: id, locale } },
      })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} deleted translation for destination ${id} [${locale}]`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: Locale) {
    await this.findDestinationOrThrow(id);

    const row = await this.prisma.destinationPageContent.findUnique({
      where: { destinationId_locale: { destinationId: id, locale } },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    return (
      row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null }
    );
  }

  async upsertPageContent(
    id: string,
    locale: Locale,
    dto: UpsertDestinationPageContentDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);

    const result = await this.prisma.destinationPageContent.upsert({
      where: { destinationId_locale: { destinationId: id, locale } },
      create: {
        destinationId: id,
        locale,
        aboutText: dto.aboutText,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      update: {
        ...(dto.aboutText !== undefined && { aboutText: dto.aboutText }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription,
        }),
      },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    this.logger.log(
      `Admin ${adminId} upserted page content for destination ${id} [${locale}]`,
    );
    return result;
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findDestinationOrThrow(id);

    return this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.DESTINATION,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findDestinationOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.DESTINATION,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(
      `Admin ${adminId} created FAQ for destination ${id} [${dto.locale}]`,
    );
    return faq;
  }

  async updateFaq(
    id: string,
    faqId: string,
    dto: UpdateFaqDto,
    adminId: string,
  ) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.DESTINATION, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(
        `FAQ ${faqId} not found for destination ${id}`,
      );

    const updated = await this.prisma.faq.update({
      where: { id: faqId },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: faqSelect,
    });

    this.logger.log(
      `Admin ${adminId} updated FAQ ${faqId} for destination ${id}`,
    );
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.DESTINATION, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(
        `FAQ ${faqId} not found for destination ${id}`,
      );

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(
      `Admin ${adminId} deleted FAQ ${faqId} for destination ${id}`,
    );
    return { message: 'FAQ deleted successfully' };
  }

  // ── Grouped FAQ (add in English, then translate) ────────────────────────────
  // Thin wrappers over the shared FaqGroupService; each verifies the destination
  // exists first so 404s are accurate, then delegates the grouped-FAQ logic.

  async getFaqGroups(id: string) {
    await this.findDestinationOrThrow(id);
    return this.faqGroups.getGroups(FAQ_PAGE_TYPE.DESTINATION, id);
  }

  async createFaqGroup(id: string, dto: CreateFaqGroupDto, adminId: string) {
    await this.findDestinationOrThrow(id);
    this.logger.log(`Admin ${adminId} created FAQ for destination ${id}`);
    return this.faqGroups.createGroup(FAQ_PAGE_TYPE.DESTINATION, id, dto);
  }

  async upsertFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    dto: UpsertFaqTranslationDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} upserted FAQ ${groupId} [${locale}] for destination ${id}`,
    );
    return this.faqGroups.upsertTranslation(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      locale,
      dto,
    );
  }

  async updateFaqGroup(
    id: string,
    groupId: string,
    dto: UpdateFaqGroupDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} updated FAQ ${groupId} for destination ${id}`,
    );
    return this.faqGroups.updateGroup(
      FAQ_PAGE_TYPE.DESTINATION,
      id,
      groupId,
      dto,
    );
  }

  async deleteFaqGroup(id: string, groupId: string, adminId: string) {
    await this.findDestinationOrThrow(id);
    this.logger.log(
      `Admin ${adminId} deleted FAQ ${groupId} for destination ${id}`,
    );
    return this.faqGroups.deleteGroup(FAQ_PAGE_TYPE.DESTINATION, id, groupId);
  }
}
