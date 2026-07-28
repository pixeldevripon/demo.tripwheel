import { clearableField } from '@/common/utils/translation.util';
import { Locale } from '@/common/constants/locales';
import { PrismaService } from '@/prisma/prisma.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { TranslationClearMarkService } from '@/content-translation/translation-clear-mark.service';
import { translationUnitKeys } from '@/content-translation/translation-unit-keys';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { FaqPageType } from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  CreatePageContentSectionDto,
  UpdatePageContentSectionDto,
  UpsertPageContentSectionTranslationDto,
} from './dto/page-content-section.dto';

/** The columns every read here selects. */
export const pageContentSectionSelect = {
  id: true,
  heading: true,
  body: true,
  sectionKey: true,
  sectionGroupId: true,
  displayOrder: true,
  isActive: true,
  locale: true,
} as const;

type SectionRow = {
  id: string;
  heading: string;
  body: string;
  sectionKey: string | null;
  sectionGroupId: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
};

/**
 * PageContentSectionService - shared authored-section logic for every entity page
 * that renders heading + body blocks. All operations are parameterized by
 * `(pageType, entityId)`, so a module's service delegates here after it has
 * verified the owning entity exists.
 *
 * A logical section = one `sectionGroupId` whose per-locale rows are translations
 * of each other. The English row is the base and carries the group-level
 * attributes (displayOrder, isActive, sectionKey); the other locale rows
 * mirror them so any row can be read standalone.
 *
 * Dependencies: PrismaService (@Global).
 * Usage: inject via PageContentSectionModule; call from a module service that
 *        first checks the entity exists (e.g. `findDestinationOrThrow`) so 404s
 *        are accurate.
 */
@Injectable()
export class PageContentSectionService {
  private readonly logger = new Logger(PageContentSectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly clearMarks: TranslationClearMarkService,
  ) {}

  private buildGroup(rows: SectionRow[]) {
    const base = rows.find((r) => r.locale === Locale.en) ?? rows[0];
    return {
      sectionGroupId: base.sectionGroupId,
      sectionKey: base.sectionKey,
      displayOrder: base.displayOrder,
      isActive: base.isActive,
      // English first, then the remaining locales.
      translations: [...rows]
        .sort((a, b) =>
          a.locale === Locale.en ? -1 : b.locale === Locale.en ? 1 : 0,
        )
        .map(({ id, heading, body, locale }) => ({
          id,
          heading,
          body,
          locale,
        })),
    };
  }

  private async getGroupRowsOrThrow(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
  ) {
    const rows = (await this.prisma.pageContentSection.findMany({
      where: { pageType, entityId, sectionGroupId: groupId },
      select: pageContentSectionSelect,
    })) as SectionRow[];
    if (rows.length === 0)
      throw new NotFoundException(`Content section ${groupId} not found`);
    return rows;
  }

