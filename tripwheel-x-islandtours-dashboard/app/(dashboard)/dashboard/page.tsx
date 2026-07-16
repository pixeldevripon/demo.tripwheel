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

    const statsPromise = getDashboardStats();

    return (
        <div className='flex flex-1 flex-col gap-4'>
            <PageComponents statsPromise={statsPromise} loggedInUser={user} />
        </div>
    );
}

