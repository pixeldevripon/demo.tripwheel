'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { AccountStatusCard } from './account-status-card';
import { PersonalInfoCard } from './personal-info-card';
import { ProfileHeader } from './profile-header';
import { ProfilePhotoCard } from './profile-photo-card';
import { SecurityCard } from './security-card';
import { SocialLinksCard } from './social-links-card';

interface ProfileClientProps {
    user: any; // Ideally typed with your User interface
}

export function ProfileClient({ user }: ProfileClientProps) {
    const [isEditing, setIsEditing] = useState(false);

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.4,
                staggerChildren: 0.1,
            },
        },
    };

    return (
        <div className='max-w-7xl space-y-8 pb-10'>
            <ProfileHeader isEditing={isEditing} setIsEditing={setIsEditing} />

            <motion.div
                variants={containerVariants}
                initial='hidden'
                animate='visible'
                className='grid grid-cols-12 gap-8'>
                {/* Left Column - Main Info */}
                <div className='col-span-12 lg:col-span-8 space-y-8'>
                    <ProfilePhotoCard user={user} />
                    <PersonalInfoCard user={user} isEditing={isEditing} />
                    <SocialLinksCard user={user} isEditing={isEditing} />
                </div>

                {/* Right Column - Secondary Info & Security */}
                <div className='col-span-12 lg:col-span-4 space-y-8'>
                    <AccountStatusCard />
                    <SecurityCard />
                </div>
            </motion.div>
        </div>
    );
}

