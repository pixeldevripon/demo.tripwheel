'use client';

import Link from 'next/link';

import { ALL_LOCALES, DEFAULT_LOCALE } from '@/lib/constants/locales';

/** How many locales have a non-empty value in a per-locale string record. */
export function countFilledLocales(values: Record<string, string>): number {
  return ALL_LOCALES.filter((l) => (values[l] ?? '').trim()).length;
}

/**
 * Compact "n/7 locales" translation-completeness chip for a curation item.
 * The entity editors are English-only (translations live in the Translation
 * Console), so this is the editor's read-only window into coverage.
 */
export function LocaleCompletenessChip({ filled }: { filled: number }) {
  return (
    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
      {filled}/{ALL_LOCALES.length} locales
    </span>
  );
}

/**
 * The standard "translations are managed in the Console" sentence with a deep
 * link into the entity's workspace (first non-English locale). Embed inside a
 * manager's muted hint box.
 */
export function TranslationConsoleNote({
  type,
  id,
}: {
  /** Console entity type segment, e.g. 'hub'. */
  type: string;
  id: string;
}) {
  const target = ALL_LOCALES.find((l) => l !== DEFAULT_LOCALE) ?? DEFAULT_LOCALE;
  return (
    <>
      Translations are managed centrally in the{' '}
      <Link
        href={`/translations/${type}/${id}/${target}`}
        className="font-medium underline underline-offset-2 hover:text-foreground"
      >
        Translation Console
      </Link>
      .
    </>
  );
}
