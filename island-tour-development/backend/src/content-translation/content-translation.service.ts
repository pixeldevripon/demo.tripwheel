import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Locale } from '@prisma/client';
import { TARGET_LOCALES } from '@/common/constants/translation.constants';
import { PrismaService } from '@/prisma/prisma.service';
import { PublicCacheService } from '@/workers/public-cache.service';
import { ContentTranslationEnqueuer } from './content-translation.enqueuer';
import { EntityRegistry, type TranslationUnit } from './entity-registry';
import {
  TRANSLATION_PROVIDER,
  type TranslatableValue,
  type TranslationProvider,
} from './providers/translation-provider.interface';
import type { ContentEntityType } from './content-translation.constants';

/**
 * Orchestrates AI translation of one entity: collect units (registry) ->
 * decide what is pending (protect-human-edits + sourceHash cache) -> ONE
 * provider call per target locale -> write back -> bust the public cache.
 *
 * ## The overwrite policy (founder, 2026-07-27; revised 2026-07-28)
 * Per unit x locale:
 * - no row                                  -> translate and write (machine)
 * - machine row built from THIS source      -> skip (free re-run)
 * - machine row built from an older source  -> refresh (machine)
 * - human row                               -> SKIP ENTIRELY, empty fields
 *   included. A human-saved row is owned by the human: a field they cleared
 *   and saved STAYS cleared (the public page falls back to English), and the
 *   AI never writes into that row again unless `force` is used.
 * - no row, but a clear mark               -> skip. Where a blank cannot be
 *   stored (NOT NULL FAQ / section / hub-curation / tour-child rows) the
 *   console clears by DELETING the row, so the gap needs the mark to be told
 *   apart from "never translated". See prisma/translation-clears.prisma.
 * Machine writes always set isMachineTranslated=true + the source hash; the
 * HTTP upsert paths (human saves) always reset the flag - that split is the
 * whole contract.
 *
 * The old behaviour gap-filled empty fields on human rows, reading "empty" as
 * "please translate this" (the clear-save-Translate workflow of the day). The
 * per-field AI icon and the per-card "Translate section" button replaced that
 * workflow, and gap-fill made an intentional clear impossible - it silently
 * refilled on the next English edit or nightly sweep. Do not reintroduce it.
 *
 * ## Error contract
 * A provider failure THROWS: the queue processor relies on it for BullMQ
 * retry, and the manual controller maps it to a 502-style error. Locales
 * already written before the throw stay written - the sourceHash cache makes
 * the retry skip them.
 */

export interface TranslateEntityResult {
  entityType: ContentEntityType;
  entityId: string;
  /** Unit x locale writes performed. */
  written: number;
  /** Unit x locale pairs skipped by the policy (human rows + hash hits). */
  skipped: number;
  /** Set when nothing could be attempted, for the caller to surface. */
  reason?: 'not_configured' | 'not_found';
}

/** Public-cache tags per entity type - must exist in the frontend vocabulary. */
function cacheTags(entityType: ContentEntityType, entityId: string): string[] {
  switch (entityType) {
    case 'tour':
      return [`tour:${entityId}`, 'tours', 'search'];
    case 'destination':
      return [`destination:${entityId}`, 'destinations'];
    case 'hub':
      return [`hub:${entityId}`, 'hubs'];
    case 'category':
      return [`category:${entityId}`, 'categories'];
    case 'collection':
      return [`collection:${entityId}`, 'collections'];
    case 'homepage':
      return ['homepage'];
  }
}

@Injectable()
export class ContentTranslationService {
  private readonly logger = new Logger(ContentTranslationService.name);
  private warnedUnconfigured = false;

  constructor(
    private readonly registry: EntityRegistry,
    private readonly publicCache: PublicCacheService,
    @Inject(TRANSLATION_PROVIDER)
    private readonly provider: TranslationProvider,
    private readonly prisma: PrismaService,
    private readonly enqueuer: ContentTranslationEnqueuer,
  ) {}

  /** SHA-1 of a unit's source - the "has this already been done" cache key. */
  static hash(source: Record<string, TranslatableValue>): string {
    return createHash('sha1').update(JSON.stringify(source)).digest('hex');
  }

