import { getDashboardStats } from '@/app/_actions/dashboardActions';
import { getUserProfile } from '@/app/_actions/userActions';
import PageComponents from '@/components/page-components';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
    const cookie = (await headers()).get('cookie') ?? '';

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
    const statsPromise = getDashboardStats(cookie);

    return (
        <div className='flex flex-1 flex-col gap-4'>
            <PageComponents statsPromise={statsPromise} loggedInUser={user} />
        </div>
    );
}
