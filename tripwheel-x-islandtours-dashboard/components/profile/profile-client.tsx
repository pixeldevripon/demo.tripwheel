'use client';

import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton';
import { useProfileQuery } from '@/hooks/profile/use-profile';
import { Role } from '@/lib/config/rbac';
import { motion } from 'framer-motion';
import { AccountStatusCard } from './account-status-card';
import { PersonalInfoCard } from './personal-info-card';
import { ProfileHeader } from './profile-header';
import { ProfilePhotoCard } from './profile-photo-card';
import { SecurityCard } from './security-card';
import { SocialLinksCard } from './social-links-card';

const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, staggerChildren: 0.1 },
    },
};

/**
 * Profile page. Each card owns its own edit state, form and save (Phase 20) -
 * there is no page-wide edit mode, so editing your phone number can never
 * accidentally submit a half-typed social link.
 */
export function ProfileClient() {
    const { data: user, isLoading } = useProfileQuery();

    if (isLoading) return <ProfileSkeleton />;
    if (!user) return <div>Error loading profile. Please try again.</div>;

    return (
        <div className='max-w-7xl space-y-8 pb-10'>
            <ProfileHeader />

            <motion.div
                variants={containerVariants}
                initial='hidden'
                animate='visible'
                className='grid grid-cols-12 gap-8'>
                <div className='col-span-12 lg:col-span-8 space-y-8'>
                    <ProfilePhotoCard user={user} />
                    <PersonalInfoCard user={user} />
                    {user.role !== Role.USER && <SocialLinksCard user={user} />}
                </div>
                <div className='col-span-12 lg:col-span-4 space-y-8'>
                    <AccountStatusCard user={user} />
                    <SecurityCard />
                </div>
            </motion.div>
        </div>
    );
}
