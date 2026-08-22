import { Injectable, Logger } from '@nestjs/common';
import {
  CollectionStatus,
  HubStatus,
  PageStatus,
  TourStatus,
} from '@prisma/client';

import { CATEGORY_PAGE_MIN_TOURS } from '@/common/constants/category-visibility';
import { PrismaService } from '@/prisma/prisma.service';
import type { SitemapEntryDto } from './dto/sitemap.dto';

/**
 * Enumerates every indexable, locale-LESS URL on the public site for
 * `/sitemap.xml`. The gates here mirror EXACTLY what each public page 404s on,
 * so the sitemap never advertises a soft-404:
 *
 *  - Destination  : `isActive` (destinations.service).
 *  - Tour         : `LIVE` + `isActive` + active destination (tours.service).
 *  - Category     : top-level, `isActive`, and ≥ CATEGORY_PAGE_MIN_TOURS LIVE tours
 *                   in that destination (master §2.4; the same constant
 *                   categories.service.getBySlugForDestination 404s below).
 *  - Hub          : `PUBLISHED` + `isActive` + ≥1 LIVE tour (hubs.service).
 *  - Collection   : `PUBLISHED` + `isActive` + active destination (collections.service).
 *  - Page         : `PUBLISHED` (pages.service.getPublicBySlug 404s otherwise).
 *
 * Entity slugs are read directly (they are the canonical current slug, kept in
 * sync with slug_registry transactionally), so no join to the registry is needed.
 */
@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEntries(): Promise<SitemapEntryDto[]> {
    const [destinations, tours, tourCategories, hubs, collections, pages] =
      await Promise.all([
        this.prisma.destination.findMany({
          where: { isActive: true },
          select: { slug: true, updatedAt: true },
        }),
        this.prisma.tour.findMany({
          where: {
            status: TourStatus.LIVE,
            isActive: true,
            destination: { isActive: true },
          },
          select: {
            slug: true,
            updatedAt: true,
            destination: { select: { slug: true } },
          },
        }),
        // Category pages are per (destination, category). Iterate the LIVE-tour
        // ↔ category links and fold them into pairs, COUNTING the tours behind
        // each - the render gate is a threshold, not mere existence.
        this.prisma.tourCategory.findMany({
          where: {
            tour: {
              status: TourStatus.LIVE,
              isActive: true,
              destination: { isActive: true },
            },
            category: { isActive: true, parentCategoryId: null },
          },
          select: {
            category: { select: { slug: true, updatedAt: true } },
            tour: {
              select: {
                updatedAt: true,
                destination: { select: { slug: true } },
              },
            },
          },
        }),
        this.prisma.hub.findMany({
          where: {
            status: HubStatus.PUBLISHED,
            isActive: true,
            destination: { isActive: true },
            tourHubs: {
              some: { tour: { status: TourStatus.LIVE, isActive: true } },
            },
          },
          select: {
            slug: true,
            updatedAt: true,
            destination: { select: { slug: true } },
          },
        }),
        this.prisma.collection.findMany({
          where: {
            status: CollectionStatus.PUBLISHED,
            isActive: true,
            destination: { isActive: true },
          },
          select: {
            slug: true,
            updatedAt: true,
            destination: { select: { slug: true } },
          },
        }),
        // Global pages (legal/policy) — top-level `/{slug}`, no destination.
        this.prisma.page.findMany({
          where: { status: PageStatus.PUBLISHED },
          select: { slug: true, updatedAt: true },
        }),
      ]);

    const entries: SitemapEntryDto[] = [];

    for (const d of destinations) {
      entries.push({
        path: `/${d.slug}`,
        lastModified: d.updatedAt.toISOString(),
        type: 'destination',
      });
    }

    for (const t of tours) {
      entries.push({
        path: `/${t.destination.slug}/${t.slug}`,
        lastModified: t.updatedAt.toISOString(),
        type: 'tour',
      });
    }

    // Collapse the tour↔category links into one URL per (destination, category),
    // keeping the freshest timestamp across the category and its LIVE tours and
    // tallying how many tours sit behind the pair. `tour_categories` is unique on
    // (tourId, categoryId), so the row count IS the tour count.
    const categoryPairs = new Map<
      string,
      { path: string; lastModified: Date; tours: number }
    >();
    for (const tc of tourCategories) {
      const path = `/${tc.tour.destination.slug}/${tc.category.slug}`;
      const freshest =
        tc.tour.updatedAt > tc.category.updatedAt
          ? tc.tour.updatedAt
          : tc.category.updatedAt;
      const existing = categoryPairs.get(path);
      if (!existing) {
        categoryPairs.set(path, { path, lastModified: freshest, tours: 1 });
        continue;
      }
      existing.tours += 1;
      if (freshest > existing.lastModified) existing.lastModified = freshest;
    }
    for (const c of categoryPairs.values()) {
      // Below the bar the page 404s, so listing it would advertise a soft-404.
      if (c.tours < CATEGORY_PAGE_MIN_TOURS) continue;
      entries.push({
        path: c.path,
        lastModified: c.lastModified.toISOString(),
        type: 'category',
      });
    }

    for (const h of hubs) {
      entries.push({
        path: `/${h.destination.slug}/${h.slug}`,
        lastModified: h.updatedAt.toISOString(),
        type: 'hub',
      });
    }

    for (const c of collections) {
      entries.push({
        path: `/${c.destination.slug}/${c.slug}`,
        lastModified: c.updatedAt.toISOString(),
        type: 'collection',
      });
    }

    for (const p of pages) {
      entries.push({
        path: `/${p.slug}`,
        lastModified: p.updatedAt.toISOString(),
        type: 'page',
      });
    }

    this.logger.log(`Sitemap enumerated ${entries.length} indexable URLs`);
    return entries;
  }
}
