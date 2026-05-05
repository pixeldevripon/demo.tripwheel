'use client';

import {
    Facebook01Icon,
    Globe02Icon,
    InstagramIcon,
    Share01Icon,
    WhatsappIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
            id: 'whatsapp',
            label: 'WhatsApp',
            icon: WhatsappIcon,
            placeholder: '+1 234 567 890',
            defaultValue: user?.socials?.whatsapp || '',
        },
        {
            id: 'website',
            label: 'Website',
            icon: Globe02Icon,
            placeholder: 'https://yourwebsite.com',
            defaultValue: user?.socials?.website || '',
        },
    ];

    return (
        <Card className='border-none shadow-sm bg-card rounded-2xl'>
            <CardHeader className='pb-4'>
                <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                    <HugeiconsIcon icon={Share01Icon} className='w-5 h-5 text-primary' />
                    Social Media & Links
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {socialFields.map((field) => (
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
