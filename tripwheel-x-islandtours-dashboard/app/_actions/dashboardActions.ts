'use server';

import { serverAuthHeaders } from '@/lib/server/auth-headers';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';
const API = `${BACKEND_URL}/api/v1`;

/**
 * Real dashboard stats (Phase 20 honesty fix). The overview UI is unchanged;
 * this action replaces its hardcoded mock payload with live numbers assembled
 * from the existing list endpoints (`total` of limit-1 pages, page sums for
 * revenue). Metrics the backend cannot answer yet (customers, inquiries,
 * leads, created-this-month) stay 0 instead of being invented.
 *
 * Every call is scoped server-side by the forwarded session cookie: admins
 * see platform-wide numbers, operators only their own tours' bookings and
 * payments. Individual failures degrade to 0 / empty so one flaky endpoint
 * never blanks the whole overview.
 */

interface Paginated<T> {
    total: number;
    data: T[];
}

async function getJson<T>(cookie: string, path: string): Promise<T | null> {
    try {
        const res = await fetch(`${API}${path}`, {
            headers: serverAuthHeaders(cookie),
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const text = await res.text();
        return text ? (JSON.parse(text) as T) : null;
    } catch {
        return null;
    }
}

async function count(cookie: string, path: string): Promise<number> {
    const body = await getJson<{ total?: number }>(cookie, path);
    return body?.total ?? 0;
}

/** Sum of `amount` over the first page (100 rows) of a payments query. */
async function sumPayments(cookie: string, query: string): Promise<number> {
    const body = await getJson<Paginated<{ amount: string }>>(
        cookie,
        `/payments?limit=100&page=1&${query}`,
    );
    if (!body?.data?.length) return 0;
    return body.data.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function getDashboardStats(cookie: string, role: string) {
    const isAdmin = role === 'ADMIN';
    const toursBase = isAdmin ? '/tours/admin/all' : '/tours/my-tours';

    const now = new Date();
    const monthStart = isoDay(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    );
    const lastMonthStart = isoDay(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
    );
    const lastMonthEnd = isoDay(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)),
    );
    const monthEnd = isoDay(
        new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)),
    );
    const today = isoDay(now);

    const [
        bookingsTotal,
        bookingsPending,
        bookingsConfirmed,
        bookingsCancelled,
        bookingsRedeemed,
        bookingsUpcoming,
        bookingsThisMonth,
        bookingsLastMonth,
        toursTotal,
        toursDraft,
        toursLive,
        toursArchived,
        paymentsSucceeded,
        paymentsProcessing,
        paymentsFailed,
        paymentsRefunded,
        revenueTotal,
        revenueThisMonth,
        revenueLastMonth,
        refundedAmount,
        recentBookingsPage,
        recentPaymentsPage,
    ] = await Promise.all([
        count(cookie, '/bookings?limit=1'),
        count(cookie, '/bookings?limit=1&status=PENDING'),
        count(cookie, '/bookings?limit=1&status=CONFIRMED'),
        count(cookie, '/bookings?limit=1&status=CANCELLED'),
        count(cookie, '/bookings?limit=1&status=REDEEMED'),
        count(cookie, `/bookings?limit=1&from=${today}`),
        count(cookie, `/bookings?limit=1&from=${monthStart}&to=${monthEnd}`),
        count(
            cookie,
            `/bookings?limit=1&from=${lastMonthStart}&to=${lastMonthEnd}`,
        ),
        count(cookie, `${toursBase}?limit=1`),
        count(cookie, `${toursBase}?limit=1&status=DRAFT`),
        count(cookie, `${toursBase}?limit=1&status=LIVE`),
        count(cookie, `${toursBase}?limit=1&status=ARCHIVED`),
        count(cookie, '/payments?limit=1&status=SUCCEEDED'),
        count(cookie, '/payments?limit=1&status=PROCESSING'),
        count(cookie, '/payments?limit=1&status=FAILED'),
        count(cookie, '/payments?limit=1&status=REFUNDED'),
        sumPayments(cookie, 'status=SUCCEEDED'),
        sumPayments(
            cookie,
            `status=SUCCEEDED&from=${monthStart}&to=${today}`,
        ),
        sumPayments(
            cookie,
            `status=SUCCEEDED&from=${lastMonthStart}&to=${lastMonthEnd}`,
        ),
        sumPayments(cookie, 'kind=REFUND'),
        getJson<
            Paginated<{
                id: string;
                createdAt?: string;
                utcConfirmedAt?: string | null;
                status: string;
                displayRef: string;
                contactFullName: string | null;
                tourName: string;
            }>
        >(cookie, '/bookings?limit=5&page=1'),
        getJson<
            Paginated<{
                id: string;
                createdAt: string;
                amount: string;
                currency: string;
                status: string;
                provider: string;
                bookingDisplayRef: string;
            }>
        >(cookie, '/payments?limit=5&page=1'),
    ]);

    return {
        result: {
            data: {
                revenue: {
                    totalRevenue: revenueTotal,
                    thisMonth: revenueThisMonth,
                    lastMonth: revenueLastMonth,
                    netRevenue: Math.max(0, revenueTotal - refundedAmount),
                },
                bookings: {
                    total: bookingsTotal,
                    thisMonth: bookingsThisMonth,
                    lastMonth: bookingsLastMonth,
                    upcoming: bookingsUpcoming,
                    byStatus: {
                        draft: bookingsPending,
                        confirmed: bookingsConfirmed,
                        cancelled: bookingsCancelled,
                        completed: bookingsRedeemed,
                    },
                },
                trips: {
                    total: toursTotal,
                    createdThisMonth: 0,
                    withBookings: 0,
                    byStatus: {
                        draft: toursDraft,
                        published: toursLive,
                        archived: toursArchived,
                    },
                },
                // No customer/inquiry/lead endpoints exist yet - report zeros
                // rather than invented numbers.
                customers: {
                    total: 0,
                    newThisMonth: 0,
                    newLastMonth: 0,
                    verified: 0,
                    withBookings: 0,
                    repeatCustomers: 0,
                    activeThisMonth: 0,
                },
                recentActivity: {
                    recentBookings: (recentBookingsPage?.data ?? []).map(
                        (b) => ({
                            id: b.id,
                            createdAt:
                                b.createdAt ??
                                b.utcConfirmedAt ??
                                new Date().toISOString(),
                            status: b.status.toLowerCase(),
                            bookingReference: b.displayRef,
                            customer: { name: b.contactFullName ?? 'Guest' },
                            trip: { title: b.tourName },
                        }),
                    ),
                    recentPayments: (recentPaymentsPage?.data ?? []).map(
                        (p) => ({
                            id: p.id,
                            createdAt: p.createdAt,
                            amount: Number(p.amount) || 0,
                            currency: p.currency,
                            status: p.status.toLowerCase(),
                            paymentMethod: p.provider.toLowerCase(),
                            booking: { bookingReference: p.bookingDisplayRef },
                        }),
                    ),
                    recentCustomers: [],
                },
                payments: {
                    byStatus: {
                        completed: paymentsSucceeded,
                        pending: paymentsProcessing,
                        failed: paymentsFailed,
                        refunded: paymentsRefunded,
                    },
                },
                inquiries: { total: 0, pending: 0, replied: 0 },
                leads: { total: 0 },
            },
        },
    };
}
