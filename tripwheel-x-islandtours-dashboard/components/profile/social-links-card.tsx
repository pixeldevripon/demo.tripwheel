'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    Facebook01Icon,
    InstagramIcon,
    Linkedin01Icon,
    NewTwitterRectangleFreeIcons,
    Share01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useFormContext } from 'react-hook-form';

interface SocialLinksCardProps {
    isEditing: boolean;
}

export function SocialLinksCard({ isEditing }: SocialLinksCardProps) {
    const {
        register,
        formState: { errors },
    } = useFormContext();

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
        <Card className='border-none shadow-sm bg-card '>
            <CardHeader className='pb-4'>
                <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                    <HugeiconsIcon
                        icon={Share01Icon}
                        className='w-5 h-5 text-primary'
                    />
                    Social Media Profiles
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {socialPlatforms.map(platform => (
                        <div key={platform.id} className='space-y-2'>
                            <Label
                                htmlFor={platform.id}
                                className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                                {platform.label}
                            </Label>
                            <div className='relative'>
                                <HugeiconsIcon
                                    icon={platform.icon}
                                    className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground'
                                />
                                <Input
                                    id={platform.id}
                                    {...register(platform.id)}
                                    placeholder={platform.placeholder}
                                    disabled={!isEditing}
                                    className={cn(
                                        'pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all',
                                        errors[platform.id] &&
                                            'border-destructive focus:border-destructive'
                                    )}
                                />
                            </div>
                            {errors[platform.id] && (
                                <p className='text-xs text-destructive mt-1'>
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

