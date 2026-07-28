import { BadRequestException } from '@nestjs/common';
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
 *
 * Within a group the two rows are MERGED per field (`mergeTranslation`), not
 * picked. These columns are NOT NULL, so the Translation Console stores a
 * cleared field as `''` and keeps the row; picking the locale row wholesale
 * would render that blank instead of the English it should fall back to.
 * Translate the answer but not the question and the page now shows the English
 * question next to the translated answer, which is the point.
 */
export function resolveGroupedLocale<T extends LocalizableGrouped>(
  rows: T[],
  locale: Locale,
  getGroupId: (row: T) => string | null,
): T[] {
  if (locale === Locale.en) return rows;

  const grouped = new Map<string, T[]>();
  const ungrouped: T[] = [];

  for (const row of rows) {
    const groupId = getGroupId(row);
    if (groupId === null) {
      ungrouped.push(row);
      continue;
    }
    // The unique constraint allows one row per (group, locale), so a group
    // holds at most the locale row and the English one.
    const held = grouped.get(groupId) ?? [];
    held.push(row);
    grouped.set(groupId, held);
  }

  const localeUngrouped = ungrouped.filter((r) => r.locale === locale);

  const merged: T[] = [];
  for (const rowsOfGroup of grouped.values()) {
    const row = mergeTranslation(rowsOfGroup, locale);
    if (row) merged.push(row);
  }

  return [
    ...merged,
    ...(localeUngrouped.length > 0 ? localeUngrouped : ungrouped),
  ].sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * `resolveGroupedLocale` for `HubContentSection`, whose per-locale rows carry no
 * FK group key. Their cross-locale identity is (sectionType, displayOrder) -
 * the pair the dashboard editor groups by, the Translation Console addresses
 * blocks by, and the DB has a unique constraint on. That is a real group key,
 * so blocks fall back per block AND per field like everything else.
 *
 * This replaced `resolveLocaleSet` for hub blocks (set-level all-or-nothing),
 * under which translating one block hid every untranslated sibling of its type
 * instead of showing them in English.
 */
export function resolveBlocksByPosition<
  T extends LocalizableGrouped & { sectionType: string },
>(rows: T[], locale: Locale): T[] {
  return resolveGroupedLocale(
    rows,
    locale,
    (row) => `${row.sectionType}#${row.displayOrder}`,
  );
}

/**
 * The base-row equivalent of `mergeTranslation` for surfaces whose English
 * source lives on the BASE row rather than an `en` translation row (hub
 * our-picks, comparison groups/columns). A cleared translation is stored as
 * `''`, and `?? base` would happily return that empty string.
 */
export function orBase(
  translated: string | null | undefined,
  base: string,
): string {
  return translated && translated.trim() ? translated : base;
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

/**
 * The per-field clear contract for NOT NULL translation columns.
 *
 * Emptying a field in the Translation Console stores `''` and KEEPS the row:
 * the row stays human (`isMachineTranslated: false`) so the AI leaves it alone,
 * and public reads fall back to English for that one field
 * (`mergeTranslation` / `orBase`). Every field of every item is therefore
 * independently clearable - clearing a heading no longer forces you to clear
 * its body, and clearing both no longer has to delete the row.
 *
 * English is the exception: it is the source every locale falls back TO, so
 * blanking it has nothing to fall back to and is rejected. Delete the item
 * itself if it should not exist.
 */
export function clearableField(
  value: string | undefined,
  locale: Locale,
  label: string,
): string {
  const trimmed = (value ?? '').trim();
  if (locale === Locale.en && !trimmed) {
    throw new BadRequestException(
      `${label} cannot be empty in English - it is the source every other locale falls back to. Delete the item instead.`,
    );
  }
  return trimmed;
}

/** Defers to English: null/undefined, a blank string, an empty array. */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * PER-FIELD English fallback for a translation row with nullable columns.
 *
 * Row-level fallback (`rows.find(locale) ?? rows.find(en)`) only covers a
 * MISSING locale row. It silently fails the case the Translation Console
 * creates every day: the row exists, but one field in it was cleared. The
 * requested locale then wins the row and the cleared field renders empty
 * instead of showing English.
 *
 * So merge field by field: keep whatever the locale actually says, and let
 * English through wherever it says nothing. A field cleared in the console is
 * a deliberate "show English here" - this is the half that makes that true on
 * the page (the other half is `translation_clear_marks`, which stops the AI
 * refilling it).
 *
 * Blank strings and empty arrays count as "says nothing" alongside NULL: the
 * per-item tables store `''` where the column is NOT NULL, and either way an
 * empty box on the page is never the intent.
 *
 * Query with `where: { locale: { in: [locale, Locale.en] } }` and select
 * `locale: true`, or there is nothing here to merge.
 */
export function mergeTranslation<T extends { locale: Locale }>(
  rows: T[],
  locale: Locale,
): T | undefined {
  const en = rows.find((r) => r.locale === Locale.en);
  if (locale === Locale.en) return en ?? rows[0];

  const target = rows.find((r) => r.locale === locale);
  if (!target) return en;
  if (!en) return target;

  const merged: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(en)) {
    // `locale` and the machine flag describe the ROW, not the copy - the
    // requested locale's own values stand.
    if (key === 'locale' || key === 'isMachineTranslated') continue;
    if (isBlank(merged[key])) merged[key] = value;
  }
  return merged as T;
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
