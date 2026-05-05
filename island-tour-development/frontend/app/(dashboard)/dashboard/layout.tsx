import DashboardWrapper from '@/components/dashboard/dashbaord-wraper';
import { authClient } from '@/lib/auth-client';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const reqHeaders = await headers();

    const { data: sessionData } = await authClient.getSession({
        fetchOptions: { headers: reqHeaders },
    });

    if (!sessionData?.session) {
        redirect('/login');
    }

    const { user } = sessionData;
    const userRole = (user as unknown as { role?: string }).role;

    // ── Onboarding Guard ───────────────────────────────────────────────────────
    // If the user is a TOUR_OPERATOR, we must ensure they have an operator profile.
    // We check this on the server side using our helper action.
    if (userRole === 'TOUR_OPERATOR') {
        const { checkOnboardingStatus } =
            await import('@/app/_actions/onboardingActions');
        const { needsOnboarding } = await checkOnboardingStatus();
        if (needsOnboarding) {
            redirect('/onboarding');
        }
    }

    return (
        <DashboardWrapper
            userName={user.name}
            userEmail={user.email}
            userRole={userRole}>
            {children}
        </DashboardWrapper>
    );
}

