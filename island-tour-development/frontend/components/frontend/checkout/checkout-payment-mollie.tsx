'use client';

import { createPaymentIntent } from '@/lib/api/bookings';
import { formatCheckoutMoney } from '@/lib/checkout/checkout';
import { leaveTo } from '@/lib/checkout/leave-to';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    loadMollieJs,
    toMollieJsLocale,
    type MollieComponent,
    type MollieInstance,
} from '@/lib/mollie/mollie-js';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
    ConsentLine,
    CtaButton,
    FieldShell,
    FreeCancelNote,
    Radio,
} from './checkout-fields';

type CheckoutDict = Dictionary['checkout'];

/**
 * Payment section for the MOLLIE provider - the Stripe-parity inline card
 * form via Mollie Components (mollie.js iframes styled to the same Figma
 * fields). Card is the ONLY method shown here (founder decision - no "more
 * methods" row); the hosted page appears only as the FALLBACK when Components
 * are not configured (no profileId) or mollie.js cannot load.
 *
 * Money flow: nothing was created at contact-continue (phase 1 only returned
 * the Components profile). Pay tokenizes the card client-side and the
 * phase-2 intent call creates the `creditcard` payment with that token - the
 * returned checkout URL is then only the 3DS authentication hop (frictionless
 * 3DS bounces straight back to the processing page).
 */
