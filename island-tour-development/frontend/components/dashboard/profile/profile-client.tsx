'use client';

import { motion } from 'framer-motion';
import { useState, useTransition, useEffect } from 'react';
import { AccountStatusCard } from './account-status-card';
import { PersonalInfoCard } from './personal-info-card';
import { ProfileHeader } from './profile-header';
import { ProfilePhotoCard } from './profile-photo-card';
import { SecurityCard } from './security-card';
import { SocialLinksCard } from './social-links-card';
import { toast } from 'sonner';
import { updateAdminSocialMedia, updateOperatorSocialMedia, updateUserProfile } from '@/app/_actions/userActions';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, type ProfileFormValues } from '@/lib/validations/profile';

interface ProfileClientProps {
    user: any;
}

export function ProfileClient({ user }: ProfileClientProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, startTransition] = useTransition();

    const methods = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: {
            name: user?.name || '',
            email: user?.email || '',
            phone: user?.phone || '',
            location: user?.location || '',
            timezone: user?.timezone || '',
            instagramUrl: user?.operator?.socialMedia?.instagramUrl || '',
            facebookUrl: user?.operator?.socialMedia?.facebookUrl || '',
            linkedinUrl: user?.operator?.socialMedia?.linkedinUrl || '',
            twitterUrl: user?.operator?.socialMedia?.twitterUrl || '',
        },
    });

    // Sync form with fresh data from server (after revalidation)
    useEffect(() => {
        if (user) {
            methods.reset({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                location: user.location || '',
                timezone: user.timezone || '',
                instagramUrl: user.operator?.socialMedia?.instagramUrl || '',
                facebookUrl: user.operator?.socialMedia?.facebookUrl || '',
                linkedinUrl: user.operator?.socialMedia?.linkedinUrl || '',
                twitterUrl: user.operator?.socialMedia?.twitterUrl || '',
            });
        }
    }, [user, methods]);

    const handleSave = async (data: ProfileFormValues) => {
        startTransition(async () => {
            const userData = {
                name: data.name,
                phone: data.phone,
                location: data.location,
                timezone: data.timezone,
            };

            const socialData = {
                facebookUrl: data.facebookUrl,
                twitterUrl: data.twitterUrl,
                linkedinUrl: data.linkedinUrl,
                instagramUrl: data.instagramUrl,
            };

            try {
                // Initialize actions array to run in parallel
                const actions: Promise<any>[] = [updateUserProfile(userData)];

                // Add role-specific social media update if applicable
                if (user.role === 'ADMIN') {
                    actions.push(updateAdminSocialMedia(socialData));
                } else if (user.role === 'TOUR_OPERATOR' && user.operator?.id) {
                    actions.push(updateOperatorSocialMedia(user.operator.id, socialData));
                }

                // Execute all updates in parallel (Eliminating network waterfall)
                const results = await Promise.all(actions);
                
                const userResult = results[0];
                const socialResult = results[1]; // might be undefined if no social action was added

                // Aggregate and handle errors
                const errors: string[] = [];
                if (!userResult.success) errors.push(userResult.error || 'Personal info update failed');
                if (socialResult && !socialResult.success) errors.push(socialResult.error || 'Social media update failed');

                if (errors.length > 0) {
                    // Show specific failures
                    errors.forEach(err => toast.error(err));
                    
                    // If at least one part succeeded, notify the user
                    const successCount = results.filter(r => r.success).length;
                    if (successCount > 0) {
                        toast.info('Some changes were saved, but others failed. Please check the fields and try again.');
                    }
                    
                    // Keep editing mode active so they can fix errors
                    return;
                }

                toast.success('Profile updated successfully');
                setIsEditing(false);
            } catch (error) {
                toast.error('An unexpected error occurred during save');
            }
        });
    };

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
        <FormProvider {...methods}>
            <div className='max-w-7xl space-y-8 pb-10'>
                <ProfileHeader 
                    isEditing={isEditing} 
                    setIsEditing={setIsEditing} 
                    onSave={methods.handleSubmit(handleSave)}
                    isLoading={isPending}
                />

                <form onSubmit={methods.handleSubmit(handleSave)}>
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
                            <AccountStatusCard user={user} />
                            <SecurityCard />
                        </div>
                    </motion.div>
                </form>
            </div>
        </FormProvider>
    );
}

