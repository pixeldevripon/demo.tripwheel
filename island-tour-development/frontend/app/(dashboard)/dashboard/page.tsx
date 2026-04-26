import { LogoutButton } from '@/components/auth/logout-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { authClient } from '@/lib/auth-client';

export const metadata = {
    title: 'Dashboard - Island Tours',
};

export default async function DashboardPage() {
    const reqHeaders = await headers();

    const { data: sessionData } = await authClient.getSession({
        fetchOptions: {
            headers: reqHeaders,
        },
    });

    if (!sessionData || !sessionData.session) {
        redirect('/login');
    }

    const { user } = sessionData;

    return (
        <div className='min-h-screen bg-muted/20'>
            <header className='bg-background border-b px-6 py-4 flex items-center justify-between'>
                <div>
                    <h1 className='text-xl font-bold tracking-tight'>
                        Island Tours Dashboard
                    </h1>
                </div>
                <div className='flex items-center gap-6'>
                    <div className='flex flex-col items-end'>
                        <span className='text-sm font-semibold'>
                            {user.name}
                        </span>
                        <span className='text-xs text-muted-foreground uppercase tracking-wider'>
                            {/* @ts-expect-error Custom fields from separate backend aren't typed in frontend client */}
                            {user.role || 'user'}
                        </span>
                    </div>
                    <LogoutButton />
                </div>
            </header>

            <main className='p-6 max-w-5xl mx-auto mt-6'>
                <Card>
                    <CardHeader>
                        <CardTitle className='text-2xl'>
                            Welcome back, {user.name}!
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className='space-y-4'>
                            <p className='text-muted-foreground'>
                                This is your protected dashboard. Only
                                authenticated users can see this page.
                            </p>

                            <div className='grid grid-cols-2 gap-4 pt-4 mt-4 border-t'>
                                <div>
                                    <h3 className='font-semibold text-sm text-muted-foreground uppercase'>
                                        Email Address
                                    </h3>
                                    <p className='mt-1'>{user.email}</p>
                                </div>
                                <div>
                                    <h3 className='font-semibold text-sm text-muted-foreground uppercase'>
                                        Account Status
                                    </h3>
                                    <p className='mt-1 flex items-center gap-2'>
                                        <span className='w-2 h-2 rounded-full bg-green-500'></span>
                                        {user.emailVerified
                                            ? 'Verified'
                                            : 'Active'}
                                    </p>
                                </div>
                                <div>
                                    <h3 className='font-semibold text-sm text-muted-foreground uppercase'>
                                        User ID
                                    </h3>
                                    <p className='mt-1 font-mono text-sm'>
                                        {user.id}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

