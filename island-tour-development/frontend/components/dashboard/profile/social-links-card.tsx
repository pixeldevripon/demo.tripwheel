'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Facebook01Icon,
    InstagramIcon,
    Linkedin,
    NewTwitterRectangleFreeIcons,
    Share01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

interface SocialLinksCardProps {
    user: any;
    isEditing: boolean;
}

export function SocialLinksCard({ user, isEditing }: SocialLinksCardProps) {
    const socialFields = [
        {
            id: 'instagram',
            label: 'Instagram',
            icon: InstagramIcon,
            placeholder: '@yourusername',
            defaultValue: user?.socials?.instagram || '',
        },
        {
            id: 'facebook',
            label: 'Facebook',
            icon: Facebook01Icon,
            placeholder: 'facebook.com/yourpage',
            defaultValue: user?.socials?.facebook || '',
        },
        {
            id: 'linkedin',
            label: 'LinkedIn',
            icon: Linkedin,
            placeholder: 'linkedin.com/in/youraccount',
            defaultValue: user?.socials?.linkedin || '',
        },
        {
            id: 'twitter',
            label: 'Twitter / X',
            icon: NewTwitterRectangleFreeIcons,
            placeholder: 'https://x.com/youraccount',
            defaultValue: user?.socials?.twitter || '',
        },
    ];

    return (
        <Card className='border-none shadow-sm bg-card rounded-2xl'>
            <CardHeader className='pb-4'>
                <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                    <HugeiconsIcon
                        icon={Share01Icon}
                        className='w-5 h-5 text-primary'
                    />
                    Social Media & Links
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {socialFields.map(field => (
                        <div key={field.id} className='space-y-2'>
                            <Label
                                htmlFor={field.id}
                                className='text-sm font-medium text-muted-foreground flex items-center gap-2'>
                                {field.label}
                            </Label>
                            <div className='relative'>
                                <HugeiconsIcon
                                    icon={field.icon}
                                    className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground'
                                />
                                <Input
                                    id={field.id}
                                    defaultValue={field.defaultValue}
                                    placeholder={field.placeholder}
                                    disabled={!isEditing}
                                    className='pl-10 h-11 bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 rounded-xl transition-all'
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

