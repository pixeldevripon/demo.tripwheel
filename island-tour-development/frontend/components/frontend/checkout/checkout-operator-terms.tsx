'use client';

import { ModalShell } from '@/components/frontend/modal-shell';
import { fetchOperatorTerms, type OperatorTermsBody } from '@/lib/api/bookings';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import {
    ConsentLine,
    FreeCancelNote,
    PayCtaButton,
    Radio,
} from './checkout-fields';

type CheckoutDict = Dictionary['checkout'];

/**
 * The Payment card while the intent is DEFERRED behind the gate (Pastel #80):
 * the backend refuses a flagged booking's payment intent until acceptance, so
 * the real method list (whose Card row mounts Stripe Elements off the intent)
 * cannot exist yet. This panel keeps the commit block's exact shape - method
 * rows, gate, CTA, free-cancel and consent lines - with the three rows as a
 * non-interactive preview; ticking the box records acceptance, arms the intent
 * and swaps the live payment panel in.
 *
 * The CTA is NOT disabled: a tap with the box empty asks the gate to show its
 * one calm error line (the mockup's exact demo), never a swallowed click.
 */
export function OperatorTermsPendingPanel({
    dict,
    locale,
    freeCancelLabel,
    amountLabel,
    busy,
    gate,
    onBlockedPay,
}: {
    dict: CheckoutDict;
    locale: Locale;
    freeCancelLabel: string;
    /** Formatted charge-today amount for the CTA label, or null. */
    amountLabel: string | null;
    /** Acceptance + intent round-trip in flight. */
    busy: boolean;
    /** The rendered `CheckoutOperatorTerms` node. */
    gate: ReactNode;
    onBlockedPay: () => void;
}) {
    const previewRows: { label: string; logos: string[] }[] = [
        {
            label: dict.card,
            logos: [
                '/icons/payments/pay-1.svg',
                '/icons/payments/pay-2.svg',
                '/icons/payments/pay-8.svg',
            ],
        },
        { label: 'iDEAL', logos: ['/icons/payments/pay-4.svg'] },
        { label: dict.paypal, logos: ['/icons/payments/pay-3.svg'] },
    ];
    return (
        <div className='flex flex-col'>
            <span className='mt-0.5 mb-2.5 text-[13.5px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
                {dict.selectPaymentMethod}
            </span>
            {/* Same bordered radio list as the live panel, non-interactive
                until the tick arms the intent (the rows become real then). */}
            <div className='overflow-hidden rounded-it-md border-[1.5px] border-it-border bg-it-white opacity-60'>
                {previewRows.map(row => (
                    <div
                        key={row.label}
                        className='flex items-center gap-3 border-t border-it-divider px-4 py-3.5 first:border-t-0'>
                        <Radio selected={false} />
                        <span className='text-[14px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
                            {row.label}
                        </span>
                        <span className='ml-auto flex items-center gap-1.5'>
                            {row.logos.map(src => (
                                <Image
                                    key={src}
                                    src={src}
                                    alt=''
                                    width={74}
                                    height={41}
                                    className='h-6 w-auto shrink-0'
                                />
                            ))}
                        </span>
                    </div>
                ))}
            </div>

            {gate}

            <PayCtaButton
                onClick={onBlockedPay}
                disabled={busy}
                processing={busy}
                dict={dict}
                amountLabel={amountLabel}
            />
            <FreeCancelNote label={freeCancelLabel} />
            <ConsentLine
                consent={dict.consent}
                consentTerms={dict.consentTerms}
                consentPrivacy={dict.consentPrivacy}
                securePayment={dict.securePayment}
                locale={locale}
            />
        </div>
    );
}

/**
 * The operator-conditions gate at the checkout commit step (Pastel #80 /
 * MCK-20): ONE required checkbox with TWO renderings, keyed on the tour's
 * `operatorTerms.kind`.
 *
 * - DOCUMENT: "I have read and agree to {operator}'s operator conditions" -
 *   the conditions words open a reading layer with the operator's full text,
 *   and "Agree and continue" inside the reader ticks the box, so reading is
 *   never punished with a second tap.
 * - ACKNOWLEDGMENT: 2-6 first-person participation facts right above the box
 *   ("This tour asks you to confirm:") - a declaration, not a contract, so
 *   there is no document and no link (a link would be theater).
 *
 * The box sits between the payment methods and the CTA, directly above the
 * locked consent line, and is visible from the moment Payment opens - it never
 * springs on tap. The checkout owns the state: ticking records acceptance
 * server-side and arms the payment intent (the backend refuses the intent
 * without the stamp - the checkbox is the interface to that rule, the API is
 * the rule).
 */
