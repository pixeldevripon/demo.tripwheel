'use client';

import {
    quoteBooking,
    type BookingAddOnSelection,
} from '@/lib/api/bookings';
import {
    formatCheckoutMoney,
    type BookingSelectionPayload,
    type CheckoutTotals,
} from '@/lib/checkout/checkout';
import type { Currency, Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { CheckoutForm, type CheckoutPickupOption } from './checkout-form';
import {
    CheckoutLiveProvider,
    type CheckoutLiveTotals,
} from './checkout-pickup-label';
import { CheckoutSteps, type CheckoutPhase } from './checkout-steps';

type CheckoutDict = Dictionary['checkout'];

interface CheckoutClientProps {
    dict: CheckoutDict;
    locale: Locale;
    /** Tour detail URL - the "Back to tour" bar and summary edit target. */
    tourHref: string;
    pickupOptions: CheckoutPickupOption[];
    pickupFromLabel: string | null;
    /** Pickup is mandatory at reserve (master E.3): no "No pickup" option. */
    pickupRequired: boolean;
    /** Client-derived totals for the URL selection (initial summary figures). */
    totals: CheckoutTotals;
    /** Composed free-cancellation line shown under the pay CTA (page owns hours). */
    freeCancelLabel: string;
    /** Server-rendered booking summary (right rail). */
    summary: ReactNode;

    /** Operator-conditions gate (Pastel #80) - null for the ungated catalog. */
    operatorTerms: {
        kind: 'DOCUMENT' | 'ACKNOWLEDGMENT';
        items: string[];
    } | null;
    operatorName: string | null;

    // ── Live booking inputs (widget selection, carried in the URL) ──
    tourId: string;
    departureId: string | null;
    currency: Currency;
    quoteId: string | null;
    reserveSelection: BookingSelectionPayload | null;
    /** Optional extras chosen in the widget (carried in the URL). */
    addOns: BookingAddOnSelection[];
    destination: string;
    slug: string;
    /** Traveller bounced back after a FAILED charge (?payment=failed). */
    paymentFailed?: boolean;
}

const backBarLabel =
    'flex w-fit cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13.5px] font-medium leading-[1.6] text-it-heading no-underline hover:underline';

const backCaret = (
    <Image
        src='/icons/breadcrumb/arrow-right.svg'
        alt=''
        width={20}
        height={20}
        className='size-[15px] shrink-0 rotate-180'
    />
);

/**
 * Owns the checkout phase and lays out the three full-width bands of the Figma
 * pages (49225:8357 / 49225:8358): the phase-aware back bar ("Back to tour" on
 * Contact, "Back to contact" on Payment), the 116px step-indicator band, and
 * the form + summary grid - both columns starting at the same top. The summary
 * is passed in as a server-rendered node.
 *
 * It also owns the LIVE pickup selection: choosing a pickup zone re-quotes the
 * booking (`POST /bookings/quote` with `pickupLocationId`), so a priced
 * PAID_ADDON zone updates the summary's Total / Pay today / Balance later and
 * the amount on the payment CTA (master 5.8 - the reserve recomputes the same
 * math server-side and stays authoritative).
 */
export function CheckoutClient({
    dict,
    locale,
    tourHref,
    pickupOptions,
    pickupFromLabel,
    pickupRequired,
    totals,
    freeCancelLabel,
    summary,
    operatorTerms,
    operatorName,
    tourId,
    departureId,
    currency,
    quoteId,
    reserveSelection,
    addOns,
    destination,
    slug,
    paymentFailed = false,
}: CheckoutClientProps) {
    const [phase, setPhase] = useState<CheckoutPhase>('contact');
    // Selected pickup, published by the form: the label feeds the summary's
    // pickup row; the id drives the re-quote below.
    const [pickup, setPickup] = useState<{
        id: string | null;
        label: string | null;
    }>({ id: null, label: null });
    // Authoritative totals after a pickup re-quote; null = server totals hold.
    const [liveTotals, setLiveTotals] = useState<CheckoutLiveTotals | null>(
        null
    );

    // Re-quote when a real pickup zone is chosen (guide: quote on pickup
    // change). "No pickup" / "other" clear back to the server totals - they
    // never charge. Fails soft: on error the previous totals stand and the
    // reserve (which recomputes everything) remains the source of truth.
    useEffect(() => {
        if (!pickup.id || !departureId || !reserveSelection) {
            setLiveTotals(null);
            return;
        }
        const controller = new AbortController();
        quoteBooking(
            {
                tourId,
                departureId,
                ...reserveSelection,
                ...(addOns.length > 0 ? { addOns } : {}),
                currency,
                pickupLocationId: pickup.id,
            },
            controller.signal
        )
            .then(q =>
                setLiveTotals({
                    total: Number(q.totalRetail),
                    payToday: Number(q.depositAmount),
                    balanceLater: Number(q.balanceAmount),
                    // Same "label x qty x unit" row shape the widget breakdown
                    // uses, so the summary reads identically to the card.
                    lines: q.lines.map((l, i) => ({
                        id: `${l.kind}-${l.ageBandId ?? i}`,
                        label: `${l.label} x ${l.quantity} x ${formatCheckoutMoney(
                            Number(l.unitPrice),
                            currency,
                            locale
                        )}`,
                        amount: Number(l.lineTotal),
                    })),
                })
            )
            .catch(() => {
                /* keep the previous totals; reserve stays authoritative */
            });
        return () => controller.abort();
        // reserveSelection/addOns come from the URL - stable for the page life.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickup.id, departureId, tourId, currency]);

    const payToday = liveTotals?.payToday ?? totals.payToday;
    const hasPayment = payToday > 0;

    return (
        // Design v2 MCK-09: ONE container for the whole surface - the back
        // row, the step indicator and the form column all share the same left
        // edge (the steps live INSIDE the form column, above the accordion).
        <div className='it-container'>
            {/* Back row - "Back to tour" on Contact, "Back to contact" on
                Payment (step-aware, master 5.8). */}
            <div className='pt-3.5'>
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

            {/* Form (left, with the steps above the accordion) + sticky 340px
                summary (right). Mobile: one column, summary sheet first. */}
            <CheckoutLiveProvider
                value={{ pickupLabel: pickup.label, totals: liveTotals }}>
                <div className='grid items-start gap-4 pt-5 pb-14 lg:grid-cols-[1fr_340px] lg:gap-7'>
                    <div className='min-w-0'>
                        <div className='mb-[18px]'>
                            <CheckoutSteps
                                phase={phase}
                                contactLabel={dict.contact}
                                paymentLabel={dict.payment}
                                onGoToContact={() => setPhase('contact')}
                                paymentStep={hasPayment}
                            />
                        </div>
                        <CheckoutForm
                            dict={dict}
                            locale={locale}
                            phase={phase}
                            onPhaseChange={setPhase}
                            onPickupChange={setPickup}
                            pickupOptions={pickupOptions}
                            pickupFromLabel={pickupFromLabel}
                            pickupRequired={pickupRequired}
                            payToday={payToday}
                            freeCancelLabel={freeCancelLabel}
                            operatorTerms={operatorTerms}
                            operatorName={operatorName}
                            tourId={tourId}
                            departureId={departureId}
                            currency={currency}
                            quoteId={quoteId}
                            reserveSelection={reserveSelection}
                            addOns={addOns}
                            destination={destination}
                            slug={slug}
                            paymentFailed={paymentFailed}
                        />
                    </div>
                    <div className='max-lg:order-first lg:sticky lg:top-20'>
                        {summary}
                    </div>
                </div>
            </CheckoutLiveProvider>
        </div>
    );
}
