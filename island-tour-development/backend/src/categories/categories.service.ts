import { CATEGORY_PAGE_MIN_TOURS } from '@/common/constants/category-visibility';
import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { TranslationClearMarkService } from '@/content-translation/translation-clear-mark.service';
import { translationUnitKeys } from '@/content-translation/translation-unit-keys';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import {
  applyTranslation,
  faqSelect,
  mergeTranslation,
  resolveFaqLocale,
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
  CreateCategoryFaqDto,
  FaqLocaleQueryDto,
  UpdateCategoryDto,
  UpdateCategoryFaqDto,
  UpsertCategoryPageContentDto,
  UpsertCategoryTranslationsDto,
} from './dto/category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqGroups: FaqGroupService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly clearMarks: TranslationClearMarkService,
  ) {}

  private readonly categorySelect = {
    id: true,
    name: true,
    slug: true,
    heroImage: true,
    ogImage: true,
    description: true,
    icon: true,
    sortOrder: true,
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
   * Master §2.4: list the categories whose page is publicly LIVE at this
   * destination - at least {@link CATEGORY_PAGE_MIN_TOURS} published tours in the
   * (category, destination) pair. A thinner category is draft, so it must not be
   * linked from navigation anywhere; returning it here would put a link to a 404
   * in the hero's "Popular" row, the "Explore by type" grid and the footer.
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
    // The visibility bar is applied to the COUNT, not merely to "has a link row" -
    // a category with one or two tours has a groupBy row but no live page.
    const categoryIds = [...countByCategory.entries()]
      .filter(([, count]) => count >= CATEGORY_PAGE_MIN_TOURS)
      .map(([categoryId]) => categoryId);
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
   * Master §2.4: category detail for a specific destination. Returns 404 when the
   * (category, destination) pair is below {@link CATEGORY_PAGE_MIN_TOURS} published
   * tours - the slug_registry row stays active so the slug remains reserved, but
   * the page must not render.
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
          // Both rows: editorial fields live ONLY on translation rows, so a
          // per-FIELD English fallback needs the en row too. Fetching just
          // `locale` renders a cleared (or never-translated) field as EMPTY
          // instead of falling back.
          translations: {
            where: { locale: { in: [locale, Locale.en] } },
            select: { ...translationSelect, locale: true },
          },
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
    if (publishedTourCount < CATEGORY_PAGE_MIN_TOURS) {
      throw new NotFoundException(
        `Category "${categorySlug}" has ${publishedTourCount} published tour(s) in ` +
          `"${destinationSlug}", below the ${CATEGORY_PAGE_MIN_TOURS} a category page needs`,
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
    const t = translations.find((row) => row.locale === locale);
    const en = translations.find((row) => row.locale === Locale.en);
    // Per-FIELD fallback: a field cleared in the Translation Console is null
    // here and must show English, not a blank.
    return {
      ...applyTranslation(cat, t ?? en, locale),
      overview: t?.overview ?? en?.overview ?? null,
      h1Override: t?.h1Override ?? en?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? en?.breadcrumbLabel ?? null,
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
      // A category created without an explicit position goes to the END of its
      // row, not the front. This defaulted to 0, which put every admin-created
      // category ahead of all 19 seeded ones (sortOrder 0-18) on every island the
      // moment it was saved - leading the destination hero's "Popular" links, the
      // "Explore by type" grid, the footer and the All-Tours pills, all without
      // anyone choosing that.
      const parentCategoryId = dto.parentCategoryId ?? null;
      const sortOrder =
        dto.sortOrder ??
        ((
          await tx.category.aggregate({
            where: { parentCategoryId },
            _max: { sortOrder: true },
          })
        )._max.sortOrder ?? -1) + 1;

      const category = await tx.category
        .create({
          data: {
            name: dto.name,
            slug,
            heroImage: dto.heroImage ?? null,
            ogImage: dto.ogImage ?? null,
            description: dto.description ?? null,
            icon: dto.icon ?? null,
            sortOrder,
            parentCategoryId,
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
    // Parent-transition rules. Promotion (sub -> top-level, e.g. Detach) is
    // allowed and restores the slug_registry rows. Demotion (top-level -> sub,
    // e.g. re-attaching a detached sub-category) removes the standalone page,
    // so it is never silent: it requires the explicit confirmPageRemoval flag,
    // and the 19 seeded master categories can never be demoted at all.
    let promoteToTopLevel = false;
    let demoteToSub = false;
    if (dto.parentCategoryId !== undefined) {
      await this.assertValidParent(dto.parentCategoryId, id);
      const current = await this.prisma.category.findUnique({
        where: { id },
        select: { parentCategoryId: true, isSeeded: true },
      });
      if (!current) throw new NotFoundException(`Category ${id} not found`);
      const wasSub = Boolean(current.parentCategoryId);
      const willBeSub = Boolean(dto.parentCategoryId);

      // Structural impossibility first (has children -> can never nest), so a
      // caller is not told to confirm page removal on a request that could
      // never succeed anyway.
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
      if (!wasSub && willBeSub) {
        if (current.isSeeded) {
          throw new ForbiddenException(
            'Seeded categories cannot be converted into sub-categories',
          );
        }
        if (dto.confirmPageRemoval !== true) {
          throw new BadRequestException(
            'Converting a top-level category into a sub-category removes its standalone ' +
              'page on every destination. Send confirmPageRemoval: true to accept that.',
          );
        }
        demoteToSub = true;
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
            ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
            ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
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

      if (demoteToSub) {
        // Demoted to a filter-only sub-category (confirmed by the caller):
        // retire its page slugs exactly like a hard delete - rows stay,
        // isActive=false + deletedAt=now, so the URLs 404 and the slug is
        // protected for the 90-day cooldown. A later Detach (promotion)
        // clears the cooled-down ghosts and re-reserves.
        await markSlugsDeleted(tx, SlugEntityType.CATEGORY, id);
      }

      if (promoteToTopLevel) {
        // Promoted to top-level (e.g. Detach): reserve its slug per active
        // destination, as in create. (Unconfirmed demotion is rejected
        // up-front, so a top-level category never silently loses its page.)
        //
        // Honor an `isActive: false` sent in the SAME request: the rows this
        // block writes must not override the caller's explicit deactivation
        // (the dto.isActive block above already applied it).
        const rowsActive = dto.isActive ?? true;
        const destinations = await tx.destination.findMany({
          where: { isActive: true },
          select: { slug: true },
        });
        const activeDestSlugs = destinations.map((d) => d.slug);
        // Resurrect the category's OWN retired rows first: a demotion inside
        // the 90-day cooldown leaves fresh ghosts (deletedAt=now) that
        // clearCooledDownSlugs deliberately does not touch, and createMany
        // would collide with them on (destinationSlug, slug). Every own row
        // leaves the delete-cooldown state, but only rows in ACTIVE
        // destinations go live - a deactivated destination keeps its whole
        // namespace dark (same scoping as `missing` below).
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.CATEGORY, entityId: id },
          data: { deletedAt: null },
        });
        await tx.slugRegistry.updateMany({
          where: {
            entityType: SlugEntityType.CATEGORY,
            entityId: id,
            destinationSlug: { in: activeDestSlugs },
          },
          data: { isActive: rowsActive },
        });
        const own = await tx.slugRegistry.findMany({
          where: { entityType: SlugEntityType.CATEGORY, entityId: id },
          select: { destinationSlug: true },
        });
        const covered = new Set(own.map((r) => r.destinationSlug));
        const missing = destinations.filter((d) => !covered.has(d.slug));
        if (missing.length > 0) {
          await clearCooledDownSlugs(
            tx,
            missing.map((dest) => ({
              destinationSlug: dest.slug,
              slug: updated.slug,
            })),
          );
          await tx.slugRegistry
            .createMany({
              data: missing.map((dest) => ({
                destinationSlug: dest.slug,
                slug: updated.slug,
                entityType: SlugEntityType.CATEGORY,
                entityId: id,
                isActive: rowsActive,
              })),
            })
            .catch((err: unknown) => {
              // Another entity legitimately claimed the freed slug after the
              // 90-day cooldown - a collision, not corruption. Name the way
              // out instead of surfacing a raw 500.
              if ((err as { code?: string })?.code === 'P2002') {
                throw new ConflictException(
                  `Slug "${updated.slug}" is now used by another page in at least one destination. Rename this category, then detach it.`,
                );
              }
              throw err;
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

      // Prisma cascade covers the rows that actually have a FK to Category:
      // translations and page content. It does NOT cover the polymorphic Faq
      // table - it keys off (discriminator, entityId) with no relation, so
      // nothing deletes it for us and it leaks silently. (FeaturedExperience
      // no longer references categories - cards are standalone presentation.)
      await tx.faq.deleteMany({
        where: { pageType: FAQ_PAGE_TYPE.CATEGORY, entityId: id },
      });

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
        // Human write path: reset the AI bookkeeping so the machine refresher
        // never overwrites what was typed here.
        sourceHash: null,
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
    // An English edit re-sources the other locales.
    if (locale === Locale.en) this.contentTranslation.enqueue('category', id);
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

    // A whole-locale delete is the broadest possible clear - mark it so the
    // AI treats the absent row as deliberate, not as untranslated.
    await this.clearMarks.mark(
      'category',
      id,
      translationUnitKeys.main(),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} deleted translation for category ${id} [${locale}]`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  /**
   * `fallback` is the public read: fill blanks from English so a page never
   * renders an empty About band. The dashboard editor leaves it off and gets
   * the locale exactly as stored - anything else would have an admin edit
   * English text inside a Dutch box and save it as Dutch.
   */
  async getPageContent(id: string, locale: Locale, fallback = false) {
    await this.findCategoryOrThrow(id);

    const rows = await this.prisma.categoryPageContent.findMany({
      where: {
        categoryId: id,
        locale: fallback ? { in: [locale, Locale.en] } : locale,
      },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    const row = fallback
      ? mergeTranslation(rows, locale)
      : rows.find((r) => r.locale === locale);
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
        // Human write path - reset the AI bookkeeping (see upsertTranslations).
        isMachineTranslated: false,
        sourceHash: null,
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
    if (locale === Locale.en) this.contentTranslation.enqueue('category', id);
    return result;
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  /**
   * Public FAQ read. With a locale it fetches that locale AND English and
   * resolves per group and per field: an untranslated FAQ shows in English
   * rather than vanishing, and a field cleared in the Translation Console
   * falls back on its own (English question next to a translated answer).
   * Without a locale it returns every row - the admin listing.
   */
  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findCategoryOrThrow(id);

    const rows = await this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.CATEGORY,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: { in: [query.locale, Locale.en] } }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });

    return query.locale ? resolveFaqLocale(rows, query.locale) : rows;
  }

  async createFaq(id: string, dto: CreateCategoryFaqDto, adminId: string) {
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
    dto: UpdateCategoryFaqDto,
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

  // ── Grouped FAQ (add in English, then translate) ────────────────────────────
  // Thin wrappers over the shared FaqGroupService; each verifies the category
  // exists first so 404s are accurate, then delegates the grouped-FAQ logic.

  async getFaqGroups(id: string) {
    await this.findCategoryOrThrow(id);
    return this.faqGroups.getGroups(FAQ_PAGE_TYPE.CATEGORY, id);
  }

  async createFaqGroup(id: string, dto: CreateFaqGroupDto, adminId: string) {
    await this.findCategoryOrThrow(id);
    this.logger.log(`Admin ${adminId} created FAQ for category ${id}`);
    return this.faqGroups.createGroup(FAQ_PAGE_TYPE.CATEGORY, id, dto);
  }

  async upsertFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    dto: UpsertFaqTranslationDto,
    adminId: string,
  ) {
    await this.findCategoryOrThrow(id);
    this.logger.log(
      `Admin ${adminId} upserted FAQ ${groupId} [${locale}] for category ${id}`,
    );
    return this.faqGroups.upsertTranslation(
      FAQ_PAGE_TYPE.CATEGORY,
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
    await this.findCategoryOrThrow(id);
    this.logger.log(
      `Admin ${adminId} updated FAQ ${groupId} for category ${id}`,
    );
    return this.faqGroups.updateGroup(FAQ_PAGE_TYPE.CATEGORY, id, groupId, dto);
  }

  /** Clear ONE locale of a FAQ (Translation Console) - see FaqGroupService. */
  async deleteFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    adminId: string,
  ) {
    await this.findCategoryOrThrow(id);
    this.logger.log(
      `Admin ${adminId} cleared FAQ ${groupId} [${locale}] for category ${id}`,
    );
    return this.faqGroups.deleteTranslation(
      FAQ_PAGE_TYPE.CATEGORY,
      id,
      groupId,
      locale,
    );
  }

  async deleteFaqGroup(id: string, groupId: string, adminId: string) {
    await this.findCategoryOrThrow(id);
    this.logger.log(
      `Admin ${adminId} deleted FAQ ${groupId} for category ${id}`,
    );
    return this.faqGroups.deleteGroup(FAQ_PAGE_TYPE.CATEGORY, id, groupId);
  }
}
