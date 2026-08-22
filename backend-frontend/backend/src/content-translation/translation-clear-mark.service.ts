import { Injectable, Logger } from '@nestjs/common';
import type { FaqPageType, Locale } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { entityTypeForPageType } from './translation-unit-keys';
import type { ContentEntityType } from './content-translation.constants';

/**
 * Records and answers "did a human deliberately blank this locale here?".
 *
 * Every Translation-Console clear endpoint calls `mark()` after removing the
 * row; `EntityRegistry` calls `loadFor()` when collecting an entity, and
 * `ContentTranslationService` skips any (unit, locale) that comes back marked.
 * Without it a cleared FAQ / section / highlight is indistinguishable from an
 * untranslated one and the next English edit re-creates it (see
 * prisma/translation-clears.prisma for the full why).
 *
 * Marks are advisory bookkeeping, never user-visible data: a write failure is
 * logged and swallowed rather than failing the clear the admin asked for. The
 * worst case of a lost mark is the old behaviour (content comes back), not a
 * broken request.
 */
@Injectable()
export class TranslationClearMarkService {
  private readonly logger = new Logger(TranslationClearMarkService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Composite map key - `unitKey` may contain ':', so join on something else. */
  static mapKey(unitKey: string, locale: Locale): string {
    return `${unitKey}@@${locale}`;
  }

  /**
   * Remember that this unit was deliberately blanked in `locale`. Idempotent.
   * English is never marked: it is the source every locale derives from, and
   * the clear endpoints all refuse it before reaching here.
   */
  async mark(
    entityType: ContentEntityType,
    entityId: string,
    unitKey: string,
    locale: Locale,
    clearedBy?: string,
  ): Promise<void> {
    try {
      await this.prisma.translationClearMark.upsert({
        where: {
          entityType_entityId_unitKey_locale: {
            entityType,
            entityId,
            unitKey,
            locale,
          },
        },
        create: { entityType, entityId, unitKey, locale, clearedBy },
        update: { clearedBy },
      });
    } catch (err) {
      this.logger.warn(
        `Could not record the translation clear for ${entityType} ${entityId} ${unitKey} [${locale}]: ` +
          `${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  /** `mark()` for the pageType-shaped callers; no-op for unmapped types. */
  async markForPageType(
    pageType: FaqPageType,
    entityId: string,
    unitKey: string,
    locale: Locale,
    clearedBy?: string,
  ): Promise<void> {
    const entityType = entityTypeForPageType(pageType);
    if (!entityType) return;
    await this.mark(entityType, entityId, unitKey, locale, clearedBy);
  }

  /**
   * All marks for one entity, as `mapKey()` strings. One query per collect -
   * an entity has at most a handful of marks.
   */
  async loadFor(
    entityType: ContentEntityType,
    entityId: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.translationClearMark.findMany({
      where: { entityType, entityId },
      select: { unitKey: true, locale: true },
    });
    return new Set(
      rows.map((r) => TranslationClearMarkService.mapKey(r.unitKey, r.locale)),
    );
  }

  /**
   * Drop marks that no longer describe anything.
   *
   * A mark only means something while the row is ABSENT. Once a human types a
   * translation back in, the row itself carries the policy
   * (`isMachineTranslated: false` = hands off) and the mark is dead weight
   * that would wrongly suppress translation if the row were later replaced by
   * a wholesale editor save. Rather than hanging an `unmark()` call off all
   * ~20 upsert paths, the registry garbage-collects here on every collect.
   */
  async forget(
    entityType: ContentEntityType,
    entityId: string,
    pairs: Array<{ unitKey: string; locale: Locale }>,
  ): Promise<void> {
    if (pairs.length === 0) return;
    try {
      await this.prisma.translationClearMark.deleteMany({
        where: { entityType, entityId, OR: pairs },
      });
    } catch (err) {
      this.logger.warn(
        `Could not prune translation clear marks for ${entityType} ${entityId}: ` +
          `${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}
