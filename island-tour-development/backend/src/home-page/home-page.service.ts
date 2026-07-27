import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { PrismaService } from '@/prisma/prisma.service';
import { TourStatus } from '@prisma/client';
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
  async getPublic(locale: Locale) {
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
              // Caption and slug both come from the CATEGORY itself, in the
              // requested locale - never from an admin-typed string.
              category: {
                select: {
                  slug: true,
                  name: true,
                  isActive: true,
                  translations: { where: { locale }, select: { name: true } },
                },
              },
            },
            orderBy: EDITORIAL_CARDS.orderBy,
          },
          translations: {
            where: { locale },
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
    const copy = translations[0];

    // The island the whole banner points at - button AND cards.
    const island = await this.resolveEditorialIsland(
      base.editorialDestinationId,
      editorialDestination,
    );

    // Which of these categories actually has something bookable on that island.
    const bookable = await this.categoriesWithLiveTours(
      editorialCards
        .filter((c) => c.isLink && c.category?.isActive)
        .map((c) => c.categoryId)
        .filter((id): id is string => !!id),
      island?.id ?? null,
    );

    return {
      locale,
      heroImage: base.heroImage,
      editorialCards: editorialCards.map((card) => {
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

    const { editorialDestination, ...base } = row;
    return {
      ...base,
      /** The island the cards are gated against - the fallback, if none is pinned. */
      resolvedDestinationSlug: island?.slug ?? null,
      editorialCards: row.editorialCards.map((card) => ({
        ...card,
        hasLiveTours: card.categoryId ? bookable.has(card.categoryId) : false,
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

    // Every category a card points at must exist, for the same reason the CTA
    // target is checked: the FK would raise a 500-shaped Prisma error where the
    // admin needs a sentence.
    if (dto.editorialCards?.length) {
      await this.assertCardCategoriesExist(dto.editorialCards);
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
              categoryId: card.categoryId ?? null,
              // A link with nowhere to go is not a link. Normalising here means
              // the public resolver never has to special-case the pair.
              isLink: card.categoryId ? (card.isLink ?? true) : false,
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

  /** One query for the whole deck rather than one per card. */
  private async assertCardCategoriesExist(
    cards: { categoryId?: string | null }[],
  ) {
    const ids = [
      ...new Set(cards.map((c) => c.categoryId).filter((id) => !!id)),
    ] as string[];
    if (!ids.length) return;

    const found = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    const missing = ids.find((id) => !found.some((c) => c.id === id));
    if (missing) {
      throw new BadRequestException(`No category found with id "${missing}"`);
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
