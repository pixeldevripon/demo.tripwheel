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
 */
export async function getDashboardStats(
    cookie: string,
    granularity: 'month' | 'day' = 'month',
    buckets = 6,
): Promise<DashboardStats | null> {
    try {
        const res = await fetch(
            `${API}/analytics/dashboard?granularity=${granularity}&buckets=${buckets}`,
            { headers: serverAuthHeaders(cookie), cache: 'no-store' },
        );
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
