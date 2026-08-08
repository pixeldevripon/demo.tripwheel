/**
 * Client-side curated popular links - backs the navbar mobile search layer's
 * zero state (browser, anonymous, NO auth cookie). Mirrors
 * `lib/api/categories-public.ts`: a public GET that runs in the browser because
 * the selected island is a client-side choice and changes without a navigation.
 * The server-cached equivalent is `getDestinationPopularLinks` in
 * `lib/api/public/destinations.ts`.
 */
import { BACKEND_API_BASE } from '@/lib/api/backend-url';
import type { Locale } from '@/lib/constants/locales';
import type {
  DestinationPopularLink,
  PopularLinkPlacement,
} from '@/types/destination';

/**
 * The admin's curated discovery list for one placement, already re-gated by the
 * backend so every row opens a page that renders. Returns `[]` on any failure -
 * and `[]` is a meaningful answer here, not just an error swallow: it is the
 * signal to fall back to the island's automatic list.
 */
export async function fetchDestinationPopularLinksClient(
  destinationSlug: string,
  locale?: Locale,
  placement: PopularLinkPlacement = 'SEARCH_PANEL',
): Promise<DestinationPopularLink[]> {
  const qs = new URLSearchParams({ placement });
  if (locale) qs.set('locale', locale);

  try {
    const res = await fetch(
      `${BACKEND_API_BASE}/destinations/slug/${destinationSlug}/popular-links?${qs.toString()}`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return [];
    return (await res.json()) as DestinationPopularLink[];
  } catch {
    return [];
  }
}
