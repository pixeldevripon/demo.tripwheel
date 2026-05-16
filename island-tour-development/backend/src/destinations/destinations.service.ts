import { Locale } from '@/common/constants/locales';
import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SlugEntityType } from '@prisma/client';
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

const translationSelect = {
  name: true,
  overview: true,
  h1Override: true,
  breadcrumbLabel: true,
  isMachineTranslated: true,
} as const;

@Injectable()
export class DestinationService {
  private readonly logger = new Logger(DestinationService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly destinationSelect = {
    id: true,
    name: true,
    slug: true,
    heroImage: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private readonly faqSelect = {
    id: true,
    question: true,
    answer: true,
    displayOrder: true,
    isActive: true,
    locale: true,
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findDestinationOrThrow(id: string) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: this.destinationSelect,
    });
    if (!destination) throw new NotFoundException(`Destination ${id} not found`);
    return destination;
  }

  private applyTranslation<T extends { name: string }>(
    base: T,
    t: { name: string | null; isMachineTranslated: boolean } | undefined,
    locale: Locale,
  ) {
    return {
      ...base,
      name: t?.name ?? base.name,
      locale,
      isMachineTranslated: t?.isMachineTranslated ?? false,
    };
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
          translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const localizedData = data.map(({ translations, ...dest }) =>
      this.applyTranslation(dest, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(locale: Locale = Locale.en) {
    const data = await this.prisma.destination.findMany({
      where: { isActive: true },
      select: {
        ...this.destinationSelect,
        translations: { where: { locale }, select: { name: true, isMachineTranslated: true } },
      },
      orderBy: { name: 'asc' },
    });

    return data.map(({ translations, ...dest }) =>
      this.applyTranslation(dest, translations[0], locale),
    );
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        ...this.destinationSelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });
    if (!destination) throw new NotFoundException(`Destination ${id} not found`);

    const { translations, ...dest } = destination;
    const t = translations[0];

    return {
      ...this.applyTranslation(dest, t, locale),
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
    if (!destination) throw new NotFoundException(`Destination with slug "${slug}" not found`);

    const { translations, ...dest } = destination;
    const t = translations[0];

    return {
      ...this.applyTranslation(dest, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async create(dto: CreateDestinationDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination
        .create({
          data: {
            name: dto.name,
            slug,
            heroImage: dto.heroImage,
            createdBy: adminId,
          },
          select: { id: true, slug: true },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(`Destination slug "${slug}" already exists`);
          }
          throw err;
        });

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

      const result = await tx.destination.findUniqueOrThrow({
        where: { id: destination.id },
        select: this.destinationSelect,
      });

      this.logger.log(
        `Admin ${adminId} created destination "${dto.name}" (${destination.id}), ` +
          `seeded ${categories.length} category slug(s) + 1 reserved`,
      );

      return result;
    });
  }

  async update(id: string, dto: UpdateDestinationDto, adminId: string) {
    await this.findDestinationOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.destination.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        select: this.destinationSelect,
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
    const destination = await this.findDestinationOrThrow(id);

    if (destination.isSeeded) {
      throw new ForbiddenException('Seeded destinations cannot be deactivated');
    }

    await this.prisma.$transaction(async (tx) => {
      const tripCount = await tx.trip.count({ where: { destinationId: id } });
      if (tripCount > 0) {
        throw new ConflictException(
          `Cannot deactivate destination: ${tripCount} trip(s) are still assigned to it`,
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

    return translation ?? { locale, name: null, overview: null, h1Override: null, breadcrumbLabel: null, isMachineTranslated: false };
  }

  async upsertTranslations(
    id: string,
    locale: Locale,
    dto: UpsertDestinationTranslationsDto,
    adminId: string,
  ) {
    await this.findDestinationOrThrow(id);

    const { fields, isMachineTranslated = false } = dto;

    const result = await this.prisma.destinationTranslation.upsert({
      where: { destinationId_locale: { destinationId: id, locale } },
      create: {
        destinationId: id,
        locale,
        isMachineTranslated,
        name: fields.name,
        overview: fields.overview,
        h1Override: fields.h1Override,
        breadcrumbLabel: fields.breadcrumbLabel,
      },
      update: {
        isMachineTranslated,
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.overview !== undefined && { overview: fields.overview }),
        ...(fields.h1Override !== undefined && { h1Override: fields.h1Override }),
        ...(fields.breadcrumbLabel !== undefined && { breadcrumbLabel: fields.breadcrumbLabel }),
      },
      select: { locale: true, ...translationSelect },
    });

    this.logger.log(`Admin ${adminId} upserted translation for destination ${id} [${locale}]`);
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    await this.findDestinationOrThrow(id);

    const existing = await this.prisma.destinationTranslation.findUnique({
      where: { destinationId_locale: { destinationId: id, locale } },
    });
    if (!existing) throw new NotFoundException(`No translation found for locale "${locale}"`);

    await this.prisma.destinationTranslation.delete({
      where: { destinationId_locale: { destinationId: id, locale } },
    });

    this.logger.log(`Admin ${adminId} deleted translation for destination ${id} [${locale}]`);
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: Locale) {
    await this.findDestinationOrThrow(id);

    const row = await this.prisma.destinationPageContent.findUnique({
      where: { destinationId_locale: { destinationId: id, locale } },
      select: { locale: true, aboutText: true, metaTitle: true, metaDescription: true },
    });

    return row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null };
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
        ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
      },
      select: { locale: true, aboutText: true, metaTitle: true, metaDescription: true },
    });

    this.logger.log(`Admin ${adminId} upserted page content for destination ${id} [${locale}]`);
    return result;
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findDestinationOrThrow(id);

    return this.prisma.faq.findMany({
      where: {
        pageType: 'destination',
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: this.faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findDestinationOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: 'destination',
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: this.faqSelect,
    });

    this.logger.log(`Admin ${adminId} created FAQ for destination ${id} [${dto.locale}]`);
    return faq;
  }

  async updateFaq(id: string, faqId: string, dto: UpdateFaqDto, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: 'destination', entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for destination ${id}`);

    const updated = await this.prisma.faq.update({
      where: { id: faqId },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.faqSelect,
    });

    this.logger.log(`Admin ${adminId} updated FAQ ${faqId} for destination ${id}`);
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: 'destination', entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for destination ${id}`);

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(`Admin ${adminId} deleted FAQ ${faqId} for destination ${id}`);
    return { message: 'FAQ deleted successfully' };
  }
}
