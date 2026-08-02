/**
 * SEO meta helpers for the tour SEO tab. Pure + framework-free so they can be
 * unit-tested and reused.
 */

/**
 * Truncate `text` to at most `max` characters at a word boundary, appending an
 * ellipsis when it had to cut.
 *
 * The ellipsis ("...") costs 3 chars, so the raw slice must leave room for it —
 * otherwise the result exceeds `max`. The previous implementation sliced at
 * `max - 1` and then appended 3 chars, producing up to `max + 2` characters.
 * That over-length string was fed straight into a `z.string().max(max)` default
 * and silently failed validation, blocking the "Continue" button with no message
 * (code-review M11). Slicing at `max - 3` guarantees `result.length <= max`.
 */
export function truncateMeta(text: string, max: number): string {
  if (text.length <= max) return text;
  // Reserve 3 chars for the ellipsis so the final string never exceeds `max`.
  const room = Math.max(0, max - 3);
  const slice = text.slice(0, room);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > room * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[\s.,;:-]+$/, '')}...`;
}
