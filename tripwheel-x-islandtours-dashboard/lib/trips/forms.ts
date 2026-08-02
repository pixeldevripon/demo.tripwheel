/**
 * Shared form coercion + base-locale lookup for the trip child-entity editors
 * (locations, pickups, features, highlights, inclusions, exclusions).
 *
 * `numOrNull`/`numOrUndef` were defined identically in the locations and pickup
 * tabs, `strOrNull` only in pickups, and the English-translation lookup was
 * hand-rolled in six places and had begun to drift (code-review M5/M13).
 *
 * Behaviour is preserved EXACTLY — the same `Number(v)` (no finite check) and
 * `.trim()` guards the tabs already relied on. This is a de-duplication, not a
 * behaviour change.
 */

/** "" / whitespace / undefined → null; otherwise `Number(v)` (may be NaN, as before). */
export const numOrNull = (v: string | undefined): number | null =>
  v && v.trim() !== '' ? Number(v) : null

/** As `numOrNull`, but → undefined for the empty case (so the key is omitted from a PATCH). */
export const numOrUndef = (v: string | undefined): number | undefined =>
  v && v.trim() !== '' ? Number(v) : undefined

/** "" / whitespace / undefined → null; otherwise the non-empty string as-is (untrimmed, as before). */
export const strOrNull = (v: string | undefined): string | null =>
  v && v.trim() !== '' ? v : null

/** The English (base-locale) translation row, or undefined. */
export function findEnglish<T extends { locale: string }>(
  translations: T[] | undefined | null,
): T | undefined {
  return translations?.find((t) => t.locale === 'en')
}
