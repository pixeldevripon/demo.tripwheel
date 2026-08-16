/**
 * Operator-conditions locale resolution (Pastel #80 / MCK-20).
 *
 * Both content carriers are `{locale: value}` JSON maps written by trusted
 * writers only (seed today, the admin CMS later - WHICH MUST SANITIZE the
 * document HTML at write time, same as page editorial content). These helpers
 * resolve a locale with EN fallback and refuse anything that is not the
 * expected shape, so a malformed map degrades to "no content" instead of
 * leaking raw JSON to the public payload.
 */

type LocaleMap = Record<string, unknown>;

function asLocaleMap(value: unknown): LocaleMap | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as LocaleMap)
    : null;
}

/** `{locale: string[]}` → the locale's items, EN fallback, else []. */
export function resolveLocaleStrings(value: unknown, locale: string): string[] {
  const map = asLocaleMap(value);
  if (!map) return [];
  const pick = (key: string): string[] | null => {
    const entry = map[key];
    return Array.isArray(entry) && entry.every((i) => typeof i === 'string')
      ? entry
      : null;
  };
  return pick(locale) ?? pick('en') ?? [];
}

/** `{locale: string}` → the locale's text, EN fallback, else null. */
export function resolveLocaleText(
  value: unknown,
  locale: string,
): string | null {
  const map = asLocaleMap(value);
  if (!map) return null;
  const pick = (key: string): string | null => {
    const entry = map[key];
    return typeof entry === 'string' && entry.trim() ? entry : null;
  };
  return pick(locale) ?? pick('en');
}

/**
 * True when a stored conditions document has any actual text in it. The
 * stored format is sanitized TipTap HTML (the PAGES pipeline, reused:
 * `sanitizePageHtml` at write time, `.it-page-prose` at render time), so
 * "has a document" means "has text once tags are stripped" - an empty
 * `<p></p>` from a cleared editor is NOT a document.
 */
export function htmlHasText(html: string | null): boolean {
  return !!html && html.replace(/<[^>]*>/g, '').trim().length > 0;
}
