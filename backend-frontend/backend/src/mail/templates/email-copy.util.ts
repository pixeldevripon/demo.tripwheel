import { Locale } from '@prisma/client';

/**
 * Shared helpers for the per-template `*.copy.ts` modules
 * (EMAIL-IMPLEMENTATION-PLAN.md §2.9): traveller-facing email copy is a
 * `Record<Locale, {…strings}>` beside its template, English canonical,
 * machine-first translations for the other six. No i18n framework - the
 * modules are plain data and this is the only mechanism.
 *
 * Strings carry `{placeholder}` slots that the CONTEXT BUILDER interpolates
 * (never the HTML template renderer): sentence structure differs per locale,
 * so a value's position inside the sentence must live in the translated
 * string, not in the markup around it.
 */

export type CopyVars = Record<string, string | number>;

/**
 * Interpolate `{name}` slots. Unknown slots are left literal on purpose -
 * the same "loud bug beats silently blank" rule the template renderer uses.
 * Values are NOT HTML-escaped here: copy strings flow into the template
 * renderer as tokens, and `substitute()` escapes on output. Escaping twice
 * would email "Miss Ann &amp;amp; Co".
 */
export function fillCopy(template: string, vars: CopyVars): string {
  return template.replace(/\{(\w+)\}/g, (literal, key: string) =>
    key in vars ? String(vars[key]) : literal,
  );
}

/**
 * The copy row for a booking's locale. Total by construction - every copy
 * module is `Record<Locale, T>` and the caller resolves the locale through
 * `toLocale()` first - but a runtime `en` fallback keeps a half-migrated
 * enum extension from emailing `undefined`.
 */
export function copyFor<T>(table: Record<Locale, T>, locale: Locale): T {
  return table[locale] ?? table[Locale.en];
}
