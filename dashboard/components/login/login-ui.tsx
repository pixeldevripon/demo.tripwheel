'use client';

import { AlertCircleIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import Link from 'next/link';

import { travellerAccountUrl } from '@/lib/public-site';

/**
 * Shared primitives for the three login surfaces (traveler / operator / staff).
 * Kept in one place so the field / button / feedback styling stays identical
 * across all doors. Colors are `--it-*` tokens; error red uses Tailwind reds
 * until a feedback token is added.
 */

export const inputClass =
    'w-full rounded-[10px] border border-it-border bg-it-white px-3 py-3 text-base text-it-ink placeholder:text-it-ink-placeholder focus:border-transparent focus:outline-2 focus:outline-it-primary';

export const primaryBtn =
    'flex w-full items-center justify-center gap-2 rounded-full bg-it-primary px-4 py-3 text-base font-medium text-it-primary-fg transition-[filter] hover:brightness-95';

/**
 * Staff-surface button: monochrome ink, squared corners - deliberately NOT the
 * operator portal's orange pill, so the two doors never feel like one surface.
 */
export const staffBtn =
    'flex w-full items-center justify-center gap-2 rounded-[10px] bg-it-ink px-4 py-3 text-base font-medium text-white transition-opacity hover:opacity-90';

/**
 * Admin-surface button: the staff shape plus an inset hairline, so the system
 * admin door reads as a third surface rather than a re-skinned staff page. Same
 * reasoning as `staffBtn` vs `primaryBtn` - no two doors should feel like one.
 */
export const adminBtn =
    'flex w-full items-center justify-center gap-2 rounded-[10px] bg-it-ink px-4 py-3 text-base font-medium text-white ring-1 ring-inset ring-white/25 transition-opacity hover:opacity-90';

export const quietLink =
    'text-sm font-medium text-it-text-muted transition-colors hover:text-it-primary';

export function Field({
    label,
    htmlFor,
    children,
}: {
    label: string;
    htmlFor: string;
    children: React.ReactNode;
}) {
    return (
        <div className='mb-4'>
            <label
                htmlFor={htmlFor}
                className='mb-1.5 block text-sm font-medium text-it-heading'>
                {label}
            </label>
            {children}
        </div>
    );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
    return (
        <div
            role='alert'
            className='mb-4 flex items-start gap-2 rounded-[10px] border border-danger-border bg-danger-subtle px-3 py-2.5 text-sm text-danger-fg'>
            <HugeiconsIcon
                icon={AlertCircleIcon}
                className='mt-0.5 size-4 shrink-0'
                strokeWidth={1.75}
            />
            <span>{children}</span>
        </div>
    );
}

const WRONG_DOOR_COPY: Record<
    'portal' | 'staff' | 'account' | 'admin',
    { body: string; label: string }
> = {
    portal: {
        body: 'This email is registered as a tour operator account. Please sign in through the Operator Portal.',
        label: 'Go to operator sign-in',
    },
    staff: {
        body: 'This email belongs to a staff account. Please use the staff sign-in.',
        label: 'Go to staff sign-in',
    },
    // Travellers no longer sign in here at all - their account area lives on
    // the public site and uses an emailed code, not a password.
    account: {
        body: 'This email belongs to a traveller account. Manage your bookings on the Island Tours site - we will email you a sign-in code.',
        label: 'Go to your account',
    },
    // Unreachable today (ADMIN passes every door, so the backend never
    // suggests 'admin') - kept so a future admin-adjacent role that CAN be
    // wrong-doored renders sensibly instead of crashing on a missing key.
    admin: {
        body: 'This email belongs to an administrator account. Please sign in through the admin door.',
        label: 'Go to admin sign-in',
    },
};

/**
 * Wrong-door notice: the ErrorNote shell plus a link to the door the account
 * actually belongs at.
 *
 * `admin` is an in-app route (`/admin`) since the admin gate was merged into
 * this dashboard - it used to be a separate deployment reached through
 * NEXT_PUBLIC_ADMIN_LOGIN_URL. Only the traveller account area is still on
 * another origin, so it is the one case that needs a full-navigation <a>.
 *
 * Note this notice is never rendered BY the admin door itself: that door
 * answers every failure with one generic string, deliberately never hinting
 * which other surface an email belongs to. See `admin-login.tsx`.
 */
export function WrongDoorNote({
    correctSurface,
}: {
    correctSurface: 'portal' | 'staff' | 'account' | 'admin';
}) {
    // The index is TypeScript-narrowed, but `correctSurface` ultimately comes
    // from an unvalidated API response - fall back rather than crash the
    // login page if an unexpected value ever slips through.
    const copy = WRONG_DOOR_COPY[correctSurface] ?? WRONG_DOOR_COPY.portal;
    return (
        <ErrorNote>
            {copy.body}{' '}
            {correctSurface === 'account' ? (
                /* The traveller account area lives on ANOTHER origin (the
                   public site), so it needs a full navigation rather than a
                   client-side <Link>. */
                <a
                    href={travellerAccountUrl()}
                    className='font-medium underline underline-offset-2'>
                    {copy.label}
                </a>
            ) : (
                <Link
                    href={`/${correctSurface}`}
                    className='font-medium underline underline-offset-2'>
                    {copy.label}
                </Link>
            )}
        </ErrorNote>
    );
}

export function SuccessBlock({
    title,
    body,
    loginHref,
    loginLabel = 'Back to login',
}: {
    title: string;
    body: string;
    /** When provided, renders a "Back to login" link below the body. */
    loginHref?: string;
    loginLabel?: string;
}) {
    return (
        <div className='py-2 text-center'>
            {/* Bright green circle */}
            <div className='mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-success-subtle ring-4 ring-success-border/40'>
                <HugeiconsIcon
                    icon={Tick02Icon}
                    className='size-7 text-success-fg'
                    strokeWidth={2.5}
                />
            </div>
            <strong className='block text-base text-it-heading'>{title}</strong>
            <p className='mt-2 text-sm leading-relaxed text-it-text-muted'>
                {body}
            </p>
            {loginHref && (
                <Link
                    href={loginHref}
                    className='mt-4 inline-flex items-center justify-center rounded-full border border-it-border bg-it-white px-6 py-2.5 text-sm font-medium text-it-heading transition-colors hover:border-it-primary hover:text-it-primary'>
                    {loginLabel}
                </Link>
            )}
        </div>
    );
}

