'use client';

/**
 * Field primitives shared by every wizard step (07 §4.4, §5.1).
 *
 * They exist to make two habits cheap:
 *
 * - **Consequence over instruction.** `ConsequenceText` renders what a value
 *   WILL DO ("Bookings close 2 hours before departure") instead of what the
 *   field is ("How long before departure bookings close"). Computed from the
 *   live value, so it doubles as a units check.
 * - **A boolean still deserves a sentence.** `ToggleRow` gives every flag a
 *   name AND the consequence of turning it on, which is what makes a bare
 *   checkbox grid readable. It draws no box: the checkbox is the state, and
 *   wrapping each one in a tinted panel made booleans the loudest thing on
 *   the page.
 *
 * `FieldGrid` is the one responsive rule: one column on phones, two from `sm`.
 * The old three-column meeting-point row is why this is centralised.
 */

import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** One column on phones, two from `sm`. Never three - it never survives 1024. */
export function FieldGrid({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>
            {children}
        </div>
    );
}

/** What the current value will actually do. Renders nothing when empty. */
export function ConsequenceText({ children }: { children: ReactNode }) {
    if (!children) return null;
    return (
        <p className='text-xs text-content-muted'>
            <span className='text-content-subtle'>→ </span>
            {children}
        </p>
    );
}

interface ToggleRowProps {
    id: string;
    label: string;
    /** What turning it on means for a traveller. */
    description?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

export function ToggleRow({
    id,
    label,
    description,
    checked,
    onChange,
    disabled,
}: ToggleRowProps) {
    return (
        // No box. Each of these used to draw a bordered, filled panel that
        // changed colour when ticked - so a group of four checkboxes read as
        // four cards, and the strongest visual signal on the screen was a
        // boolean. The checkbox itself already says checked; the row does not
        // need to shout it too.
        <label
            htmlFor={id}
            className={cn(
                'group flex cursor-pointer items-start gap-3 py-1.5',
                disabled && 'cursor-not-allowed opacity-60',
            )}>
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={c => onChange(!!c)}
                disabled={disabled}
                className='mt-0.5'
            />
            <span className='min-w-0'>
                <span className='block text-sm text-content'>
                    {label}
                </span>
                {description && (
                    <span className='mt-0.5 block text-xs text-content-muted'>
                        {description}
                    </span>
                )}
            </span>
        </label>
    );
}

/** A row of toggles that stays one column until there is room for two. */
export function ToggleGrid({ children }: { children: ReactNode }) {
    return (
        <div className='grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2'>
            {children}
        </div>
    );
}

interface SelectFieldProps<T extends FieldValues> {
    control: Control<T>;
    name: FieldPath<T>;
    label: string;
    options: { value: string; label: string; disabled?: boolean }[];
    placeholder?: string;
    description?: ReactNode;
    error?: string;
    disabled?: boolean;
    required?: boolean;
}

/**
 * Controller + Select + Field boilerplate in one place. Every select in the
 * wizard goes through this so an invalid one always gets `aria-invalid`, which
 * is what `focusFirstInvalid` looks for.
 */
export function SelectField<T extends FieldValues>({
    control,
    name,
    label,
    options,
    placeholder,
    description,
    error,
    disabled,
    required,
}: SelectFieldProps<T>) {
    return (
        <Field>
            <Label>
                {label}
                {required && (
                    <span aria-hidden className='text-danger-fg'>
                        {' '}
                        *
                    </span>
                )}
            </Label>
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <Select
                        value={field.value ?? ''}
                        onValueChange={field.onChange}
                        disabled={disabled}>
                        <SelectTrigger
                            className='w-full'
                            aria-invalid={!!error}>
                            <SelectValue placeholder={placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                            {options.map(o => (
                                <SelectItem
                                    key={o.value}
                                    value={o.value}
                                    disabled={o.disabled}>
                                    {o.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            />
            {description && <FieldDescription>{description}</FieldDescription>}
            <FieldError>{error}</FieldError>
        </Field>
    );
}

/**
 * Progressive disclosure for the optional tail of a form (07 §3: net price,
 * strike-through price, stop addresses).
 *
 * Content stays mounted and animates height, same contract as
 * `CollapsibleCard` - a closed disclosure must never drop a value the operator
 * already typed.
 */
export function MoreOptions({
    label = 'More options',
    children,
}: {
    label?: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();

    return (
        <div>
            <button
                type='button'
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                className='flex items-center gap-1 text-xs font-medium text-content-muted underline-offset-2 transition-colors duration-fast hover:text-content'>
                <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className={cn(
                        'size-3.5 transition-transform duration-normal',
                        open && 'rotate-180',
                    )}
                />
                {label}
            </button>
            <motion.div
                initial={false}
                animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                transition={
                    reduceMotion
                        ? { duration: 0 }
                        : {
                              height: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
                              opacity: { duration: 0.18 },
                          }
                }
                inert={!open}
                aria-hidden={!open}
                className='overflow-hidden'>
                <div className='pt-4'>{children}</div>
            </motion.div>
        </div>
    );
}

/** Minutes rendered the way an operator says them out loud. */
export function formatMinutes(raw: string | number | null | undefined): string {
    const mins = typeof raw === 'string' ? Number(raw) : raw;
    if (mins == null || Number.isNaN(mins) || mins <= 0) return '';
    if (mins < 60) return `${mins} minutes`;
    if (mins < 1440) {
        const h = mins / 60;
        const label = Number.isInteger(h) ? h : h.toFixed(1);
        return `${label} hour${h === 1 ? '' : 's'}`;
    }
    const d = mins / 1440;
    const label = Number.isInteger(d) ? d : d.toFixed(1);
    return `${label} day${d === 1 ? '' : 's'}`;
}