  async getGroups(pageType: FaqPageType, entityId: string) {
    const rows = (await this.prisma.pageContentSection.findMany({
      where: { pageType, entityId },
      select: pageContentSectionSelect,
      orderBy: [{ displayOrder: 'asc' }, { locale: 'asc' }],
    })) as SectionRow[];

    const groups = new Map<string, SectionRow[]>();
    for (const row of rows) {
      const bucket = groups.get(row.sectionGroupId);
      if (bucket) bucket.push(row);
      else groups.set(row.sectionGroupId, [row]);
    }

    return [...groups.values()]
      .map((groupRows) => this.buildGroup(groupRows))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createGroup(
    pageType: FaqPageType,
    entityId: string,
    dto: CreatePageContentSectionDto,
  ) {
    const sectionGroupId = randomUUID();
    const row = await this.prisma.pageContentSection.create({
      data: {
        pageType,
        entityId,
        sectionGroupId,
        locale: Locale.en,
        heading: dto.heading,
        body: dto.body,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: pageContentSectionSelect,
    });

    this.logger.log(
      `Created content section ${sectionGroupId} for ${pageType} ${entityId}`,
    );
    // A new English source was born - queue the AI translation fan-out.
    this.contentTranslation.enqueueForPageType(pageType, entityId);
    return this.buildGroup([row]);
  }

  async upsertTranslation(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
    locale: Locale,
    dto: UpsertPageContentSectionTranslationDto,
  ) {
    const rows = await this.getGroupRowsOrThrow(pageType, entityId, groupId);
    const base = rows.find((r) => r.locale === Locale.en) ?? rows[0];
    const existing = rows.find((r) => r.locale === locale);

    // Heading and body clear independently: a blank stores '' and keeps the
    // row, so that one field falls back to English. See `clearableField`.
    const heading = clearableField(dto.heading, locale, 'The heading');
    const body = clearableField(dto.body, locale, 'The body');

    // This is the HUMAN write path (dashboard) - it always resets the machine
    // bookkeeping, so the AI refresher never overwrites what was typed here.
    const row = existing
      ? await this.prisma.pageContentSection.update({
          where: { id: existing.id },
          data: {
            heading,
            body,
            isMachineTranslated: false,
            sourceHash: null,
          },
          select: pageContentSectionSelect,
        })
      : await this.prisma.pageContentSection.create({
          data: {
            pageType,
            entityId,
            sectionGroupId: groupId,
            locale,
            heading,
            body,
            // Group-level attributes are mirrored so every locale row stays in
            // sync and can be read standalone.
            sectionKey: base.sectionKey,
            displayOrder: base.displayOrder,
            isActive: base.isActive,
          },
          select: pageContentSectionSelect,
        });

    this.logger.log(
      `Upserted content section ${groupId} translation [${locale}] for ${pageType} ${entityId}`,
    );
    // An English edit re-sources the group's other locales.
    if (locale === Locale.en) {
      this.contentTranslation.enqueueForPageType(pageType, entityId);
    }
    return row;
  }

  async updateGroup(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
    dto: UpdatePageContentSectionDto,
  ) {
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    // displayOrder / isActive are group-level: apply to every locale row at once.
    await this.prisma.pageContentSection.updateMany({
      where: { pageType, entityId, sectionGroupId: groupId },
      data: {
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(
      `Updated content section ${groupId} for ${pageType} ${entityId}`,
    );
    const rows = await this.getGroupRowsOrThrow(pageType, entityId, groupId);
    return this.buildGroup(rows);
  }

  /**
   * Remove ONE locale's row from a section - the Translation Console's
   * "clear". `heading`/`body` are NOT NULL, so a blank translation cannot be
   * stored: deleting the row IS the cleared state, and the public page falls
   * back to English. English is the source and is refused here.
   */
  async deleteTranslation(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
    locale: Locale,
  ) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'English is the source translation and cannot be cleared - delete the section instead',
      );
    }
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    const { count } = await this.prisma.pageContentSection.deleteMany({
      where: { pageType, entityId, sectionGroupId: groupId, locale },
    });

    // heading/body are NOT NULL - the clear removed the row, so the mark is
    // the only record that this locale is meant to stay blank.
    await this.clearMarks.markForPageType(
      pageType,
      entityId,
      translationUnitKeys.section(groupId),
      locale,
    );

    this.logger.log(
      `Deleted content section ${groupId} translation [${locale}] for ${pageType} ${entityId}`,
    );
    return { message: count > 0 ? 'Translation cleared' : 'Nothing to clear' };
  }

  async deleteGroup(pageType: FaqPageType, entityId: string, groupId: string) {
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    await this.prisma.pageContentSection.deleteMany({
      where: { pageType, entityId, sectionGroupId: groupId },
    });

    this.logger.log(
      `Deleted content section ${groupId} for ${pageType} ${entityId}`,
    );
    return { message: 'Content section deleted successfully' };
  }
}
