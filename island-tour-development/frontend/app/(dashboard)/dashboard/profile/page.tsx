import { getUserProfile } from '@/app/_actions/userActions';
import { ProfileSkeleton } from '@/components/skelitons/profile-skeleton';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { ProfileClient } from '../../../../components/dashboard/profile/profile-client';

export default async function ProfilePage() {
    return (
        <Suspense fallback={<ProfileSkeleton />}>
            <ProfileDataWrapper />
        </Suspense>
    );
}

async function ProfileDataWrapper() {
    const reqHeaders = await headers();
    const cookie = reqHeaders.get('cookie') || '';
    const user = await getUserProfile(cookie);

    if (!user) {
        return <div>Error loading profile. Please try again.</div>;
    }

    return <ProfileClient user={user} />;
}

