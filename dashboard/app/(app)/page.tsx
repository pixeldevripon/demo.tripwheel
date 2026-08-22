import { getDashboardStats } from '@/app/_actions/dashboardActions';
import PageComponents from '@/components/page-components';
import {
    formatRangeLabel,
    parseRangePreset,
    RANGE_PARAM,
    resolveRange,
} from '@/lib/analytics/range-presets';
import { Permission, ROLE_PERMISSIONS } from '@/lib/config/rbac';
import { navGroupsForRole, resolvePermissions } from '@/lib/rbac-utils';
import { getDashboardSession } from '@/lib/server/dashboard-session';
import { getNavigations } from '@/navigations/navigations';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const cookie = (await headers()).get('cookie') ?? '';
    const params = await searchParams;

    // The Overview IS the analytics page, and it is also the landing route -
    // so a seat without VIEW_ANALYTICS used to land here on a page its own
    // sidebar (correctly) hides, staring at a stats error (access-roles
    // matrix follow-up 2026-08-02). Resolve the EFFECTIVE permission set and
    // route such a seat to the first page it may actually see instead.
    // `getDashboardSession` is request-cached, so on cold loads this shares
    // the layout's wave; the extra round trips only run on warm Overview
    // clicks, where the permission answer is what makes the page correct.
    const session = await getDashboardSession(cookie);
    if (!session?.role) {
        redirect('/portal');
    }
    const permissions = resolvePermissions(
        session.role,
        session.permissions,
        ROLE_PERMISSIONS as Record<string, string[]>
    );
    if (!permissions.includes(Permission.VIEW_ANALYTICS)) {
        const firstAllowed = navGroupsForRole(getNavigations(), permissions)[0]
            ?.items[0]?.url;
        if (firstAllowed) {
            redirect(`/${firstAllowed}`);
        }
        // A seat with no dashboard permissions at all: empty sidebar + an
        // honest explanation, never a stats error on a page it cannot use.
        return (
            <div className='flex flex-1 items-center justify-center'>
                <p className='max-w-sm rounded-md border border-line bg-surface-sunken px-6 py-8 text-center text-sm text-content-muted'>
                    Your seat has no dashboard access yet. Ask your
                    administrator to assign a designation or permissions.
                </p>
            </div>
        );
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
            : undefined
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

