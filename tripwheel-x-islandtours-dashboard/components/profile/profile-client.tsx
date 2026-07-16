'use client';

import { ProfileSkeleton } from '@/components/skeletons/profile-skeleton';
import { useProfileQuery, useUpdateProfile } from '@/hooks/profile/use-profile';
import { Role } from '@/lib/config/rbac';
import { profileSchema, type ProfileFormValues } from '@/lib/validations/profile';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
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

export function ProfileClient() {
    const { data: user, isLoading } = useProfileQuery();
    const updateMutation = useUpdateProfile();
    const [isEditing, setIsEditing] = useState(false);

    const form = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            location: '',
            timezone: '',
            instagramUrl: '',
            facebookUrl: '',
            linkedinUrl: '',
            twitterUrl: '',
        },
    });

    useEffect(() => {
        if (user) {
            form.reset({
                name: user.name ?? '',
                email: user.email ?? '',
                phone: user.phone ?? '',
                location: user.location ?? '',
                timezone: user.timezone ?? '',
                instagramUrl: user.operator?.socialMedia?.instagramUrl ?? '',
                facebookUrl: user.operator?.socialMedia?.facebookUrl ?? '',
                linkedinUrl: user.operator?.socialMedia?.linkedinUrl ?? '',
                twitterUrl: user.operator?.socialMedia?.twitterUrl ?? '',
            });
        }
    }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (isLoading) return <ProfileSkeleton />;
    if (!user) return <div>Error loading profile. Please try again.</div>;

    const handleSave = form.handleSubmit((data: ProfileFormValues) => {
        updateMutation.mutate(
            { data, role: user.role, operatorId: user.operator?.id },
            {
                onSuccess: () => {
                    toast.success('Profile updated successfully');
                    setIsEditing(false);
                },
            }
        );
    });

    return (
        <FormProvider {...form}>
            <div className='max-w-7xl space-y-8 pb-10'>
                <ProfileHeader
                    isEditing={isEditing}
                    setIsEditing={setIsEditing}
                    onSave={handleSave}
                    isLoading={updateMutation.isPending}
                />

                <form onSubmit={handleSave}>
                    <motion.div
                        variants={containerVariants}
                        initial='hidden'
                        animate='visible'
                        className='grid grid-cols-12 gap-8'>
                        <div className='col-span-12 lg:col-span-8 space-y-8'>
                            <ProfilePhotoCard user={user} />
                            <PersonalInfoCard user={user} isEditing={isEditing} />
                            {user.role !== Role.USER && (
                                <SocialLinksCard isEditing={isEditing} />
                            )}
                        </div>
                        <div className='col-span-12 lg:col-span-4 space-y-8'>
                            <AccountStatusCard user={user} />
                            <SecurityCard />
                        </div>
                    </motion.div>
                </form>
            </div>
        </FormProvider>
    );
}
