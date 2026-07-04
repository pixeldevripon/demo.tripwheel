import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import {
  applyTranslation,
  faqSelect,
  translationSelect,
} from '@/common/utils/translation.util';
import { generateSlug } from '@/common/utils/slug.util';
import {
  clearCooledDownSlugs,
  markSlugsDeleted,
  renameEntitySlug,
  slugRowBlocks,
} from '@/common/utils/slug-registry.util';
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
  CategoryQueryDto,
  CreateCategoryDto,
  CreateFaqDto,
  FaqLocaleQueryDto,
  UpdateCategoryDto,
  UpdateFaqDto,
  UpsertCategoryPageContentDto,
  UpsertCategoryTranslationsDto,
} from './dto/category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly categorySelect = {
    id: true,
    name: true,
    slug: true,
    heroImage: true,
    description: true,
    icon: true,
    sortOrder: true,
    metaTitleTemplate: true,
    metaDescriptionTemplate: true,
    parentCategoryId: true,
    isActive: true,
    isSeeded: true,
    createdAt: true,
    updatedAt: true,
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

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: CategoryQueryDto) {
    const { isActive, page = 1, limit = 20, locale = Locale.en } = query;
    const skip = (page - 1) * limit;

    const where = { ...(isActive !== undefined && { isActive }) };

    const [total, data] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        select: {
          ...this.categorySelect,
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

    const localizedData = data.map(({ translations, ...cat }) =>
      applyTranslation(cat, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(locale: Locale = Locale.en) {
    const data = await this.prisma.category.findMany({
      where: { isActive: true },
      select: {
        ...this.categorySelect,
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return data.map(({ translations, ...cat }) =>
      applyTranslation(cat, translations[0], locale),
    );
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        ...this.categorySelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);

    const { translations, ...cat } = category;
    const t = translations[0];

    return {
      ...applyTranslation(cat, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async getBySlug(slug: string, locale: Locale = Locale.en) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      select: {
        ...this.categorySelect,
        translations: { where: { locale }, select: translationSelect },
      },
    });
    if (!category)
      throw new NotFoundException(`Category with slug "${slug}" not found`);

    const { translations, ...cat } = category;
    const t = translations[0];

    return {
      ...applyTranslation(cat, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  // ── V2 category-page tour-gating (Stage 3) ────────────────────────────────────

  /**
   * Count published (LIVE + active) tours for a category within a destination.
   * NOTE: uses the single `categoryId` FK today; Stage 4 (many-to-many) will switch
   * this to count via the `TourCategory` join.
   */
  async getPublishedTourCount(
    categoryId: string,
    destinationId: string,
  ): Promise<number> {
    return this.prisma.tour.count({
      where: {
        categories: { some: { categoryId } },
        destinationId,
        status: TourStatus.LIVE,
        isActive: true,
      },
    });
  }

  /**
   * V2 §3: list categories for a destination that have ≥1 published tour.
   * Empty-category pages must not exist, so zero-count categories are excluded.
   * Returns localized categories ordered by sortOrder, each with publishedTourCount.
   */
  async getActiveByDestinationSlug(
    destinationSlug: string,
    locale: Locale = Locale.en,
  ) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);
    }

    const grouped = await this.prisma.tourCategory.groupBy({
      by: ['categoryId'],
      where: {
        tour: {
          destinationId: destination.id,
          status: TourStatus.LIVE,
          isActive: true,
        },
      },
      _count: { _all: true },
    });
    const countByCategory = new Map(
      grouped.map((g) => [g.categoryId, g._count._all]),
    );
    const categoryIds = [...countByCategory.keys()];
    if (categoryIds.length === 0) return [];

    const categories = await this.prisma.category.findMany({
      // Only TOP-LEVEL categories appear in destination nav / hero / All-Tours
      // pills. Sub-categories (parentCategoryId set) are refinement filters shown
      // only on their parent's category page.
      where: {
        id: { in: categoryIds },
        isActive: true,
        parentCategoryId: null,
      },
      select: {
        ...this.categorySelect,
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map(({ translations, ...cat }) => ({
      ...applyTranslation(cat, translations[0], locale),
      publishedTourCount: countByCategory.get(cat.id) ?? 0,
    }));
  }

  /**
   * V2 §3: category detail for a specific destination. Returns 404 when the
   * (category, destination) pair has zero published tours - the slug_registry row
   * stays active so the slug remains reserved, but the page must not render.
   */
  async getBySlugForDestination(
    destinationSlug: string,
    categorySlug: string,
    locale: Locale = Locale.en,
  ) {
    const [destination, category] = await Promise.all([
      this.prisma.destination.findUnique({
        where: { slug: destinationSlug },
        select: { id: true, isActive: true },
      }),
      this.prisma.category.findUnique({
        where: { slug: categorySlug },
        select: {
          ...this.categorySelect,
          translations: { where: { locale }, select: translationSelect },
        },
      }),
    ]);
    if (!destination || !destination.isActive) {
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);
    }
    if (!category || !category.isActive) {
      throw new NotFoundException(`Category "${categorySlug}" not found`);
    }

    const publishedTourCount = await this.getPublishedTourCount(
      category.id,
      destination.id,
    );
    if (publishedTourCount === 0) {
      throw new NotFoundException(
        `Category "${categorySlug}" has no published tours in "${destinationSlug}"`,
      );
    }

    // Sub-categories (V2 §3) with >=1 published tour at this destination -
    // tour-gated + localized, for the on-page refine pills. Empty at launch
    // (sub-categories are unused), so the category page simply shows no pills.
    const subCategories = await this.getSubCategoriesForDestination(
      category.id,
      destination.id,
      locale,
    );

    const { translations, ...cat } = category;
    const t = translations[0];
    return {
      ...applyTranslation(cat, t, locale),
      overview: t?.overview ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
      publishedTourCount,
      subCategories,
    };
  }

  /**
   * Active sub-categories of `parentId` that have >=1 published tour at the given
   * destination, localized + ordered by sortOrder. Backs the category page's
   * refine pills. Returns `[]` when the parent has no (tour-gated) children.
   */
  private async getSubCategoriesForDestination(
    parentId: string,
    destinationId: string,
    locale: Locale,
  ) {
    const children = await this.prisma.category.findMany({
      where: { parentCategoryId: parentId, isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        translations: { where: { locale }, select: { name: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    if (children.length === 0) return [];

    const grouped = await this.prisma.tourCategory.groupBy({
      by: ['categoryId'],
      where: {
        categoryId: { in: children.map((c) => c.id) },
        tour: {
          destinationId,
          status: TourStatus.LIVE,
          isActive: true,
        },
      },
      _count: { _all: true },
    });
    const countBy = new Map(grouped.map((g) => [g.categoryId, g._count._all]));

    return children
      .filter((c) => (countBy.get(c.id) ?? 0) > 0)
      .map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.translations[0]?.name ?? c.name,
        publishedTourCount: countBy.get(c.id) ?? 0,
      }));
  }

  /**
   * Validate a requested parent (single-level nesting): it must exist, must NOT
   * itself be a sub-category, and must not be the category being edited. No-op
   * for a null/empty parent (top-level). Throws BadRequestException otherwise.
   */
  private async assertValidParent(
    parentCategoryId: string | null | undefined,
    selfId?: string,
  ): Promise<void> {
    if (!parentCategoryId) return;
    if (selfId && parentCategoryId === selfId) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    const parent = await this.prisma.category.findUnique({
      where: { id: parentCategoryId },
      select: { parentCategoryId: true },
    });
    if (!parent) {
      throw new BadRequestException(
        `Parent category ${parentCategoryId} not found`,
      );
    }
    if (parent.parentCategoryId) {
      throw new BadRequestException(
        'Sub-categories are limited to one level: the selected parent is itself a sub-category',
      );
    }
  }

  async create(dto: CreateCategoryDto, adminId: string) {
    await this.assertValidParent(dto.parentCategoryId);
    const slug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category
        .create({
          data: {
            name: dto.name,
            slug,
            heroImage: dto.heroImage ?? null,
            description: dto.description ?? null,
            icon: dto.icon ?? null,
            sortOrder: dto.sortOrder ?? 0,
            metaTitleTemplate: dto.metaTitleTemplate ?? null,
            metaDescriptionTemplate: dto.metaDescriptionTemplate ?? null,
            parentCategoryId: dto.parentCategoryId ?? null,
            createdBy: adminId,
          },
          select: this.categorySelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Category slug "${slug}" already exists`,
            );
          }
          throw err;
        });

      // Sub-categories (parentCategoryId set) are FILTER-ONLY refinements: they
      // have no standalone page, so no slug_registry rows are written. Only
      // top-level categories reserve a slug per destination.
      const isSubCategory = Boolean(dto.parentCategoryId);
      const destinations = isSubCategory
        ? []
        : await tx.destination.findMany({
            where: { isActive: true },
            select: { slug: true },
          });

      if (destinations.length > 0) {
        // Clear any cooled-down ghosts so a previously force-deleted category slug can be reused.
        await clearCooledDownSlugs(
          tx,
          destinations.map((dest) => ({
            destinationSlug: dest.slug,
            slug: category.slug,
          })),
        );
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
        `Admin ${adminId} created ${
          isSubCategory ? 'sub-category (filter-only)' : 'category'
        } "${dto.name}" (${category.id}), seeded ${destinations.length} slug_registry row(s)`,
      );

      return category;
    });
  }

  async update(id: string, dto: UpdateCategoryDto, adminId: string) {
    // Parent-transition rules. A brand-new category may be created as a
    // sub-category (create() handles that, skipping slug_registry), but an
    // EXISTING top-level category must never be demoted into a sub-category -
    // that would silently destroy its page. Promotion (sub -> top-level) is
    // allowed and restores the slug_registry rows.
    let promoteToTopLevel = false;
    if (dto.parentCategoryId !== undefined) {
      await this.assertValidParent(dto.parentCategoryId, id);
      const current = await this.prisma.category.findUnique({
        where: { id },
        select: { parentCategoryId: true },
      });
      if (!current) throw new NotFoundException(`Category ${id} not found`);
      const wasSub = Boolean(current.parentCategoryId);
      const willBeSub = Boolean(dto.parentCategoryId);

      if (!wasSub && willBeSub) {
        throw new BadRequestException(
          'An existing top-level category cannot be converted into a sub-category. Create a new sub-category instead.',
        );
      }
      if (willBeSub) {
        const childCount = await this.prisma.category.count({
          where: { parentCategoryId: id },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            'Cannot nest a category that already has sub-categories',
          );
        }
      }
      promoteToTopLevel = wasSub && !willBeSub;
    }

    // Resolve a slug rename up-front. A category slug is global, so the rename re-points its
    // registry row in EVERY destination and writes a 301 per destination (master rules).
    let renameFrom: string | undefined;
    let renameTo: string | undefined;
    if (dto.slug !== undefined) {
      const current = await this.prisma.category.findUnique({
        where: { id },
        select: { slug: true },
      });
      if (!current) throw new NotFoundException(`Category ${id} not found`);
      const normalized = generateSlug(dto.slug);
      if (normalized !== current.slug) {
        // Category slugs are globally unique.
        const clash = await this.prisma.category.findUnique({
          where: { slug: normalized },
          select: { id: true },
        });
        if (clash && clash.id !== id)
          throw new ConflictException(
            `Category slug "${normalized}" already exists`,
          );
        // The target must not be held (in any destination) by another page - cooldown-aware.
        const others = await this.prisma.slugRegistry.findMany({
          where: {
            slug: normalized,
            NOT: { entityType: SlugEntityType.CATEGORY, entityId: id },
          },
          select: { deletedAt: true },
        });
        if (others.some((r) => slugRowBlocks(r))) {
          throw new ConflictException(
            `Slug "${normalized}" is already taken by another page in at least one destination`,
          );
        }
        renameFrom = current.slug;
        renameTo = normalized;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (renameTo && renameFrom) {
        await renameEntitySlug(tx, {
          entityType: SlugEntityType.CATEGORY,
          entityId: id,
          fromSlug: renameFrom,
          toSlug: renameTo,
        });
      }

      const updated = await tx.category
        .update({
          where: { id },
          data: {
            ...(renameTo && { slug: renameTo }),
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
            ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
            ...(dto.metaTitleTemplate !== undefined && {
              metaTitleTemplate: dto.metaTitleTemplate,
            }),
            ...(dto.metaDescriptionTemplate !== undefined && {
              metaDescriptionTemplate: dto.metaDescriptionTemplate,
            }),
            ...(dto.parentCategoryId !== undefined && {
              parentCategoryId: dto.parentCategoryId,
            }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.categorySelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025')
            throw new NotFoundException(`Category ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.CATEGORY, entityId: id },
          data: { isActive: dto.isActive },
        });
      }

      if (promoteToTopLevel) {
        // Promoted to top-level (e.g. Detach): reserve its slug per active
        // destination, as in create. (Demotion is rejected up-front, so a
        // top-level category never loses its page.)
        const destinations = await tx.destination.findMany({
          where: { isActive: true },
          select: { slug: true },
        });
        if (destinations.length > 0) {
          await clearCooledDownSlugs(
            tx,
            destinations.map((dest) => ({
              destinationSlug: dest.slug,
              slug: updated.slug,
            })),
          );
          await tx.slugRegistry.createMany({
            data: destinations.map((dest) => ({
              destinationSlug: dest.slug,
              slug: updated.slug,
              entityType: SlugEntityType.CATEGORY,
              entityId: id,
            })),
          });
        }
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

    await this.prisma.$transaction(async (tx) => {
      const tripCount = await tx.tour.count({
        where: {
          categories: { some: { categoryId: id } },
          isActive: true,
          status: { not: TourStatus.DRAFT },
        },
      });
      if (tripCount > 0) {
        throw new ConflictException(
          `Cannot deactivate category: ${tripCount} active trip(s) are still assigned to it`,
        );
      }

      await tx.category.update({ where: { id }, data: { isActive: false } });
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.CATEGORY, entityId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated category ${id}`);
    return { message: 'Category deactivated successfully' };
  }

  async forceDelete(id: string, adminId: string) {
    const category = await this.findCategoryOrThrow(id);

    if (category.isSeeded) {
      throw new ForbiddenException(
        'Seeded categories cannot be permanently deleted',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Master slug-registry rule: hard delete starts the 90-day reuse cooldown (keep rows,
      // isActive=false + deletedAt=now) across every destination the category was seeded into.
      await markSlugsDeleted(tx, SlugEntityType.CATEGORY, id);
      // Cascade via Prisma schema handles: translations, FAQs, page content
      await tx.category.delete({ where: { id } });
    });

    this.logger.log(`Admin ${adminId} permanently deleted category ${id}`);
    return { message: 'Category permanently deleted' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findCategoryOrThrow(id);

    return this.prisma.categoryTranslation.findMany({
      where: { categoryId: id },
      select: { locale: true, ...translationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findCategoryOrThrow(id);

    const translation = await this.prisma.categoryTranslation.findUnique({
      where: { categoryId_locale: { categoryId: id, locale } },
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
    dto: UpsertCategoryTranslationsDto,
    adminId: string,
  ) {
    await this.findCategoryOrThrow(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: id, locale } },
      create: {
        categoryId: id,
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
      `Admin ${adminId} upserted translation for category ${id} [${locale}]`,
    );
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the category name field instead.',
      );
    }

    await this.findCategoryOrThrow(id);

    await this.prisma.categoryTranslation
      .delete({ where: { categoryId_locale: { categoryId: id, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} deleted translation for category ${id} [${locale}]`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  async getPageContent(id: string, locale: Locale) {
    await this.findCategoryOrThrow(id);

    const row = await this.prisma.categoryPageContent.findUnique({
      where: { categoryId_locale: { categoryId: id, locale } },
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
    dto: UpsertCategoryPageContentDto,
    adminId: string,
  ) {
    await this.findCategoryOrThrow(id);

    const result = await this.prisma.categoryPageContent.upsert({
      where: { categoryId_locale: { categoryId: id, locale } },
      create: {
        categoryId: id,
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
      `Admin ${adminId} upserted page content for category ${id} [${locale}]`,
    );
    return result;
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findCategoryOrThrow(id);

    return this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.CATEGORY,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: query.locale }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  async createFaq(id: string, dto: CreateFaqDto, adminId: string) {
    await this.findCategoryOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.CATEGORY,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(
      `Admin ${adminId} created FAQ for category ${id} [${dto.locale}]`,
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
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.CATEGORY, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(`FAQ ${faqId} not found for category ${id}`);

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

    this.logger.log(`Admin ${adminId} updated FAQ ${faqId} for category ${id}`);
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.CATEGORY, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(`FAQ ${faqId} not found for category ${id}`);

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(`Admin ${adminId} deleted FAQ ${faqId} for category ${id}`);
    return { message: 'FAQ deleted successfully' };
  }
}
