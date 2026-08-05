import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { mergeTranslation } from '@/common/utils/translation.util';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { PrismaService } from '@/prisma/prisma.service';
import { FxRatesService } from '@/fx/fx-rates.service';
import { Currency, HubStatus, Prisma, TourStatus } from '@prisma/client';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  UpdateHomePageDto,
  UpsertHomePageTranslationDto,
} from './dto/home-page.dto';

/**
 * The homepage is a singleton - there is one homepage per platform, and islands
 * are data inside it rather than variants of it. Same convention as the settings
 * models: a fixed primary key, self-seeded on first admin read.
 */
const HOME_ID = 'default';

/**
 * The island the editorial banner falls back to before "whatever is first".
 * The banner copy is themed to the launch island, so it is the sensible default
 * when an admin has not pinned one.
 */
const LAUNCH_ISLAND_SLUG = 'curacao';

const TRANSLATION_SELECT = {
  locale: true,
  heroTitle: true,
  heroSubtitle: true,
  experiencesTitle: true,
  editorialTitleLine1: true,
  editorialTitleLine2: true,
  editorialBody: true,
  editorialCta: true,
  faqTitle: true,
  faqSubtitle: true,
  metaTitle: true,
  metaDescription: true,
  isMachineTranslated: true,
} as const;

const BASE_SELECT = {
  heroImage: true,
  editorialDestinationId: true,
  ogImage: true,
} as const;

/** The fanned CTA deck, always in fan order. */
const EDITORIAL_CARDS = {
  select: {
    id: true,
    imageUrl: true,
    categoryId: true,
    hubId: true,
    isLink: true,
    displayOrder: true,
  },
  orderBy: { displayOrder: 'asc' },
} as const;

/** Shape returned when no row (or no translation) exists yet - all defaults. */
const EMPTY_COPY = {
  heroTitle: null,
  heroSubtitle: null,
  experiencesTitle: null,
  editorialTitleLine1: null,
  editorialTitleLine2: null,
  editorialBody: null,
  editorialCta: null,
  faqTitle: null,
  faqSubtitle: null,
  metaTitle: null,
  metaDescription: null,
} as const;

