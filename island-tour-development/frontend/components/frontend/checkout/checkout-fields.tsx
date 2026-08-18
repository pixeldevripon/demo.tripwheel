'use client';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useId, type ReactNode } from 'react';

/**
 * Shared field primitives + style tokens for the checkout accordion (design v2
 * MCK-09). Extracted so `checkout-form` (contact) and `checkout-payment`
 * (Stripe Card Elements) render identical inputs without a circular import.
 *
 * FOUNDER RULE: every control keeps the SUBTLE `border-it-border` - no dark
 * borders on inputs in any state (focus swaps to the orange primary).
 */

export const labelClass = 'text-[13px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]';
export const helperClass = 'text-[13px] leading-[1.6] text-it-text-muted tracking-[-0.012em]';
// 16px below `md` - iOS Safari force-zooms the viewport on a focused input
// under 16px. Zooming mid-checkout is the worst place on the site for it.
//
// This said 16 in the comment and 14.5 in the class (found 2026-08-18), so the
// guard was written down but never actually in force: every checkout field
// zoomed the page on focus on an iPhone. It is a real 16 now. Do NOT let a
// type sweep pull it under 16 again - the desktop step is the one to tune.
export const inputBase =
    'w-full rounded-it-sm border bg-it-white px-[13px] text-[16px] md:text-[14.5px] leading-[1.6] text-it-heading placeholder:text-it-text-muted outline-none transition-colors focus:border-it-primary tracking-[-0.012em]';
export const titleClass =
    'font-it-display text-[14.5px] font-medium leading-[1.3] tracking-[-0.012em] text-it-heading';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Green free-cancellation reassurance line under a commit CTA (5.8). */
export function FreeCancelNote({ label }: { label: string }) {
    return (
        // items-start + the icon's optical offset: when the line WRAPS on a
        // narrow viewport the check stays with the first line instead of
        // floating centred between both.
        <div className='mt-3 flex items-start justify-center gap-[7px] text-center text-[13px] font-medium leading-[1.5] text-it-green-text tracking-[-0.012em]'>
            <Image
                src='/icons/booking-check.svg'
                alt=''
                width={20}
                height={20}
                className='mt-[3px] size-3.5 shrink-0'
            />
            <span>{label}</span>
        </div>
    );
}

/**
 * 12px centred implied-consent block under a commit CTA: the optional
 * "payments are secure and encrypted" line, then the terms/privacy sentence
 * with its {terms}/{privacy} tokens swapped for underlined links. Kept at the
 * legal/accessibility legibility floor - never lighter or smaller.
 */
export function ConsentLine({
    consent,
    consentTerms,
    consentPrivacy,
    securePayment,
    locale,
}: {
    consent: string;
    consentTerms: string;
    consentPrivacy: string;
    /** Prefix line; omitted on operator_full (no payment is taken). */
    securePayment?: string;
    locale: Locale;
}) {
    const linkClass =
        'font-medium text-it-text-muted underline underline-offset-2 tracking-[-0.012em]';
    return (
        <p className='mt-2.5 text-center text-[13px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
            {securePayment && (
                <>
                    {securePayment}.
                    <br />
                </>
            )}
            {consent.split(/(\{terms\}|\{privacy\})/).map((part, i) => {
                if (part === '{terms}')
                    return (
                        <Link
                            key={i}
                            href={localizeHref(locale, '/terms')}
                            className={linkClass}>
                            {consentTerms}
                        </Link>
                    );
                if (part === '{privacy}')
                    return (
                        <Link
                            key={i}
                            // Real legal-page slug (same as the footer), NOT /privacy.
                            href={localizeHref(locale, '/privacy-policy')}
                            className={linkClass}>
                            {consentPrivacy}
                        </Link>
                    );
                return <span key={i}>{part}</span>;
            })}
        </p>
    );
}

/** Label text + the mockup's orange required star / soft optional note. */
export function FieldLabel({
    label,
    required,
    note,
}: {
    label: string;
    required?: boolean;
    /** Soft-gray suffix, e.g. "(From $19 p.p.)". */
    note?: string;
}) {
    return (
        <>
            {label}
            {required && <span className='text-it-primary tracking-[-0.012em]'> *</span>}
            {note && (
                <span className='font-medium text-it-text-muted tracking-[-0.012em]'> {note}</span>
            )}
        </>
    );
}

