'use client';

import {
    requestPasswordChangeAction,
    setPasswordAction,
} from '@/app/_actions/userActions';
import { SecretField } from '@/components/settings/settings-fields';
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
import { ProfileSaveButton, ProfileSection } from './profile-section';

/**
 * The Security section (Webflow-settings style): the change-password form
 * lives inline in a flat block. Branches on `hasPassword`: credentialed
 * accounts change their password (other sessions revoked); invite-provisioned
 * accounts that never set one get the set-password variant instead.
 */
export function SecuritySection() {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    // Tri-state on purpose. `Boolean(session?.user.hasPassword)` collapses
    // "still loading" and "definitely has no password" into the same false,
    // which made every credentialed account (all of them - the seed and the
    // Better Auth account hooks both set hasPassword) flash "This account has
    // no password yet" on load, and show it permanently if the session fetch
    // failed. Only claim "no password" once the session has actually resolved.
    const hasPassword = isPending
        ? null
        : Boolean(
              (session?.user as { hasPassword?: boolean } | undefined)
                  ?.hasPassword,
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
            hasPassword === false ? setPasswordSchema : changePasswordSchema,
        ) as Resolver<PasswordFormValues>,
        defaultValues: { currentPassword: '', newPassword: '' },
    });

    const mutation = useMutation({
        mutationFn: async (values: PasswordFormValues) => {
            if (hasPassword === false) {
                // No password to verify, so nothing to confirm by email.
                await setPasswordAction(values.newPassword);
                return 'set' as const;
            }
            // Verifies the current password server-side and emails a confirm
            // link. The password does NOT change until that link is used.
            await requestPasswordChangeAction(
                values.currentPassword ?? '',
                values.newPassword,
            );
            return 'requested' as const;
        },
        onSuccess: outcome => {
            if (outcome === 'set') {
                toast.success('Password set', {
                    description:
                        'Your security credentials have been successfully updated.',
                });
            } else {
                toast.success('Check your email', {
                    description:
                        'We sent a confirmation link to your account address. Your password changes once you open it.',
                });
            }
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
            <ProfileSection
                title={hasPassword ? 'Change password' : 'Set password'}
                description={
                    hasPassword
                        ? passwordChangedAt
                            ? `Last changed ${formatDate(passwordChangedAt, { year: 'numeric', month: 'short', day: 'numeric' })}. Updating signs out your other sessions.`
                            : 'Updating signs out your other sessions.'
                        : 'Your account has no password yet - set one to sign in with it.'
                }
                action={
                    <ProfileSaveButton
                        onClick={onSubmit}
                        isPending={mutation.isPending}
                        variant='default'
                        label={hasPassword ? 'Update password' : 'Set password'}
                    />
                }>
                <form onSubmit={onSubmit} className='mt-6 max-w-md space-y-5'>
                    {hasPassword !== false && (
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
            </ProfileSection>
        </div>
    );
}