@Injectable()
export class HomePageService {
  private readonly logger = new Logger(HomePageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqGroups: FaqGroupService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly fx: FxRatesService,
  ) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * The public homepage payload for one locale.
   *
   * Deliberately a read-only `findUnique` (not the self-seeding upsert the admin
   * read uses): an anonymous GET must never write. When nothing is configured it
   * returns an all-null object, which the frontend reads as "keep every built-in
   * dictionary default" - so a homepage with no content row still renders.
   */
  async getPublic(locale: Locale, currency?: Currency) {
    // FAQs ride along in this one payload rather than getting their own endpoint:
    // the homepage needs both together, and one cached read beats two.
    const [row, faqs] = await Promise.all([
      this.prisma.homePage.findUnique({
        where: { id: HOME_ID },
        select: {
          ...BASE_SELECT,
          editorialDestination: { select: { slug: true, isActive: true } },
          editorialCards: {
            select: {
              ...EDITORIAL_CARDS.select,
              // Caption and slug both come from the TARGET itself (category
              // or hub), in the requested locale - never from an admin-typed
              // string.
              category: {
                select: {
                  slug: true,
                  name: true,
                  isActive: true,
                  translations: { where: { locale }, select: { name: true } },
                },
              },
              hub: {
                select: {
                  slug: true,
                  name: true,
                  isActive: true,
                  status: true,
                  destinationId: true,
                  translations: { where: { locale }, select: { name: true } },
                },
              },
            },
            orderBy: EDITORIAL_CARDS.orderBy,
          },
          // Both locales: `mergeTranslation` fills any field the locale row
          // leaves blank from English, so a cleared hero title shows the
          // English one instead of nothing.
          translations: {
            where: { locale: { in: [locale, Locale.en] } },
            select: TRANSLATION_SELECT,
          },
        },
      }),
      this.getPublicFaqs(locale),
    ]);

    if (!row) {
      return {
        locale,
        heroImage: null,
        editorialCards: [],
        editorialDestinationSlug: null,
        ogImage: null,
        ...EMPTY_COPY,
        faqs,
      };
    }

    const { editorialDestination, editorialCards, translations, ...base } = row;
    const copy = mergeTranslation(translations, locale);

    // The island the whole banner points at - button AND cards.
    const island = await this.resolveEditorialIsland(
      base.editorialDestinationId,
      editorialDestination,
    );

    // Independent of each other - both derive only from the island and the
    // cards - so they go out together rather than one after the other.
    const [bookable, startingPrices] = await Promise.all([
      // Which of these categories actually has something bookable on that island.
      this.categoriesWithLiveTours(
        editorialCards
          .filter((c) => c.isLink && c.category?.isActive)
          .map((c) => c.categoryId)
          .filter((id): id is string => !!id),
        island?.id ?? null,
      ),
      /*
       * The "from" price each card advertises: its target's cheapest live tour
       * on the banner's island, converted to the shopper's currency.
       *
       * Gated by the SAME liveness test that decides whether the card may show
       * its name and link at all (below). Without the filter, archiving a
       * category or unpublishing a hub that still has live tours left the card
       * correctly anonymous and unlinked but still quoting a real price - a
       * page we had just decided must not be advertised, advertised by its
       * price.
       */
      this.cardStartingPrices(
        editorialCards.filter((c) =>
          c.hubId
            ? !!c.hub?.isActive && c.hub.status === HubStatus.PUBLISHED
            : !!c.category?.isActive,
        ),
        island?.id ?? null,
        currency,
      ),
    ]);

    return {
      locale,
      heroImage: base.heroImage,
      editorialCards: editorialCards.map((card) => {
        // HUB card: gated to the banner's own island (the one-island
        // invariant) plus the hub page's own visibility bar - active AND
        // published. A hub on another island, archived, or unpublished
        // degrades to a plain photo, exactly like the category path below.
        if (card.hubId && card.hub) {
          const hub = card.hub;
          const live =
            hub.isActive && hub.status === HubStatus.PUBLISHED ? hub : null;
          const linkable =
            !!live && card.isLink && hub.destinationId === (island?.id ?? null);
          return {
            image: card.imageUrl,
            name: live ? live.translations[0]?.name || live.name : null,
            // Slug only - joined to the island below, same as categories
            // (hub URLs share the `/{island}/{slug}` shape).
            categorySlug: linkable ? live.slug : null,
            ...(startingPrices.get(card.id) ?? {
              priceFrom: null,
              priceCurrency: null,
            }),
          };
        }

        // An archived category must not be advertised, exactly as with the CTA
        // button below: the card degrades to a plain photo rather than naming
        // and linking a page that 404s.
        const live = card.category?.isActive ? card.category : null;
        // THE GATE: a category page 404s unless that category has a live tour
        // on this island, so a card that would land on one is served without a
        // link. It keeps its photo and its caption - the never-blank rule - it
        // simply stops being a door to a missing page.
        const linkable =
          !!live &&
          card.isLink &&
          !!card.categoryId &&
          bookable.has(card.categoryId);
        return {
          image: card.imageUrl,
          name: live ? live.translations[0]?.name || live.name : null,
          // Slug only - the frontend joins it to the island below, so a card
          // can never open a different island from the button beside it.
          categorySlug: linkable ? live.slug : null,
          ...(startingPrices.get(card.id) ?? {
            priceFrom: null,
            priceCurrency: null,
          }),
        };
      }),
      // The RESOLVED island, not the raw admin choice: the cards are gated
      // against this island, so the frontend must land on the same one or the
      // gate would have been computed for a different page. An archived pick
      // resolves to the fallback rather than being advertised.
      editorialDestinationSlug: island?.slug ?? null,
      ogImage: base.ogImage,
      heroTitle: copy?.heroTitle ?? null,
      heroSubtitle: copy?.heroSubtitle ?? null,
      experiencesTitle: copy?.experiencesTitle ?? null,
      editorialTitleLine1: copy?.editorialTitleLine1 ?? null,
      editorialTitleLine2: copy?.editorialTitleLine2 ?? null,
      editorialBody: copy?.editorialBody ?? null,
      editorialCta: copy?.editorialCta ?? null,
      faqTitle: copy?.faqTitle ?? null,
      faqSubtitle: copy?.faqSubtitle ?? null,
      metaTitle: copy?.metaTitle ?? null,
      metaDescription: copy?.metaDescription ?? null,
      faqs,
    };
  }

