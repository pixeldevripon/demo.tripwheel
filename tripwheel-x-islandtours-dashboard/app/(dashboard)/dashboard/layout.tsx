import { getUserProfile } from '@/app/_actions/userActions';
import DashboardShell from '@/components/shell/dashboard-shell';
import { DashboardSkeleton } from '@/components/skeletons/dashboard-skeleton';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

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
        redirect('/portal');
    }

    const userRole = (user as unknown as { role?: string }).role;

    // getUserProfile already fetched the operator record; a TOUR_OPERATOR with
    // none still needs onboarding. Derive it here instead of a second round-trip.
    if (
        userRole === 'TOUR_OPERATOR' &&
        !(user as unknown as { operator?: unknown }).operator
    ) {
        redirect('/onboarding');
    }

    return (
        <DashboardShell
            userName={user.name}
            userEmail={user.email}
            userRole={userRole}
            userImage={user.image}>
            {children}
        </DashboardShell>
    );
}

