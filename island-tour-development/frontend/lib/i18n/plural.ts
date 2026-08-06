import type { Locale } from '@/lib/constants/locales';

/**
 * ICU plural categories, keyed exactly as `Intl.PluralRules` resolves them
 * (the same CLDR plural-rule data an ICU `{count, plural, ...}` message runs
 * on). `other` is the only category every locale defines - the rest are
 * additive per-locale (e.g. `one` for English/French, none beyond `other`
 * for Chinese).
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
    other: string;
};

/**
 * Picks the correct plural category for `count` in `locale` via the native
 * `Intl.PluralRules` and substitutes `{count}` into that category's template.
 *
 * Locale-aware, not a hand-rolled `count === 1` check: French treats 0 the
 * same as 1 (`one`), Chinese has no `one` category at all, etc. - `select()`
 * encodes those CLDR rules so the dictionary only has to supply the text per
 * category.
 */
export function formatPlural(
    forms: PluralForms,
    count: number,
    locale: Locale
): string {
    const category = new Intl.PluralRules(locale).select(count);
    const template = forms[category] ?? forms.other;
    return template.replace('{count}', String(count));
}
