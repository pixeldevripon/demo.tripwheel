'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * localStorage key holding the requested new address while a change-email is
 * in flight. Written by ChangeEmailDialog on submit; read (and cleared) here
 * to tell "fully changed" apart from "old inbox approved, new inbox pending".
 */
export const PENDING_EMAIL_CHANGE_KEY = 'it-pending-email-change';

/** better-auth appends ?error=<CODE> to the callbackURL on a bad link. */
const ERROR_DESCRIPTIONS: Record<string, string> = {
    TOKEN_EXPIRED:
        'That email link has expired. Request the change again to get a fresh one.',
    INVALID_TOKEN: 'That email link is invalid or was already used.',
    USER_NOT_FOUND: 'The account this link belongs to no longer exists.',
    INVALID_USER:
        'This link belongs to a different account. Sign out and open it again.',
};

/**
 * Handles landings from the change-email flow's two emailed links. Both
 * redirect to /profile?email_change=1 (the dialog's callbackURL), and errors
 * arrive as an extra ?error=<CODE> - so this reads the params once, toasts
 * the outcome, and cleans the URL. Which step just finished is inferred from
 * the pending marker: if the profile email now equals the requested address
 * the change completed; otherwise the old inbox approved and the new inbox
 * still holds the final link.
 */
export function useEmailChangeLanding(currentEmail: string | undefined) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) return;
        const flag = searchParams.get('email_change');
        const error = searchParams.get('error');
        if (!flag && !error) return;

        if (error) {
            handled.current = true;
            toast.error('Email change failed', {
                description:
                    ERROR_DESCRIPTIONS[error.toUpperCase()] ??
                    'The link could not be processed. Please request the change again.',
            });
            router.replace('/profile', { scroll: false });
            return;
        }

        // Success landings need the fresh profile email to phrase the toast.
        if (!currentEmail) return;
        handled.current = true;

        let pending: string | null = null;
        try {
            pending = localStorage.getItem(PENDING_EMAIL_CHANGE_KEY);
        } catch {
            // Storage unavailable - fall through to the generic copy.
        }

        if (pending && pending.toLowerCase() === currentEmail.toLowerCase()) {
            toast.success('Email updated', {
                description: `Your sign-in email is now ${currentEmail}.`,
            });
            try {
                localStorage.removeItem(PENDING_EMAIL_CHANGE_KEY);
            } catch {
                // Already read - leaving it behind is harmless.
            }
        } else if (pending) {
            toast.info('One step left', {
                description: `Change approved. Open the verification email we sent to ${pending} to finish.`,
            });
        } else {
            // Link opened in a browser without the marker (other device,
            // cleared storage) - state the current truth without guessing.
            toast.success('Email change step completed', {
                description: `Your current sign-in email is ${currentEmail}.`,
            });
        }
        router.replace('/profile', { scroll: false });
    }, [searchParams, currentEmail, router]);
}
