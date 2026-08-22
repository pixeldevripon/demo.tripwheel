'use client';

import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

/**
 * Wrap this around the app (or a route segment) so all TanStack Query hooks
 * work. A new QueryClient is created per-session (useState) to avoid sharing
 * state between different users in SSR.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Data is considered fresh for 30 s, then re-fetched in background
                        staleTime: 30 * 1000,
                        // Retry failed requests up to 2 times with exponential back-off
                        retry: 2,
                        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
                        // Automatically refetch when the window regains focus
                        refetchOnWindowFocus: true,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
