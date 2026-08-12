/**
 * String utilities shared by BOTH email design families.
 *
 * They lived in `auth-email-shell.ts` because that shell was written first, so
 * every operator template — and the operator shell itself — imported its
 * escaping from a file named for the other family. Nothing here is
 * auth-specific, and that import was the only thread still tying the two
 * shells together, which quietly contradicted the split.
 */

/**
 * Escapes the HTML-significant characters so user data cannot inject markup.
 *
 * Quotes are escaped too, not only the angle brackets: these values land inside
 * `href="…"` and `style="…"` attributes, where a bare quote breaks out of the
 * attribute rather than merely rendering oddly.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The plain-text part's view of a fragment of email HTML: markup stripped and
 * the entities `escapeHtml` introduced put back, so a name reads as `O'Brien`
 * rather than `O&#39;Brien` in the text/plain alternative.
 *
 * `<br>` becomes a SPACE before tags are stripped. Dropping it instead glued
 * the words on either side together — the reason `tour-review.template.ts`
 * once joined its lines with `'<br> '` and a trailing space.
 */
export function stripToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
