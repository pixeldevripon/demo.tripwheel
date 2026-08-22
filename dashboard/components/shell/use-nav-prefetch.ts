'use client';

import { bookingKeys } from '@/hooks/bookings/use-bookings';
import { paymentKeys } from '@/hooks/payments/use-payments';
import {
    bookingsDashboardApi,
    paymentsDashboardApi,
} from '@/lib/api/bookings-dashboard';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Warms a list page's TanStack query when its sidebar link is hovered or
 * focused, so the rows are already in cache by the time the click lands.
 *
 * Why this and not a route prefetch: the route side is already instant (these
 * pages are synchronous server shells that fetch nothing), so what a user now
 * waits on is the table's own `useQuery` firing on mount. `<Link>` prefetching
 * cannot help with that - it warms the RSC payload, not the client cache.
 *
 * THE PARAMS BELOW MUST MIRROR `useTableState`'s DEFAULTS EXACTLY. Query keys
 * include the params object, so a prefetch under `{page: 1, limit: 20}` is
 * dead weight if the list view mounts with anything else. `useTableState`
 * defaults to page 1 / limit 20 and drops both from the URL at those values
 * (`use-table-state.ts:37,42-43`), which is the state a sidebar click produces.
 * A user arriving on a deep-linked URL with filters gets a normal fetch - the
 * prefetch is an optimization for the common path, never a correctness input.
 *
 * Only the three routes whose keys can be matched exactly are covered. Adding
 * more means confirming the list view's mount-time params first; a guess that
 * misses just burns a request.
 */
const DEFAULT_LIST = { page: 1, limit: 20 } as const;

/**
 * Cancellation Requests pins these on top of the defaults. `status: CONFIRMED`
 * mirrors the page's Pending queue default - the prefetch key must match the
 * list view's mount-time params exactly or the warmed cache is never read.
 */
const CANCELLATION_LIST = {
    ...DEFAULT_LIST,
    cancellationRequested: true,
    status: 'CONFIRMED',
} as const;

export function useNavPrefetch() {
    const queryClient = useQueryClient();

    return useCallback(
        (url?: string) => {
            switch (url) {
                case 'bookings':
                    queryClient.prefetchQuery({
                        queryKey: bookingKeys.list(DEFAULT_LIST),
                        queryFn: () => bookingsDashboardApi.list(DEFAULT_LIST),
                    });
                    break;
                case 'cancellation-requests':
                    queryClient.prefetchQuery({
                        queryKey: bookingKeys.list(CANCELLATION_LIST),
                        queryFn: () =>
                            bookingsDashboardApi.list(CANCELLATION_LIST),
                    });
                    break;
                case 'payments':
                    queryClient.prefetchQuery({
                        queryKey: paymentKeys.list(DEFAULT_LIST),
                        queryFn: () => paymentsDashboardApi.list(DEFAULT_LIST),
                    });
                    break;
                default:
                    break;
            }
        },
        [queryClient],
    );
}
