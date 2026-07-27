import type { Locale } from '@prisma/client';

/**
 * DI token for the active AI translation provider.
 *
 * Module-neutral on purpose: content translation AND review translation (LD32)
 * inject this same token, so swapping providers (founder: "free model for now")
 * is one factory branch in ContentTranslationModule - no consumer changes.
 */
export const TRANSLATION_PROVIDER = Symbol('TRANSLATION_PROVIDER');

/** A translatable value: plain text or a bullet list (e.g. whatToBring). */
export type TranslatableValue = string | string[];

/**
 * What every provider must offer.
 *
 * Two shapes, one contract:
 * - `translateFields` - the whole-entity shape: a flat key map translated in ONE
 *   call so context is shared and rate limits are respected. Arrays stay arrays
 *   with length and order preserved.
 * - `translateText` - the single-string shape (review comments).
 *
 * `from` is nullable because review sources are written in whatever language
 * the guest used - `null` lets the model auto-detect. Content translation
 * always passes `en`.
 *
 * Error contract: a failed/invalid translation THROWS (callers that must not
 * fail - the review job - catch and skip; the content processor relies on the
 * throw for its BullMQ retry).
 */
export interface TranslationProvider {
  /** False = the feature is inert (no key configured anywhere). */
  isConfigured(): Promise<boolean>;

  translateFields(
    fields: Record<string, TranslatableValue>,
    from: Locale | null,
    to: Locale,
  ): Promise<Record<string, TranslatableValue>>;

  translateText(text: string, from: Locale | null, to: Locale): Promise<string>;
}
