'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Camera01Icon, Delete02Icon, Loading03Icon, Upload02Icon } from '@hugeicons/core-free-icons';

import { mediaApi } from '@/lib/api/media';
import { useUpdateProfilePhoto } from '@/hooks/profile/use-profile';
import type { UserProfile } from '@/types/profile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

// bundle-dynamic-imports: Load heavy cropper only when needed
const ImageCropper = dynamic(() => import('./image-cropper'), {
    loading: () => (
        <HugeiconsIcon icon={Loading03Icon} className='w-10 h-10 animate-spin text-primary mx-auto my-10' />
    ),
    ssr: false,
});

export function ProfilePhotoCard({ user }: { user: UserProfile }) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [openCropper, setOpenCropper] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string>('');
    const updatePhoto = useUpdateProfilePhoto();

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
            if (!uploaded?.url) { toast.error('Upload02Icon failed'); return; }
            await updatePhoto.mutateAsync(uploaded.url);
            toast.success('Profile photo updated successfully');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to upload image');
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
            toast.error(err instanceof Error ? err.message : 'Failed to remove photo');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card className='border-none shadow-sm bg-card overflow-hidden'>
            <CardHeader className='pb-4'>
                <CardTitle className='text-lg font-semibold flex items-center gap-2'>
                    <HugeiconsIcon icon={Camera01Icon} className='w-5 h-5 text-primary' />
                    Profile Photo
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className='flex flex-col md:flex-row items-center gap-8'>
                    <div className='relative group'>
                        <Avatar className='w-32 h-32 border-4 border-background shadow-xl ring-1 ring-border group-hover:opacity-90 transition-all duration-300'>
                            <AvatarImage src={user.image ?? ''} className='object-cover' />
                            <AvatarFallback className='bg-primary/10 text-primary text-2xl'>
                                {user.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className='absolute bottom-1 right-1 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform duration-200 ring-2 ring-background disabled:opacity-50 disabled:scale-100'>
                            {uploading ? (
                                <HugeiconsIcon icon={Loading03Icon} className='w-4 h-4 animate-spin' />
                            ) : (
                                <HugeiconsIcon icon={Upload02Icon} className='w-4 h-4' />
                            )}
                        </button>
                    </div>
                    <div className='flex-1 space-y-4 text-center md:text-left'>
                        <div className='space-y-1'>
                            <h3 className='font-medium text-foreground'>Update your photo</h3>
                            <p className='text-sm text-muted-foreground'>
                                Supported formats: JPG, PNG or WEBP. Max size 5MB.
                            </p>
                        </div>
                        <div className='flex flex-wrap justify-center md:justify-start gap-2'>
                            <input
                                type='file'
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept='image/*'
                                className='hidden'
                            />
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                size='sm'
                                variant='outline'
                                className='rounded-lg h-9 gap-2'>
                                {uploading ? <HugeiconsIcon icon={Loading03Icon} className='w-4 h-4 animate-spin' /> : null}
                                Upload02Icon New
                            </Button>
                            {user.image ? (
                                <Button
                                    onClick={handleRemovePhoto}
                                    disabled={uploading}
                                    size='sm'
                                    variant='ghost'
                                    className='rounded-lg h-9 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2'>
                                    <HugeiconsIcon icon={Delete02Icon} className='w-4 h-4' />
                                    Remove
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {openCropper ? (
                    <ImageCropper
                        open={openCropper}
                        imageSrc={tempImageSrc}
                        onClose={() => setOpenCropper(false)}
                        onCropComplete={handleCropComplete}
                    />
                ) : null}
            </CardContent>
        </Card>
    );
}