/** Label + text input + optional inline error. */
export function Field({
    label,
    required,
    value,
    onChange,
    placeholder,
    type = 'text',
    error,
    className,
    inputMode,
    readOnly,
}: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    error?: string;
    className?: string;
    inputMode?: 'text' | 'email' | 'tel' | 'numeric';
    /**
     * Value is fixed by something outside the form (checkout locks the email to
     * the signed-in traveller). `readOnly`, never `disabled`: the value still
     * submits, still reads to a screen reader, and stays selectable/copyable -
     * a disabled input would look like a bug on a field that shows real data.
     */
    readOnly?: boolean;
}) {
    const id = useId();
    return (
        <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
            <label htmlFor={id} className={labelClass}>
                <FieldLabel label={label} required={required} />
            </label>
            <input
                id={id}
                type={type}
                inputMode={inputMode}
                value={value}
                placeholder={placeholder}
                readOnly={readOnly}
                onChange={e => onChange(e.target.value)}
                aria-invalid={error ? true : undefined}
                className={`${inputBase} h-[46px] ${
                    error ? 'border-it-primary' : 'border-it-border'
                } ${readOnly ? 'bg-it-surface text-it-text-muted focus:border-it-border tracking-[-0.012em]' : ''}`}
            />
            <FieldError error={error} />
        </div>
    );
}

/**
 * ONE reveal for every error line on the checkout, field-level or form-level.
 *
 * `FieldError`'s docblock already promised it "mirrors the Field error
 * treatment" - so the intent to have a single error motion was written down,
 * and three call sites (the contact form and both payment panels) ignored it
 * and inlined their own copy of the same AnimatePresence block.
 */
