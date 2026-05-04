import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import PageComponents from '@/components/dashboard/page-components';
import { getDashboardStats } from '@/app/_actions/dashboardActions';

export default async function DashboardPage() {
    const reqHeaders = await headers();
    const { data: sessionData } = await authClient.getSession({
        fetchOptions: { headers: reqHeaders },
    });

    if (!sessionData?.session) {
        redirect('/login');
    }

    const { user } = sessionData;
    const statsPromise = getDashboardStats();

    return (
        <div className='flex flex-1 flex-col gap-4 py-8! p-4 pt-0'>
            <PageComponents
                statsPromise={statsPromise}
                loggedInUser={user}
            />
        </div>
    );
}

