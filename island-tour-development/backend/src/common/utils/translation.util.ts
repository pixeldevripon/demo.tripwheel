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

/** Minimum row shape the grouped resolver needs - a subset of `faqSelect`. */
type LocalizableGrouped = {
  locale: Locale;
  displayOrder: number;
};

/**
 * Collapses a mixed `locale` + English row set down to one row per logical item,
 * preferring the requested locale. Shared by every polymorphic per-locale table
 * whose rows carry a group key (`Faq.faqGroupId`,
 * `PageContentSection.sectionGroupId`).
 *
 * Query with `where: { locale: { in: [locale, Locale.en] } }` and pass the rows
 * here. Filtering on `locale` alone instead empties the whole block on any page
 * that has not been translated yet - in six of the seven locales.
 *
 * Grouped rows fall back PER GROUP, so a page with three of its five items
 * translated still renders all five. Rows whose `getGroupId` returns null have no
 * counterpart to match on, so they fall back as a set: the English ones are used
 * only when the locale has no ungrouped rows at all. (`PageContentSection` has a
 * NOT NULL group key, so that branch is dead for sections - it exists for `Faq`'s
 * legacy pre-grouping rows.)
 */
export function resolveGroupedLocale<T extends LocalizableGrouped>(
  rows: T[],
  locale: Locale,
  getGroupId: (row: T) => string | null,
): T[] {
  if (locale === Locale.en) return rows;

  const grouped = new Map<string, T>();
  const ungrouped: T[] = [];

  for (const row of rows) {
    const groupId = getGroupId(row);
    if (groupId === null) {
      ungrouped.push(row);
      continue;
    }
    // The unique constraint allows one row per (group, locale), so the only
    // contest is locale vs en - and the locale row always wins it.
    const held = grouped.get(groupId);
    if (!held || row.locale === locale) grouped.set(groupId, row);
  }

  const localeUngrouped = ungrouped.filter((r) => r.locale === locale);

  return [
    ...grouped.values(),
    ...(localeUngrouped.length > 0 ? localeUngrouped : ungrouped),
  ].sort((a, b) => a.displayOrder - b.displayOrder);
}

/** `resolveGroupedLocale` keyed on `faqGroupId`. See it for the fallback rules. */
export function resolveFaqLocale<
  T extends LocalizableGrouped & { faqGroupId: string | null },
>(rows: T[], locale: Locale): T[] {
  return resolveGroupedLocale(rows, locale, (row) => row.faqGroupId);
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
