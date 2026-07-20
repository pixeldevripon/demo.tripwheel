import { getDashboardStats } from '@/app/_actions/dashboardActions';
import { getUserProfile } from '@/app/_actions/userActions';
import PageComponents from '@/components/page-components';
import {
    formatRangeLabel,
    parseRangePreset,
    RANGE_PARAM,
    resolveRange,
} from '@/lib/analytics/range-presets';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const cookie = (await headers()).get('cookie') ?? '';
    const params = await searchParams;

    // `getUserProfile` is request-memoized (React `cache()`) and already resolved
    // by the dashboard layout, so this reuses that result with no extra backend
    // call - and it forwards the internal key to bypass the per-IP throttle.
    const user = await getUserProfile(cookie);
    if (!user) {
        redirect('/portal');
    }
    // Customers have no Overview - their landing page is My Bookings. The
    // server root owns role routing (login just pushes '/'), so deep links
    // and refreshes behave identically.
    if (user.role === 'USER') {
        redirect('/bookings');
    }

    // Real stats, scoped by the forwarded session cookie (admin: platform-wide,
    // operator: own tours). Scoping is decided server-side from the session, so
    // the role is deliberately not passed in. Not awaited - the stats area
    // streams in behind its Suspense skeleton while the rest of the page renders.
    //
    // The reporting window rides on a URL search param rather than client state,
    // so changing it re-runs THIS fetch on the server. There is no second copy
    // of the range in the browser that could drift from the numbers on screen.
    const preset = parseRangePreset(
        typeof params[RANGE_PARAM] === 'string'
            ? params[RANGE_PARAM]
            : undefined,
    );
    const activeRange = resolveRange(preset);
    const statsPromise = getDashboardStats(cookie, activeRange);

    // Resolved on the SERVER, from the same dates that were sent to the
    // backend. Deriving it in the browser instead would recompute "today"
    // against a different clock and could label the numbers with a window they
    // were not filtered by.
    const rangeLabel = formatRangeLabel({
        from: activeRange.from ?? null,
        to: activeRange.to ?? null,
        isAllTime: preset === 'all',
    });

    return (
        <div className='flex flex-1 flex-col gap-4'>
            <PageComponents
                statsPromise={statsPromise}
                loggedInUser={user}
                rangePreset={preset}
                rangeLabel={rangeLabel}
            />
        </div>
    );
}
