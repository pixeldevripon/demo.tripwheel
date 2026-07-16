'use client';

import type { BookingSelectionPayload } from '@/lib/checkout/checkout';
import type { Currency, Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { CheckoutForm, type CheckoutPickupOption } from './checkout-form';
import { PickupLabelProvider } from './checkout-pickup-label';
import { CheckoutSteps, type CheckoutPhase } from './checkout-steps';

type CheckoutDict = Dictionary['checkout'];

interface CheckoutClientProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Tour detail URL - the "Back to tour" bar and summary edit target. */
    tourHref: string;
    pickupOptions: CheckoutPickupOption[];
    pickupFromLabel: string | null;
    payToday: number;
    currencySymbol: string;
    /** Server-rendered booking summary (right rail). */
    summary: ReactNode;

    // ── Live booking inputs (widget selection, carried in the URL) ──
    tourId: string;
    departureId: string | null;
    currency: Currency;
    quoteId: string | null;
    reserveSelection: BookingSelectionPayload | null;
    destination: string;
    slug: string;
}

const backBarLabel =
    'flex w-fit cursor-pointer items-center gap-2 border-none bg-transparent p-0 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading no-underline transition-colors duration-500 hover:text-it-primary';

const backCaret = (
    <Image
        src='/icons/breadcrumb/arrow-right.svg'
        alt=''
        width={20}
        height={20}
        className='size-5 shrink-0 rotate-180'
    />
);

/**
 * Owns the checkout phase and lays out the three full-width bands of the Figma
 * pages (49225:8357 / 49225:8358): the phase-aware back bar ("Back to tour" on
 * Contact, "Back to contact" on Payment), the 116px step-indicator band, and
 * the form + summary grid - both columns starting at the same top. The summary
 * is passed in as a server-rendered node.
 */
export function CheckoutClient({
    dict,
    locale,
    tourHref,
    pickupOptions,
    pickupFromLabel,
    payToday,
    currencySymbol,
    summary,
    tourId,
    departureId,
    currency,
    quoteId,
    reserveSelection,
    destination,
    slug,
}: CheckoutClientProps) {
    const [phase, setPhase] = useState<CheckoutPhase>('contact');
    // Selected pickup label, published by the form and consumed by the summary's
    // pickup row (the summary itself is a server-rendered node).
    const [pickupLabel, setPickupLabel] = useState<string | null>(null);
    const hasPayment = payToday > 0;

    return (
        <div className='flex flex-col'>
            {/* Back bar - "Back to tour" on Contact (Figma 47659:2353),
                "Back to contact" on Payment (49225:8358). */}
            <div className='border-b border-it-heading/10 bg-it-white'>
                <div className='mx-auto w-full max-w-360 px-4 py-5 md:px-8 xl:px-30'>
                    <AnimatePresence mode='wait' initial={false}>
                        <motion.div
                            key={phase}
                            initial={{ opacity: 0, x: 6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{
                                duration: 0.15,
                                ease: [0.4, 0, 0.2, 1],
                            }}>
                            {phase === 'payment' ? (
                                <button
                                    type='button'
                                    onClick={() => setPhase('contact')}
                                    className={backBarLabel}>
                                    {backCaret}
                                    {dict.backToContact}
                                </button>
                            ) : (
                                <Link href={tourHref} className={backBarLabel}>
                                    {backCaret}
                                    {dict.backToTour}
                                </Link>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Step-indicator band (116px; steps left-aligned to the grid edge). */}
            {hasPayment ? (
                <div className='mx-auto w-full max-w-360 px-4 py-5 md:px-8 xl:px-30'>
                    <CheckoutSteps
                        phase={phase}
                        contactLabel={dict.contact}
                        paymentLabel={dict.payment}
                        onGoToContact={() => setPhase('contact')}
                    />
                </div>
            ) : (
                <div className='h-5' />
            )}

            {/* Form (left) + summary (right) - aligned by the same grid. */}
            <div className='it-container'>
                <PickupLabelProvider value={pickupLabel}>
                <div className='flex flex-col gap-8 lg:grid lg:grid-cols-[792fr_384fr] lg:items-start lg:gap-6'>
                    <div className='lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24'>
                        {summary}
                    </div>
                    <div className='min-w-0 lg:col-start-1 lg:row-start-1'>
                        <CheckoutForm
                            dict={dict}
                            locale={locale}
                            phase={phase}
                            onPhaseChange={setPhase}
                            onPickupLabelChange={setPickupLabel}
                            pickupOptions={pickupOptions}
                            pickupFromLabel={pickupFromLabel}
                            payToday={payToday}
                            currencySymbol={currencySymbol}
                            tourId={tourId}
                            departureId={departureId}
                            currency={currency}
                            quoteId={quoteId}
                            reserveSelection={reserveSelection}
                            destination={destination}
                            slug={slug}
                        />
                    </div>
                </div>
                </PickupLabelProvider>
            </div>
        </div>
    );
}
