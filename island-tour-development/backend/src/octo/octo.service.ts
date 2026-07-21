import { Injectable } from '@nestjs/common';
import { Locale, TourStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { faqSelect, resolveFaqLocale } from '@/common/utils/translation.util';
import type { OctoCapabilitySet } from '@/octo/common/octo-capabilities';
import { OctoException } from '@/octo/common/octo-error';
import { serializeSupplier } from '@/octo/serializers/octo-supplier.serializer';
import {
  octoTourInclude,
  serializeTour,
  type OctoFaq,
} from '@/octo/serializers/octo-tour.serializer';

/**
 * OCTO catalog read service (Phase 0+1).
 *
 * Backs the public, slug-free OCTO catalog: the platform-as-supplier metadata and
 * the tour (= OCTO product) list/detail. Only `LIVE` + active tours are exposed.
 * Serialization (capability gating, money minor-units, locale fallback) lives in the
 * serializers; this service owns the DB reads + OCTO error mapping.
 */
@Injectable()
export class OctoService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /supplier - platform-as-supplier (decision D4). */
  async getSupplier(endpoint: string) {
    const [siteInfo, company] = await Promise.all([
      this.prisma.siteInfo.upsert({
        where: { id: 'default' },
        update: {},
        create: { id: 'default' },
      }),
      this.prisma.companyInformations.findUnique({ where: { id: 'default' } }),
    ]);
    return serializeSupplier(siteInfo, company, endpoint);
  }

  /** GET /tours - full catalog of LIVE + active tours. */
  async listTours(caps: OctoCapabilitySet, locale: Locale) {
    const tours = await this.prisma.tour.findMany({
      where: { status: TourStatus.LIVE, isActive: true },
      orderBy: [{ tierRank: 'asc' }, { qualityScore: 'desc' }, { id: 'asc' }],
      include: octoTourInclude,
    });

    const faqsByTour = await this.loadFaqs(
      tours.map((t) => t.id),
      locale,
      caps,
    );

    return tours.map((tour) =>
      serializeTour(tour, {
        caps,
        locale,
        faqs: faqsByTour.get(tour.id) ?? [],
      }),
    );
  }

  /** GET /tours/{id} - single tour; same shape as a list item. */
  async getTour(tourId: string, caps: OctoCapabilitySet, locale: Locale) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      include: octoTourInclude,
    });

    if (!tour || tour.status !== TourStatus.LIVE || !tour.isActive) {
      throw OctoException.invalidTourId(tourId);
    }

    const faqsByTour = await this.loadFaqs([tour.id], locale, caps);
    return serializeTour(tour, {
      caps,
      locale,
      faqs: faqsByTour.get(tour.id) ?? [],
    });
  }

  /**
   * Loads locale-resolved FAQs grouped by tour. FAQs are polymorphic
   * (`pageType='tour'`); only fetched when the content capability is active.
   */
  private async loadFaqs(
    tourIds: string[],
    locale: Locale,
    caps: OctoCapabilitySet,
  ): Promise<Map<string, OctoFaq[]>> {
    const grouped = new Map<string, OctoFaq[]>();
    if (!caps.has('octo/content') || tourIds.length === 0) return grouped;

    const rows = await this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.TOUR,
        entityId: { in: tourIds },
        isActive: true,
        locale: { in: [locale, Locale.en] },
      },
      orderBy: { displayOrder: 'asc' },
      select: { entityId: true, ...faqSelect },
    });

    const byTour = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byTour.get(r.entityId) ?? [];
      list.push(r);
      byTour.set(r.entityId, list);
    }

    // Shared resolver: falls back per faqGroupId, so a tour with three of its
    // five questions translated exposes all five rather than dropping to English
    // wholesale. (This replaced an all-or-nothing rule that did the latter.)
    for (const [entityId, list] of byTour) {
      grouped.set(
        entityId,
        resolveFaqLocale(list, locale).map((r) => ({
          question: r.question,
          answer: r.answer,
        })),
      );
    }
    return grouped;
  }
}
