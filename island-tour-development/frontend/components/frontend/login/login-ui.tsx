'use client';

import { Check, CircleAlert } from 'lucide-react';

/**
 * Shared primitives for the three login surfaces (traveler / operator / staff).
 * Kept in one place so the field / button / feedback styling stays identical
 * across all doors. Colors are `--it-*` tokens; error red uses Tailwind reds
 * until a feedback token is added.
 */

export const inputClass =
    'w-full rounded-[10px] border border-it-border bg-it-white px-3.5 py-2.75 text-[15px] text-it-ink placeholder:text-it-ink-placeholder focus:border-transparent focus:outline-2 focus:outline-it-primary';

export const primaryBtn =
    'flex w-full items-center justify-center gap-2 rounded-full bg-it-primary px-5 py-3.25 text-[15px] font-semibold text-it-primary-fg transition-[filter] hover:brightness-95';

export const quietLink =
    'text-[13.5px] font-semibold text-it-text-muted transition-colors hover:text-it-primary';

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
                className='mb-1.5 block text-[13px] font-semibold text-it-heading'>
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
            className='mb-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3.25 py-2.5 text-[13.5px] text-red-700'>
            <CircleAlert className='mt-0.5 size-4 shrink-0' strokeWidth={1.75} />
            <span>{children}</span>
        </div>
    );
}

export function SuccessBlock({ title, body }: { title: string; body: string }) {
    return (
        <div className='py-2 text-center'>
            <div className='mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-it-green-subtle'>
                <Check className='size-6 text-it-green-fg' strokeWidth={2} />
            </div>
            <strong className='text-it-heading'>{title}</strong>
            <p className='mt-1.5 text-[14.5px] text-it-text-muted'>{body}</p>
            <span className='mt-2.5 inline-block rounded-[6px] border border-dashed border-it-border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-it-text-muted'>
                Mockup endpoint
            </span>
        </div>
    );
}