const ERROR_REVEAL = {
    initial: { opacity: 0, y: -4, height: 0 },
    animate: { opacity: 1, y: 0, height: 'auto' },
    exit: { opacity: 0, y: -4, height: 0 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
} as const;

/** An animated inline error line (mirrors the Field error treatment). */
export function FieldError({ error }: { error?: string }) {
    return (
        <AnimatePresence initial={false}>
            {error && (
                <motion.span
                    {...ERROR_REVEAL}
                    className='text-[13px] leading-[1.5] text-it-primary tracking-[-0.012em]'>
                    {error}
                </motion.span>
            )}
        </AnimatePresence>
    );
}

/**
 * The FORM-level error line - same reveal, one step larger, and its own top
 * margin because it sits under a control group rather than under one field.
 */
export function FormError({
    error,
    className = 'mt-3',
}: {
    error?: string | null;
    className?: string;
}) {
    return (
        <AnimatePresence initial={false}>
            {error && (
                <motion.div
                    {...ERROR_REVEAL}
                    className={`${className} text-[13px] leading-[1.6] text-it-primary`}>
                    {error}
                </motion.div>
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
        <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
            <span className={labelClass}>{label}</span>
            <div
                className={`${inputBase} flex h-[46px] items-center ${
                    error ? 'border-it-primary' : 'border-it-border'
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
 * Label + native select styled as the mockup box with a trailing chevron. Pass
 * `options` for a flat list or `groups` for `<optgroup>`s (e.g. a "Popular"
 * countries block above the full alphabetical list).
 */
export function SelectField({
    label,
    required,
    note,
    value,
    onChange,
    options,
    groups,
    className,
    placeholderValue,
}: {
    label: string;
    required?: boolean;
    /** Soft-gray label suffix, e.g. the "(From $19 p.p.)" pickup note. */
    note?: string;
    value: string;
    onChange: (v: string) => void;
    options?: SelectOption[];
    groups?: SelectGroup[];
    className?: string;
    placeholderValue?: string;
}) {
    const id = useId();
    return (
        <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
            <label htmlFor={id} className={labelClass}>
                <FieldLabel label={label} required={required} note={note} />
            </label>
            <div className='relative'>
                <select
                    id={id}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className={`${inputBase} h-[46px] cursor-pointer appearance-none border-it-border pr-11 ${
                        value === placeholderValue ? 'text-it-text-muted tracking-[-0.012em]' : ''
                    }`}>
                    {groups
                        ? groups.map(g => (
                              <optgroup key={g.label} label={g.label}>
                                  {g.options.map(o => (
                                      <option key={o.value} value={o.value}>
                                          {o.label}
                                      </option>
                                  ))}
                              </optgroup>
                          ))
                        : options?.map(o => (
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
                    className='pointer-events-none absolute top-1/2 right-4 size-3.5 -translate-y-1/2'
                />
            </div>
        </div>
    );
}

/** 18px radio ring (design v2 .pm-radio): subtle border, 9px orange dot. */
export function Radio({ selected }: { selected: boolean }) {
    return (
        <span
            className={`relative size-[18px] shrink-0 rounded-full border-[1.5px] bg-it-white transition-colors duration-300 ${
                selected ? 'border-it-primary' : 'border-it-border'
            }`}>
            <AnimatePresence>
                {selected && (
                    // Centered by transform, not grid: a grid item snaps to
                    // whole CSS pixels while the 1.5px ring border paints
                    // fractionally, so at non-100% browser zoom the dot and
                    // the ring land on different pixel grids and the dot
                    // reads off-centre. The x/y halves live INSIDE the motion
                    // values - framer-motion owns `transform`, so a
                    // -translate-x-1/2 class would be overwritten on the
                    // first animation frame.
                    <motion.span
                        initial={{ scale: 0, x: '-50%', y: '-50%' }}
                        animate={{ scale: 1, x: '-50%', y: '-50%' }}
                        exit={{ scale: 0, x: '-50%', y: '-50%' }}
                        transition={{
                            type: 'spring',
                            stiffness: 500,
                            damping: 30,
                        }}
                        className='absolute left-1/2 top-1/2 size-[9px] rounded-full bg-it-primary'
                    />
                )}
            </AnimatePresence>
        </span>
    );
}

/**
 * Full-width commit button - the ONE the whole checkout commits through
 * (Continue on contact, "Reserve my spot · Pay X" on payment via
 * `PayCtaButton`).
 *
 * It is INK, not the brand orange (founder, 2026-08-18). Orange is the site's
 * "go and look at this" colour - it is on every card, link and price - and
 * checkout is the one place where the button is not an invitation to browse
 * but a commitment to pay. Black reads as the serious, secure action, which is
 * the whole point of the step. The orange stays on the summary's amounts and
 * on links, so the page still belongs to the site.
 */
export function CtaButton({
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
            className={`flex w-full items-center justify-center gap-[9px] rounded-it-sm border-none bg-it-ink p-[15px] text-[14.5px] font-bold leading-[1.5] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-heading ${
                disabled ? 'cursor-default opacity-90' : 'cursor-pointer'
            }`}>
            {children}
        </motion.button>
    );
}

/**
 * The "Secure checkout · Powered by {PSP}" trust row.
 *
 * Identical in both payment panels but for the PSP name. It carries no
 * integration logic at all, which is why it lives here rather than being
 * duplicated alongside code that genuinely differs per PSP.
 */
export function SecureCheckoutRow({
    psp,
    dict,
}: {
    psp: string;
    dict: { secureCheckout: string; poweredBy: string };
}) {
    return (
        <div className='mb-3.5 flex items-center gap-2.5 rounded-it-md border border-it-border bg-it-bg px-3.5 py-[11px] text-[13px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
            <Image
                src='/icons/checkout/lock-ink.svg'
                alt=''
                width={24}
                height={24}
                className='size-4 shrink-0'
            />
            {dict.secureCheckout}
            <span className='ml-auto inline-flex items-center gap-1 rounded-[4px] bg-[#425466] px-[9px] py-1 text-[12px] font-medium tracking-[0.02em] text-it-white'>
                {dict.poweredBy} <b>{psp}</b>
            </span>
        </div>
    );
}

/**
 * The commit CTA - the button that takes the money.
 *
 * Shared deliberately. It was ~45 identical lines in both payment panels,
 * differing only in the click handler and the disabled predicate, and a change
 * to the amount format, the busy state or the lock affordance had to land twice
 * or the two PSPs' Pay buttons drifted apart. `amountLabel` is passed in
 * already formatted so this component never has to know about currencies.
 *
 * `amountLabel` MUST be the amount that will actually be charged - see
 * `chargeToday` in `checkout-form`, which reads it from the payment intent
 * rather than from client-side arithmetic.
 */
export function PayCtaButton({
    onClick,
    disabled,
    processing,
    dict,
    amountLabel,
}: {
    onClick: () => void;
    disabled: boolean;
    processing: boolean;
    dict: { processing: string; reserve: string; reservePay: string };
    /** Formatted amount, or null when nothing is due now. */
    amountLabel: string | null;
}) {
    return (
        <div className='mt-5'>
            <CtaButton onClick={onClick} disabled={disabled}>
                <AnimatePresence mode='wait' initial={false}>
                    {processing ? (
                        <motion.span
                            key='processing'
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className='flex items-center gap-2.5'>
                            <span className='size-4 shrink-0 animate-spin rounded-full border-2 border-it-white/30 border-t-it-white' />
                            {dict.processing}
                        </motion.span>
                    ) : (
                        <motion.span
                            key='label'
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15 }}
                            className='flex items-center gap-[9px]'>
                            <Image
                                src='/icons/checkout/lock-white.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-[15px] shrink-0'
                            />
                            {dict.reserve}
                            {amountLabel && (
                                <>
                                    {' · '}
                                    {dict.reservePay.replace(
                                        '{amount}',
                                        amountLabel
                                    )}
                                </>
                            )}
                        </motion.span>
                    )}
                </AnimatePresence>
            </CtaButton>
        </div>
    );
}

/**
 * Accordion collapse duration (ms). Shared by the `Collapse` transition and
 * `checkout-form`'s scroll-into-view, so the scroll can wait for the layout to
 * settle instead of guessing - keep the two in step.
 */
export const COLLAPSE_MS = 350;

/* ── Accordion primitives ─────────────────────────────────────────────
 *
 * Moved here from `checkout-form`, where they sat below a 950-line component
 * despite being stateless presentation. This file is their home by its own
 * definition - "shared field primitives, extracted so checkout-form and
 * checkout-payment render identical inputs".
 *
 * `SectionBadge`'s done/active/upcoming tri-state is also spelled out in
 * `checkout-steps.tsx` at a different size; they are at least neighbours now,
 * so the next change to that vocabulary can see both.
 * ───────────────────────────────────────────────────────────────────── */

export type SectionBadgeState = 'active' | 'done' | 'upcoming';

/**
 * 26px numbered circle for a section header (design v2 .h-num): orange-filled
 * while active, green with a white check once done, subtle-ringed upcoming.
 */
export function SectionBadge({
    number,
    state,
}: {
    number: number;
    state: SectionBadgeState;
}) {
    return (
        <span
            className={`grid size-[26px] shrink-0 place-items-center rounded-full transition-colors duration-300 ${
                state === 'done'
                    ? 'bg-it-green'
                    : state === 'active'
                      ? 'bg-it-primary'
                      : 'border-[1.5px] border-it-border bg-it-white'
            }`}>
            <AnimatePresence mode='wait' initial={false}>
                {state === 'done' ? (
                    <motion.span
                        key='check'
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={springPop}
                        className='grid place-items-center'>
                        <Image
                            src='/icons/checkout/check-tick-white.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[13px] shrink-0'
                        />
                    </motion.span>
                ) : (
                    <motion.span
                        key='number'
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={springPop}
                        className={`text-[13px] font-bold leading-none tabular-nums ${
                            state === 'active'
                                ? 'text-it-white tracking-[-0.012em]'
                                : 'text-it-text-muted tracking-[-0.012em]'
                        }`}>
                        {number}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}

/**
 * Height-collapse section body. Spacing lives INSIDE (pt on the child) so the
 * collapsed state closes fully tight; collapsed content stays mounted (form /
 * Stripe entries survive an edit round) but is inert - no tab stops, no
 * screen-reader exposure.
 *
 * `instant` snaps the height instead of animating it. Pass it for the OPENING
 * of any section holding a PSP iframe: while `height` animates from 0 the box
 * is also `overflow-hidden`, so the Stripe Card Elements and the four Mollie
 * components - which mount on the very render the animation starts - would come
 * up inside a zero-height, clipped container and settle their layout against a
 * box that is still moving. Snapping costs one frame of animation and gives the
 * iframes a settled box to mount into; the reveal keeps its motion via the
 * opacity fade at that call site, which neither clips nor resizes.
 */
export function Collapse({
    open,
    instant = false,
    children,
}: {
    open: boolean;
    instant?: boolean;
    children: ReactNode;
}) {
    return (
        <motion.div
            initial={false}
            animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
            transition={
                instant
                    ? { duration: 0 }
                    : { duration: COLLAPSE_MS / 1000, ease: [0.4, 0, 0.2, 1] }
            }
            inert={open ? undefined : true}
            aria-hidden={!open}
            className='overflow-hidden'>
            {children}
        </motion.div>
    );
}

