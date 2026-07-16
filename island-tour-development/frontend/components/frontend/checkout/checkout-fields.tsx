'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useId, type ReactNode } from 'react';

/**
 * Shared field primitives + style tokens for the checkout Contact and Payment
 * cards (Figma 47659:2424 / 47667:15365). Extracted so `checkout-form` (contact)
 * and `checkout-payment` (Stripe Card Elements) render identical inputs without a
 * circular import.
 */

export const labelClass =
    'font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';
export const helperClass =
    'text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/50';
export const inputBase =
    'w-full rounded-[8px] border bg-it-white px-4 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading placeholder:text-it-heading/30 outline-none transition-colors focus:border-it-primary';
export const titleClass =
    'font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading';
export const cardClass =
    'rounded-[16px] border border-it-heading/10 bg-it-white p-6';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Label + text input + optional inline error. */
export function Field({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    error,
    className,
    inputMode,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    error?: string;
    className?: string;
    inputMode?: 'text' | 'email' | 'tel' | 'numeric';
}) {
    const id = useId();
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            <label htmlFor={id} className={labelClass}>
                {label}
            </label>
            <input
                id={id}
                type={type}
                inputMode={inputMode}
                value={value}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={`${inputBase} h-[50px] ${
                    error ? 'border-it-primary' : 'border-it-heading/20'
                }`}
            />
            <FieldError error={error} />
        </div>
    );
}

/** An animated inline error line (mirrors the Field error treatment). */
export function FieldError({ error }: { error?: string }) {
    return (
        <AnimatePresence initial={false}>
            {error && (
                <motion.span
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className='text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                    {error}
                </motion.span>
            )}
        </AnimatePresence>
    );
}

/** A labelled shell holding an arbitrary control (e.g. a Stripe Card Element). */
export function FieldShell({
    label,
    error,
    className,
    children,
}: {
    label: string;
    error?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            <span className={labelClass}>{label}</span>
            <div
                className={`${inputBase} flex h-[50px] items-center ${
                    error ? 'border-it-primary' : 'border-it-heading/20'
                }`}>
                {children}
            </div>
            <FieldError error={error} />
        </div>
    );
}

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectGroup {
    label: string;
    options: SelectOption[];
}

/**
 * Label + native select styled as the Figma box with a trailing chevron. Pass
 * `options` for a flat list or `groups` for `<optgroup>`s (e.g. a "Popular"
 * countries block above the full alphabetical list).
 */
export function SelectField({
    label,
    value,
    onChange,
    options,
    groups,
    className,
    placeholderValue,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options?: SelectOption[];
    groups?: SelectGroup[];
    className?: string;
    placeholderValue?: string;
}) {
    const id = useId();
    return (
        <div className={`flex flex-col gap-2 ${className ?? ''}`}>
            <label htmlFor={id} className={labelClass}>
                {label}
            </label>
            <div className='relative'>
                <select
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${inputBase} h-[50px] cursor-pointer appearance-none border-it-heading/20 pr-11 ${
                        value === placeholderValue ? 'text-it-heading/30' : ''
                    }`}>
                    {groups
                        ? groups.map((g) => (
                              <optgroup key={g.label} label={g.label}>
                                  {g.options.map((o) => (
                                      <option key={o.value} value={o.value}>
                                          {o.label}
                                      </option>
                                  ))}
                              </optgroup>
                          ))
                        : options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                  {o.label}
                              </option>
                          ))}
                </select>
                <Image
                    src='/icons/checkout/arrow-down.svg'
                    alt=''
                    width={16}
                    height={16}
                    className='pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2'
                />
            </div>
        </div>
    );
}

/** 24px radio cell holding the 20px ring (Figma Ellipse 10, 1.5px stroke). */
export function Radio({ selected }: { selected: boolean }) {
    return (
        <span className='grid size-6 shrink-0 place-items-center'>
            <span
                className={`grid size-5 place-items-center rounded-full border-[1.5px] transition-colors duration-300 ${
                    selected ? 'border-it-primary' : 'border-it-heading'
                }`}>
                <AnimatePresence>
                    {selected && (
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{
                                type: 'spring',
                                stiffness: 500,
                                damping: 30,
                            }}
                            className='size-2.5 rounded-full bg-it-primary'
                        />
                    )}
                </AnimatePresence>
            </span>
        </span>
    );
}

/** Full-width dark commit button (Figma r6, bg #2c2c2c, pad 23/32). */
export function DarkButton({
    onClick,
    disabled,
    type = 'button',
    children,
}: {
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit';
    children: ReactNode;
}) {
    return (
        <motion.button
            type={type}
            onClick={onClick}
            disabled={disabled}
            aria-busy={disabled || undefined}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className={`flex w-full items-center justify-center gap-2.5 rounded-[6px] border-none bg-it-heading px-8 py-[23px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-opacity hover:opacity-90 ${
                disabled ? 'cursor-default' : 'cursor-pointer'
            }`}>
            {children}
        </motion.button>
    );
}
