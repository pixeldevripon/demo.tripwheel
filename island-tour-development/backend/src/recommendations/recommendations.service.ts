import { Locale } from '@/common/constants/locales';
import { mergeTranslation } from '@/common/utils/translation.util';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CollectionStatus,
  Currency,
  HubStatus,
  Prisma,
  RecommendationPlacement,
  RecommendationRefType,
  RecommendationSource,
  TourStatus,
} from '@prisma/client';
import {
  CreateRecommendationDto,
  UpdateRecommendationDto,
  UpsertRecommendationTranslationDto,
} from './dto/recommendation.dto';

const TRANSLATION_SELECT = {
  locale: true,
  eyebrow: true,
  areaLabel: true,
  title: true,
  description: true,
  ctaLabel: true,
  isMachineTranslated: true,
} as const;

const BASE_SELECT = {
  id: true,
  source: true,
  categoryId: true,
  isEnabled: true,
  displayOrder: true,
  isSeeded: true,
  placements: true,
  refType: true,
  refId: true,
  imageUrl: true,
  linkUrl: true,
  rating: true,
  reviewCount: true,
  sleeps: true,
  priceAmount: true,
  currency: true,
} as const;

const CATEGORY_REF_SELECT = { id: true, name: true, slug: true } as const;

/** Every placement, so the "who is featured where" pass has a stable order. */
const ALL_PLACEMENTS: RecommendationPlacement[] = [
  RecommendationPlacement.THANK_YOU_PAGE,
  RecommendationPlacement.CONFIRMATION_EMAIL,
];

/**
 * Which recommendation each surface features: lowest `displayOrder` wins, `id`
 * breaking ties so the choice is stable across requests when several sit on 0.
 */
const PROMOTION_ORDER: Prisma.RecommendationOrderByWithRelationInput[] = [
  { displayOrder: 'asc' },
  { id: 'asc' },
];

/**
 * Prisma hands Decimals back as Decimal objects, which serialize to JSON as
 * STRINGS. The card does arithmetic and formatting on these, so converting once
 * here beats every consumer re-parsing `"4.8"` on every render.
 */
function num(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}

/**
 * EXPORTED, and it has to be: the controller's methods return these shapes by
 * inference, and Nest's build emits declarations - an unexported local interface
 * makes every one of those a TS4053 ("cannot be named").
 */
export interface RecommendationRow {
  id: string;
  source: RecommendationSource;
  categoryId: string | null;
  isEnabled: boolean;
  displayOrder: number;
  isSeeded: boolean;
  placements: RecommendationPlacement[];
  refType: RecommendationRefType | null;
  refId: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  rating: Prisma.Decimal | null;
  reviewCount: number | null;
  sleeps: number | null;
  priceAmount: Prisma.Decimal | null;
  currency: Currency;
}

export interface TranslationRow {
  locale: Locale;
  eyebrow: string | null;
  areaLabel: string | null;
  title: string | null;
  description: string | null;
  ctaLabel: string | null;
  isMachineTranslated: boolean;
}

