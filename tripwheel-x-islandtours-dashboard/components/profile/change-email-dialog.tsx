'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon, MailEdit02Icon } from '@hugeicons/core-free-icons';

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
import { SuccessBlock } from '@/components/login/login-ui';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import {
    changeEmailSchema,
    type ChangeEmailFormValues,
} from '@/lib/validations/profile';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

interface ChangeEmailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The account's current sign-in email (shown + used in the copy). */
    currentEmail: string;
}

/**
 * Better Auth change-email flow (two-step, two-mailbox): submitting sends a
 * confirmation link to the CURRENT address; approving it triggers a
 * verification email to the NEW address; only then does the email change.
 * Nothing changes until both links are clicked, so the dialog's success state
 * explains exactly that instead of pretending the email already moved.
 */
export function ChangeEmailDialog({
    open,
    onOpenChange,
    currentEmail,
}: ChangeEmailDialogProps) {
    const [sentTo, setSentTo] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ChangeEmailFormValues>({
        resolver: zodResolver(changeEmailSchema),
        defaultValues: { newEmail: '' },
    });

    const mutation = useMutation({
        mutationFn: async (values: ChangeEmailFormValues) => {
            if (
                values.newEmail.trim().toLowerCase() ===
                currentEmail.toLowerCase()
            ) {
                throw new Error('That is already your sign-in email.');
            }
            const result = await authClient.changeEmail({
                newEmail: values.newEmail.trim(),
                callbackURL: '/profile',
            });
            if (result.error) throw result.error;
            return values.newEmail.trim();
        },
        onSuccess: (newEmail: string) => {
            setSentTo(newEmail);
        },
        onError: (err: any) => {
            // Better Auth guards change-email with a fresh-session check; a
            // stale session comes back as SESSION_EXPIRED. (A taken email is
            // a silent fake success server-side - enumeration-safe - so there
            // is deliberately no "already in use" branch here.)
            if (err?.code === 'SESSION_EXPIRED' || err?.status === 401) {
                toast.error('Please sign in again', {
                    description:
                        'Changing your email needs a fresh session. Log out and back in, then retry.',
                });
            } else {
                toast.error(err?.message || 'Failed to request email change');
            }
        },
    });

    function close(val: boolean) {
        if (mutation.isPending) return;
        onOpenChange(val);
        if (!val) {
            reset();
            setSentTo(null);
        }
    }

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className='sm:max-w-xl p-0 border-none bg-transparent shadow-none'>
                <Card className='w-full border-border bg-card shadow-xl overflow-hidden'>
                    <CardHeader className='space-y-4 pb-6'>
                        <div className='flex items-center gap-3'>
                            <div className='p-2 bg-primary/10 rounded-xl border border-primary/20'>
                                <HugeiconsIcon
                                    icon={MailEdit02Icon}
                                    className='w-5 h-5 text-primary'
                                />
                            </div>
                            <div className='space-y-1'>
                                <DialogTitle className='text-xl font-bold tracking-tight'>
                                    Change Email
                                </DialogTitle>
                                <DialogDescription className='text-muted-foreground text-xs leading-relaxed'>
                                    Your sign-in email is{' '}
                                    <span className='font-semibold'>
                                        {currentEmail}
                                    </span>
                                    . The change only applies after you approve
                                    it from that inbox and verify the new
                                    address.
                                </DialogDescription>
                            </div>
                        </div>
                    </CardHeader>

                    {sentTo ? (
                        <CardContent className='pb-8'>
                            <SuccessBlock
                                title='Confirm the change from your current inbox'
                                body={`We sent a confirmation link to ${currentEmail}. After you approve it, a verification email goes to ${sentTo} - your email changes once that link is opened. Until then you keep signing in with ${currentEmail}.`}
                            />
                            <Button
                                type='button'
                                variant='outline'
                                onClick={() => close(false)}
                                className='mt-4 w-full'>
                                Done
                            </Button>
                        </CardContent>
                    ) : (
                        <form
                            onSubmit={handleSubmit(values =>
                                mutation.mutate(values),
                            )}>
                            <CardContent className='space-y-6'>
                                <FieldGroup className='gap-6'>
                                    <Field data-invalid={!!errors.newEmail}>
                                        <FieldLabel htmlFor='newEmail'>
                                            New Email Address
                                        </FieldLabel>
                                        <Input
                                            id='newEmail'
                                            type='email'
                                            autoComplete='email'
                                            placeholder='you@example.com'
                                            {...register('newEmail')}
                                            className={cn(
                                                'h-11 transition-all',
                                                errors.newEmail &&
                                                    'border-b-destructive/50 focus-visible:border-b-destructive/50',
                                            )}
                                        />
                                        {errors.newEmail && (
                                            <FieldError>
                                                {errors.newEmail.message}
                                            </FieldError>
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
                                            <HugeiconsIcon
                                                icon={Loading03Icon}
                                                className='mr-2 h-4 w-4 animate-spin'
                                            />
                                            Sending...
                                        </>
                                    ) : (
                                        'SEND CONFIRMATION'
                                    )}
                                </Button>
                                <Button
                                    type='button'
                                    variant='outline'
                                    onClick={() => close(false)}
                                    disabled={mutation.isPending}
                                    className='w-full sm:flex-1 h-12 order-2 sm:order-1 font-semibold text-xs opacity-70 hover:opacity-100 transition-opacity'>
                                    Cancel
                                </Button>
                            </CardFooter>
                        </form>
                    )}
                </Card>
            </DialogContent>
        </Dialog>
    );
}