export function CheckoutOperatorTerms({
    dict,
    locale,
    tourId,
    kind,
    items,
    operatorName,
    checked,
    busy,
    error,
    onToggle,
}: {
    dict: CheckoutDict;
    locale: Locale;
    tourId: string;
    kind: 'DOCUMENT' | 'ACKNOWLEDGMENT';
    /** First-person declarations (ACKNOWLEDGMENT only), locale-resolved. */
    items: string[];
    operatorName: string | null;
    checked: boolean;
    /** Acceptance + intent round-trip in flight - the box locks meanwhile. */
    busy: boolean;
    /** The one calm error line, set by a Pay tap with the box empty. */
    error: string | null;
    onToggle: (next: boolean) => void;
}) {
    const [readerOpen, setReaderOpen] = useState(false);
    const operator = operatorName ?? dict.operatorTermsFallbackName;

    const checkboxRow = (label: ReactNode, ariaLabel: string) => (
        <motion.button
            type='button'
            role='checkbox'
            aria-checked={checked}
            aria-required='true'
            aria-label={ariaLabel}
            disabled={busy}
            onClick={() => onToggle(!checked)}
            whileTap={busy ? undefined : { scale: 0.995 }}
            transition={springPop}
            className={`flex w-full cursor-pointer items-start gap-3 rounded-it-md border-[1.5px] bg-it-white p-3.5 text-left transition-colors duration-300 ${
                error
                    ? 'border-it-error'
                    : checked
                      ? 'border-it-primary'
                      : 'border-it-border'
            } ${busy ? 'cursor-wait opacity-60' : ''}`}>
            <span
                aria-hidden
                className={`mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-[4px] border-[1.5px] transition-colors duration-300 ${
                    checked
                        ? 'border-it-primary bg-it-primary'
                        : 'border-it-border bg-it-white'
                }`}>
                {checked && (
                    <Image
                        src='/icons/checkout/check-tick-white.svg'
                        alt=''
                        width={12}
                        height={12}
                        className='size-3 shrink-0'
                    />
                )}
            </span>
            <span className='text-[14px] md:text-[16px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                {label}
            </span>
        </motion.button>
    );

    // "I have read and agree to {operator}'s {conditions}." - split on the
    // placeholders so the operator name is bold and the conditions words are
    // the reader trigger (same template pattern as ConsentLine).
    const documentLabel = dict.operatorTermsAgree
        .split(/(\{operator\}|\{conditions\})/)
        .map((part, i) => {
            if (part === '{operator}')
                return <b key={i}>{operator}</b>;
            if (part === '{conditions}')
                return (
                    <span
                        key={i}
                        role='button'
                        tabIndex={0}
                        onClick={e => {
                            // The row itself is the checkbox - opening the
                            // reader must not toggle it.
                            e.stopPropagation();
                            setReaderOpen(true);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setReaderOpen(true);
                            }
                        }}
                        className='cursor-pointer font-medium text-it-primary underline underline-offset-2 tracking-[-0.012em]'>
                        {dict.operatorTermsConditionsWord}
                    </span>
                );
            return <span key={i}>{part}</span>;
        });

    return (
        <div className='mt-4 flex flex-col gap-2'>
            {kind === 'ACKNOWLEDGMENT' ? (
                <div className='flex flex-col gap-2.5 rounded-it-md border-[1.5px] border-it-border bg-it-bg p-3.5'>
                    <span className='text-[13px] font-medium leading-[1.5] text-it-heading tracking-[-0.012em]'>
                        {dict.operatorTermsConfirmHeading}
                    </span>
                    <ul className='m-0 flex list-disc flex-col gap-1 pl-5'>
                        {items.map((item, i) => (
                            <li
                                key={i}
                                className='text-[13px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                {item}
                            </li>
                        ))}
                    </ul>
                    {checkboxRow(
                        dict.operatorTermsConfirmLabel,
                        dict.operatorTermsConfirmLabel
                    )}
                </div>
            ) : (
                checkboxRow(
                    documentLabel,
                    dict.operatorTermsAgree
                        .replace('{operator}', operator)
                        .replace(
                            '{conditions}',
                            dict.operatorTermsConditionsWord
                        )
                )
            )}

            {/* The one calm error line (mockup: never a modal, never a shake). */}
            <AnimatePresence initial={false}>
                {error && (
                    <motion.p
                        role='alert'
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className='m-0 text-[12.5px] leading-[1.5] text-it-error tracking-[-0.012em]'>
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>

            {kind === 'DOCUMENT' && (
                <OperatorTermsReader
                    dict={dict}
                    locale={locale}
                    tourId={tourId}
                    operatorName={operator}
                    open={readerOpen}
                    onClose={() => setReaderOpen(false)}
                    onAgree={() => {
                        setReaderOpen(false);
                        if (!checked && !busy) onToggle(true);
                    }}
                />
            )}
        </div>
    );
}

/**
 * The reading layer (MCK-20 §3): the operator's full conditions text, opened
 * in the flow. Desktop: centred dialog; phone: bottom sheet - the shared
 * `ModalShell` owns the chrome (portal, escape, scroll lock, focus trap and
 * restore, same as the tour page's PolicyModal). "Agree and continue" closes
 * AND ticks the box.
 *
 * The body is fetched once on first open. It is sanitized HTML from a trusted
 * write path (seed today, the admin CMS later - which must sanitize at write
 * time, like page editorial content), rendered with the page's own type scale.
 */
function OperatorTermsReader({
    dict,
    locale,
    tourId,
    operatorName,
    open,
    onClose,
    onAgree,
}: {
    dict: CheckoutDict;
    locale: Locale;
    tourId: string;
    operatorName: string;
    open: boolean;
    onClose: () => void;
    onAgree: () => void;
}) {
    const [body, setBody] = useState<OperatorTermsBody | null>(null);
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'failed'>(
        'idle'
    );

    // One fetch on first open; a failed fetch retries on the next open.
    useEffect(() => {
        if (!open || state === 'ready' || state === 'loading') return;
        let cancelled = false;
        setState('loading');
        fetchOperatorTerms(tourId, locale)
            .then(res => {
                if (cancelled) return;
                setBody(res);
                setState('ready');
            })
            .catch(() => {
                if (!cancelled) setState('failed');
            });
        return () => {
            cancelled = true;
        };
        // `state` is deliberately read, not depended on: depending on it would
        // re-run the effect on its own transition and loop `failed -> loading`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, tourId, locale]);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            ariaLabel={dict.operatorTermsReaderTitle}
            panelClassName='sm:max-h-[85vh] sm:max-w-[720px] sm:gap-5'>
            {/* Header - does not scroll */}
            <div className='flex shrink-0 flex-col gap-4'>
                <div className='flex items-start justify-between gap-4'>
                    <div className='flex flex-col gap-1'>
                        <h2 className='m-0 font-it-display text-[21px] leading-[1.2] tracking-[-0.012em] text-it-heading sm:text-[22px] font-medium'>
                            {dict.operatorTermsReaderTitle}
                        </h2>
                        <span className='text-[13px] leading-[1.5] text-it-text-muted tracking-[-0.012em]'>
                            {operatorName}
                            {body?.version
                                ? ` · ${dict.operatorTermsReaderVersion.replace('{version}', body.version)}`
                                : ''}
                        </span>
                    </div>
                    <motion.button
                        type='button'
                        aria-label={dict.operatorTermsReaderClose}
                        onClick={onClose}
                                    whileTap={{ scale: 0.9 }}
                                    transition={springPop}
                                    className='-mt-0.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-ink/10 bg-it-surface transition-colors duration-300 hover:bg-it-border sm:size-10'>
                                    <Image
                                        src='/icons/modal-close.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-4 shrink-0 sm:size-[18px]'
                                    />
                                </motion.button>
                            </div>
                            <div className='h-px w-full bg-it-ink/10' />
                        </div>

                        {/* Body - the scroll container */}
                        <div className='min-h-0 flex-1 overflow-y-auto'>
                            {state === 'ready' && body?.document ? (
                                <div
                                    className='flex flex-col gap-2 text-[14.5px] leading-[1.7] text-it-text-muted [&_h4]:m-0 [&_h4]:mt-3 [&_h4]:text-[14.5px] [&_h4]:font-bold [&_h4]:leading-[1.6] [&_h4]:text-it-heading [&_h4:first-child]:mt-0 [&_li]:mt-1 [&_p]:m-0 [&_ul]:m-0 [&_ul]:pl-5 tracking-[-0.012em]'
                                    // Sanitized at write time (trusted seed /
                                    // admin CMS) - same contract as the page
                                    // editorial content this mirrors.
                                    dangerouslySetInnerHTML={{
                                        __html: body.document,
                                    }}
                                />
                            ) : state === 'failed' ||
                              (state === 'ready' && !body?.document) ? (
                                <p className='m-0 text-[14px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                    {dict.operatorTermsReaderUnavailable}
                                </p>
                            ) : (
                                <p className='m-0 text-[14px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                    {dict.operatorTermsReaderLoading}
                                </p>
                            )}
                        </div>

            {/* Footer - agreeing inside the reader ticks the box,
                so reading is never punished with a second tap. */}
            <div className='shrink-0'>
                <motion.button
                    type='button'
                    onClick={onAgree}
                    whileTap={{ scale: 0.985 }}
                    transition={springPop}
                    className='w-full cursor-pointer rounded-it-md border-none bg-it-primary px-5 py-3 text-[14.5px] font-medium leading-[1.5] text-it-white transition-colors duration-300 hover:bg-it-primary-hover tracking-[-0.012em]'>
                    {dict.operatorTermsReaderAgree}
                </motion.button>
            </div>
        </ModalShell>
    );
}
