'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Tick02Icon } from '@hugeicons/core-free-icons';

import Link from 'next/link';

/**
 * Shared primitives for the three login surfaces (traveler / operator / staff).
 * Kept in one place so the field / button / feedback styling stays identical
 * across all doors. Colors are `--it-*` tokens; error red uses Tailwind reds
 * until a feedback token is added.
 */

export const inputClass =
    'w-full rounded-[10px] border border-it-border bg-it-white px-3 py-3 text-base text-it-ink placeholder:text-it-ink-placeholder focus:border-transparent focus:outline-2 focus:outline-it-primary';

export const primaryBtn =
    'flex w-full items-center justify-center gap-2 rounded-full bg-it-primary px-4 py-3 text-base font-semibold text-it-primary-fg transition-[filter] hover:brightness-95';

/**
 * Staff-surface button: monochrome ink, squared corners - deliberately NOT the
 * operator portal's orange pill, so the two doors never feel like one surface.
 */
export const staffBtn =
    'flex w-full items-center justify-center gap-2 rounded-[10px] bg-it-ink px-4 py-3 text-base font-semibold text-white transition-opacity hover:opacity-90';

export const quietLink =
    'text-sm font-semibold text-it-text-muted transition-colors hover:text-it-primary';

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
                className='mb-1.5 block text-sm font-semibold text-it-heading'>
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
            <HugeiconsIcon icon={AlertCircleIcon} className='mt-0.5 size-4 shrink-0' strokeWidth={1.75} />
            <span>{children}</span>
        </div>
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
                <HugeiconsIcon icon={Tick02Icon} className='size-7 text-success-fg' strokeWidth={2.5} />
            </div>
            <strong className='block text-base text-it-heading'>{title}</strong>
            <p className='mt-2 text-sm leading-relaxed text-it-text-muted'>{body}</p>
            {loginHref && (
                <Link
                    href={loginHref}
                    className='mt-4 inline-flex items-center justify-center rounded-full border border-it-border bg-it-white px-6 py-2.5 text-sm font-semibold text-it-heading transition-colors hover:border-it-primary hover:text-it-primary'>
                    {loginLabel}
                </Link>
            )}
        </div>
    );
}

