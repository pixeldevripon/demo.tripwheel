'use client';

import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton';
import { useProfileQuery } from '@/hooks/profile/use-profile';
import { Role } from '@/lib/config/rbac';
import { motion } from 'framer-motion';
import { PersonalInfoCard } from './personal-info-card';
import { ProfileHeader } from './profile-header';
import { ProfileIdentityCard } from './profile-identity-card';
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
        <div className='mx-auto w-full max-w-5xl space-y-6 pb-8'>
            <ProfileHeader />

            <motion.div
                variants={containerVariants}
                initial='hidden'
                animate='visible'
                className='space-y-6'>
                <ProfileIdentityCard user={user} />
                <PersonalInfoCard user={user} />
                {user.role !== Role.USER && <SocialLinksCard user={user} />}
                <SecurityCard />
            </motion.div>
        </div>
    );
}
