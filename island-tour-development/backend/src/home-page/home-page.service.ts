import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { PrismaService } from '@/prisma/prisma.service';
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
  editorialImages: true,
  editorialDestinationId: true,
  ogImage: true,
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
        editorialImages: [],
        editorialDestinationSlug: null,
        ogImage: null,
        ...EMPTY_COPY,
        faqs,
      };
    }

    const { editorialDestination, translations, ...base } = row;
    const copy = translations[0];

    return {
      locale,
      heroImage: base.heroImage,
      editorialImages: base.editorialImages,
      // An archived island must not be advertised on the homepage - fall back to
      // the frontend's own resolution rather than linking somewhere that 404s.
      editorialDestinationSlug: editorialDestination?.isActive
        ? editorialDestination.slug
        : null,
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
    return this.prisma.homePage.upsert({
      where: { id: HOME_ID },
      update: {},
      create: { id: HOME_ID },
      select: {
        ...BASE_SELECT,
        translations: {
          select: TRANSLATION_SELECT,
          orderBy: { locale: 'asc' },
        },
      },
    });
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

    const result = await this.prisma.homePage.upsert({
      where: { id: HOME_ID },
      create: {
        id: HOME_ID,
        heroImage: dto.heroImage,
        editorialImages: dto.editorialImages ?? [],
        editorialDestinationId: dto.editorialDestinationId,
        ogImage: dto.ogImage,
      },
      update: {
        ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
        ...(dto.editorialImages !== undefined && {
          editorialImages: dto.editorialImages,
        }),
        ...(dto.editorialDestinationId !== undefined && {
          editorialDestinationId: dto.editorialDestinationId,
        }),
        ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
      },
      select: BASE_SELECT,
    });

    this.logger.log(`Admin ${adminId} updated homepage content`);
    return result;
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
