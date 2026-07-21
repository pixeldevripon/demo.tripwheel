import { Locale } from '@/common/constants/locales';
import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  anchor: true,
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
  anchor: string | null;
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
 * attributes (displayOrder, isActive, anchor, sectionKey); the other locale rows
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

  constructor(private readonly prisma: PrismaService) {}

  private buildGroup(rows: SectionRow[]) {
    const base = rows.find((r) => r.locale === Locale.en) ?? rows[0];
    return {
      sectionGroupId: base.sectionGroupId,
      sectionKey: base.sectionKey,
      anchor: base.anchor,
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
        anchor: dto.anchor || null,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: pageContentSectionSelect,
    });

    this.logger.log(
      `Created content section ${sectionGroupId} for ${pageType} ${entityId}`,
    );
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

    const row = existing
      ? await this.prisma.pageContentSection.update({
          where: { id: existing.id },
          data: { heading: dto.heading, body: dto.body },
          select: pageContentSectionSelect,
        })
      : await this.prisma.pageContentSection.create({
          data: {
            pageType,
            entityId,
            sectionGroupId: groupId,
            locale,
            heading: dto.heading,
            body: dto.body,
            // Group-level attributes are mirrored so every locale row stays in
            // sync and can be read standalone.
            sectionKey: base.sectionKey,
            anchor: base.anchor,
            displayOrder: base.displayOrder,
            isActive: base.isActive,
          },
          select: pageContentSectionSelect,
        });

    this.logger.log(
      `Upserted content section ${groupId} translation [${locale}] for ${pageType} ${entityId}`,
    );
    return row;
  }

  async updateGroup(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
    dto: UpdatePageContentSectionDto,
  ) {
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    // anchor / displayOrder / isActive are group-level: apply to every locale row
    // at once. An empty-string anchor clears it.
    await this.prisma.pageContentSection.updateMany({
      where: { pageType, entityId, sectionGroupId: groupId },
      data: {
        ...(dto.anchor !== undefined && { anchor: dto.anchor || null }),
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
