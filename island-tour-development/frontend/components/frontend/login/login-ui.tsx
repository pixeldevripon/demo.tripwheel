'use client';

import { Check, CircleAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Shared primitives for the three login surfaces (traveler / operator / staff).
 * Kept in one place so the field / button / feedback styling stays identical
 * across all doors. Colors are `--it-*` tokens; error red uses Tailwind reds
 * until a feedback token is added.
 */

// 16px below `md`: iOS Safari force-zooms the whole viewport when a focused
// input computes under 16px, and it never zooms back out. Desktop keeps the
// 15px design size. Covers all three login doors, operator apply, forgot,
// reset and the 2FA backup-code field, since they all share this class.
export const inputClass =
    'w-full rounded-[10px] border border-it-border bg-it-white px-3.5 py-2.75 text-[14.5px] md:text-[14px] text-it-heading placeholder:text-it-ink-placeholder focus:border-transparent focus:outline-2 focus:outline-it-primary tracking-[-0.012em]';

/**
 * Append to `inputClass` when a field has failed validation, so the field itself
 * carries the state and not only the message below it. The focus ring stays
 * `it-primary`: once someone is typing a correction, red on the ring reads as
 * "still wrong" before they have had a chance to finish.
 */
export const inputErrorClass = 'border-red-400 focus:outline-it-primary';

export const primaryBtn =
    'flex w-full items-center justify-center gap-2 rounded-full bg-it-primary px-5 py-3.25 text-[14px] font-medium text-it-primary-fg transition-[filter] hover:brightness-95 tracking-[-0.012em]';

export const quietLink =
    'text-[12.5px] font-medium text-it-text-muted transition-colors hover:text-it-primary tracking-[-0.012em]';

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
                className='mb-1.5 block text-[12px] font-medium text-it-heading tracking-[-0.012em]'>
                {label}
            </label>
            {children}
        </div>
    );
}

/**
 * A single field's validation message, sitting under its input.
 *
 * Distinct from `ErrorNote`, which is the FORM-level banner for what came back
 * from the server (throttled, wrong code). This one is for what is wrong with one
 * input, and it lives next to that input so the fix is where the message is.
 *
 * `id` is required: the input must point at it with `aria-describedby`, or a
 * screen-reader user hears the field and never the reason it was rejected.
 */
export function FieldError({
    id,
    children,
}: {
    id: string;
    children: React.ReactNode;
}) {
    return (
        <p
            id={id}
            role='alert'
            className='mt-1.5 text-[12px] leading-[1.5] text-red-600 tracking-[-0.012em]'>
            {children}
        </p>
    );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
    return (
        <div
            role='alert'
            className='mb-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3.25 py-2.5 text-[12.5px] text-red-700 tracking-[-0.012em]'>
            <CircleAlert className='mt-0.5 size-4 shrink-0' strokeWidth={1.75} />
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
            <div className='mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-100 ring-4 ring-emerald-50'>
                <Check className='size-7 text-emerald-600' strokeWidth={2.5} />
            </div>
            <strong className='block text-[15.5px] text-it-heading tracking-[-0.012em]'>{title}</strong>
            <p className='mt-2 text-[13px] leading-relaxed text-it-text-muted tracking-[-0.012em]'>{body}</p>
            {loginHref && (
                <Link
                    href={loginHref}
                    className='mt-5 inline-flex items-center justify-center rounded-full border border-it-border bg-it-white px-6 py-2.5 text-[13px] font-medium text-it-heading transition-colors hover:border-it-primary hover:text-it-primary tracking-[-0.012em]'>
                    {loginLabel}
                </Link>
            )}
        </div>
    );
}

