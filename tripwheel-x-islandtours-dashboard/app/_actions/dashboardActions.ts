'use server';

import { serverAuthHeaders } from '@/lib/server/auth-headers';
import type { DashboardStats } from '@/types/analytics';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';
const API = `${BACKEND_URL}/api/v1`;

/**
 * The dashboard overview payload, straight from `GET /analytics/dashboard`.
 *
 * Every figure is a live aggregate computed in the backend: nothing here is
 * mocked, extrapolated or padded, so a zero on screen means the query really
 * returned zero. Money is EUR-normalized backend-side using each booking's
 * snapshotted `fxRateToEur`, which is why a mixed USD/EUR ledger sums
 * correctly instead of adding raw amounts under a single symbol.
 *
 * This replaced a 22-request fan-out over the list endpoints. That approach
 * had two real defects beyond being slow: revenue summed only the FIRST 100
 * payments (silently under-reporting past that), and it added mixed
 * currencies together. Both are gone - the aggregate runs in SQL over the
 * whole table.
 *
 * Scope follows the session cookie: admins get platform-wide numbers,
 * operators only their own tours, bookings and payments.
 *
 * `from`/`to` (inclusive `YYYY-MM-DD`) narrow the reporting window. They filter
 * FLOWS only - stocks such as the live trip count come back as current state
 * either way - and omitting both means all time. The backend echoes the window
 * it used back on `stats.range`, which is what the UI states on screen.
 */
export async function getDashboardStats(
    cookie: string,
    options: {
        granularity?: 'month' | 'day';
        buckets?: number;
        from?: string;
        to?: string;
    } = {},
): Promise<DashboardStats | null> {
    const { granularity = 'month', buckets = 6, from, to } = options;

    const params = new URLSearchParams({
        granularity,
        buckets: String(buckets),
    });
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
        const res = await fetch(`${API}/analytics/dashboard?${params}`, {
            headers: serverAuthHeaders(cookie),
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const text = await res.text();
        return text ? (JSON.parse(text) as DashboardStats) : null;
    } catch {
        // A null payload makes the overview render its "couldn't load" state.
        // It must never be confused with a genuinely empty dataset, which is
        // why this returns null rather than a zero-filled object.
        return null;
    }
}