/** The renderable pieces of a card, once the gate has passed. */
interface ResolvedCard {
  external: boolean;
  imageUrl: string;
  linkUrl: string;
  rating: number | null;
  reviewCount: number | null;
  sleeps: number | null;
  priceAmount: number | null;
  currency: Currency;
  eyebrow: string | null;
  areaLabel: string | null;
  title: string;
  descriptionLines: string[];
  ctaLabel: string | null;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
  ) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * The one recommendation a surface should feature, for one locale.
   *
   * Deliberately read-only: an anonymous GET must never write.
   *
   * The whole enabled+placed set is read and walked in promotion order because an
   * enabled-but-INCOMPLETE row is skipped rather than ending the search -
   * otherwise a half-filled row at `displayOrder: 0` would silently suppress the
   * good one behind it. "Incomplete" means the EXTERNAL essentials are missing, or
   * the INTERNAL entity no longer resolves live (archived/deleted).
   */
  async getFeatured(locale: Locale, placement: RecommendationPlacement) {
    const rows = await this.prisma.recommendation.findMany({
      where: { isEnabled: true, placements: { has: placement } },
      select: {
        ...BASE_SELECT,
        // Both locales: `mergeTranslation` fills any field the locale row leaves
        // blank from English.
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: TRANSLATION_SELECT,
        },
      },
      orderBy: PROMOTION_ORDER,
    });

    for (const row of rows) {
      const card = await this.buildCard(row, row.translations, locale);
      if (card) return { enabled: true, locale, ...card };
    }

    return this.hiddenPayload(locale);
  }

  /**
   * One row as the card would render it, or null when it fails the gate.
   *
   * EXTERNAL gate: an image, a link and a title are all load-bearing (a 50/50
   * photo-and-details split whose only action is its button). INTERNAL gate: the
   * pointed-at entity must still resolve LIVE to a name + image + on-site link.
   */
  private async buildCard(
    row: RecommendationRow,
    translations: TranslationRow[],
    locale: Locale,
  ): Promise<ResolvedCard | null> {
    const copy = mergeTranslation(translations, locale);
    const facts = {
      rating: num(row.rating),
      reviewCount: row.reviewCount,
      sleeps: row.sleeps,
      priceAmount: num(row.priceAmount),
      currency: row.currency,
      eyebrow: copy?.eyebrow?.trim() || null,
      areaLabel: copy?.areaLabel?.trim() || null,
      descriptionLines: splitLines(copy?.description),
      ctaLabel: copy?.ctaLabel?.trim() || null,
    };

    if (row.source === RecommendationSource.INTERNAL) {
      if (!row.refType || !row.refId) return null;
      const resolved = await this.resolveInternal(row.refType, row.refId);
      if (!resolved || !resolved.imageUrl || !resolved.title) return null;
      return {
        external: false,
        imageUrl: resolved.imageUrl,
        linkUrl: resolved.linkPath,
        title: resolved.title,
        ...facts,
      };
    }

    // EXTERNAL: the admin's own content, judged on the merged copy title.
    const title = copy?.title?.trim() || null;
    if (!row.imageUrl || !row.linkUrl || !title) return null;
    return {
      external: true,
      imageUrl: row.imageUrl,
      linkUrl: row.linkUrl,
      title,
      ...facts,
    };
  }

  /**
   * The LIVE display bits of an INTERNAL pointer, or null when the entity is gone
   * or not publicly visible. The link is site-relative (`/{destinationSlug}/{slug}`;
   * a destination is just `/{slug}`) - the frontend localises it, the email
   * absolutizes it.
   */
  private async resolveInternal(
    refType: RecommendationRefType,
    refId: string,
  ): Promise<{
    imageUrl: string | null;
    title: string;
    linkPath: string;
  } | null> {
    switch (refType) {
      case RecommendationRefType.TOUR: {
        const t = await this.prisma.tour.findUnique({
          where: { id: refId },
          select: {
            name: true,
            slug: true,
            status: true,
            isActive: true,
            isBookable: true,
            ogImage: true,
            destination: { select: { slug: true, isActive: true } },
            images: { where: { isHero: true }, take: 1, select: { url: true } },
          },
        });
        if (
          !t ||
          t.status !== TourStatus.LIVE ||
          !t.isActive ||
          !t.isBookable ||
          !t.destination.isActive
        ) {
          return null;
        }
        return {
          imageUrl: t.images[0]?.url ?? t.ogImage ?? null,
          title: t.name,
          linkPath: `/${t.destination.slug}/${t.slug}`,
        };
      }
      case RecommendationRefType.DESTINATION: {
        const d = await this.prisma.destination.findUnique({
          where: { id: refId },
          select: { name: true, slug: true, heroImage: true, isActive: true },
        });
        if (!d || !d.isActive) return null;
        return {
          imageUrl: d.heroImage ?? null,
          title: d.name,
          linkPath: `/${d.slug}`,
        };
      }
      case RecommendationRefType.COLLECTION: {
        const c = await this.prisma.collection.findUnique({
          where: { id: refId },
          select: {
            name: true,
            slug: true,
            heroImage: true,
            ogImage: true,
            status: true,
            isActive: true,
            destination: { select: { slug: true, isActive: true } },
          },
        });
        if (
          !c ||
          c.status !== CollectionStatus.PUBLISHED ||
          !c.isActive ||
          !c.destination.isActive
        ) {
          return null;
        }
        return {
          imageUrl: c.heroImage ?? c.ogImage ?? null,
          title: c.name,
          linkPath: `/${c.destination.slug}/${c.slug}`,
        };
      }
      case RecommendationRefType.HUB: {
        const h = await this.prisma.hub.findUnique({
          where: { id: refId },
          select: {
            name: true,
            slug: true,
            heroImage: true,
            ogImage: true,
            status: true,
            isActive: true,
            destination: { select: { slug: true, isActive: true } },
          },
        });
        if (
          !h ||
          h.status !== HubStatus.PUBLISHED ||
          !h.isActive ||
          !h.destination.isActive
        )
          return null;
        return {
          imageUrl: h.heroImage ?? h.ogImage ?? null,
          title: h.name,
          linkPath: `/${h.destination.slug}/${h.slug}`,
        };
      }
    }
  }

  /**
   * The "do not render" answer, content and all. Every field is nulled rather than
   * merely flagged: the shape is identical to the enabled one, so a caller that
   * forgets the flag renders an empty card instead of leaking a half-configured
   * promo, and the currency still carries a real value because the frontend types
   * it as an enum.
   */
  private hiddenPayload(locale: Locale) {
    return {
      enabled: false,
      locale,
      external: false,
      imageUrl: null,
      linkUrl: null,
      rating: null,
      reviewCount: null,
      sleeps: null,
      priceAmount: null,
      currency: Currency.USD,
      eyebrow: null,
      areaLabel: null,
      title: null,
      descriptionLines: [] as string[],
      ctaLabel: null,
    };
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /**
   * Every recommendation in promotion order, each with its category, stored
   * locales, live-resolution verdict, and which surfaces it currently wins.
   *
   * `featuredPlacements` is decided across the WHOLE list PER SURFACE: each surface
   * features exactly one row (the first enabled, complete one placed there), so a
   * row-by-row flag would show several all claiming to be live.
   */
  async findAll() {
    const described = await this.describeAll();
    const featured = this.computeFeatured(described);
    return described.map(({ row, card }) =>
      this.toAdminShape(row, card, featured),
    );
  }

  async findOne(id: string) {
    // Built on the same list as findAll: whether THIS row wins a surface is
    // decided against the others, and one implementation keeps the two in step.
    const described = await this.describeAll();
    const found = described.find((d) => d.row.id === id);
    if (!found) throw new NotFoundException(`Recommendation ${id} not found`);

    const featured = this.computeFeatured(described);
    return this.toAdminShape(found.row, found.card, featured);
  }

  async create(dto: CreateRecommendationDto, adminId: string) {
    const { title, description, areaLabel, eyebrow, ctaLabel, ...base } = dto;
    const source = base.source ?? RecommendationSource.EXTERNAL;

    if (source === RecommendationSource.INTERNAL) {
      if (!base.refType || !base.refId) {
        throw new BadRequestException(
          'Internal recommendations need a refType and refId.',
        );
      }
      await this.assertRefExists(base.refType, base.refId);
    } else if (!title?.trim()) {
      throw new BadRequestException(
        'External recommendations need a title (the render gate and list label).',
      );
    }

    if (base.categoryId) await this.assertCategoryExists(base.categoryId);

    // English copy is created WITH the row (external always; internal only when an
    // override was typed) rather than left to a second request.
    const hasCopy = !!(
      title ||
      description ||
      areaLabel ||
      eyebrow ||
      ctaLabel
    );

    const row = await this.prisma.recommendation.create({
      data: {
        ...base,
        ...(hasCopy && {
          translations: {
            create: {
              locale: Locale.en,
              title,
              description,
              areaLabel,
              eyebrow,
              ctaLabel,
            },
          },
        }),
      },
      select: { id: true },
    });

    this.logger.log(`Admin ${adminId} created recommendation ${row.id}`);
    // New English copy needs translating into the other six locales.
    if (hasCopy) this.contentTranslation.enqueue('recommendation', row.id);
    return this.findOne(row.id);
  }

  async update(id: string, dto: UpdateRecommendationDto, adminId: string) {
    const existing = await this.prisma.recommendation.findUnique({
      where: { id },
      select: { source: true, refType: true, refId: true },
    });
    if (!existing)
      throw new NotFoundException(`Recommendation ${id} not found`);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);

    // Enforce the same source-consistency rule as create() against the EFFECTIVE
    // post-patch state, so a PATCH cannot leave a row permanently incomplete (an
    // internal pointer with no target) with a silent 200.
    const effectiveSource = dto.source ?? existing.source;
    const effectiveRefType =
      dto.refType !== undefined ? dto.refType : existing.refType;
    const effectiveRefId = dto.refId !== undefined ? dto.refId : existing.refId;
    if (effectiveSource === RecommendationSource.INTERNAL) {
      if (!effectiveRefType || !effectiveRefId) {
        throw new BadRequestException(
          'Internal recommendations need a refType and refId.',
        );
      }
      // Only re-check the target when the pointer or source actually changed.
      if (
        dto.source !== undefined ||
        dto.refType !== undefined ||
        dto.refId !== undefined
      ) {
        await this.assertRefExists(effectiveRefType, effectiveRefId);
      }
    }

    await this.prisma.recommendation.update({
      where: { id },
      data: {
        ...(dto.source !== undefined && { source: dto.source }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.placements !== undefined && { placements: dto.placements }),
        ...(dto.refType !== undefined && { refType: dto.refType }),
        ...(dto.refId !== undefined && { refId: dto.refId }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.linkUrl !== undefined && { linkUrl: dto.linkUrl }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.reviewCount !== undefined && { reviewCount: dto.reviewCount }),
        ...(dto.sleeps !== undefined && { sleeps: dto.sleeps }),
        ...(dto.priceAmount !== undefined && { priceAmount: dto.priceAmount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
      select: { id: true },
    });

    this.logger.log(`Admin ${adminId} updated recommendation ${id}`);
    return this.findOne(id);
  }

  /**
   * Delete a recommendation. Seeded rows are protected, the same contract as
   * `Destination.isSeeded`. Translations go with it (FK cascade); nothing else
   * points at it, which is why this is a hard delete rather than an archive.
   */
  async remove(id: string, adminId: string) {
    const row = await this.prisma.recommendation.findUnique({
      where: { id },
      select: { id: true, isSeeded: true },
    });
    if (!row) throw new NotFoundException(`Recommendation ${id} not found`);

    if (row.isSeeded) {
      throw new ForbiddenException(
        'Seeded recommendations cannot be deleted. Switch it off instead if it ' +
          'should not be featured.',
      );
    }

    await this.prisma.recommendation.delete({ where: { id } });
    this.logger.log(`Admin ${adminId} deleted recommendation ${id}`);
    return { message: 'Recommendation deleted successfully' };
  }

  async getTranslations(id: string) {
    await this.assertExists(id);

    return this.prisma.recommendationTranslation.findMany({
      where: { recommendationId: id },
      select: TRANSLATION_SELECT,
      orderBy: { locale: 'asc' },
    });
  }

  async upsertTranslation(
    id: string,
    locale: Locale,
    dto: UpsertRecommendationTranslationDto,
    adminId: string,
  ) {
    await this.assertExists(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.recommendationTranslation.upsert({
      where: { recommendationId_locale: { recommendationId: id, locale } },
      create: {
        recommendationId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        eyebrow: fields.eyebrow,
        areaLabel: fields.areaLabel,
        title: fields.title,
        description: fields.description,
        ctaLabel: fields.ctaLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        // Human write path: reset the AI bookkeeping so the machine refresher
        // never overwrites what was typed here.
        sourceHash: null,
        ...(fields.eyebrow !== undefined && { eyebrow: fields.eyebrow }),
        ...(fields.areaLabel !== undefined && { areaLabel: fields.areaLabel }),
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.description !== undefined && {
          description: fields.description,
        }),
        ...(fields.ctaLabel !== undefined && { ctaLabel: fields.ctaLabel }),
      },
      select: TRANSLATION_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} upserted recommendation ${id} copy [${locale}]`,
    );
    // An English edit re-sources the other locales.
    if (locale === Locale.en) {
      this.contentTranslation.enqueue('recommendation', id);
    }
    return result;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private toAdminShape(
    row: RecommendationRow & {
      category: { id: string; name: string; slug: string } | null;
      translations: TranslationRow[];
    },
    card: ResolvedCard | null,
    featured: Map<RecommendationPlacement, string>,
  ) {
    return {
      id: row.id,
      source: row.source,
      category: row.category,
      isEnabled: row.isEnabled,
      displayOrder: row.displayOrder,
      isSeeded: row.isSeeded,
      placements: row.placements,
      refType: row.refType,
      refId: row.refId,
      // For an INTERNAL row the resolved live title doubles as the list label; null
      // means the entity no longer resolves (archived/deleted), which is exactly
      // what an admin needs to see.
      refLabel:
        row.source === RecommendationSource.INTERNAL
          ? (card?.title ?? null)
          : null,
      imageUrl: row.imageUrl,
      linkUrl: row.linkUrl,
      rating: num(row.rating),
      reviewCount: row.reviewCount,
      sleeps: row.sleeps,
      priceAmount: num(row.priceAmount),
      currency: row.currency,
      featuredPlacements: ALL_PLACEMENTS.filter(
        (p) => featured.get(p) === row.id,
      ),
      isComplete: card !== null,
      translations: row.translations,
    };
  }

  /**
   * Every recommendation in promotion order, each resolved once (English basis) -
   * parallel, since each internal row hits the DB for its entity. The single source
   * both findAll and findOne build on, so the two never drift.
   */
  private async describeAll() {
    const rows = await this.prisma.recommendation.findMany({
      select: {
        ...BASE_SELECT,
        category: { select: CATEGORY_REF_SELECT },
        translations: {
          select: TRANSLATION_SELECT,
          orderBy: { locale: 'asc' },
        },
      },
      orderBy: PROMOTION_ORDER,
    });

    return Promise.all(
      rows.map(async (row) => ({
        row,
        card: await this.buildCard(row, row.translations, Locale.en),
      })),
    );
  }

  /**
   * Which recommendation wins each surface: the first enabled, complete row in
   * promotion order whose placements include that surface. One winner per surface.
   */
  private computeFeatured(
    described: Array<{
      row: {
        id: string;
        isEnabled: boolean;
        placements: RecommendationPlacement[];
      };
      card: ResolvedCard | null;
    }>,
  ): Map<RecommendationPlacement, string> {
    const featured = new Map<RecommendationPlacement, string>();
    for (const placement of ALL_PLACEMENTS) {
      const winner = described.find(
        ({ row, card }) =>
          row.isEnabled && !!card && row.placements.includes(placement),
      );
      if (winner) featured.set(placement, winner.row.id);
    }
    return featured;
  }

  private async assertExists(id: string) {
    const found = await this.prisma.recommendation.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!found) throw new NotFoundException(`Recommendation ${id} not found`);
  }

  private async assertCategoryExists(categoryId: string) {
    const found = await this.prisma.recommendationCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!found) {
      throw new BadRequestException(
        `Recommendation category ${categoryId} not found`,
      );
    }
  }

  /**
   * The pointed-at entity must EXIST (existence only, not published state): an
   * admin may point a recommendation at a not-yet-live tour and it simply stays
   * unfeatured until the tour goes live. A typo'd id, though, is caught here with a
   * clear error rather than surfacing later as a silently incomplete row.
   */
  private async assertRefExists(refType: RecommendationRefType, refId: string) {
    const exists = await this.refExists(refType, refId);
    if (!exists) {
      throw new BadRequestException(
        `Referenced ${refType.toLowerCase()} ${refId} not found`,
      );
    }
  }

  private async refExists(
    refType: RecommendationRefType,
    refId: string,
  ): Promise<boolean> {
    const where = { id: refId };
    const select = { id: true };
    switch (refType) {
      case RecommendationRefType.TOUR:
        return !!(await this.prisma.tour.findUnique({ where, select }));
      case RecommendationRefType.DESTINATION:
        return !!(await this.prisma.destination.findUnique({ where, select }));
      case RecommendationRefType.COLLECTION:
        return !!(await this.prisma.collection.findUnique({ where, select }));
      case RecommendationRefType.HUB:
        return !!(await this.prisma.hub.findUnique({ where, select }));
    }
  }
}

/**
 * The stored description, one entry per paragraph on the card. Newline-separated
 * rather than a child table; blank lines dropped so a trailing return does not
 * render an empty paragraph.
 */
function splitLines(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
