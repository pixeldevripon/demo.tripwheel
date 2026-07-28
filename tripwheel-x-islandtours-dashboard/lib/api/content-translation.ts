import type { Locale } from '@/lib/constants/locales';
import type { TranslatableEntityType } from '@/lib/translatable-schema';
import { apiFetch } from './fetch';

/**
 * AI translation ("Translate with AI"): synchronously translates one entity's
 * English source into ONE target locale on the backend, persisting the result
 * (isMachineTranslated: true). Human-edited rows are never overwritten.
 *
 * The paths are per-entity on purpose - they start with `tours/`,
 * `categories/`, etc., so apiFetch's path-based public-cache busting maps them
 * to the right tags with no extra wiring.
 */

export interface GenerateTranslationResult {
  entityType: string;
  entityId: string;
  locale: Locale;
  /** Units freshly translated and written. */
  written: number;
  /** Units left alone (human rows + already-current machine rows). */
  skipped: number;
  reason?: string;
}

const PATH_SEGMENT: Record<Exclude<TranslatableEntityType, 'homepage'>, string> = {
  tour: 'tours',
  destination: 'destinations',
  hub: 'hubs',
  category: 'categories',
  collection: 'collections',
};

function pathFor(type: TranslatableEntityType, id: string, locale: Locale): string {
  if (type === 'homepage') return `/home-page/translations/${locale}/generate`;
  return `/${PATH_SEGMENT[type]}/${id}/translations/${locale}/generate`;
}

export const contentTranslationApi = {
  /** `force` re-translates human-edited rows too - only ever sent after the
   *  user confirmed the warning dialog. */
  generate: (
    type: TranslatableEntityType,
    id: string,
    locale: Locale,
    force = false,
  ) =>
    apiFetch<GenerateTranslationResult>(
      `${pathFor(type, id, locale)}${force ? '?force=true' : ''}`,
      { method: 'POST' },
    ),

  /**
   * Inline per-field translation: returns the translated text, persists
   * NOTHING (the form field is filled and the human reviews before saving).
   */
  translateText: (text: string, targetLocale: Locale) =>
    apiFetch<{ translatedText: string }>('/content-translation/translate-text', {
      method: 'POST',
      body: JSON.stringify({ text, targetLocale }),
    }),
};
