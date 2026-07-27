'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';

import { setPasswordAction } from '@/app/_actions/userActions';
import { SecretField } from '@/components/settings/settings-fields';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import {
    changePasswordSchema,
    setPasswordSchema,
    type PasswordFormValues,
} from '@/lib/validations/profile';
import { formatDate } from '@/utils/intl-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

/**
 * The Security section (Webflow-settings style): the change-password form
 * lives inline in a flat block. Branches on `hasPassword`: credentialed
 * accounts change their password (other sessions revoked); invite-provisioned
 * accounts that never set one get the set-password variant instead.
 */
export function SecuritySection() {
    const router = useRouter();
    const { data: session } = authClient.useSession();
    const hasPassword = Boolean(
        (session?.user as { hasPassword?: boolean } | undefined)?.hasPassword,
    );
    const passwordChangedAt = (
        session?.user as { passwordChangedAt?: string } | undefined
    )?.passwordChangedAt;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<PasswordFormValues>({
        // One cast at the schema/form boundary: the two schemas validate the
        // same field shape, they just disagree on whether currentPassword
        // exists (see PasswordFormValues in lib/validations/profile.ts).
        resolver: zodResolver(
            hasPassword ? changePasswordSchema : setPasswordSchema,
        ) as Resolver<PasswordFormValues>,
        defaultValues: { currentPassword: '', newPassword: '' },
    });

    const mutation = useMutation({
        mutationFn: async (values: PasswordFormValues) => {
            if (hasPassword) {
                const result = await authClient.changePassword({
                    newPassword: values.newPassword,
                    currentPassword: values.currentPassword ?? '',
                    revokeOtherSessions: true,
                });
                if (result.error) throw result.error;
            } else {
                await setPasswordAction(values.newPassword);
            }
        },
        onSuccess: () => {
            toast.success(hasPassword ? 'Password updated' : 'Password set', {
                description:
                    'Your security credentials have been successfully updated.',
            });
            reset({ currentPassword: '', newPassword: '' });
            router.refresh();
        },
        onError: (err: any) => {
            if (err?.status === 401 || err?.code === 'INVALID_PASSWORD') {
                toast.error('Verification failed', {
                    description:
                        'The current password you entered is incorrect.',
                });
            } else if (err?.code === 'PASSWORD_TOO_SHORT') {
                toast.error('Password too short', {
                    description:
                        'Your new password must be at least 12 characters.',
                });
            } else {
                toast.error(err?.message || 'Failed to update password');
            }
        },
    });

    const onSubmit = handleSubmit(values => mutation.mutate(values));

    return (
        <div>
            <section className='pb-10'>
                <div className='flex items-start justify-between gap-4'>
                    <div>
                        <h2 className='text-base font-semibold'>
                            {hasPassword ? 'Change password' : 'Set password'}
                        </h2>
                        <p className='mt-1 text-sm text-muted-foreground'>
                            {hasPassword
                                ? passwordChangedAt
                                    ? `Last changed ${formatDate(passwordChangedAt, { year: 'numeric', month: 'short', day: 'numeric' })}. Updating signs out your other sessions.`
                                    : 'Updating signs out your other sessions.'
                                : 'Your account has no password yet - set one to sign in with it.'}
                        </p>
                    </div>
                    <Button
                        type='button'
                        size='sm'
                        onClick={onSubmit}
                        disabled={mutation.isPending}>
                        {mutation.isPending ? (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        ) : null}
                        {hasPassword ? 'Update password' : 'Set password'}
                    </Button>
                </div>

                <form onSubmit={onSubmit} className='mt-6 max-w-md space-y-5'>
                    {hasPassword && (
                        <SecretField
                            label='Current password'
                            autoComplete='current-password'
                            registration={register('currentPassword')}
                            error={errors.currentPassword?.message}
                        />
                    )}
                    <SecretField
                        label='New password'
                        autoComplete='new-password'
                        registration={register('newPassword')}
                        error={errors.newPassword?.message}
                        description='At least 12 characters.'
                    />
                </form>
            </section>
        </div>
    );
}
