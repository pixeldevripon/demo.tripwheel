/**
 * Client-side reads against the public availability endpoints (`@Public()` on the
 * backend, so no session needed). Used by the hub trips grid to filter tours to
 * those with a bookable departure on a chosen date. Runs in the browser on user
 * interaction, so it uses the client `apiFetch` - not the server-only
 * `lib/api/public/fetch` primitive.
 */
import { apiFetch } from './fetch';

/** One bookable departure returned by `POST /availability/check`. */
export interface AvailabilityDeparture {
  id: string;
  date: string;
  startTime: string;
  status: string;
  available: boolean;
}

/**
 * Bookable departures for one tour within `[dateFrom, dateTo]` (inclusive), both
 * `yyyy-MM-dd`. Pass the same date for both to test a single day. Returns `[]`
 * when the tour has no open departure in range (the backend already applies the
 * booking-cutoff and capacity rules).
 */
export async function checkTourDepartures(
  tourId: string,
  dateFrom: string,
  dateTo: string,
  signal?: AbortSignal,
): Promise<AvailabilityDeparture[]> {
  return apiFetch<AvailabilityDeparture[]>('/availability/check', {
    method: 'POST',
    body: JSON.stringify({ tourId, dateFrom, dateTo }),
    signal,
  });
}

/** Run `mapper` over `items` with at most `limit` promises in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Given tour ids and a single `yyyy-MM-dd` date, resolve the subset that has at
 * least one bookable departure that day - the set of ids the hub grid should keep
 * visible. Checks run with bounded concurrency so a large panel never bursts past
 * the backend's per-IP rate limit. Fail-open: a tour whose check errors (network
 * / 429 / abort) stays visible, so a transient failure never blanks the grid.
 */
export async function filterToursAvailableOnDate(
  tourIds: string[],
  date: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const results = await mapWithConcurrency(tourIds, 6, async (id) => {
    try {
      const deps = await checkTourDepartures(id, date, date, signal);
      return { id, show: deps.length > 0 };
    } catch {
      return { id, show: true };
    }
  });
  return new Set(results.filter((r) => r.show).map((r) => r.id));
}
