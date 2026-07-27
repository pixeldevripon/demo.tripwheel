'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Camera01Icon, Loading03Icon } from '@hugeicons/core-free-icons';

import { StatusBadge } from '@/components/common/status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUpdateProfilePhoto } from '@/hooks/profile/use-profile';
import { mediaApi } from '@/lib/api/media';
import type { UserProfile } from '@/types/profile';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

// bundle-dynamic-imports: Load heavy cropper only when needed
const ImageCropper = dynamic(() => import('./image-cropper'), {
    loading: () => (
        <HugeiconsIcon
            icon={Loading03Icon}
            className='mx-auto my-8 size-10 animate-spin text-primary'
        />
    ),
    ssr: false,
});

/**
 * Identity summary: photo, name, email, role, verification and tenure in one
 * row. Replaces the old Profile Photo and Account Status cards.
 */
export function ProfileIdentityCard({ user }: { user: UserProfile }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [openCropper, setOpenCropper] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string>('');
    const updatePhoto = useUpdateProfilePhoto();

    const memberSince = user.createdAt
        ? new Intl.DateTimeFormat('en-US', {
              month: 'long',
              year: 'numeric',
          }).format(new Date(user.createdAt))
        : null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File too large. Max size is 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setTempImageSrc(reader.result as string);
            setOpenCropper(true);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCropComplete = async (file: File) => {
        setOpenCropper(false);
        setUploading(true);
        try {
            const [uploaded] = await mediaApi.upload([file]);
            if (!uploaded?.url) {
                toast.error('Upload failed');
                return;
            }
            await updatePhoto.mutateAsync(uploaded.url);
            toast.success('Profile photo updated');
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to upload image',
            );
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = async () => {
        setUploading(true);
        try {
            await updatePhoto.mutateAsync(null);
            toast.success('Profile photo removed');
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to remove photo',
            );
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card>
            <CardContent className='flex flex-col gap-6 sm:flex-row sm:items-center'>
                <div className='relative shrink-0 self-center sm:self-auto'>
                    <Avatar className='size-20 ring-1 ring-line'>
                        {user.image ? (
                            <AvatarImage
                                src={user.image}
                                className='object-cover'
                            />
                        ) : null}
                        <AvatarFallback className='bg-primary/10 text-xl text-primary'>
                            {user.name?.charAt(0) || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <button
                        type='button'
                        aria-label='Change profile photo'
                        title='Change profile photo'
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className='absolute -right-0.5 -bottom-0.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background transition-opacity hover:opacity-90 disabled:opacity-50'>
                        <HugeiconsIcon
                            icon={uploading ? Loading03Icon : Camera01Icon}
                            className={
                                uploading
                                    ? 'size-3.5 animate-spin'
                                    : 'size-3.5'
                            }
                        />
                    </button>
                    <input
                        type='file'
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept='image/*'
                        className='hidden'
                        aria-label='Upload profile photo'
                    />
                </div>

                <div className='min-w-0 flex-1 text-center sm:text-left'>
                    <div className='flex flex-wrap items-center justify-center gap-2 sm:justify-start'>
                        <h2 className='truncate text-lg font-semibold'>
                            {user.name}
                        </h2>
                        <Badge
                            variant='outline'
                            className='font-medium capitalize'>
                            {user.role?.toLowerCase().replace('_', ' ') ||
                                'user'}
                        </Badge>
                        <StatusBadge
                            variant={user.emailVerified ? 'success' : 'danger'}>
                            {user.emailVerified ? 'Verified' : 'Unverified'}
                        </StatusBadge>
                    </div>
                    <p className='mt-0.5 truncate text-sm text-muted-foreground'>
                        {user.email}
                        {memberSince && (
                            <span className='text-muted-foreground/70'>
                                {' '}
                                · Member since {memberSince}
                            </span>
                        )}
                    </p>
                </div>

                {user.image ? (
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={handleRemovePhoto}
                        disabled={uploading}
                        className='self-center text-muted-foreground hover:text-destructive sm:self-auto'>
                        Remove photo
                    </Button>
                ) : null}
            </CardContent>

            {openCropper ? (
                <ImageCropper
                    open={openCropper}
                    imageSrc={tempImageSrc}
                    onClose={() => setOpenCropper(false)}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </Card>
    );
}
