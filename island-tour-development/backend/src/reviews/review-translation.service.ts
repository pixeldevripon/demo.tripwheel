import { createHash } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Locale, ReviewModerationStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';

/**
 * LD32 - machine translation of review text.
 *
 * ## Why the provider is not a choice
 * The master locks it: §4.7.18 "machine translation via Google Translate API +
 * show-original toggle", with DeepL / Azure Translator named as the only
 * equivalents. This is deliberately a thin REST client rather than the official
 * SDK - one endpoint, one shape, no extra dependency tree.
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

/** Locales a review is translated INTO. The source locale is skipped per review. */
const TARGET_LOCALES: Locale[] = [
  Locale.en,
  Locale.nl,
  Locale.de,
  Locale.fr,
  Locale.es,
  Locale.pt,
  Locale.zh,
];

/**
 * Google's code for Simplified Chinese is `zh-CN`; our enum is `zh`. Every other
 * locale we carry happens to match ISO-639-1 exactly.
 */
const PROVIDER_CODE: Partial<Record<Locale, string>> = { [Locale.zh]: 'zh-CN' };

/** v3 `translateText` accepts up to 1024 strings per call; stay well under it. */
const MAX_CONTENTS_PER_CALL = 100;

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

  constructor(private readonly prisma: PrismaService) {}

  private get apiKey(): string | undefined {
    return process.env.GOOGLE_TRANSLATE_API_KEY?.trim() || undefined;
  }

  private get projectId(): string | undefined {
    return process.env.GOOGLE_TRANSLATE_PROJECT_ID?.trim() || undefined;
  }

  get isEnabled(): boolean {
    return Boolean(this.apiKey && this.projectId);
  }

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
    if (!this.isEnabled) {
      if (!this.warnedUnconfigured) {
        this.warnedUnconfigured = true;
        this.logger.warn(
          'GOOGLE_TRANSLATE_API_KEY / GOOGLE_TRANSLATE_PROJECT_ID are not set - ' +
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
      const [translated] = await this.translate(
        [source.comment],
        source.locale,
        locale,
      );
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
   * Cloud Translation v3 `translateText`.
   *
   * Batched by contract - the endpoint takes an array - so a caller with many
   * strings for ONE language pair pays a single round trip. Returns [] on any
   * failure rather than throwing: a translation outage must not fail the job
   * that called it, and the missing row simply gets picked up next run.
   */
  private async translate(
    contents: string[],
    from: Locale,
    to: Locale,
  ): Promise<string[]> {
    if (contents.length === 0) return [];
    if (contents.length > MAX_CONTENTS_PER_CALL) {
      contents = contents.slice(0, MAX_CONTENTS_PER_CALL);
    }

    const url =
      `https://translation.googleapis.com/v3/projects/${this.projectId}:translateText` +
      `?key=${encodeURIComponent(this.apiKey!)}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          contents,
          // Review text is plain text. Declaring it stops the provider treating
          // stray `<` or `&` in a guest's comment as markup to preserve.
          mimeType: 'text/plain',
          sourceLanguageCode: PROVIDER_CODE[from] ?? from,
          targetLanguageCode: PROVIDER_CODE[to] ?? to,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Translate ${from}->${to} failed (${res.status}): ${body.slice(0, 200)}`,
        );
        return [];
      }

      const json = (await res.json()) as {
        translations?: { translatedText?: string }[];
      };
      return (json.translations ?? [])
        .map((t) => t.translatedText ?? '')
        .filter(Boolean);
    } catch (err) {
      this.logger.error(
        `Translate ${from}->${to} threw: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return [];
    }
  }

  /**
   * Fire-and-forget enqueue, used by the moderation path.
   *
   * Swallows its own failure by design: BullMQ needs Redis, and if Redis is
   * down the correct outcome is an untranslated review, not a failed approval.
   * The backfill pass picks it up later either way.
   */
  async enqueue(queue: Queue | undefined, reviewId: string): Promise<void> {
    if (!queue || !this.isEnabled) return;
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
    if (!this.isEnabled) return { processed: 0, written: 0 };

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
