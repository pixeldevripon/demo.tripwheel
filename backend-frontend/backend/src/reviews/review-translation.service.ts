import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Locale, ReviewModerationStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { TARGET_LOCALES } from '@/common/constants/translation.constants';
import {
  TRANSLATION_PROVIDER,
  type TranslationProvider,
} from '@/content-translation/providers/translation-provider.interface';

/**
 * LD32 - machine translation of review text.
 *
 * ## Provider
 * The master's §4.7.18 originally named Google Translate; the founder switched
 * every AI translation surface to the shared provider (Gemini, 2026-07-27) so
 * content and reviews ride one credential and one client. This service owns
 * WHAT gets translated; the injected TRANSLATION_PROVIDER owns HOW.
 *
 * ## What it will not do
 * - **Never translates the original away.** The row a guest actually wrote
 *   (`isMachineTranslated = false`) is the source and is never overwritten.
 * - **Never re-translates an unchanged source.** Every written row records the
 *   SHA-1 of the text it came from; a run that finds a matching hash skips the
 *   call. Without that this is not a cache, it is a recurring bill for identical
 *   output.
 * - **Never translates an unapproved review.** Paying to translate something
 *   that may be rejected is waste, and a HELD review has not earned publication
 *   in any language.
 * - **Never blocks moderation.** Approval enqueues; it does not await six
 *   network calls inside a transaction.
 *
 * ## When unconfigured
 * With no API key the whole feature is inert: `isEnabled` is false, the job is a
 * no-op and the endpoint returns a clear 400. Reviews still display in their
 * original language, which is exactly the pre-LD32 behaviour - a missing key
 * degrades the page, it does not break it.
 */

/** BullMQ queue name for the LD32 translation worker. */
export const REVIEW_TRANSLATION_QUEUE = 'review-translation';

export interface TranslateResult {
  reviewId: string;
  written: number;
  skipped: number;
  /** Set when nothing could be done, for the caller to surface. */
  reason?: string;
}

@Injectable()
export class ReviewTranslationService {
  private readonly logger = new Logger(ReviewTranslationService.name);
  private warnedUnconfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSLATION_PROVIDER)
    private readonly provider: TranslationProvider,
  ) {}

  /** SHA-1 of a source string - the cache key for "has this already been done". */
  static hash(text: string): string {
    return createHash('sha1').update(text).digest('hex');
  }

  /**
   * Translate one review into every locale it is missing.
   *
   * Idempotent: a second call with an unchanged source writes nothing.
   */
  async translateReview(reviewId: string): Promise<TranslateResult> {
    if (!(await this.provider.isConfigured())) {
      if (!this.warnedUnconfigured) {
        this.warnedUnconfigured = true;
        this.logger.warn(
          'AI translation is not configured (no provider API key in dashboard or env) - ' +
            'review translation (LD32) is inert. Reviews display in their original language.',
        );
      }
      return { reviewId, written: 0, skipped: 0, reason: 'not_configured' };
    }

    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        moderationStatus: true,
        translations: {
          select: {
            id: true,
            locale: true,
            comment: true,
            isMachineTranslated: true,
            sourceHash: true,
          },
        },
      },
    });
    if (!review) throw new NotFoundException('Review not found');

    // Only approved reviews are worth paying to translate.
    if (review.moderationStatus !== ReviewModerationStatus.APPROVED) {
      return { reviewId, written: 0, skipped: 0, reason: 'not_approved' };
    }

    const source = this.resolveSource(review.translations);
    if (!source || !source.comment.trim()) {
      // A star-only review has no text. Not an error - most of the point of the
      // one-tap flow is that such reviews exist.
      return { reviewId, written: 0, skipped: 0, reason: 'no_source_text' };
    }

    const sourceHash = ReviewTranslationService.hash(source.comment);
    const byLocale = new Map(review.translations.map((t) => [t.locale, t]));

    const pending = TARGET_LOCALES.filter((locale) => {
      if (locale === source.locale) return false;
      const existing = byLocale.get(locale);
      if (!existing) return true;
      // Present, machine-made, and built from THIS source text -> nothing to do.
      if (existing.isMachineTranslated && existing.sourceHash === sourceHash) {
        return false;
      }
      // Never overwrite a human-authored translation with machine output.
      if (!existing.isMachineTranslated) return false;
      return true;
    });

    const skipped = TARGET_LOCALES.length - 1 - pending.length;
    if (pending.length === 0) {
      return { reviewId, written: 0, skipped };
    }

    let written = 0;
    for (const locale of pending) {
      // Catch-and-skip preserves the original contract: a provider outage or
      // rejected output skips THIS locale (backfill retries later) instead of
      // failing the whole job. The content pipeline relies on throws for its
      // BullMQ retry; this one deliberately does not.
      const translated = await this.provider
        .translateText(source.comment, source.locale, locale)
        .catch((err: unknown) => {
          this.logger.error(
            `Translate review ${reviewId} -> ${locale} failed: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
          return null;
        });
      if (!translated) continue;

      await this.prisma.reviewTranslation.upsert({
        where: { reviewId_locale: { reviewId: review.id, locale } },
        create: {
          reviewId: review.id,
          locale,
          comment: translated,
          isMachineTranslated: true,
          sourceHash,
        },
        update: {
          comment: translated,
          isMachineTranslated: true,
          sourceHash,
        },
      });
      written++;
    }

    if (written > 0) {
      this.logger.log(
        `Review ${reviewId}: translated into ${written} locale(s) from ${source.locale}`,
      );
    }
    return { reviewId, written, skipped };
  }

  /**
   * The row the guest actually wrote.
   *
   * `isMachineTranslated = false` is the marker. Falling back to EN and then to
   * whatever exists keeps pre-LD32 rows workable - the demo seed wrote every
   * locale with the flag set on non-EN, so EN is the source there.
   */
  private resolveSource<
    T extends { locale: Locale; comment: string; isMachineTranslated: boolean },
  >(translations: T[]): T | null {
    return (
      translations.find((t) => !t.isMachineTranslated) ??
      translations.find((t) => t.locale === Locale.en) ??
      translations[0] ??
      null
    );
  }

  /**
   * Fire-and-forget enqueue, used by the moderation path.
   *
   * Swallows its own failure by design: BullMQ needs Redis, and if Redis is
   * down the correct outcome is an untranslated review, not a failed approval.
   * The backfill pass picks it up later either way.
   */
  async enqueue(queue: Queue | undefined, reviewId: string): Promise<void> {
    if (!queue) return;
    if (!(await this.provider.isConfigured())) return;
    try {
      await queue.add(
        'translate',
        { reviewId },
        {
          // De-duplicates repeat approvals of the same review.
          jobId: reviewId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 500,
          removeOnFail: 1000,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Could not enqueue translation for review ${reviewId}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }

  /**
   * Backfill pass: approved reviews with text that are missing at least one
   * locale. Bounded per run so a first pass over a large backlog cannot empty a
   * translation quota (or a budget) in one go.
   */
  async translatePending(
    limit = 50,
  ): Promise<{ processed: number; written: number }> {
    if (!(await this.provider.isConfigured())) {
      return { processed: 0, written: 0 };
    }

    const candidates = await this.prisma.review.findMany({
      where: { moderationStatus: ReviewModerationStatus.APPROVED },
      select: { id: true, _count: { select: { translations: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit * 4,
    });

    let processed = 0;
    let written = 0;
    for (const c of candidates) {
      if (processed >= limit) break;
      if (c._count.translations >= TARGET_LOCALES.length) continue;
      const res = await this.translateReview(c.id);
      processed++;
      written += res.written;
    }
    return { processed, written };
  }
}
