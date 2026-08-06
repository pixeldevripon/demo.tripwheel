import { FxRatesService } from '@/fx/fx-rates.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  applyMostPopularCap,
  badgeSelect,
  deriveTourBadge,
  type BadgeInput,
} from '@/tours/tour-badge';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Currency, Locale, TourStatus } from '@prisma/client';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxRatesService,
  ) {}

  /** Tour fields needed to render a wishlist card (mirrors the search-hit shape). */
  private readonly tourSelect = {
    id: true,
    name: true,
    slug: true,
    priceFrom: true,
    basePrice: true,
    defaultCurrency: true,
    pricingModel: true,
    durationMinutesFrom: true,
    durationMinutesTo: true,
    pickupModel: true,
    cancellationHours: true,
    isLocalsFavourite: true,
    destination: { select: { slug: true } },
    images: {
      where: { isHero: true },
      select: { url: true, altText: true },
      take: 1,
    },
    // Badge inputs (§3.6/§3.7). `aggregateRating`/`aggregateReviewCount` are
    // card fields in their own right and come in via this fragment too.
    ...badgeSelect,
    // The §3.6 "max 1 per category" cap needs each card's primary category.
    categories: {
      where: { isPrimary: true },
      select: { categoryId: true },
      take: 1,
    },
  } as const;

  /**
   * Resolve one row's badge and flatten the fields the card needs, dropping the
   * demand-signal inputs that were only ever fetched to compute it.
   *
   * `tierRank` deliberately SURVIVES this step: `applyMostPopularCap` reads it
   * to pick the fallback badge, so it can only be stripped once the cap has run
   * across the whole list - `stripRankingInternals` does that. This is the same
   * derive-then-strip order `ToursService.neutralizeForPublic` documents.
   */
  private toCardWithBadge<
    T extends {
      categories: { categoryId: string }[];
      likelyToSellOut: boolean;
      likelyToSellOutOverride: boolean | null;
      publishedAt: Date | null;
    } & BadgeInput,
  >(tour: T) {
    const {
      categories,
      likelyToSellOut: _lsto,
      likelyToSellOutOverride: _lstoOverride,
      publishedAt: _publishedAt,
      ...rest
    } = tour;
    return {
      ...rest,
      badge: deriveTourBadge(tour),
      primaryCategoryId: categories[0]?.categoryId ?? null,
    };
  }

  /**
   * Drop the ranking internals once every badge is final. `tierRank` is how
   * much an operator pays us for placement, expressed as a number - it has no
   * business in a traveler payload. `isSponsored` stays: a boolean, not a rate,
   * and the card renders the spotlight treatment from it.
   *
   * Removed outright rather than nulled: `tierRank` has never been part of this
   * endpoint's response, so there is no existing shape to keep valid - unlike
   * `neutralizeForPublic`, which nulls because `TourResponseDto` declares them.
   */
  private stripRankingInternals<T extends { tierRank: number }>(
    cards: T[],
  ): Omit<T, 'tierRank'>[] {
    return cards.map(({ tierRank: _tierRank, ...card }) => card);
  }

  /** The current user's saved tours, newest first, shaped for card rendering. When
   *  `currency` is passed, each card gets the converted display `money` (guide §20.9). */
  async list(userId: string, locale: Locale = Locale.en, currency?: Currency) {
    const rows = await this.prisma.wishlist.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      select: {
        savedAt: true,
        tour: {
          select: {
            ...this.tourSelect,
            translations: { where: { locale }, select: { title: true } },
          },
        },
      },
    });

    const withBadges = rows
      .filter((row) => row.tour)
      .map(({ savedAt, tour }) => {
        const { destination, translations, ...rest } = tour;
        return {
          ...this.toCardWithBadge(rest),
          destinationSlug: destination?.slug ?? null,
          title: translations?.[0]?.title?.trim() || tour.name,
          savedAt,
        };
      });

    // §3.6: the "Most popular" cap is per RENDERED list, and a wishlist is one
    // - five saved boat tours all flagged "Most popular" says nothing.
    const cards = this.stripRankingInternals(applyMostPopularCap(withBadges));

    // Same reusable converter as the public tour/hub cards.
    await this.fx.attachMoney(cards, currency, 'defaultCurrency');
    return cards;
  }

  /**
   * PUBLIC id resolver for the cookie-based wishlist: shapes the given tour ids
   * for card rendering (same search-hit shape as `list`, no `savedAt`). The
   * browser owns the saved set (a 6-month `it.wishlist` cookie) - the backend
   * only turns ids into displayable cards. Input order is preserved (the cookie
   * keeps newest-first); unknown / non-LIVE / inactive ids are dropped
   * silently so a stale cookie never breaks the page. Capped at 100 ids.
   */
  async resolveByIds(
    ids: string[],
    locale: Locale = Locale.en,
    currency?: Currency,
  ) {
    const unique = [...new Set(ids)].slice(0, 100);
    if (unique.length === 0) return [];

    const rows = await this.prisma.tour.findMany({
      where: { id: { in: unique }, status: TourStatus.LIVE, isActive: true },
      select: {
        ...this.tourSelect,
        translations: { where: { locale }, select: { title: true } },
      },
    });

    const byId = new Map(rows.map((t) => [t.id, t]));
    const withBadges = unique
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((tour) => {
        const { destination, translations, ...rest } = tour;
        return {
          ...this.toCardWithBadge(rest),
          destinationSlug: destination?.slug ?? null,
          title: translations?.[0]?.title?.trim() || tour.name,
        };
      });

    // Capped across the resolved list, in the cookie's own order - the order
    // the traveller will actually see them in.
    const cards = this.stripRankingInternals(applyMostPopularCap(withBadges));

    await this.fx.attachMoney(cards, currency, 'defaultCurrency');
    return cards;
  }

  /** Just the saved tour ids — used to hydrate heart states across the site. */
  async listIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlist.findMany({
      where: { userId },
      select: { tourId: true },
    });
    return rows.map((r) => r.tourId);
  }

  /** Save a tour (idempotent). 404 if the tour does not exist. */
  async add(userId: string, tourId: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: { id: true },
    });
    if (!tour) throw new NotFoundException(`Tour ${tourId} not found`);

    await this.prisma.wishlist.upsert({
      where: { userId_tourId: { userId, tourId } },
      create: { userId, tourId },
      update: {},
    });
    this.logger.log(`User ${userId} saved tour ${tourId}`);
    return { tourId, saved: true };
  }

  /** Remove a saved tour (idempotent — no error if it was not saved). */
  async remove(userId: string, tourId: string) {
    await this.prisma.wishlist.deleteMany({ where: { userId, tourId } });
    this.logger.log(`User ${userId} removed tour ${tourId}`);
    return { tourId, saved: false };
  }
}