export function CheckoutPaymentMollie({
    dict,
    locale,
    bookingId,
    profileId,
    testmode,
    payToday,
    currencySymbol,
    freeCancelLabel,
    processingHref,
}: {
    dict: CheckoutDict;
    locale: Locale;
    bookingId: string;
    /** Mollie Components profile (pfl_...); null = hosted page only. */
    profileId: string | null;
    testmode: boolean;
    payToday: number;
    currencySymbol: string;
    /** Composed free-cancellation reassurance line under the pay CTA. */
    freeCancelLabel: string;
    /** Relative processing path (with ?ref&tour) - Mollie's returnUrl is built from it. */
    processingHref: string;
}) {
    // 'loading' while mollie.js + the field iframes come up; 'unavailable'
    // (no profileId / blocked script) falls back to the hosted page.
    const [cardState, setCardState] = useState<
        'loading' | 'ready' | 'unavailable'
    >(profileId ? 'loading' : 'unavailable');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const mollieRef = useRef<MollieInstance | null>(null);
    const numberRef = useRef<HTMLDivElement>(null);
    const holderRef = useRef<HTMLDivElement>(null);
    const expiryRef = useRef<HTMLDivElement>(null);
    const cvcRef = useRef<HTMLDivElement>(null);

    // Mount the four card iframes once mollie.js is up. StrictMode-safe: the
    // cleanup unmounts every component, so the second mount starts clean.
    useEffect(() => {
        if (!profileId) return;
        let cancelled = false;
        const mounted: MollieComponent[] = [];

        void loadMollieJs().then(Mollie => {
            if (cancelled) return;
            if (!Mollie) {
                setCardState('unavailable');
                return;
            }
            const mollie = Mollie(profileId, {
                locale: toMollieJsLocale(locale),
                testmode,
            });
            mollieRef.current = mollie;

            // Same visual contract as the Stripe Card Elements (transparent
            // iframes inside our FieldShell boxes).
            const styles = {
                base: {
                    color: '#2c2c2c',
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
                    fontSize: '16px',
                    letterSpacing: '-0.012em',
                    '::placeholder': { color: 'rgba(44,44,44,0.3)' },
                },
                valid: { color: '#2c2c2c' },
            };
            const fields: [
                'cardNumber' | 'cardHolder' | 'expiryDate' | 'verificationCode',
                HTMLDivElement | null,
                string,
            ][] = [
                ['cardNumber', numberRef.current, 'number'],
                ['expiryDate', expiryRef.current, 'expiry'],
                ['verificationCode', cvcRef.current, 'cvv'],
                ['cardHolder', holderRef.current, 'name'],
            ];
            for (const [type, target, key] of fields) {
                if (!target) continue;
                const component = mollie.createComponent(type, { styles });
                component.mount(target);
                component.addEventListener('change', state => {
                    setErrors(prev => ({
                        ...prev,
                        [key]: state.error && state.touched ? state.error : '',
                    }));
                });
                mounted.push(component);
            }
            setCardState('ready');
        });

        return () => {
            cancelled = true;
            for (const component of mounted) {
                try {
                    component.unmount();
                } catch {
                    // Already gone (navigation teardown) - nothing to release.
                }
            }
            mollieRef.current = null;
        };
        // profileId/testmode/locale are stable for the checkout's lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileId]);

    const money = (n: number) => formatCheckoutMoney(n, currencySymbol, locale);

    /** Phase 2: create the Mollie payment, then follow its redirect/landing. */
    async function createAndGo(cardToken?: string) {
        const pi = await createPaymentIntent(bookingId, {
            returnUrl: `${window.location.origin}${processingHref}`,
            cancelUrl: window.location.href,
            ...(cardToken ? { cardToken } : {}),
        });
        if (pi.checkoutUrl) {
            // Hosted page, or the card's 3DS hop - leaves the app either way.
            window.location.assign(pi.checkoutUrl);
            return;
        }
        if (pi.status === 'SUCCEEDED' || pi.status === 'PROCESSING') {
            // Frictionless 3DS (or an already-paid revisit) - no redirect
            // needed; the processing page settles and forwards to the TYP.
            // Document navigation, matching the hosted/3DS branch above and the
            // Stripe panel - the processing route is never prerendered
            // (lib/checkout/leave-to.ts).
            leaveTo(processingHref);
            return;
        }
        throw new Error(dict.paymentUnavailable);
    }

    async function handlePay() {
        if (processing) return;
        setFormError(null);
        setProcessing(true);
        try {
            if (cardState === 'ready') {
                const mollie = mollieRef.current;
                if (!mollie) throw new Error(dict.paymentUnavailable);
                const { token, error } = await mollie.createToken();
                if (error || !token) {
                    // Field-level problems already show under their inputs;
                    // this is the form-level fallback (localized by mollie.js).
                    setFormError(error?.message ?? dict.paymentError);
                    setProcessing(false);
                    return;
                }
                await createAndGo(token);
            } else {
                // Hosted fallback (no profileId / mollie.js blocked).
                await createAndGo();
            }
            // Success = navigation; the latch stays on while the page leaves.
        } catch (err) {
            console.error('[checkout] mollie pay failed:', err);
            const raw = err instanceof Error ? err.message : '';
            const isServer500 = /internal server error/i.test(raw);
            setFormError(raw && !isServer500 ? raw : dict.paymentError);
            setProcessing(false);
        }
    }

    // The mount target only provides WIDTH: mollie.js sizes the iframe's
    // HEIGHT itself (18px start, then a height-changed event from the inner
    // frame) - forcing h-full stretches it to fill the 50px shell and pins
    // the text/brand icon to the top. FieldShell's items-center does the
    // vertical centering of the mollie-managed block.
    const mountClass = 'w-full';

    return (
        <div className='flex flex-col'>
            {cardState !== 'unavailable' ? (
                /* Inline card (Mollie Components) - mirrors the Stripe card
                   form. The <form> is REQUIRED by mollie.js (components live
                   inside one; Enter in a field dispatches its submit). */
                <form
                    className='flex flex-col'
                    onSubmit={e => {
                        e.preventDefault();
                        void handlePay();
                    }}>
                    <span className='mt-0.5 mb-2.5 text-[13.5px] font-bold leading-[1.5] text-it-ink'>
                        {dict.selectPaymentMethod}
                    </span>
                    <div className='mb-3.5 flex items-center gap-2.5 rounded-it-md border border-it-border bg-it-bg px-3.5 py-[11px] text-[13px] font-bold leading-[1.5] text-it-ink'>
                        <Image
                            src='/icons/checkout/lock-ink.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 shrink-0'
                        />
                        {dict.secureCheckout}
                        <span className='ml-auto inline-flex items-center gap-1 rounded-[4px] bg-[#425466] px-[9px] py-1 text-[10.5px] font-bold tracking-[0.02em] text-it-white'>
                            {dict.poweredBy} <b>Mollie</b>
                        </span>
                    </div>
                    <div className='flex w-full items-center gap-3 rounded-t-it-md border-[1.5px] border-b-0 border-it-border bg-it-primary-subtle px-4 py-3.5'>
                        <Radio selected />
                        <span className='text-[14px] font-bold leading-[1.5] text-it-ink'>
                            {dict.card}
                        </span>
                        <Image
                            src='/icons/checkout/pay-card.svg'
                            alt=''
                            width={44}
                            height={14}
                            className='ml-auto h-3.5 w-11 shrink-0'
                        />
                    </div>
                    <div className='flex flex-col gap-3.5 rounded-b-it-md border-[1.5px] border-t-0 border-it-border px-4 pb-[18px] pt-2.5'>
                        <FieldShell
                            label={dict.cardNumber}
                            error={errors.number}>
                            <div ref={numberRef} className={mountClass} />
                        </FieldShell>
                        <div className='flex flex-col gap-4 sm:flex-row sm:gap-2'>
                            <FieldShell
                                className='flex-1'
                                label={dict.expiry}
                                error={errors.expiry}>
                                <div ref={expiryRef} className={mountClass} />
                            </FieldShell>
                            <FieldShell
                                className='flex-1'
                                label={dict.cvv}
                                error={errors.cvv}>
                                <div ref={cvcRef} className={mountClass} />
                            </FieldShell>
                        </div>
                        <FieldShell label={dict.nameOnCard} error={errors.name}>
                            <div ref={holderRef} className={mountClass} />
                        </FieldShell>
                    </div>
                    {/* Test-mode aid (operator-facing, never rendered on a live
                        key - so deliberately not in the 7-locale dictionaries). */}
                    {testmode && cardState === 'ready' && (
                        <p className='pt-1.5 text-[12.5px] leading-[1.6] text-it-ink-muted'>
                            Test mode - use card 4543 4740 0224 9996 (Visa) or
                            2223 0000 1047 9399 (Mastercard), any future expiry,
                            any CVV, any name.
                        </p>
                    )}
                </form>
            ) : (
                /* Hosted fallback: no profileId configured (or mollie.js
                   blocked) - a single always-selected hand-off row. */
                <div className='flex items-start gap-3 rounded-it-md border-[1.5px] border-it-border bg-it-primary-subtle px-4 py-3.5'>
                    <Radio selected />
                    <div className='flex min-w-0 flex-col gap-1'>
                        <span className='text-[14px] font-bold leading-[1.5] text-it-ink'>
                            {dict.hostedCheckoutTitle}
                        </span>
                        <span className='text-[12.5px] leading-[1.6] text-it-text-muted'>
                            {dict.redirectNote}
                        </span>
                    </div>
                </div>
            )}

            {/* Form-level error (tokenization / payment-creation failure). */}
            <AnimatePresence initial={false}>
                {formError && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className='mt-3 text-[13.5px] leading-[1.6] text-it-primary'>
                        {formError}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className='mt-5'>
                <CtaButton
                    onClick={handlePay}
                    disabled={processing || cardState === 'loading'}>
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
                                {payToday > 0 && (
                                    <>
                                        {' · '}
                                        {dict.reservePay.replace(
                                            '{amount}',
                                            money(payToday)
                                        )}
                                    </>
                                )}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </CtaButton>
            </div>

            {/* Free-cancellation + implied consent (same as the Stripe panel). */}
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

