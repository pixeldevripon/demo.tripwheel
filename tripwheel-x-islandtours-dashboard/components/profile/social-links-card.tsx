'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Facebook01Icon,
    InstagramIcon,
    Linkedin01Icon,
    Loading03Icon,
    NewTwitterRectangleFreeIcons,
    PencilEdit02Icon,
    Share01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { useUpdateProfile } from '@/hooks/profile/use-profile';
import {
    profileSchema,
    type ProfileFormValues,
} from '@/lib/validations/profile';
import { profileValuesFromUser } from './profile-form-values';
import type { UserProfile } from '@/types/profile';

interface SocialLinksCardProps {
    user: UserProfile;
}

/**
 * Per-card edit (Phase 20): owns its edit state and form. The form carries
 * the full profile value set so the save payload matches the old page-wide
 * form's shape exactly; only the social URLs are editable here.
 */
export function SocialLinksCard({ user }: SocialLinksCardProps) {
    const updateMutation = useUpdateProfile();
    const [isEditing, setIsEditing] = useState(false);

    const {
        register,
        formState: { errors },
        reset,
        handleSubmit,
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: profileValuesFromUser(user),
    });

    useEffect(() => {
        if (!isEditing) reset(profileValuesFromUser(user));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isEditing]);

    const onSave = handleSubmit((data: ProfileFormValues) => {
        updateMutation.mutate(
            { data, role: user.role, operatorId: user.operator?.id },
            {
                onSuccess: () => {
                    toast.success('Profile updated successfully');
                    setIsEditing(false);
                },
            },
        );
    });

    function cancelEdit() {
        reset(profileValuesFromUser(user));
        setIsEditing(false);
    }

    const socialPlatforms = [
        {
            id: 'instagramUrl',
            label: 'Instagram',
            icon: InstagramIcon,
            placeholder: 'https://instagram.com/username',
        },
        {
            id: 'facebookUrl',
            label: 'Facebook',
            icon: Facebook01Icon,
            placeholder: 'https://facebook.com/username',
        },
        {
            id: 'linkedinUrl',
            label: 'LinkedIn',
            icon: Linkedin01Icon,
            placeholder: 'https://linkedin.com/in/username',
        },
        {
            id: 'twitterUrl',
            label: 'Twitter / X',
            icon: NewTwitterRectangleFreeIcons,
            placeholder: 'https://twitter.com/username',
        },
    ] as const;

    return (
        <Card>
            <CardHeader className='pb-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                        <HugeiconsIcon
                            icon={Share01Icon}
                            className='size-5 text-primary'
                        />
                        Social Media Profiles
                    </CardTitle>
                    {isEditing ? (
                        <div className='flex gap-2'>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={cancelEdit}
                                disabled={updateMutation.isPending}>
                                Cancel
                            </Button>
                            <Button
                                size='sm'
                                onClick={onSave}
                                disabled={updateMutation.isPending}>
                                {updateMutation.isPending && (
                                    <HugeiconsIcon
                                        icon={Loading03Icon}
                                        className='size-4 animate-spin'
                                    />
                                )}
                                Save
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setIsEditing(true)}>
                            <HugeiconsIcon
                                icon={PencilEdit02Icon}
                                className='size-4'
                            />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {socialPlatforms.map(platform => (
                        <div key={platform.id} className='space-y-2'>
                            <Label htmlFor={platform.id}>{platform.label}</Label>
                            <div className='relative'>
                                <HugeiconsIcon
                                    icon={platform.icon}
                                    className='absolute left-3 top-1/2 -translate-y-1/2 size-4 text-content-muted'
                                />
                                <Input
                                    id={platform.id}
                                    {...register(platform.id)}
                                    placeholder={platform.placeholder}
                                    disabled={!isEditing}
                                    aria-invalid={!!errors[platform.id]}
                                    className='pl-10'
                                />
                            </div>
                            {errors[platform.id] && (
                                <p className='text-xs font-medium text-danger-fg mt-1'>
                                    {errors[platform.id]?.message as string}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
