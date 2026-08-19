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
import { PENDING_EMAIL_CHANGE_KEY } from '@/hooks/profile/use-email-change-landing';
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
            // MUST be absolute: better-auth redirects the clicked email links
            // to this URL, and a relative path would resolve against the
            // BACKEND origin (404). ?email_change=1 lets the profile page
            // recognize the landing and toast the outcome.
            const result = await authClient.changeEmail({
                newEmail: values.newEmail.trim(),
                callbackURL: `${window.location.origin}/profile?email_change=1`,
            });
            if (result.error) throw result.error;
            return values.newEmail.trim();
        },
        onSuccess: (newEmail: string) => {
            setSentTo(newEmail);
            // Lets the landing handler tell "fully changed" apart from
            // "old inbox approved, new inbox still pending". Best-effort:
            // the links may be opened in a different browser.
            try {
                localStorage.setItem(PENDING_EMAIL_CHANGE_KEY, newEmail);
            } catch {
                // Storage unavailable (private mode) - landing copy degrades
                // to the generic variant.
            }
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
                            <div className='mt-5 flex justify-center'>
                                <Button
                                    type='button'
                                    variant='outline'
                                    size='sm'
                                    onClick={() => close(false)}>
                                    Done
                                </Button>
                            </div>
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

                            {/* Standard dialog footer: compact, right-aligned
                                actions - never full-width stacked blocks. */}
                            <CardFooter className='flex justify-end gap-2 pb-6'>
                                <Button
                                    type='button'
                                    variant='ghost'
                                    size='sm'
                                    onClick={() => close(false)}
                                    disabled={mutation.isPending}>
                                    Cancel
                                </Button>
                                <Button
                                    type='submit'
                                    size='sm'
                                    disabled={mutation.isPending}>
                                    {mutation.isPending ? (
                                        <>
                                            <HugeiconsIcon
                                                icon={Loading03Icon}
                                                className='size-4 animate-spin'
                                            />
                                            Sending...
                                        </>
                                    ) : (
                                        'Send confirmation'
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    )}
                </Card>
            </DialogContent>
        </Dialog>
    );
}
