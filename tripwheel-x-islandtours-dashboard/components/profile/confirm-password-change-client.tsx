'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Alert02Icon,
    CheckmarkCircle02Icon,
    Loading03Icon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';

import { confirmPasswordChangeAction } from '@/app/_actions/userActions';
import { Button } from '@/components/ui/button';

/**
 * Landing page for the emailed password-change link.
 *
 * The change is applied by an explicit button press, NOT on page load. Email
 * security scanners and link prefetchers follow GET links, and an
 * apply-on-load page would let them silently change the password (and sign
 * the owner out everywhere) without a human ever seeing this screen.
 */
export function ConfirmPasswordChangeClient({ token }: { token?: string }) {
    const [done, setDone] = useState(false);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!token) throw new Error('This link is missing its token.');
            await confirmPasswordChangeAction(token);
        },
        onSuccess: () => setDone(true),
    });

    if (!token) {
        return (
            <Shell
                tone='danger'
                title='This link is incomplete'
                body='The confirmation token is missing from the address. Open the link straight from the email, or start the password change again from your profile.'
            >
                <Button asChild variant='outline' size='sm'>
                    <Link href='/profile'>Back to profile</Link>
                </Button>
            </Shell>
        );
    }

    if (done) {
        return (
            <Shell
                tone='success'
                title='Password updated'
                body='Your new password is live. Every session was signed out, including this browser, so sign in again with the new password.'
            >
                <Button asChild size='sm'>
                    <Link href='/login'>Go to sign in</Link>
                </Button>
            </Shell>
        );
    }

    return (
        <Shell
            title='Confirm your password change'
            body='Your password has not changed yet. Confirm below to apply it - this signs you out everywhere, so you will need to sign in again with the new password.'
        >
            <div className='space-y-3'>
                <div className='flex flex-wrap gap-2'>
                    <Button
                        size='sm'
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <HugeiconsIcon
                                icon={Loading03Icon}
                                className='size-4 animate-spin'
                            />
                        ) : null}
                        Confirm password change
                    </Button>
                    <Button asChild variant='outline' size='sm'>
                        <Link href='/profile'>Cancel</Link>
                    </Button>
                </div>
                {mutation.isError && (
                    <p className='text-sm text-destructive'>
                        {mutation.error instanceof Error
                            ? mutation.error.message
                            : 'Could not confirm the password change.'}
                    </p>
                )}
            </div>
        </Shell>
    );
}

function Shell({
    title,
    body,
    tone,
    children,
}: {
    title: string;
    body: string;
    tone?: 'success' | 'danger';
    children: React.ReactNode;
}) {
    return (
        <div className='mx-auto max-w-md py-16'>
            <div className='rounded-lg border bg-card p-6'>
                {tone && (
                    <HugeiconsIcon
                        icon={
                            tone === 'success'
                                ? CheckmarkCircle02Icon
                                : Alert02Icon
                        }
                        className={`mb-3 size-6 ${
                            tone === 'success'
                                ? 'text-success-solid'
                                : 'text-destructive'
                        }`}
                    />
                )}
                <h1 className='text-lg font-semibold'>{title}</h1>
                <p className='mt-2 text-sm text-muted-foreground'>{body}</p>
                <div className='mt-6'>{children}</div>
            </div>
        </div>
    );
}