  /**
   * Translate one entity into the given locales (default: all six non-EN).
   * Idempotent: a second run over an unchanged source writes nothing.
   *
   * `force` (manual button only, behind an explicit confirmation): human rows
   * are fully RE-translated and re-stamped machine instead of gap-filled.
   * Background jobs and the nightly sweep never force.
   */
  async translateEntity(
    entityType: ContentEntityType,
    entityId: string,
    locales?: Locale[],
    force = false,
  ): Promise<TranslateEntityResult> {
    const base = { entityType, entityId };

    if (!(await this.provider.isConfigured())) {
      if (!this.warnedUnconfigured) {
        this.warnedUnconfigured = true;
        this.logger.warn(
          'AI translation is not configured (no provider API key in dashboard or env) - ' +
            'content translation is inert. Content displays in English only.',
        );
      }
      return { ...base, written: 0, skipped: 0, reason: 'not_configured' };
    }

    const units = await this.registry.collect(entityType, entityId);
    if (units === null) {
      // Deleted while the job sat in the queue - done, not an error.
      return { ...base, written: 0, skipped: 0, reason: 'not_found' };
    }

    const targets = (locales ?? TARGET_LOCALES).filter((l) => l !== Locale.en);

    let written = 0;
    let skipped = 0;
    for (const locale of targets) {
      // Every pending write is a MACHINE write: human rows are skipped
      // outright above, so there is no partial/gap-fill shape any more.
      const pending: Array<{
        unit: TranslationUnit;
        hash: string;
        /** Source fields to translate for this locale. */
        fields: string[];
      }> = [];
      for (const unit of units) {
        const sourceFields = Object.keys(unit.source);
        if (sourceFields.length === 0) continue; // nothing to say
        const hash = ContentTranslationService.hash(unit.source);
        const existing = unit.existing[locale];
        if (existing && !existing.isMachineTranslated && !force) {
          // Human row: hands off, empty fields included. A field cleared and
          // saved in the console is a deliberate "show English here" - the AI
          // must not read it as a gap to fill. `force` (confirmed manual
          // click) falls through to a full machine rewrite instead.
          skipped++;
          continue;
        }
        if (!existing && unit.cleared?.[locale] && !force) {
          // No row, but the console recorded a deliberate clear here. The
          // NOT NULL surfaces (FAQ, sections, hub curation, tour children)
          // cannot store a blank, so clearing DELETES the row - without this
          // mark the gap reads as "never translated" and we would helpfully
          // put the content back. The page falls back to English by design.
          skipped++;
          continue;
        }
        // Machine-made and built from THIS source -> nothing to do (holds in
        // force mode too: a fresh run over the same source is the same text).
        if (existing?.isMachineTranslated && existing.sourceHash === hash) {
          skipped++;
          continue;
        }
        pending.push({ unit, hash, fields: sourceFields });
      }
      if (pending.length === 0) continue;

      // One provider call per locale: every pending unit's requested fields,
      // flattened under "<unitKey>.<field>" (neither part contains a dot).
      const payload: Record<string, TranslatableValue> = {};
      for (const { unit, fields } of pending) {
        for (const field of fields) {
          payload[`${unit.key}.${field}`] = unit.source[field];
        }
      }

      const translated = await this.provider.translateFields(
        payload,
        Locale.en,
        locale,
      );

      for (const { unit, hash, fields } of pending) {
        const values: Record<string, TranslatableValue> = {};
        for (const field of fields) {
          const value = translated[`${unit.key}.${field}`];
          if (value !== undefined) values[field] = value;
        }
        await unit.write(locale, values, hash, true);
        written++;
      }
    }

    if (written > 0) {
      this.logger.log(
        `Translated ${entityType} ${entityId}: ${written} unit-locale write(s), ${skipped} skipped`,
      );
      // Best effort - PublicCacheService never throws.
      await this.publicCache.revalidateTags(cacheTags(entityType, entityId));
    }
    return { ...base, written, skipped };
  }

  /**
   * Nightly backfill sweep: re-enqueue the most recently updated entities per
   * type. This is what recovers (a) edits lost to the active-job dedup race,
   * (b) entities created before the feature shipped, and (c) locales dropped
   * by a provider outage. Bounded per type, and cheap by design - an entity
   * whose locales are all current costs zero provider calls (sourceHash).
   */
  async enqueuePending(limitPerType = 10): Promise<{ enqueued: number }> {
    if (!(await this.provider.isConfigured())) return { enqueued: 0 };

    const recent = {
      orderBy: { updatedAt: 'desc' },
      take: limitPerType,
    } as const;
    const [tours, destinations, hubs, categories, collections, home] =
      await Promise.all([
        this.prisma.tour.findMany({ select: { id: true }, ...recent }),
        this.prisma.destination.findMany({ select: { id: true }, ...recent }),
        this.prisma.hub.findMany({ select: { id: true }, ...recent }),
        this.prisma.category.findMany({ select: { id: true }, ...recent }),
        this.prisma.collection.findMany({ select: { id: true }, ...recent }),
        this.prisma.homePage.findFirst({ select: { id: true } }),
      ]);

    const jobs: Array<[ContentEntityType, string]> = [
      ...tours.map(({ id }): [ContentEntityType, string] => ['tour', id]),
      ...destinations.map(({ id }): [ContentEntityType, string] => [
        'destination',
        id,
      ]),
      ...hubs.map(({ id }): [ContentEntityType, string] => ['hub', id]),
      ...categories.map(({ id }): [ContentEntityType, string] => [
        'category',
        id,
      ]),
      ...collections.map(({ id }): [ContentEntityType, string] => [
        'collection',
        id,
      ]),
      ...(home ? [['homepage', home.id] as [ContentEntityType, string]] : []),
    ];
    for (const [entityType, entityId] of jobs) {
      this.enqueuer.enqueue(entityType, entityId);
    }
    return { enqueued: jobs.length };
  }
}
