/**
 * Server-side data layer for the public (frontend) site.
 *
 * Unlike `lib/api/fetch.ts` (client-side, sends the Better Auth cookie), these
 * helpers run in Server Components, hit only `@Public()` endpoints, and are
 * cached with ISR (`next.revalidate`) so the prerendered shell stays static.
 * Every helper degrades gracefully — a backend hiccup returns a safe fallback
 * instead of throwing and blanking the page.
 */
import 'server-only';

import type { DestinationLocalized } from '@/types/destination';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/** Default ISR window for public content (5 minutes). */
const DEFAULT_REVALIDATE = 300;

/**
 * Cached GET against a public backend endpoint. Returns `null` on any failure
 * (network error, non-2xx, bad JSON) so callers can fall back without a crash.
 */
async function publicGet<T>(path: string, revalidate = DEFAULT_REVALIDATE): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/**
 * Active destinations for the current locale (name already localized server-side),
 * ordered alphabetically. Powers the navbar island selector and footer.
 */
export async function getActiveDestinations(
  locale: Locale = DEFAULT_LOCALE,
): Promise<DestinationLocalized[]> {
  const data = await publicGet<DestinationLocalized[]>(
    `/destinations/active${buildQuery({ locale })}`,
  );
  return data ?? [];
}
