import { Locale } from '@/common/constants/locales';
import { clearableField, faqSelect } from '@/common/utils/translation.util';
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
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from './dto/faq-group.dto';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
  locale: Locale;
  faqGroupId: string | null;
};

/**
 * FaqGroupService — shared grouped-FAQ logic for every entity that owns FAQs
 * (destination, category, hub, collection). All operations are parameterized by
 * `(pageType, entityId)`, so a module's service delegates here after it has
 * verified the owning entity exists.
 *
 * A logical FAQ = one `faqGroupId` whose per-locale rows share the same question.
 * The English row is the base and carries the group's displayOrder / isActive.
 *
 * Dependencies: PrismaService (@Global).
 * Usage: inject via FaqModule; call from a module service that first checks the
 *        entity exists (e.g. `findDestinationOrThrow`) so 404s are accurate.
 */
@Injectable()
export class FaqGroupService {
  private readonly logger = new Logger(FaqGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly clearMarks: TranslationClearMarkService,
  ) {}

  private buildGroup(rows: FaqRow[]) {
    const groupId = rows[0].faqGroupId ?? rows[0].id;
    const base = rows.find((r) => r.locale === Locale.en) ?? rows[0];
    return {
      faqGroupId: groupId,
      displayOrder: base.displayOrder,
      isActive: base.isActive,
      // English first, then the remaining locales.
      translations: [...rows].sort((a, b) =>
        a.locale === Locale.en ? -1 : b.locale === Locale.en ? 1 : 0,
      ),
    };
  }

  private async getGroupRowsOrThrow(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
  ) {
    const rows = (await this.prisma.faq.findMany({
      where: { pageType, entityId, faqGroupId: groupId },
      select: faqSelect,
    })) as FaqRow[];
    if (rows.length === 0)
      throw new NotFoundException(`FAQ group ${groupId} not found`);
    return rows;
  }

  async getGroups(pageType: FaqPageType, entityId: string) {
    const rows = (await this.prisma.faq.findMany({
      where: { pageType, entityId },
      select: faqSelect,
      orderBy: [{ displayOrder: 'asc' }, { locale: 'asc' }],
    })) as FaqRow[];

    // Lazily migrate legacy rows (created before grouping) so each becomes its own
    // single-locale group and can be translated going forward.
    const legacy = rows.filter((r) => !r.faqGroupId);
    if (legacy.length > 0) {
      await Promise.all(
        legacy.map((r) =>
          this.prisma.faq.update({
            where: { id: r.id },
            data: { faqGroupId: r.id },
          }),
        ),
      );
      legacy.forEach((r) => {
        r.faqGroupId = r.id;
      });
    }

    const groups = new Map<string, FaqRow[]>();
    for (const row of rows) {
      const key = row.faqGroupId as string;
      const bucket = groups.get(key);
      if (bucket) bucket.push(row);
      else groups.set(key, [row]);
    }

    return [...groups.values()]
      .map((groupRows) => this.buildGroup(groupRows))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createGroup(
    pageType: FaqPageType,
    entityId: string,
    dto: CreateFaqGroupDto,
  ) {
    const faqGroupId = randomUUID();
    const row = await this.prisma.faq.create({
      data: {
        pageType,
        entityId,
        faqGroupId,
        locale: Locale.en,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(
      `Created FAQ group ${faqGroupId} for ${pageType} ${entityId}`,
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
    dto: UpsertFaqTranslationDto,
  ) {
    const rows = await this.getGroupRowsOrThrow(pageType, entityId, groupId);
    const base = rows.find((r) => r.locale === Locale.en) ?? rows[0];
    const existing = rows.find((r) => r.locale === locale);

    // Each field clears independently: a blank stores '' and KEEPS the row, so
    // the page falls back to English for that field alone (translate the answer
    // but not the question and both render correctly). English is refused - it
    // is what everything else falls back to.
    const question = clearableField(dto.question, locale, 'The question');
    const answer = clearableField(dto.answer, locale, 'The answer');

    // This is the HUMAN write path (dashboard) - it always resets the machine
    // bookkeeping, so the AI refresher never overwrites what was typed here.
    const row = existing
      ? await this.prisma.faq.update({
          where: { id: existing.id },
          data: {
            question,
            answer,
            isMachineTranslated: false,
            sourceHash: null,
          },
          select: faqSelect,
        })
      : await this.prisma.faq.create({
          data: {
            pageType,
            entityId,
            faqGroupId: groupId,
            locale,
            question,
            answer,
            // Group-level attributes are mirrored so every locale row stays in sync.
            displayOrder: base.displayOrder,
            isActive: base.isActive,
          },
          select: faqSelect,
        });

    this.logger.log(
      `Upserted FAQ group ${groupId} translation [${locale}] for ${pageType} ${entityId}`,
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
    dto: UpdateFaqGroupDto,
  ) {
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    // displayOrder / isActive are group-level: apply to every locale row at once.
    await this.prisma.faq.updateMany({
      where: { pageType, entityId, faqGroupId: groupId },
      data: {
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    this.logger.log(`Updated FAQ group ${groupId} for ${pageType} ${entityId}`);
    const rows = await this.getGroupRowsOrThrow(pageType, entityId, groupId);
    return this.buildGroup(rows);
  }

  /**
   * Remove ONE locale's row from a group - the Translation Console's "clear".
   * `Faq.question`/`answer` are NOT NULL, so a blank translation cannot be
   * stored: deleting the row IS the cleared state, and the public page falls
   * back to English. English is the source every locale derives from and is
   * refused here (delete the whole group instead).
   */
  async deleteTranslation(
    pageType: FaqPageType,
    entityId: string,
    groupId: string,
    locale: Locale,
  ) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'English is the source translation and cannot be cleared - delete the FAQ instead',
      );
    }
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    const { count } = await this.prisma.faq.deleteMany({
      where: { pageType, entityId, faqGroupId: groupId, locale },
    });

    // `Faq.question`/`answer` are NOT NULL, so the clear had to remove the
    // row - record it, or the next English edit reads the gap as "never
    // translated" and puts the FAQ back.
    await this.clearMarks.markForPageType(
      pageType,
      entityId,
      translationUnitKeys.faq(groupId),
      locale,
    );

    this.logger.log(
      `Deleted FAQ group ${groupId} translation [${locale}] for ${pageType} ${entityId}`,
    );
    // Nothing to re-source: the AI must not refill a deliberately cleared
    // translation (human rows are skipped outright by the policy).
    return { message: count > 0 ? 'Translation cleared' : 'Nothing to clear' };
  }

  async deleteGroup(pageType: FaqPageType, entityId: string, groupId: string) {
    await this.getGroupRowsOrThrow(pageType, entityId, groupId);

    await this.prisma.faq.deleteMany({
      where: { pageType, entityId, faqGroupId: groupId },
    });

    this.logger.log(`Deleted FAQ group ${groupId} for ${pageType} ${entityId}`);
    return { message: 'FAQ deleted successfully' };
  }
}
