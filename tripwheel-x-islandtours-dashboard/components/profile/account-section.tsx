'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    CloudUploadIcon,
    Loading03Icon,
} from '@hugeicons/core-free-icons';

import { StatusBadge } from '@/components/common/status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    useUpdateProfile,
    useUpdateProfilePhoto,
} from '@/hooks/profile/use-profile';
import { mediaApi } from '@/lib/api/media';
import {
    profileSchema,
    type ProfileFormValues,
} from '@/lib/validations/profile';
import type { UserProfile } from '@/types/profile';
import { formatDate } from '@/utils/intl-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ChangeEmailDialog } from './change-email-dialog';
import {
    ProfileSaveButton,
    ProfileSection,
    ProfileTextField,
} from './profile-section';

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
 * The Account section (Webflow-settings style): flat blocks divided by
 * hairlines - Avatar, Account info (name + email), Account details rows.
 * Save sits in the block header, enabled only while the form is dirty.
 */
export function AccountSection({ user }: { user: UserProfile }) {
    return (
        <div>
            <AvatarBlock user={user} />
            <AccountInfoBlock user={user} />
            <AccountDetailsBlock user={user} />
        </div>
    );
}

/* ── Avatar ─────────────────────────────────────────────────────────────── */

function AvatarBlock({ user }: { user: UserProfile }) {
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
        <ProfileSection title='Avatar'>
            <div className='mt-5 flex items-start gap-5'>
                <Avatar className='size-14 shrink-0 ring-1 ring-line'>
                    {user.image ? (
                        <AvatarImage src={user.image} className='object-cover' />
                    ) : null}
                    <AvatarFallback className='bg-muted text-lg'>
                        {user.name?.charAt(0) || 'U'}
                    </AvatarFallback>
                </Avatar>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Button
                            size='sm'
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}>
                            <HugeiconsIcon
                                icon={
                                    uploading ? Loading03Icon : CloudUploadIcon
                                }
                                className={
                                    uploading
                                        ? 'size-4 animate-spin'
                                        : 'size-4'
                                }
                            />
                            Upload
                        </Button>
                        {user.image ? (
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={handleRemovePhoto}
                                disabled={uploading}
                                className='text-muted-foreground hover:text-destructive'>
                                Remove
                            </Button>
                        ) : null}
                    </div>
                    <p className='mt-2.5 max-w-sm text-sm text-muted-foreground'>
                        Upload an image up to 5MB. Your avatar shows up across
                        the dashboard and in team notifications.
                    </p>
                </div>
                <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept='image/*'
                    className='hidden'
                    aria-label='Upload profile photo'
                />
            </div>

            {openCropper ? (
                <ImageCropper
                    open={openCropper}
                    imageSrc={tempImageSrc}
                    onClose={() => setOpenCropper(false)}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </ProfileSection>
    );
}

/* ── Account info (name + email) ────────────────────────────────────────── */

function AccountInfoBlock({ user }: { user: UserProfile }) {
    const updateMutation = useUpdateProfile();
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isDirty },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
        defaultValues: { name: user.name ?? '' },
    });

    const onSave = handleSubmit(data => {
        updateMutation.mutate(data, {
            onSuccess: () => {
                toast.success('Profile updated');
                reset(data);
            },
        });
    });

    return (
        <ProfileSection
            title='Account info'
            description='Displayed on your account, emails and notifications.'
            action={
                <ProfileSaveButton
                    onClick={onSave}
                    disabled={!isDirty}
                    isPending={updateMutation.isPending}
                />
            }>
            <form onSubmit={onSave} className='mt-6 max-w-xl space-y-6'>
                <ProfileTextField
                    label='Full name'
                    registration={register('name')}
                    error={errors.name?.message}
                />

                {/* Email changes go through the verified Better Auth
                    change-email flow (dialog) - never a profile save. The
                    address renders as a calm field-shaped row with the
                    action inline, not as a disabled input + detached button. */}
                <div className='space-y-2'>
                    <Label id='email-label'>Email</Label>
                    <div
                        aria-labelledby='email-label'
                        className='flex items-center justify-between gap-3 rounded-md border border-input bg-muted/30 py-1 pl-3 pr-1'>
                        <span className='truncate text-sm'>{user.email}</span>
                        <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            className='h-7 shrink-0 px-2.5 text-primary hover:bg-primary/10 hover:text-primary'
                            onClick={() => setEmailDialogOpen(true)}>
                            Change email
                        </Button>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                        We confirm any change from your current inbox before it
                        takes effect.
                    </p>
                </div>
            </form>

            <ChangeEmailDialog
                open={emailDialogOpen}
                onOpenChange={setEmailDialogOpen}
                currentEmail={user.email}
            />
        </ProfileSection>
    );
}

/* ── Account details ────────────────────────────────────────────────────── */

function AccountDetailsBlock({ user }: { user: UserProfile }) {
    const rows: { label: string; value: React.ReactNode }[] = [
        {
            label: 'Account created',
            value: user.createdAt
                ? formatDate(user.createdAt, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                  })
                : '-',
        },
        {
            label: 'Role',
            value: (
                <span className='capitalize'>
                    {user.role?.toLowerCase().replace('_', ' ') || 'user'}
                </span>
            ),
        },
        {
            label: 'Email verification',
            value: (
                <StatusBadge
                    variant={user.emailVerified ? 'success' : 'danger'}>
                    {user.emailVerified ? 'Verified' : 'Unverified'}
                </StatusBadge>
            ),
        },
    ];

    return (
        <ProfileSection title='Account details'>
            <dl className='mt-4'>
                {rows.map(row => (
                    <div
                        key={row.label}
                        className='flex items-center gap-4 border-b border-line py-3.5 text-sm'>
                        <dt className='w-44 shrink-0 text-muted-foreground sm:w-56'>
                            {row.label}
                        </dt>
                        <dd className='min-w-0'>{row.value}</dd>
                    </div>
                ))}
            </dl>
        </ProfileSection>
    );
}
