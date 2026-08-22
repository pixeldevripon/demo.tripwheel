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
import { doorForSession, type SessionDoor } from '@/lib/rbac-utils';

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
    // Which sign-in door to offer afterwards. Derived from the role the confirm
    // call returns, because this request revokes every session - there is none
    // left to read a role from. `doorForSession` is the same helper sign-out
    // uses, so the two paths can never send one account to different doors.
    const [door, setDoor] = useState<SessionDoor>('portal');

    const mutation = useMutation({
        mutationFn: async () => {
            if (!token) throw new Error('This link is missing its token.');
            return confirmPasswordChangeAction(token);
        },
        onSuccess: result => {
            // No surface to pass: the session that carried it is gone, so the
            // door comes from the role alone. An unrecognised or absent role
            // falls back to /portal rather than failing the screen.
            setDoor(doorForSession(result?.role, null));
            setDone(true);
        },
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
                    {/* The account's own door. `/login` used to be hardcoded
                        here, and the proxy rewrites that to /portal - so an
                        admin or staff member landed at the operator login. */}
                    <Link href={`/${door}`}>Go to sign in</Link>
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
