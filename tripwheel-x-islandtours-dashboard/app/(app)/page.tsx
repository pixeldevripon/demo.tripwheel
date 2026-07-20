import { getDashboardStats } from '@/app/_actions/dashboardActions';
import PageComponents from '@/components/page-components';
import {
    formatRangeLabel,
    parseRangePreset,
    RANGE_PARAM,
    resolveRange,
} from '@/lib/analytics/range-presets';
import { getSessionRole } from '@/lib/server/dashboard-session';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const cookie = (await headers()).get('cookie') ?? '';
    const params = await searchParams;

    // Role only - ONE Better Auth call, not the 4-6 round trips `getUserProfile`
    // makes. Its comment used to claim the layout had already resolved it, but
    // layouts are preserved across sibling navigations, so on every click into
    // the Overview the whole fan-out ran again and the router could not commit
    // until it finished. Nothing on this page needs the rest of the profile:
    // stats are scoped server-side from the session cookie.
    const role = await getSessionRole(cookie);
    if (!role) {
        redirect('/portal');
    }
    // Customers have no Overview - their landing page is My Bookings. The
    // server root owns role routing (login just pushes '/'), so deep links
    // and refreshes behave identically.
    if (role === 'USER') {
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
                rangePreset={preset}
                rangeLabel={rangeLabel}
            />
        </div>
    );
}