  /**
   * Published homepage FAQs for one locale, in display order.
   *
   * Only rows that exist in the REQUESTED locale are returned - an untranslated
   * FAQ is omitted rather than falling back to English, because a Dutch traveller
   * reading a Dutch page should not hit an English answer mid-list. The frontend
   * falls back to its bundled dictionary FAQs when this comes back empty, so a
   * locale nobody has translated yet still shows a complete block.
   */
  private async getPublicFaqs(locale: Locale) {
    return this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.HOMEPAGE,
        entityId: HOME_ID,
        locale,
        isActive: true,
      },
      select: { question: true, answer: true },
      orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    });
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /** Admin view: the base row plus every stored locale. Self-seeds on first read. */
  async get() {
    const row = await this.prisma.homePage.upsert({
      where: { id: HOME_ID },
      update: {},
      create: { id: HOME_ID },
      select: {
        ...BASE_SELECT,
        editorialDestination: { select: { slug: true, isActive: true } },
        editorialCards: EDITORIAL_CARDS,
        translations: {
          select: TRANSLATION_SELECT,
          orderBy: { locale: 'asc' },
        },
      },
    });

    // The editor is told the same thing the public resolver decided, rather
    // than being left to discover that a card it shows as linked is served
    // without its link. Same island, same gate - computed once, here.
    const island = await this.resolveEditorialIsland(
      row.editorialDestinationId,
      row.editorialDestination,
    );
    const bookable = await this.categoriesWithLiveTours(
      row.editorialCards
        .map((c) => c.categoryId)
        .filter((id): id is string => !!id),
      island?.id ?? null,
    );

    // Hub cards get the same "would this page open" answer, computed against
    // the same island: active + published + on the banner's island.
    const hubIds = row.editorialCards
      .map((c) => c.hubId)
      .filter((id): id is string => !!id);
    const hubs = hubIds.length
      ? await this.prisma.hub.findMany({
          where: { id: { in: hubIds } },
          select: {
            id: true,
            isActive: true,
            status: true,
            destinationId: true,
          },
        })
      : [];
    const openableHubs = new Set(
      hubs
        .filter(
          (h) =>
            h.isActive &&
            h.status === HubStatus.PUBLISHED &&
            h.destinationId === (island?.id ?? null),
        )
        .map((h) => h.id),
    );

    const { editorialDestination, ...base } = row;
    return {
      ...base,
      /** The island the cards are gated against - the fallback, if none is pinned. */
      resolvedDestinationSlug: island?.slug ?? null,
      editorialCards: row.editorialCards.map((card) => ({
        ...card,
        hasLiveTours: card.categoryId
          ? bookable.has(card.categoryId)
          : card.hubId
            ? openableHubs.has(card.hubId)
            : false,
      })),
    };
  }

  async update(dto: UpdateHomePageDto, adminId: string) {
    // Validate the CTA target before storing it. The FK would catch a bogus id
    // with a 500-shaped Prisma error; this gives the admin a usable message.
    if (dto.editorialDestinationId) {
      const exists = await this.prisma.destination.findUnique({
        where: { id: dto.editorialDestinationId },
        select: { id: true },
      });
      if (!exists) {
        throw new BadRequestException(
          `No destination found with id "${dto.editorialDestinationId}"`,
        );
      }
    }

    // Every category or hub a card points at must exist, for the same reason
    // the CTA target is checked: the FK would raise a 500-shaped Prisma error
    // where the admin needs a sentence.
    if (dto.editorialCards?.length) {
      await this.assertCardTargetsExist(dto.editorialCards);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const home = await tx.homePage.upsert({
        where: { id: HOME_ID },
        create: {
          id: HOME_ID,
          heroImage: dto.heroImage,
          editorialDestinationId: dto.editorialDestinationId,
          ogImage: dto.ogImage,
        },
        update: {
          ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
          ...(dto.editorialDestinationId !== undefined && {
            editorialDestinationId: dto.editorialDestinationId,
          }),
          ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
        },
        select: BASE_SELECT,
      });

      // The deck is a WHOLESALE REPLACE, in one transaction with the base row.
      // Three fixed slots have no stable identity to diff against - "the middle
      // card" is a position, not a thing - so replacing is both simpler and
      // exactly what the editor means when it saves the deck.
      if (dto.editorialCards !== undefined) {
        await tx.homePageEditorialCard.deleteMany({
          where: { homeId: HOME_ID },
        });
        if (dto.editorialCards.length) {
          await tx.homePageEditorialCard.createMany({
            data: dto.editorialCards.map((card, index) => ({
              homeId: HOME_ID,
              imageUrl: card.imageUrl,
              // At most ONE target: the category wins if a client ever sends
              // both, so the resolver never has to break a tie.
              categoryId: card.categoryId ?? null,
              hubId: card.categoryId ? null : (card.hubId ?? null),
              // A link with nowhere to go is not a link. Normalising here means
              // the public resolver never has to special-case the pair.
              isLink:
                card.categoryId || card.hubId ? (card.isLink ?? true) : false,
              displayOrder: index,
            })),
          });
        }
      }

      return {
        ...home,
        editorialCards: await tx.homePageEditorialCard.findMany({
          where: { homeId: HOME_ID },
          ...EDITORIAL_CARDS,
        }),
      };
    });

    this.logger.log(`Admin ${adminId} updated homepage content`);
    return result;
  }

  /**
   * The island the editorial banner points at.
   *
   * Resolved HERE rather than left to the frontend, which is a change of
   * ownership worth stating: the card gate ("does this category have a live
   * tour on this island") is meaningless without knowing the island, and if the
   * two sides resolved it independently they could disagree - the backend would
   * gate against one island while the frontend linked to another.
   *
   * The order mirrors what the frontend used to do on its own, including the
   * `name: asc` that `GET /destinations/active` sorts by, so the resolved island
   * is the same one as before this moved: the admin's pick if it is still
   * active, else the launch island, else the first active one.
   */
  private async resolveEditorialIsland(
    pinnedId: string | null,
    pinned: { slug: string; isActive: boolean } | null,
  ): Promise<{ id: string; slug: string } | null> {
    if (pinnedId && pinned?.isActive)
      return { id: pinnedId, slug: pinned.slug };

    const active = await this.prisma.destination.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
      orderBy: { name: 'asc' },
    });

    return (
      active.find((d) => d.slug === LAUNCH_ISLAND_SLUG) ?? active[0] ?? null
    );
  }

  /**
   * The starting price each editorial card advertises: the cheapest LIVE tour
   * behind its target, on the banner's island, converted to the shopper's
   * currency.
   *
   * Keyed by CARD id rather than by target, because two cards may point at the
   * same category and each still needs its own answer.
   *
   * Two queries at most (categories, hubs) rather than one per card. Tours are
   * priced in their operator's own currency, so the minimum is taken per source
   * currency and the cheapest CONVERTED result wins - taking a raw numeric
   * minimum across mixed currencies would happily call 100 USD cheaper than
   * 95 EUR.
   *
   * Null whenever nothing bookable sits behind the card; the frontend then just
   * omits the price line rather than printing a zero.
   */
  private async cardStartingPrices(
    /**
     * Already filtered to cards whose target may be advertised - see the call
     * site. This method does not re-check liveness; it only prices what it is
     * given.
     */
    cards: {
      id: string;
      categoryId: string | null;
      hubId: string | null;
    }[],
    destinationId: string | null,
    currency?: Currency,
  ): Promise<Map<string, { priceFrom: string | null; priceCurrency: Currency | null }>> {
    const result = new Map<
      string,
      { priceFrom: string | null; priceCurrency: Currency | null }
    >();
    if (!destinationId || !cards.length) return result;

    const categoryIds = cards
      .map((c) => c.categoryId)
      .filter((id): id is string => !!id);
    const hubIds = cards.map((c) => c.hubId).filter((id): id is string => !!id);

    const liveOnIsland = {
      status: TourStatus.LIVE,
      isActive: true,
      destinationId,
    } as const;

    const [categoryRows, hubRows] = await Promise.all([
      categoryIds.length
        ? this.prisma.tourCategory.findMany({
            where: { categoryId: { in: categoryIds }, tour: liveOnIsland },
            select: {
              categoryId: true,
              tour: { select: { priceFrom: true, defaultCurrency: true } },
            },
          })
        : [],
      hubIds.length
        ? this.prisma.tourHub.findMany({
            where: { hubId: { in: hubIds }, tour: liveOnIsland },
            select: {
              hubId: true,
              tour: { select: { priceFrom: true, defaultCurrency: true } },
            },
          })
        : [],
    ]);

    // target id -> source currency -> cheapest amount in that currency
    const byTarget = new Map<string, Map<Currency, Prisma.Decimal>>();
    const note = (
      key: string,
      price: Prisma.Decimal | null | undefined,
      cur: Currency | undefined,
    ) => {
      if (price == null || !cur) return;
      const perCurrency = byTarget.get(key) ?? new Map<Currency, Prisma.Decimal>();
      const seen = perCurrency.get(cur);
      if (!seen || price.lessThan(seen)) perCurrency.set(cur, price);
      byTarget.set(key, perCurrency);
    };
    // Optional-chained on purpose: this is the site's front door, and a row
    // that arrives without its joined tour must cost the card its price line,
    // never the whole homepage.
    for (const row of categoryRows)
      note(row.categoryId, row.tour?.priceFrom, row.tour?.defaultCurrency);
    for (const row of hubRows)
      note(row.hubId, row.tour?.priceFrom, row.tour?.defaultCurrency);

    /*
     * ONE target for every card, even when the shopper's currency is unknown.
     *
     * `currency ?? source` looks like the right fallback - it is what
     * `FxRatesService.attachMoney` does - but that helper shows each item its
     * own price and never compares two items. Here we are picking a single
     * cheapest, and making every source its own target converts nothing at all,
     * so the comparison below would run on raw mixed-currency amounts: exactly
     * the "100 USD is cheaper than 95 EUR" bug this method exists to avoid.
     * EUR is the platform's base currency.
     */
    const target = currency ?? Currency.EUR;

    /*
     * Resolve each DISTINCT source currency's display rate once, the way
     * `attachMoney` does, so the per-card loop below is synchronous rather than
     * awaiting inside a nested loop.
     *
     * A source with no available rate keeps its own currency at rate 1 - the
     * sitewide "never block a page on FX" fallback.
     */
    const sources = new Set<Currency>();
    for (const perCurrency of byTarget.values())
      for (const source of perCurrency.keys()) sources.add(source);

    const rateBySource = new Map<
      Currency,
      { currency: Currency; rate: Prisma.Decimal }
    >();
    await Promise.all(
      [...sources].map(async (source) => {
        const display =
          source === target
            ? null
            : await this.fx.getDisplayRate(source, target);
        rateBySource.set(
          source,
          source === target || display
            ? {
                currency: target,
                rate: display ? display.rate : new Prisma.Decimal(1),
              }
            : { currency: source, rate: new Prisma.Decimal(1) },
        );
      }),
    );

    for (const card of cards) {
      const key = card.categoryId ?? card.hubId;
      const perCurrency = key ? byTarget.get(key) : undefined;
      if (!perCurrency?.size) continue;

      const converted = [...perCurrency.entries()].map(([source, amount]) => {
        const { currency: resolved, rate } = rateBySource.get(source)!;
        return {
          currency: resolved,
          // Decimal throughout - money math never goes via JS float.
          amount: amount
            .mul(rate)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        };
      });

      /*
       * Compare within ONE currency - the whole point of converting first.
       * Anything that could not be converted (an FX outage) is set aside. If
       * nothing converted at all, fall back to the unconverted set only when it
       * is unambiguous, i.e. every tour behind the card was priced in the same
       * currency. Otherwise the card shows no price rather than a wrong one.
       */
      const comparable = converted.filter((c) => c.currency === target);
      const pool = comparable.length
        ? comparable
        : new Set(converted.map((c) => c.currency)).size === 1
          ? converted
          : [];
      const cheapest = pool.sort((a, b) => a.amount.comparedTo(b.amount))[0];
      if (!cheapest) continue;

      result.set(card.id, {
        priceFrom: cheapest.amount.toString(),
        priceCurrency: cheapest.currency,
      });
    }

    return result;
  }

  /**
   * Of these categories, the ones with at least one LIVE tour on that island.
   *
   * This is the category page's own 404 condition (`categories.service
   * .getByDestinationSlug`), so passing it is exactly "this link resolves".
   * One query for the whole deck, `distinct` because a category with forty
   * tours is still just one answer.
   */
  private async categoriesWithLiveTours(
    categoryIds: string[],
    destinationId: string | null,
  ): Promise<Set<string>> {
    if (!categoryIds.length || !destinationId) return new Set();

    const rows = await this.prisma.tourCategory.findMany({
      where: {
        categoryId: { in: categoryIds },
        tour: {
          status: TourStatus.LIVE,
          isActive: true,
          destinationId,
        },
      },
      select: { categoryId: true },
      distinct: ['categoryId'],
    });

    return new Set(rows.map((r) => r.categoryId));
  }

  /** One query per target type for the whole deck rather than one per card. */
  private async assertCardTargetsExist(
    cards: { categoryId?: string | null; hubId?: string | null }[],
  ) {
    const categoryIds = [
      ...new Set(cards.map((c) => c.categoryId).filter((id) => !!id)),
    ] as string[];
    const hubIds = [
      ...new Set(cards.map((c) => c.hubId).filter((id) => !!id)),
    ] as string[];

    const [categories, hubs] = await Promise.all([
      categoryIds.length
        ? this.prisma.category.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true },
          })
        : [],
      hubIds.length
        ? this.prisma.hub.findMany({
            where: { id: { in: hubIds } },
            select: { id: true },
          })
        : [],
    ]);

    const missingCategory = categoryIds.find(
      (id) => !categories.some((c) => c.id === id),
    );
    if (missingCategory) {
      throw new BadRequestException(
        `No category found with id "${missingCategory}"`,
      );
    }
    const missingHub = hubIds.find((id) => !hubs.some((h) => h.id === id));
    if (missingHub) {
      throw new BadRequestException(`No hub found with id "${missingHub}"`);
    }
  }

  async getTranslations() {
    await this.ensureRow();

    return this.prisma.homePageTranslation.findMany({
      where: { homeId: HOME_ID },
      select: TRANSLATION_SELECT,
      orderBy: { locale: 'asc' },
    });
  }

  async upsertTranslation(
    locale: Locale,
    dto: UpsertHomePageTranslationDto,
    adminId: string,
  ) {
    // The translation row FKs to the singleton, which may not exist yet if the
    // first thing an admin ever does is write copy.
    await this.ensureRow();

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.homePageTranslation.upsert({
      where: { homeId_locale: { homeId: HOME_ID, locale } },
      create: {
        homeId: HOME_ID,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        heroTitle: fields.heroTitle,
        heroSubtitle: fields.heroSubtitle,
        experiencesTitle: fields.experiencesTitle,
        editorialTitleLine1: fields.editorialTitleLine1,
        editorialTitleLine2: fields.editorialTitleLine2,
        editorialBody: fields.editorialBody,
        editorialCta: fields.editorialCta,
        faqTitle: fields.faqTitle,
        faqSubtitle: fields.faqSubtitle,
        metaTitle: fields.metaTitle,
        metaDescription: fields.metaDescription,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        // Human write path: reset the AI bookkeeping so the machine refresher
        // never overwrites what was typed here.
        sourceHash: null,
        ...(fields.heroTitle !== undefined && { heroTitle: fields.heroTitle }),
        ...(fields.heroSubtitle !== undefined && {
          heroSubtitle: fields.heroSubtitle,
        }),
        ...(fields.experiencesTitle !== undefined && {
          experiencesTitle: fields.experiencesTitle,
        }),
        ...(fields.editorialTitleLine1 !== undefined && {
          editorialTitleLine1: fields.editorialTitleLine1,
        }),
        ...(fields.editorialTitleLine2 !== undefined && {
          editorialTitleLine2: fields.editorialTitleLine2,
        }),
        ...(fields.editorialBody !== undefined && {
          editorialBody: fields.editorialBody,
        }),
        ...(fields.editorialCta !== undefined && {
          editorialCta: fields.editorialCta,
        }),
        ...(fields.faqTitle !== undefined && { faqTitle: fields.faqTitle }),
        ...(fields.faqSubtitle !== undefined && {
          faqSubtitle: fields.faqSubtitle,
        }),
        ...(fields.metaTitle !== undefined && { metaTitle: fields.metaTitle }),
        ...(fields.metaDescription !== undefined && {
          metaDescription: fields.metaDescription,
        }),
      },
      select: TRANSLATION_SELECT,
    });

    this.logger.log(`Admin ${adminId} upserted homepage copy [${locale}]`);
    // An English edit re-sources the other locales.
    if (locale === Locale.en) {
      this.contentTranslation.enqueue('homepage', HOME_ID);
    }
    return result;
  }

  // ── FAQs ────────────────────────────────────────────────────────────────────
  //
  // Thin delegation to the shared FaqGroupService, exactly like every other
  // entity that owns FAQs - the homepage is just another (pageType, entityId)
  // pair to it. `entityId` is always the singleton key; it stays in the route so
  // the dashboard's shared FaqManager/faqGroupsApi (which build
  // `{basePath}/{id}/faqs/groups`) work against this module unmodified.

  async getFaqGroups(entityId: string) {
    this.assertHomeId(entityId);
    return this.faqGroups.getGroups(FAQ_PAGE_TYPE.HOMEPAGE, HOME_ID);
  }

  async createFaqGroup(
    entityId: string,
    dto: CreateFaqGroupDto,
    adminId: string,
  ) {
    this.assertHomeId(entityId);
    await this.ensureRow();
    const group = await this.faqGroups.createGroup(
      FAQ_PAGE_TYPE.HOMEPAGE,
      HOME_ID,
      dto,
    );
    this.logger.log(`Admin ${adminId} added a homepage FAQ`);
    return group;
  }

  async updateFaqGroup(
    entityId: string,
    groupId: string,
    dto: UpdateFaqGroupDto,
    adminId: string,
  ) {
    this.assertHomeId(entityId);
    const group = await this.faqGroups.updateGroup(
      FAQ_PAGE_TYPE.HOMEPAGE,
      HOME_ID,
      groupId,
      dto,
    );
    this.logger.log(`Admin ${adminId} updated homepage FAQ ${groupId}`);
    return group;
  }

  async deleteFaqGroup(entityId: string, groupId: string, adminId: string) {
    this.assertHomeId(entityId);
    const result = await this.faqGroups.deleteGroup(
      FAQ_PAGE_TYPE.HOMEPAGE,
      HOME_ID,
      groupId,
    );
    this.logger.log(`Admin ${adminId} deleted homepage FAQ ${groupId}`);
    return result;
  }

  async upsertFaqTranslation(
    entityId: string,
    groupId: string,
    locale: Locale,
    dto: UpsertFaqTranslationDto,
    adminId: string,
  ) {
    this.assertHomeId(entityId);
    const translation = await this.faqGroups.upsertTranslation(
      FAQ_PAGE_TYPE.HOMEPAGE,
      HOME_ID,
      groupId,
      locale,
      dto,
    );
    this.logger.log(
      `Admin ${adminId} translated homepage FAQ ${groupId} [${locale}]`,
    );
    return translation;
  }

  /**
   * Clear ONE locale's copy of a homepage FAQ (Translation Console).
   * `question`/`answer` are NOT NULL, so deleting the row IS the cleared state
   * and the public page falls back to English; the shared service records a
   * clear mark so the AI cannot read the gap as "never translated".
   */
  async deleteFaqTranslation(
    entityId: string,
    groupId: string,
    locale: Locale,
    adminId: string,
  ) {
    this.assertHomeId(entityId);
    const result = await this.faqGroups.deleteTranslation(
      FAQ_PAGE_TYPE.HOMEPAGE,
      HOME_ID,
      groupId,
      locale,
    );
    this.logger.log(
      `Admin ${adminId} cleared homepage FAQ ${groupId} translation [${locale}]`,
    );
    return result;
  }

  /**
   * There is exactly one homepage, so the only valid entityId is the singleton
   * key. Rejecting anything else stops a typo writing orphan FAQ rows under a
   * `homepage` pageType that no page would ever read.
   */
  private assertHomeId(entityId: string) {
    if (entityId !== HOME_ID) {
      throw new NotFoundException(`Home page "${entityId}" not found`);
    }
  }

  /** Self-seed the singleton so translation writes always have a parent row. */
  private async ensureRow() {
    await this.prisma.homePage.upsert({
      where: { id: HOME_ID },
      update: {},
      create: { id: HOME_ID },
      select: { id: true },
    });
  }
}
