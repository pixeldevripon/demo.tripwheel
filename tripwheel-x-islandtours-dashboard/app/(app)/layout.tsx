import DashboardShell from '@/components/shell/dashboard-shell';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { travellerAccountUrl } from '@/lib/public-site';
import { getDashboardSession } from '@/lib/server/dashboard-session';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

/**
 * This layout authenticates, so it reads `headers()` and calls the backend on
 * every entry and can never produce a static shell. Next's guidance for
 * "dynamic dashboards or pages requiring server-side data" is to exempt such a
 * layout from instant validation, which is what this marks.
 *
 * Be clear about what it does NOT buy: because `{children}` is nested inside
 * the async `DashboardContent` below, this exemption does not let pages under
 * this layout pass `unstable_instant: { prefetch: 'static' }` either. That was
 * tested - the build still fails with INSTANT_VALIDATION_ERROR at the
 * `headers()` call on line 36, and scoping with `from: [...]` does not
 * suppress it. Making any page here instant-validatable requires lifting
 * `{children}` out of this awaited subtree first.
 *
 * Sidebar clicks are already fast regardless: layouts are preserved across
 * sibling navigations, so this component does not re-run on a route change.
 * The cost this leaves on the table is the COLD load / hard refresh, which
 * still shows `DashboardSkeleton` until the profile resolves.
 */
export const unstable_instant = false;

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense fallback={<DashboardSkeleton />}>
            <DashboardContent>{children}</DashboardContent>
        </Suspense>
    );
}

async function DashboardContent({ children }: { children: React.ReactNode }) {
    const reqHeaders = await headers();
    const cookie = reqHeaders.get('cookie') || '';

    // ONE parallel wave (session + /users/me + /users/me/permissions), not the
    // up-to-four-wave `getUserProfile`. Everything below is what the shell
    // actually renders; the operator company-info / social-media records that
    // `getUserProfile` additionally fetches were never read here.
    const session = await getDashboardSession(cookie);

    if (!session) {
        redirect('/portal');
    }

    // Travellers have no surface in this app since the /account door was
    // removed (2026-07-28) - they hold no permissions here, so they would
    // otherwise land on an empty shell with a blank sidebar. A session can
    // still exist for a short while after the cutover, so send them where
    // they actually belong. Every route under this layout is covered, not
    // just the root.
    if (session.role === 'USER') {
        redirect(travellerAccountUrl());
    }

    // `/users/me` carries the operator record, so its absence is decidable from
    // the wave above - a TOUR_OPERATOR without one still needs onboarding.
    if (session.role === 'TOUR_OPERATOR' && !session.hasOperator) {
        redirect('/onboarding');
    }

    return (
        <DashboardShell
            userName={session.name}
            userEmail={session.email}
            userRole={session.role}
            userSurface={session.surface}
            userPermissions={session.permissions}
            userImage={session.image}>
            {children}
        </DashboardShell>
    );
}

