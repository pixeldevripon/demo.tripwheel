import { sanitizePageHtml } from '@/common/utils/page-html.util';
import {
  normalizePagePath,
  RESERVED_PAGE_SLUGS,
} from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Locale, PageStatus, Prisma } from '@prisma/client';
import {
  CreatePageDto,
  UpdatePageDto,
  UpdatePageStatusDto,
  UpsertPageTranslationDto,
} from './dto/pages.dto';

const TRANSLATION_SELECT = {
  locale: true,
  title: true,
  body: true,
  metaTitle: true,
  metaDescription: true,
  isMachineTranslated: true,
  updatedAt: true,
} as const;

const PAGE_SELECT = {
  id: true,
  slug: true,
  status: true,
  publishedAt: true,
  ogImage: true,
  createdAt: true,
  updatedAt: true,
  translations: {
    select: TRANSLATION_SELECT,
    orderBy: { locale: 'asc' as const },
  },
  redirects: {
    select: { fromSlug: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type PageRow = Prisma.PageGetPayload<{ select: typeof PAGE_SELECT }>;

@Injectable()
export class PagesService {
  private readonly logger = new Logger(PagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public read ─────────────────────────────────────────────────────────────

  /**
   * Resolve one public permalink.
   *
   * Order matters: a real published page ALWAYS beats a redirect row with the
   * same slug (a reclaimed permalink must serve its new page, not bounce to
   * the old one). English is the fallback for any locale without a
   * translation — the legal source text is English and is never
   * machine-translated, so the frontend shows its "English only" notice via
   * `isEnglishFallback` rather than hiding the page.
   */
  async getPublicBySlug(slug: string, locale: Locale) {
    const page = await this.prisma.page.findUnique({
      where: { slug, status: PageStatus.PUBLISHED },
      select: {
        slug: true,
        ogImage: true,
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: TRANSLATION_SELECT,
        },
      },
    });

    if (page) {
      const requested = page.translations.find((t) => t.locale === locale);
      const english = page.translations.find((t) => t.locale === Locale.en);
      const copy = requested ?? english;

      // A published page with no English row should be impossible (the create
      // path writes it), but a page with NOTHING to render must 404 rather
      // than serve an empty shell.
      if (!copy) {
        throw new NotFoundException(`Page "${slug}" has no content`);
      }

      return {
        slug: page.slug,
        locale: copy.locale,
        title: copy.title,
        body: copy.body,
        metaTitle: copy.metaTitle,
        metaDescription: copy.metaDescription,
        ogImage: page.ogImage,
        isEnglishFallback: copy.locale !== locale,
        redirectToSlug: null,
      };
    }

    // Renamed permalink? Redirects point at the PAGE, so a twice-renamed page
    // still resolves in one hop — and an unpublished target kills the redirect
    // rather than bouncing a visitor onto a 404.
    const redirect = await this.prisma.pageRedirect.findUnique({
      where: { fromSlug: slug },
      select: {
        toPage: { select: { slug: true, status: true } },
      },
    });

    if (redirect && redirect.toPage.status === PageStatus.PUBLISHED) {
      return {
        slug,
        locale,
        title: '',
        body: '',
        metaTitle: null,
        metaDescription: null,
        ogImage: null,
        isEnglishFallback: false,
        redirectToSlug: redirect.toPage.slug,
      };
    }

    throw new NotFoundException(`Page "${slug}" not found`);
  }

  // ── Admin ───────────────────────────────────────────────────────────────────

  /** The dashboard list: every page with its English title for the column. */
  async list() {
    const pages = await this.prisma.page.findMany({
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
        translations: {
          where: { locale: Locale.en },
          select: { title: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pages.map(({ translations, ...page }) => ({
      ...page,
      title: translations[0]?.title ?? null,
    }));
  }

  async get(id: string) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: PAGE_SELECT,
    });
    if (!page) throw new NotFoundException(`Page ${id} not found`);
    return this.shape(page);
  }

  /**
   * Create a page as DRAFT with its English base translation in one
   * transaction — a page without English content is unrenderable on every
   * locale, so the pair is atomic.
   */
  async create(dto: CreatePageDto, adminId: string) {
    const slug = normalizePagePath(dto.slug ?? dto.title);
    if (!slug) {
      throw new BadRequestException(
        'Title/slug must contain at least one letter or number',
      );
    }
    await this.assertSlugAvailable(slug);

    const page = await this.prisma
      .$transaction(async (tx) => {
        // Reclaiming a permalink a redirect currently owns: the real page wins
        // resolution anyway (page-before-redirect), so the stale row would
        // only confuse the admin list. Clear it.
        await tx.pageRedirect.deleteMany({ where: { fromSlug: slug } });

        return tx.page.create({
          data: {
            slug,
            ogImage: dto.ogImage ?? null,
            translations: {
              create: {
                locale: Locale.en,
                title: dto.title,
                body: dto.body ? sanitizePageHtml(dto.body) : '',
                metaTitle: dto.metaTitle ?? null,
                metaDescription: dto.metaDescription ?? null,
              },
            },
          },
          select: PAGE_SELECT,
        });
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === 'P2002') {
          throw new ConflictException(`Page slug "${slug}" already exists`);
        }
        throw err;
      });

    this.logger.log(`Admin ${adminId} created page "${slug}" (${page.id})`);
    return this.shape(page);
  }

  /**
   * Locale-agnostic fields. A slug rename on a PUBLISHED page writes the 301
   * row in the same transaction — the old permalink is live, SEO-indexed and
   * possibly bookmarked, so it must never simply die. Draft renames write no
   * redirect: the URL was never public.
   */
  async update(id: string, dto: UpdatePageDto, adminId: string) {
    const existing = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true },
    });
    if (!existing) throw new NotFoundException(`Page ${id} not found`);

    const nextSlug =
      dto.slug !== undefined ? normalizePagePath(dto.slug) : existing.slug;
    const renaming = nextSlug !== existing.slug;

    if (renaming) {
      if (!nextSlug) {
        throw new BadRequestException(
          'Slug must contain at least one letter or number',
        );
      }
      await this.assertSlugAvailable(nextSlug);
    }

    const page = await this.prisma
      .$transaction(async (tx) => {
        if (renaming) {
          // The new slug may be a fromSlug of an old redirect (including one
          // that points at THIS page — renaming back). Reclaim it.
          await tx.pageRedirect.deleteMany({ where: { fromSlug: nextSlug } });

          if (existing.status === PageStatus.PUBLISHED) {
            await tx.pageRedirect.create({
              data: { fromSlug: existing.slug, toPageId: existing.id },
            });
          }
        }

        return tx.page.update({
          where: { id },
          data: {
            ...(renaming && { slug: nextSlug }),
            ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
          },
          select: PAGE_SELECT,
        });
      })
      .catch((err: unknown) => {
        if ((err as { code?: string })?.code === 'P2002') {
          throw new ConflictException(`Page slug "${nextSlug}" already exists`);
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} updated page ${id}` +
        (renaming
          ? ` (slug "${existing.slug}" → "${nextSlug}", 301 kept)`
          : ''),
    );
    return this.shape(page);
  }

  /**
   * Publish lifecycle. `publishedAt` records the FIRST time the page went
   * live and survives unpublish/republish cycles — it answers "since when has
   * this policy existed", not "when was the toggle last flipped".
   */
  async updateStatus(id: string, dto: UpdatePageStatusDto, adminId: string) {
    const existing = await this.prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        publishedAt: true,
        translations: {
          where: { locale: Locale.en },
          select: { title: true, body: true },
        },
      },
    });
    if (!existing) throw new NotFoundException(`Page ${id} not found`);

    // A page with no English content would publish as an empty shell on every
    // locale. Refuse with a sentence rather than let the public read 404.
    const english = existing.translations[0];
    if (
      dto.status === PageStatus.PUBLISHED &&
      (!english || !english.title.trim() || !english.body.trim())
    ) {
      throw new BadRequestException(
        'Cannot publish: the page needs an English title and body first',
      );
    }

    const page = await this.prisma.page.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === PageStatus.PUBLISHED &&
          !existing.publishedAt && { publishedAt: new Date() }),
      },
      select: PAGE_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} set page "${existing.slug}" → ${dto.status}`,
    );
    return this.shape(page);
  }

  /**
   * Hard delete. PUBLISHED pages are refused: deleting a live permalink kills
   * a public URL (for the legal pages, one linked from the footer of every
   * page) with no trace. Unpublish first — that is the reversible step.
   */
  async remove(id: string, adminId: string) {
    const existing = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true },
    });
    if (!existing) throw new NotFoundException(`Page ${id} not found`);

    if (existing.status === PageStatus.PUBLISHED) {
      throw new ConflictException(
        'Cannot delete a published page — unpublish it first',
      );
    }

    // Translations and redirect rows cascade with the page.
    await this.prisma.page.delete({ where: { id } });

    this.logger.log(`Admin ${adminId} deleted page "${existing.slug}" (${id})`);
    return { message: 'Page deleted successfully' };
  }

  /**
   * Per-locale content, `{ fields }` wrapper like every other entity. The
   * body is sanitized HERE — the write path is the single gate that makes the
   * stored HTML safe to render everywhere without a client sanitizer.
   */
  async upsertTranslation(
    id: string,
    locale: Locale,
    dto: UpsertPageTranslationDto,
    adminId: string,
  ) {
    const page = await this.prisma.page.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!page) throw new NotFoundException(`Page ${id} not found`);

    const { fields, isMachineTranslated } = dto;
    const body =
      fields.body !== undefined ? sanitizePageHtml(fields.body) : undefined;

    // A brand-new locale row needs something to stand on; PATCH semantics
    // only make sense against an existing row.
    const exists = await this.prisma.pageTranslation.findUnique({
      where: { pageId_locale: { pageId: id, locale } },
      select: { id: true },
    });
    if (!exists && (fields.title === undefined || body === undefined)) {
      throw new BadRequestException(
        `No ${locale} translation exists yet — provide both title and body to create it`,
      );
    }

    const result = await this.prisma.pageTranslation.upsert({
      where: { pageId_locale: { pageId: id, locale } },
      create: {
        pageId: id,
        locale,
        title: fields.title!,
        body: body!,
        metaTitle: fields.metaTitle ?? null,
        metaDescription: fields.metaDescription ?? null,
        isMachineTranslated: isMachineTranslated ?? false,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        ...(fields.title !== undefined && { title: fields.title }),
        ...(body !== undefined && { body }),
        ...(fields.metaTitle !== undefined && { metaTitle: fields.metaTitle }),
        ...(fields.metaDescription !== undefined && {
          metaDescription: fields.metaDescription,
        }),
      },
      select: TRANSLATION_SELECT,
    });

    this.logger.log(
      `Admin ${adminId} upserted page "${page.slug}" content [${locale}]`,
    );
    return result;
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  /**
   * The bidirectional half of the fall-through contract, applied to the FIRST
   * segment of the permalink path (`legal/terms` → `legal`): a page must not
   * sit under (a) a hard-coded route that survived the Pages migration, or
   * (b) an existing destination — the destination/entity resolvers run FIRST
   * at those depths, so the page would silently never render.
   * (destinations.service holds the mirror check against existing pages.)
   */
  private async assertSlugAvailable(slug: string) {
    const firstSegment = slug.split('/')[0];

    if (RESERVED_PAGE_SLUGS.has(firstSegment)) {
      throw new ConflictException(
        `Page slug "${slug}" is reserved for a platform route`,
      );
    }

    const destination = await this.prisma.destination.findUnique({
      where: { slug: firstSegment },
      select: { id: true },
    });
    if (destination) {
      throw new ConflictException(
        `Page slug "${slug}" starts with the destination "${firstSegment}" — the page would be unreachable behind it`,
      );
    }
  }

  private shape(page: PageRow) {
    const { redirects, ...rest } = page;
    return {
      ...rest,
      redirectFromSlugs: redirects.map((r) => r.fromSlug),
    };
  }
}
