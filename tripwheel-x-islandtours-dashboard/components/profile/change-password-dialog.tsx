'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, SecurityCheckIcon, SquareLock02Icon, ViewIcon, ViewOffIcon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { setPasswordAction } from '@/app/_actions/userActions';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import {
    changePasswordSchema,
    setPasswordSchema,
    type ChangePasswordFormValues,
    type SetPasswordFormValues,
} from '@/lib/validations/profile';
import { formatDate } from '@/utils/intl-utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

interface ChangePasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
    open,
    onOpenChange,
}: ChangePasswordDialogProps) {
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();

    const { data: session } = authClient.useSession();
    const hasPassword = (session?.user as any)?.hasPassword;

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ChangePasswordFormValues | SetPasswordFormValues>({
        resolver: zodResolver(hasPassword ? changePasswordSchema : setPasswordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    const mutation = useMutation({
        mutationFn: async (values: ChangePasswordFormValues | SetPasswordFormValues) => {
            if (hasPassword) {
                const result = await authClient.changePassword({
                    newPassword: values.newPassword,
                    currentPassword: (values as ChangePasswordFormValues).currentPassword,
                    revokeOtherSessions: true,
                });
                if (result.error) throw result.error;
            } else {
                await setPasswordAction(values.newPassword);
            }
        },
        onSuccess: () => {
            toast.success(hasPassword ? 'Password updated' : 'Password set', {
                description: 'Your security credentials have been successfully updated.',
            });
            onOpenChange(false);
            reset();
            router.refresh();
        },
        onError: (err: any) => {
            if (err?.status === 401 || err?.code === 'INVALID_PASSWORD') {
                toast.error('Verification failed', {
                    description: 'The current password you entered is incorrect.',
                });
            } else if (err?.code === 'PASSWORD_TOO_SHORT') {
                toast.error('Password too short', {
                    description: 'Your new password must be at least 12 characters.',
                });
            } else {
                toast.error(err?.message || 'Failed to update password');
            }
        },
    });

    return (
        <Dialog
            open={open}
            onOpenChange={val => {
                if (!mutation.isPending) {
                    onOpenChange(val);
                    if (!val) reset();
                }
            }}>
            <DialogContent className='sm:max-w-xl p-0 border-none bg-transparent shadow-none'>
                <Card className='w-full border-border bg-card shadow-xl overflow-hidden'>
                    <CardHeader className='space-y-4 pb-6'>
                        <div className='flex items-center gap-3'>
                            <div className='p-2 bg-primary/10 rounded-xl border border-primary/20'>
                                <HugeiconsIcon icon={SecurityCheckIcon} className='w-5 h-5 text-primary' />
                            </div>
                            <div className='space-y-1'>
                                <DialogTitle className='text-xl font-bold tracking-tight'>
                                    {hasPassword ? 'Security Settings' : 'Create Password'}
                                </DialogTitle>
                                <DialogDescription className='text-muted-foreground text-xs leading-relaxed'>
                                    {hasPassword
                                        ? 'Protect your account with a strong password.'
                                        : 'Set a password to enable secure login credentials.'}
                                </DialogDescription>
                            </div>
                        </div>

                        {hasPassword && (session?.user as any)?.passwordChangedAt && (
                            <div className='px-3 py-2 bg-muted/50 rounded-lg border border-border/50 flex items-center gap-2'>
                                <HugeiconsIcon icon={SquareLock02Icon} className='w-3.5 h-3.5 text-muted-foreground' />
                                <span className='text-[11px] text-muted-foreground font-medium'>
                                    Last changed:{' '}
                                    {formatDate((session?.user as any).passwordChangedAt, {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        )}
                    </CardHeader>

                    <form onSubmit={handleSubmit(values => mutation.mutate(values))}>
                        <CardContent className='space-y-6'>
                            <FieldGroup className='gap-6'>
                                {hasPassword && (
                                    <Field data-invalid={!!(errors as any).currentPassword}>
                                        <FieldLabel htmlFor='currentPassword'>
                                            Current Password
                                        </FieldLabel>
                                        <div className='relative group/input'>
                                            <Input
                                                id='currentPassword'
                                                type={showCurrent ? 'text' : 'password'}
                                                placeholder='Enter current password'
                                                {...register('currentPassword' as any)}
                                                className={cn(
                                                    'h-11 transition-all pr-12',
                                                    (errors as any).currentPassword &&
                                                        'border-b-destructive/50 focus-visible:border-b-destructive/50'
                                                )}
                                            />
                                            <button
                                                type='button'
                                                onClick={() => setShowCurrent(!showCurrent)}
                                                className='absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all'>
                                                {showCurrent ? <HugeiconsIcon icon={ViewOffIcon} size={16} /> : <HugeiconsIcon icon={ViewIcon} size={16} />}
                                            </button>
                                        </div>
                                        {(errors as any).currentPassword && (
                                            <FieldError>{(errors as any).currentPassword.message}</FieldError>
                                        )}
                                    </Field>
                                )}

                                <Field data-invalid={!!errors.newPassword}>
                                    <FieldLabel htmlFor='newPassword'>
                                        {hasPassword ? 'New Password' : 'Password'}
                                    </FieldLabel>
                                    <div className='relative group/input'>
                                        <Input
                                            id='newPassword'
                                            type={showNew ? 'text' : 'password'}
                                            placeholder='Create a strong password'
                                            {...register('newPassword')}
                                            className={cn(
                                                'h-11 transition-all pr-12',
                                                errors.newPassword &&
                                                    'border-b-destructive/50 focus-visible:border-b-destructive/50'
                                            )}
                                        />
                                        <button
                                            type='button'
                                            onClick={() => setShowNew(!showNew)}
                                            className='absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all'>
                                            {showNew ? <HugeiconsIcon icon={ViewOffIcon} size={16} /> : <HugeiconsIcon icon={ViewIcon} size={16} />}
                                        </button>
                                    </div>
                                    {errors.newPassword && (
                                        <FieldError>{errors.newPassword.message}</FieldError>
                                    )}
                                </Field>

                                <Field data-invalid={!!errors.confirmPassword}>
                                    <FieldLabel htmlFor='confirmPassword'>
                                        Confirm Password
                                    </FieldLabel>
                                    <div className='relative group/input'>
                                        <Input
                                            id='confirmPassword'
                                            type={showConfirm ? 'text' : 'password'}
                                            placeholder='Repeat new password'
                                            {...register('confirmPassword')}
                                            className={cn(
                                                'h-11 transition-all pr-12',
                                                errors.confirmPassword &&
                                                    'border-b-destructive/50 focus-visible:border-b-destructive/50'
                                            )}
                                        />
                                        <button
                                            type='button'
                                            onClick={() => setShowConfirm(!showConfirm)}
                                            className='absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all'>
                                            {showConfirm ? <HugeiconsIcon icon={ViewOffIcon} size={16} /> : <HugeiconsIcon icon={ViewIcon} size={16} />}
                                        </button>
                                    </div>
                                    {errors.confirmPassword && (
                                        <FieldError>{errors.confirmPassword.message}</FieldError>
                                    )}
                                </Field>
                            </FieldGroup>
                        </CardContent>

                        <CardFooter className='flex flex-col sm:flex-row gap-3 pt-6 pb-8 px-8'>
                            <Button
                                type='submit'
                                disabled={mutation.isPending}
                                className='w-full sm:flex-1 order-1 sm:order-2'>
                                {mutation.isPending ? (
                                    <>
                                        <HugeiconsIcon icon={Loading03Icon} className='mr-2 h-4 w-4 animate-spin' />
                                        {hasPassword ? 'Updating...' : 'Setting...'}
                                    </>
                                ) : (
                                    'SAVE PASSWORD'
                                )}
                            </Button>
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => onOpenChange(false)}
                                disabled={mutation.isPending}
                                className='w-full sm:flex-1 h-12 order-2 sm:order-1 font-semibold text-xs opacity-70 hover:opacity-100 transition-opacity'>
                                Cancel
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </DialogContent>
        </Dialog>
    );
}
