import DashboardWrapper from '@/components/dashboard/dashbaord-wraper';
import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardSkeleton } from '@/components/skelitons/dashboard-skeleton';
import { getUserProfile } from '@/app/_actions/userActions';

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

    // Use our cached getUserProfile which is connected to the 'user-profile' tag
    const user = await getUserProfile(cookie);

    if (!user) {
        redirect('/login');
    }

    const userRole = (user as unknown as { role?: string }).role;

    if (userRole === 'TOUR_OPERATOR') {
        const { checkOnboardingStatus } = await import(
            '@/app/_actions/onboardingActions'
        );
        const { needsOnboarding } = await checkOnboardingStatus();
        if (needsOnboarding) {
            redirect('/onboarding');
        }
    }

    return (
        <DashboardWrapper
            userName={user.name}
            userEmail={user.email}
            userRole={userRole}
            userImage={user.image}>
            {children}
        </DashboardWrapper>
    );
}

