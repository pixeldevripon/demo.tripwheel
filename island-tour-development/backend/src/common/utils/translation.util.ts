import { Locale } from '@/common/constants/locales';

export const translationSelect = {
  name: true,
  overview: true,
  h1Override: true,
  breadcrumbLabel: true,
  isMachineTranslated: true,
} as const;

export const faqSelect = {
  id: true,
  question: true,
  answer: true,
  displayOrder: true,
  isActive: true,
  locale: true,
  faqGroupId: true,
} as const;

/** Minimum row shape `resolveFaqLocale` needs - a subset of `faqSelect`. */
type LocalizableFaq = {
  locale: Locale;
  faqGroupId: string | null;
  displayOrder: number;
};

/**
 * Collapses a mixed `locale` + English FAQ row set down to one row per logical
 * FAQ, preferring the requested locale.
 *
 * Query with `where: { locale: { in: [locale, Locale.en] } }` and pass the rows
 * here. Filtering on `locale` alone instead empties the whole FAQ block on any
 * page that has not been translated yet - in six of the seven locales.
 *
 * Grouped rows (`faqGroupId` set) fall back per group, so a page with three of
 * its five questions translated still renders all five. Legacy ungrouped rows
 * have no counterpart to match on, so they fall back as a set: the English ones
 * are used only when the locale has no ungrouped rows at all.
 */
export function resolveFaqLocale<T extends LocalizableFaq>(
  rows: T[],
  locale: Locale,
): T[] {
  if (locale === Locale.en) return rows;

  const grouped = new Map<string, T>();
  const ungrouped: T[] = [];

  for (const row of rows) {
    if (row.faqGroupId === null) {
      ungrouped.push(row);
      continue;
    }
    // The unique constraint allows one row per (group, locale), so the only
    // contest is locale vs en - and the locale row always wins it.
    const held = grouped.get(row.faqGroupId);
    if (!held || row.locale === locale) grouped.set(row.faqGroupId, row);
  }

  const localeUngrouped = ungrouped.filter((r) => r.locale === locale);

  return [
    ...grouped.values(),
    ...(localeUngrouped.length > 0 ? localeUngrouped : ungrouped),
  ].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Set-level locale fallback for translated rows that carry no group key linking
 * their per-locale variants (`HubContentSection` is the one case). Nothing can
 * be matched up pairwise, so the choice is all-or-nothing: return the locale's
 * rows if it has any, otherwise the English ones.
 *
 * Partition by whatever makes an independently-rendered block first (section
 * type, say) and call this per partition - otherwise one translated block
 * suppresses the English fallback for every other block on the page.
 */
export function resolveLocaleSet<T extends { locale: Locale }>(
  rows: T[],
  locale: Locale,
): T[] {
  const localeRows = rows.filter((r) => r.locale === locale);
  return localeRows.length > 0
    ? localeRows
    : rows.filter((r) => r.locale === Locale.en);
}

export function applyTranslation<T extends { name: string }>(
  base: T,
  t: { name: string | null; isMachineTranslated: boolean } | undefined,
  locale: Locale,
) {
  return {
    ...base,
    name: t?.name ?? base.name,
    locale,
    isMachineTranslated: t?.isMachineTranslated ?? false,
  };
}
