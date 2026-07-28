'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { useId, type ReactNode } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * The three primitives every profile block is built from (Webflow-settings
 * style, 2026-07-28 redesign): a flat `<section>` divided from its siblings by
 * a hairline, a Save button that lives in the block header, and a plain
 * label + input field. No cards, no shadows.
 *
 * Deliberately local to `components/profile/` rather than reusing the settings
 * form kit: that kit is card-shaped (`SettingsCard` renders a `Card` with a
 * footer Save) and this page is not, and eslint D3 forbids one module's
 * components importing another's.
 *
 * Vertical rhythm is positional, not per-call-site: `first:pt-0` and
 * `last:border-b-0` reproduce the original pb-10 / py-10 / py-10-no-border
 * cadence as long as the sections are direct siblings.
 */
export const PROFILE_SECTION_CLASS =
    'border-b border-line py-10 first:pt-0 last:border-b-0';

export function ProfileSection({
    title,
    description,
    action,
    children,
    className,
}: {
    title: string;
    description?: ReactNode;
    /** Rendered opposite the title - normally a `<ProfileSaveButton />`. */
    action?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn(PROFILE_SECTION_CLASS, className)}>
            <div className='flex items-start justify-between gap-4'>
                <div>
                    <h2 className='text-base font-semibold'>{title}</h2>
                    {description ? (
                        <p className='mt-1 text-sm text-muted-foreground'>
                            {description}
                        </p>
                    ) : null}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/** Header-mounted Save, spinning while its mutation is in flight. */
export function ProfileSaveButton({
    onClick,
    disabled,
    isPending,
    label = 'Save',
    variant = 'outline',
}: {
    onClick: () => void;
    disabled?: boolean;
    isPending?: boolean;
    label?: string;
    variant?: 'default' | 'outline';
}) {
    return (
        <Button
            type='button'
            size='sm'
            variant={variant}
            onClick={onClick}
            disabled={disabled || isPending}>
            {isPending ? (
                <HugeiconsIcon
                    icon={Loading03Icon}
                    className='size-4 animate-spin'
                />
            ) : null}
            {label}
        </Button>
    );
}

/** Label + input + optional hint, with the page's inline error treatment. */
export function ProfileTextField({
    label,
    registration,
    error,
    description,
    placeholder,
    type = 'text',
    disabled,
}: {
    label: string;
    registration: UseFormRegisterReturn;
    error?: string;
    description?: string;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
}) {
    const id = useId();
    return (
        <div className='space-y-2'>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={!!error}
                {...registration}
            />
            {description ? (
                <p className='text-xs text-muted-foreground'>{description}</p>
            ) : null}
            {error ? (
                <p className='text-xs font-medium text-danger-fg'>{error}</p>
            ) : null}
        </div>
    );
}
