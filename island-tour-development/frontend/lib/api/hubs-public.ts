/**
 * Client-side public hubs fetch - backs the navbar categories dropdown's place
 * row (MCK-19: the dropdown was the one surface in the chrome with no route to
 * a hub). Mirrors `lib/api/categories-public.ts`: a public GET that runs in the
 * browser because the selected island is a client-side choice. The
 * server-cached equivalent is `getDestinationHubs` in `lib/api/public/hubs.ts`.
 */
import type { Locale } from '@/lib/constants/locales';
import type { HubByDestination } from '@/types/hub';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Published, tour-gated hubs for a destination, fetched from the browser.
 * Anonymous (does not send the auth cookie). Returns `[]` on any failure so
 * callers never need a try/catch.
 */
export async function fetchDestinationHubsClient(
  destinationSlug: string,
  locale?: Locale,
): Promise<HubByDestination[]> {
  const qs = new URLSearchParams();
  if (locale) qs.set('locale', locale);
  const query = qs.toString() ? `?${qs.toString()}` : '';

  try {
    const res = await fetch(
      `${BACKEND_API_BASE}/hubs/destination/${destinationSlug}${query}`,
      { headers: { 'Content-Type': 'application/json' } },
    );
    if (!res.ok) return [];
    return (await res.json()) as HubByDestination[];
  } catch {
    return [];
  }
}
