'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';

import { contentTranslationApi } from '@/lib/api/content-translation';
import type { Locale } from '@/lib/constants/locales';

/**
 * Inline per-field AI translation (the small icon button on a workspace
 * field). Returns the translated string, or null after showing an error
 * toast. No query invalidation on purpose: nothing is persisted - the caller
 * fills the form field (dirty) and the human reviews before Save all, exactly
 * like "Copy from English".
 */
export function useInlineTranslate(locale: Locale) {
  return useCallback(
    async (text: string): Promise<string | null> => {
      try {
        const res = await contentTranslationApi.translateText(text, locale);
        return res.translatedText;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'AI translation failed.',
        );
        return null;
      }
    },
    [locale],
  );
}
