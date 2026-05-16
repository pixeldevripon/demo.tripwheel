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
  CategoryQueryDto,
  CreateCategoryDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  UpdateCategoryDto,
  UpdateFaqDto,
  UpsertCategoryPageContentDto,
  UpsertCategoryTranslationsDto,
} from './dto/category.dto';

const TRANSLATION_FIELDS = ['name', 'overview', 'h1Override', 'breadcrumbLabel'] as const;

type TranslationEntry = { value: string; isMachineTranslated: boolean };
type TranslationMap = Map<string, Record<string, TranslationEntry>>;

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly categorySelect = {
    id: true,
    name: true,
    slug: true,
    isActive: true,
    isSeeded: true,
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

  private async findCategoryOrThrow(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: this.categorySelect,
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  private async fetchTranslations(
    entityIds: string[],
    locale: string,
    fields: readonly string[],
  ): Promise<TranslationMap> {
    if (entityIds.length === 0 || locale === 'en') return new Map();

    const rows = await this.prisma.translation.findMany({
      where: {
        entityType: 'category',
        entityId: { in: entityIds },
        locale: { in: [locale, 'en'] },
        field: { in: [...fields] },
      },
      select: { entityId: true, locale: true, field: true, value: true, isMachineTranslated: true },
    });

    const result: TranslationMap = new Map();
    for (const row of rows) {
      if (!result.has(row.entityId)) result.set(row.entityId, {});
      const fieldMap = result.get(row.entityId)!;
      // Requested locale wins over 'en' fallback
      if (!fieldMap[row.field] || row.locale === locale) {
        fieldMap[row.field] = { value: row.value, isMachineTranslated: row.isMachineTranslated };
      }
    }
    return result;
  }

  private applyLocale<T extends { id: string; name: string }>(
    entity: T,
    translationMap: TranslationMap,
    locale: string,
  ) {
    const fields = translationMap.get(entity.id) ?? {};
    const nameTranslation = fields['name'];
    return {
      ...entity,
      name: nameTranslation?.value ?? entity.name,
      locale,
      isMachineTranslated: nameTranslation?.isMachineTranslated ?? false,
    };
  }

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: CategoryQueryDto) {
    const { isActive, page = 1, limit = 20, locale = 'en' } = query;
    const skip = (page - 1) * limit;

    const where = { ...(isActive !== undefined && { isActive }) };

    const [total, data] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        select: this.categorySelect,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const translationMap = await this.fetchTranslations(data.map((c) => c.id), locale, ['name']);
    return { total, page, limit, data: data.map((c) => this.applyLocale(c, translationMap, locale)) };
  }

  async getActive(locale = 'en') {
    const data = await this.prisma.category.findMany({
      where: { isActive: true },
      select: this.categorySelect,
      orderBy: { name: 'asc' },
    });

    const translationMap = await this.fetchTranslations(data.map((c) => c.id), locale, ['name']);
    return data.map((c) => this.applyLocale(c, translationMap, locale));
  }

  async getById(id: string, locale = 'en') {
    const category = await this.findCategoryOrThrow(id);
    const translationMap = await this.fetchTranslations([id], locale, TRANSLATION_FIELDS);
    return this.applyLocale(category, translationMap, locale);
  }

  async getBySlug(slug: string, locale = 'en') {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: this.categorySelect,
    });
    if (!category) throw new NotFoundException(`Category with slug "${slug}" not found`);

    const translationMap = await this.fetchTranslations([category.id], locale, TRANSLATION_FIELDS);
    return this.applyLocale(category, translationMap, locale);
  }

  async create(dto: CreateCategoryDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category
        .create({
          data: { name: dto.name, slug, createdBy: adminId },
          select: this.categorySelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(`Category slug "${slug}" already exists`);
          }
          throw err;
        });

      await tx.featuredSlot.createMany({
        data: [1, 2, 3].map((slotNumber) => ({
          categoryId: category.id,
          slotNumber,
          status: 'AVAILABLE',
        })),
      });

      const destinations = await tx.destination.findMany({
        where: { isActive: true },
        select: { slug: true },
      });

      if (destinations.length > 0) {
        await tx.slugRegistry.createMany({
          data: destinations.map((dest) => ({
            destinationSlug: dest.slug,
            slug: category.slug,
            entityType: SlugEntityType.CATEGORY,
            entityId: category.id,
          })),
        });
      }

      this.logger.log(
        `Admin ${adminId} created category "${dto.name}" (${category.id}), seeded ${destinations.length} slug_registry row(s)`,
      );

      return category;
    });
  }

  async update(id: string, dto: UpdateCategoryDto, adminId: string) {
    await this.findCategoryOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        select: this.categorySelect,
      });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.CATEGORY, entityId: id },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated category ${id}`);
      return updated;
    });
  }

  async remove(id: string, adminId: string) {
    const category = await this.findCategoryOrThrow(id);

    if (category.isSeeded) {
      throw new ForbiddenException('Seeded categories cannot be deactivated');
    }

    const tripCount = await this.prisma.trip.count({ where: { categoryId: id } });
    if (tripCount > 0) {
      throw new ConflictException(
        `Cannot deactivate category: ${tripCount} trip(s) are still assigned to it`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { isActive: false } });
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.CATEGORY, entityId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated category ${id}`);
    return { message: 'Category deactivated successfully' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findCategoryOrThrow(id);

    const rows = await this.prisma.translation.findMany({
      where: { entityType: 'category', entityId: id },
      select: { locale: true, field: true, value: true, isMachineTranslated: true },
      orderBy: [{ locale: 'asc' }, { field: 'asc' }],
    });

    const grouped: Record<string, { fields: Record<string, string>; isMachineTranslated: boolean }> = {};
    for (const row of rows) {
      if (!grouped[row.locale]) {
        grouped[row.locale] = { fields: {}, isMachineTranslated: row.isMachineTranslated };
      }
      grouped[row.locale].fields[row.field] = row.value;
    }

    return Object.entries(grouped).map(([locale, data]) => ({
      locale,
      fields: data.fields,
      isMachineTranslated: data.isMachineTranslated,
    }));
  }

  async getTranslationsByLocale(id: string, locale: string) {
    const rows = await this.prisma.translation.findMany({
      where: { entityType: 'category', entityId: id, locale },
      select: { field: true, value: true, isMachineTranslated: true },
    });

    const fields: Record<string, string> = {};
    let isMachineTranslated = false;
    for (const row of rows) {
      fields[row.field] = row.value;
      isMachineTranslated = row.isMachineTranslated;
    }

    return { locale, fields, isMachineTranslated };
  }

  async upsertTranslations(
    id: string,
    locale: string,
    dto: UpsertCategoryTranslationsDto,
    adminId: string,
  ) {
    await this.findCategoryOrThrow(id);

    const { isMachineTranslated = false } = dto;
    const entries = (Object.entries(dto.fields) as [string, string | undefined][]).filter(
      ([, v]) => v !== undefined && v !== null,
    ) as [string, string][];

    if (entries.length > 0) {
      await this.prisma.$transaction(
        entries.map(([field, value]) =>
          this.prisma.translation.upsert({
            where: {
              entityType_entityId_locale_field: { entityType: 'category', entityId: id, locale, field },
            },
            create: { entityType: 'category', entityId: id, locale, field, value, isMachineTranslated },
            update: { value, isMachineTranslated },
          }),
        ),
      );
    }

    this.logger.log(
      `Admin ${adminId} upserted ${entries.length} translation(s) for category ${id} [${locale}]`,
    );

    return this.getTranslationsByLocale(id, locale);
  }

  async deleteTranslations(id: string, locale: string, adminId: string) {
    await this.findCategoryOrThrow(id);

    const { count } = await this.prisma.translation.deleteMany({
      where: { entityType: 'category', entityId: id, locale },
    });

    this.logger.log(`Admin ${adminId} deleted ${count} translation(s) for category ${id} [${locale}]`);
    return { message: `Deleted ${count} translation(s) for locale "${locale}"` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: string) {
    await this.findCategoryOrThrow(id);

    const rows = await this.prisma.pageContent.findMany({
      where: { pageType: 'category', entityId: id, locale },
      select: { field: true, value: true },
    });

    const fields: Record<string, string> = {};
    for (const row of rows) fields[row.field] = row.value;

    return { locale, fields };
  }

  async upsertPageContent(
    id: string,
    locale: string,
    dto: UpsertCategoryPageContentDto,
    adminId: string,
  ) {
    await this.findCategoryOrThrow(id);

    const entries = (Object.entries(dto.fields) as [string, string | undefined][]).filter(
      ([, v]) => v !== undefined && v !== null,
    ) as [string, string][];

    if (entries.length > 0) {
      await this.prisma.$transaction(
        entries.map(([field, value]) =>
          this.prisma.pageContent.upsert({
            where: {
              pageType_entityId_locale_field: { pageType: 'category', entityId: id, locale, field },
            },
            create: { pageType: 'category', entityId: id, locale, field, value },
            update: { value },
          }),
        ),
      );
    }

    this.logger.log(`Admin ${adminId} upserted page content for category ${id} [${locale}]`);
    return this.getPageContent(id, locale);
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findCategoryOrThrow(id);

    return this.prisma.faq.findMany({
      where: {
        pageType: 'category',
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: this.faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findCategoryOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: 'category',
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: this.faqSelect,
    });

    this.logger.log(`Admin ${adminId} created FAQ for category ${id} [${dto.locale}]`);
    return faq;
  }

  async updateFaq(id: string, faqId: string, dto: UpdateFaqDto, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: 'category', entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for category ${id}`);

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

    this.logger.log(`Admin ${adminId} updated FAQ ${faqId} for category ${id}`);
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: 'category', entityId: id },
    });
    if (!faq) throw new NotFoundException(`FAQ ${faqId} not found for category ${id}`);

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(`Admin ${adminId} deleted FAQ ${faqId} for category ${id}`);
    return { message: 'FAQ deleted successfully' };
  }
}
