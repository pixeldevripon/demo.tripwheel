import { Locale } from '@prisma/client';

/**
 * Negotiates the OCTO content locale (spec §5.1 — `Accept-Language`).
 *
 * ## What it does
 * Parses an `Accept-Language` header (e.g. `"nl-NL,nl;q=0.9,en;q=0.8"`) and resolves
 * it to one of our supported `Locale` enum values, honouring `q` weights and falling
 * back to English. Only the primary subtag is matched (`nl-NL` → `nl`).
 *
 * ## Usage
 * `negotiateLocale(req.headers['accept-language'])` in OCTO controllers; the resolved
 * locale is echoed back to clients via the `Content-Language` response header.
 */
const SUPPORTED = new Set<string>(Object.values(Locale));

export function negotiateLocale(header: unknown): Locale {
  if (typeof header !== 'string' || !header.trim()) return Locale.en;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number(qParam.split('=')[1]) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((r) => r.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0];
    if (SUPPORTED.has(primary)) return primary as Locale;
  }
  return Locale.en;
}
