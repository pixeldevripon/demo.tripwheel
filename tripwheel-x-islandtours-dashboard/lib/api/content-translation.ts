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

const PATH_SEGMENT: Record<
  Exclude<TranslatableEntityType, 'homepage'>,
  string
> = {
  tour: 'tours',
  destination: 'destinations',
  hub: 'hubs',
  category: 'categories',
  collection: 'collections',
  // Hotels are a normal list with real ids, so they take the standard per-id
  // shape below. They were briefly a singleton and had their own special case
  // here; leaving it behind pointed this at `/hotel/...`, which no longer
  // exists, and every "Translate with AI" click answered "Cannot POST".
  hotel: 'hotels',
};

function pathFor(type: TranslatableEntityType, id: string, locale: Locale): string {
  // The homepage is the only singleton: it carries no id, because the backend
  // resolves its one row itself.
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

  /**
   * Batched inline translation (the per-card "Translate section" button):
   * the whole field map rides in ONE request and comes back translated under
   * the same keys in ONE response. Persists NOTHING, like translateText.
   * Backend caps: 100 entries, 30k characters total.
   */
  translateFields: (fields: Record<string, string>, targetLocale: Locale) =>
    apiFetch<{ fields: Record<string, string> }>(
      '/content-translation/translate-fields',
      {
        method: 'POST',
        body: JSON.stringify({ fields, targetLocale }),
      },
    ),
};
