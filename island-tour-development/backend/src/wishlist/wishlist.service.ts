import { FxRatesService } from '@/fx/fx-rates.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  applyMostPopularCap,
  badgeSelect,
  deriveTourBadge,
  type BadgeInput,
  type TourBadge,
} from '@/tours/tour-badge';
import { islandToursBase } from '@/common/utils/app-urls.util';
import { MailService } from '@/mail/mail.service';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Locale, TourStatus } from '@prisma/client';
import type { EmailWishlistDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: FxRatesService,
    private readonly mail: MailService,
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
    // The category SLUG rides along for one reason: an unbookable saved tour
    // offers "See similar tours", and the nearest similar thing is its own
    // primary category on its own island.
    categories: {
      where: { isPrimary: true },
      select: { categoryId: true, category: { select: { slug: true } } },
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

  /**
   * Drop the 'sponsored' badge from a SAVED list (mck-17, saved tours page).
   *
   * Sponsored means paid placement, and nothing on this page was placed by us:
   * the traveller put it there. It is the same rule the numbered collections
   * already follow. Every other badge keeps its normal meaning, because every
   * other badge is a statement about the tour rather than about who paid.
   *
   * Runs LAST, after `applyMostPopularCap` - the cap itself can hand a
   * category's second "Most popular" card a 'sponsored' fallback, so clearing
   * before it would let the badge back in through the side door.
   *
   * Nulled rather than back-filled with the next badge down: 'sponsored' is
   * already the lowest-priority badge in `deriveTourBadge`, so a card that
   * resolved to it has nothing further to fall through to.
   */
  private dropSponsoredBadge<T extends { badge: TourBadge }>(cards: T[]): T[] {
    for (const card of cards) {
      if (card.badge === 'sponsored') card.badge = null;
    }
    return cards;
  }

  /**
   * A saved tour that can no longer be booked - unpublished, archived or
   * deactivated since it was saved.
   *
   * It is deliberately NOT dropped (mck-17): the traveller put it on the list,
   * so the traveller decides what leaves it. Silently vanishing reads as a bug
   * in the list rather than a change at the operator, and it takes the one
   * chance we have to offer something similar instead.
   *
   * Carries only what the dimmed card renders - id, title, photo, and where to
   * look for something like it. No price, no badge, no detail URL: the card is
   * not clickable and a non-LIVE tour's commercial data has no business in a
   * public payload.
   */
  private toUnbookableCard(tour: {
    id: string;
    title: string;
    images: { url: string; altText: string | null }[];
    destination: { slug: string } | null;
    categories: { category: { slug: string } }[];
  }) {
    return {
      id: tour.id,
      title: tour.title,
      images: tour.images,
      destinationSlug: tour.destination?.slug ?? null,
      primaryCategorySlug: tour.categories[0]?.category.slug ?? null,
      isBookable: false as const,
    };
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
            status: true,
            isActive: true,
            translations: { where: { locale }, select: { title: true } },
          },
        },
      },
    });

    // Same rule as `resolveByIds`: a tour that stopped being sellable stays on
    // the list as an unbookable tile instead of vanishing from it.
    const ordered = rows
      .filter((row) => row.tour)
      .map(({ savedAt, tour }) => ({
        ...tour,
        title: tour.translations?.[0]?.title?.trim() || tour.name,
        savedAt,
      }));

    const withBadges = ordered
      .filter((t) => t.status === TourStatus.LIVE && t.isActive)
      .map((tour) => {
        const {
          destination,
          translations: _translations,
          status: _status,
          isActive: _isActive,
          title,
          savedAt,
          ...rest
        } = tour;
        return {
          ...this.toCardWithBadge(rest),
          destinationSlug: destination?.slug ?? null,
          title,
          savedAt,
          isBookable: true as const,
        };
      });

    // §3.6: the "Most popular" cap is per RENDERED list, and a wishlist is one
    // - five saved boat tours all flagged "Most popular" says nothing.
    const cards = this.dropSponsoredBadge(
      this.stripRankingInternals(applyMostPopularCap(withBadges)),
    );

    // Same reusable converter as the public tour/hub cards.
    await this.fx.attachMoney(cards, currency, 'defaultCurrency');

    const cardById = new Map(cards.map((card) => [card.id, card]));
    return ordered.map(
      (tour) =>
        cardById.get(tour.id) ?? {
          ...this.toUnbookableCard(tour),
          savedAt: tour.savedAt,
        },
    );
  }

  /**
   * PUBLIC id resolver for the cookie-based wishlist: shapes the given tour ids
   * for card rendering (same search-hit shape as `list`, no `savedAt`). The
   * browser owns the saved set (a 6-month `it.wishlist` cookie) - the backend
   * only turns ids into displayable cards. Input order is preserved (the cookie
   * keeps newest-first). Capped at 100 ids.
   *
   * A tour that has stopped being sellable since it was saved comes back as an
   * UNBOOKABLE card rather than disappearing (mck-17): `isBookable: false` plus
   * just enough to render the dimmed tile and point at something similar. Only
   * ids with no tour at all are dropped, because there is nothing left to draw.
   */
  async resolveByIds(
    ids: string[],
    locale: Locale = Locale.en,
    currency?: Currency,
  ) {
    const unique = [...new Set(ids)].slice(0, 100);
    if (unique.length === 0) return [];

    const rows = await this.prisma.tour.findMany({
      where: { id: { in: unique } },
      select: {
        ...this.tourSelect,
        status: true,
        isActive: true,
        translations: { where: { locale }, select: { title: true } },
      },
    });

    const byId = new Map(rows.map((t) => [t.id, t]));
    // Cookie order, which is the order the traveller will see them in.
    const ordered = unique
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .map((tour) => ({
        ...tour,
        title: tour.translations?.[0]?.title?.trim() || tour.name,
      }));

    const withBadges = ordered
      .filter((t) => t.status === TourStatus.LIVE && t.isActive)
      .map((tour) => {
        const {
          destination,
          translations: _translations,
          status: _status,
          isActive: _isActive,
          title,
          ...rest
        } = tour;
        return {
          ...this.toCardWithBadge(rest),
          destinationSlug: destination?.slug ?? null,
          title,
          isBookable: true as const,
        };
      });

    // Capped and de-sponsored across the BOOKABLE cards only - an unbookable
    // tile carries no badge to cap.
    const cards = this.dropSponsoredBadge(
      this.stripRankingInternals(applyMostPopularCap(withBadges)),
    );

    await this.fx.attachMoney(cards, currency, 'defaultCurrency');

    // Re-interleave: the bookable cards return to their cookie positions and
    // the unbookable ones fill the gaps, so the list never reshuffles itself
    // just because one operator unpublished something.
    const cardById = new Map(cards.map((card) => [card.id, card]));
    return ordered.map(
      (tour) => cardById.get(tour.id) ?? this.toUnbookableCard(tour),
    );
  }

  /**
   * "Email me this list" (mck-17): sends the traveller a link back to their own
   * saved tours, so a list living in one browser's cookie survives the change
   * of device that would otherwise lose it.
   *
   * Only LIVE, active ids make it into the email. Mailing somebody a link to
   * something they can no longer book is the one outcome worse than not
   * mailing at all - and unlike the page, an email cannot explain itself later.
   *
   * The link carries `restore`, not `list`: this is the traveller's OWN list
   * coming home, so opening it merges the ids back into that device's cookie
   * rather than rendering the read-only shared view.
   *
   * Returns the number of tours sent. Throws when none of the ids resolve, so
   * the page can say so instead of claiming an empty email went out.
   */
  async emailList(dto: EmailWishlistDto): Promise<{ sent: number }> {
    const ids = dto.ids
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const unique = [...new Set(ids)].slice(0, 100);
    if (unique.length === 0) {
      throw new BadRequestException('No tours to send');
    }

    const locale = dto.locale ?? Locale.en;
    const rows = await this.prisma.tour.findMany({
      where: { id: { in: unique }, status: TourStatus.LIVE, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        priceFrom: true,
        basePrice: true,
        defaultCurrency: true,
        durationMinutesFrom: true,
        durationMinutesTo: true,
        aggregateRating: true,
        aggregateReviewCount: true,
        destination: { select: { slug: true } },
        images: {
          where: { isHero: true },
          select: { url: true },
          take: 1,
        },
        translations: { where: { locale }, select: { title: true } },
      },
    });
    if (rows.length === 0) {
      throw new BadRequestException('None of these tours can be booked');
    }

    // Cookie order, so the email lists them the way the page does.
    const byId = new Map(rows.map((t) => [t.id, t]));
    const kept = unique
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));

    // Same converter the resolved cards use, so the price in the inbox is the
    // price the traveller was looking at when they asked us to send it.
    await this.fx.attachMoney(kept, dto.currency, 'defaultCurrency');

    const base = islandToursBase();
    // `/saved`, not `/wishlist`: the old path still 308s, but an email lives
    // for years and should not spend a redirect on every open.
    const listUrl = `${base}/${locale}/saved?restore=${kept
      .map((t) => t.id)
      .join(',')}`;

    await this.mail.sendSavedToursEmail(dto.email, listUrl, {
      locale,
      tours: kept.map((t) => {
        const money = (
          t as { money?: { priceFrom?: string; currency?: string } }
        ).money;
        const amount = Number(
          money?.priceFrom ?? t.priceFrom ?? t.basePrice ?? 0,
        );
        return {
          title: t.translations?.[0]?.title?.trim() || t.name,
          // Every tour is flat: /{locale}/{destination}/{tour-slug}. A tour
          // with no destination has no page, so it gets no link rather than a
          // link to nowhere.
          url: t.destination?.slug
            ? `${base}/${locale}/${encodeURIComponent(
                t.destination.slug,
              )}/${encodeURIComponent(t.slug)}`
            : null,
          imageUrl: t.images[0]?.url ?? null,
          price: Number.isFinite(amount) && amount > 0 ? amount : null,
          currency: money?.currency ?? t.defaultCurrency,
          durationMinutes: t.durationMinutesFrom,
          rating: t.aggregateReviewCount > 0 ? t.aggregateRating : null,
          reviewCount: t.aggregateReviewCount,
        };
      }),
    });
    // The address is the traveller's own and is not stored anywhere, so it is
    // not logged either - only that a send happened, and how big it was.
    this.logger.log(`Emailed a saved list of ${kept.length} tours`);
    return { sent: kept.length };
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
