/**
 * Client-side public categories fetch - backs the navbar's per-island categories
 * dropdown (browser, anonymous, NO auth cookie). Mirrors `lib/api/search.ts` /
 * `lib/api/reviews.ts`: a public GET that runs in the browser because the
 * selected island is a client-side choice. The server-cached equivalent is
 * `getDestinationCategories` in `lib/api/public/categories.ts`.
 */
import type { Locale } from '@/lib/constants/locales';
import type { CategoryByDestination } from '@/types/category';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Active, tour-gated categories for a destination, fetched from the browser.
 * Anonymous (does not send the auth cookie). Returns `[]` on any failure so
 * callers never need a try/catch.
 */
export async function fetchDestinationCategoriesClient(
  destinationSlug: string,
  locale?: Locale,
): Promise<CategoryByDestination[]> {
  const qs = new URLSearchParams();
  if (locale) qs.set('locale', locale);
  const query = qs.toString() ? `?${qs.toString()}` : '';

  try {
    const res = await fetch(
      `${BACKEND_API_BASE}/categories/destination/${destinationSlug}${query}`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return [];
    return (await res.json()) as CategoryByDestination[];
  } catch {
    return [];
  }
}
