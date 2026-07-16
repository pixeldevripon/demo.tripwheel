import { FxRatesService } from '@/fx/fx-rates.service';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Currency, Locale } from '@prisma/client';

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
    aggregateRating: true,
    aggregateReviewCount: true,
    isLocalsFavourite: true,
    destination: { select: { slug: true } },
    images: {
      where: { isHero: true },
      select: { url: true, altText: true },
      take: 1,
    },
  } as const;

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

    const cards = rows
      .filter((row) => row.tour)
      .map(({ savedAt, tour }) => {
        const { destination, translations, ...rest } = tour;
        return {
          ...rest,
          destinationSlug: destination?.slug ?? null,
          title: translations?.[0]?.title?.trim() || tour.name,
          savedAt,
        };
      });

    // Same reusable converter as the public tour/hub cards.
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
