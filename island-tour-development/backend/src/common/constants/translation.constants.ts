import { Locale } from '@prisma/client';

/**
 * Shared vocabulary for every AI-translation consumer (content entities in
 * `src/content-translation/`, review comments in `src/reviews/`). Lifted out of
 * ReviewTranslationService so the two pipelines can never drift on what "all
 * locales" means.
 */

/** Every locale content can be translated INTO. Callers skip the source locale. */
export const TARGET_LOCALES: Locale[] = [
  Locale.en,
  Locale.nl,
  Locale.de,
  Locale.fr,
  Locale.es,
  Locale.pt,
  Locale.zh,
];

/**
 * Provider-facing language codes where our enum differs from what translation
 * APIs expect: Simplified Chinese is `zh-CN`. Every other locale we carry
 * matches ISO-639-1 exactly.
 */
export const PROVIDER_CODE: Partial<Record<Locale, string>> = {
  [Locale.zh]: 'zh-CN',
};

/**
 * Human-readable language names for LLM prompts. An instruction like
 * "translate into Simplified Chinese" is far more reliable than a bare code.
 */
export const LOCALE_LANGUAGE_NAME: Record<Locale, string> = {
  [Locale.en]: 'English',
  [Locale.nl]: 'Dutch',
  [Locale.de]: 'German',
  [Locale.fr]: 'French',
  [Locale.es]: 'Spanish',
  [Locale.pt]: 'Portuguese',
  [Locale.zh]: 'Simplified Chinese',
};
