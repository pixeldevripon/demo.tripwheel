'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { springPop, swapFade } from '@/lib/motion';
import { useBooking } from '@/hooks/tours/use-booking';
import { buildCheckoutQuery, toDateParam } from '@/lib/checkout/checkout';
import { leaveTo } from '@/lib/checkout/leave-to';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Collapse } from './collapse';

/**
 * The primary action block: an optional over-capacity note, the CTA ("Continue"
 * once a selection is ready - the actual reserve + pay happens on the checkout
 * page this navigates to), and the trust lines. The free-cancellation line
 * always shows; the payment line is model-specific (deposit link / "Pay in full
 * now" / none). A tour whose payment model is not bookable in v1 (operator_full)
 * shows a disabled state instead.
 */
export function BookingCta() {
    const {
        dict,
        ready,
        editingParty,
        atCapacity,
        capacityReason,
        effectiveMax,
        fillPolicy,
        bookingBlocked,
        paymentTrust,
        handleCtaClick,
        setPolicyModal,
        locale,
        destinationSlug,
        tourSlug,
        selectedDate,
        selectedTime,
        counts,
        addOnQty,
        selectedDepartureId,
        quote,
        currency,
        ctaError,
    } = useBooking();
    // Continue -> checkout is a full document navigation that can take a beat
    // (the route is dynamic). This drives a spinner in the button instead of a
    // frozen click. Plain state, not `useTransition`: the navigation leaves the
    // React tree entirely, so a transition would never report as pending - the
    // button would just sit there looking dead until the new page painted. The
    // latch is deliberately never cleared; the page is on its way out.
    const [navigating, setNavigating] = useState(false);

    const checkoutBase =
        destinationSlug && tourSlug
            ? localizeHref(
                  locale as Locale,
                  `/${destinationSlug}/${tourSlug}/checkout`
              )
            : null;
    // NOT prefetched: the checkout route is not prerendered for this tour, so a
    // router prefetch is answered with the HTML document and warms nothing (see
    // `lib/checkout/leave-to.ts`). It only cost a wasted request.

    // A payment-free reserve (operator_full) is not offered in v1: the card
    // shows a disabled notice in place of the CTA and trust lines.
    if (bookingBlocked) {
        return (
            <div className='flex w-full items-center justify-center rounded-it-sm bg-it-bg px-8 py-3.5 text-center text-[14px] font-semibold leading-[1.6] text-it-ink-muted'>
                {dict.bookingUnavailable}
            </div>
        );
    }

    // Once ready, the CTA carries the selection (date / time / party) into the
    // checkout page via the query string. Without a destination/tour slug
    // (design/demo usage) it falls back to the in-card availability flow.
    function onCta() {
        if (ready && checkoutBase) {
            if (navigating) return;
            const query = buildCheckoutQuery({
                date: selectedDate ? toDateParam(selectedDate) : null,
                time: selectedTime,
                counts,
                addOns: addOnQty,
                departureId: selectedDepartureId,
                quoteId: quote?.quoteId ?? null,
                currency: currency ?? null,
            });
            // Document navigation, for the same reason the hops OUT of checkout
            // use it: the checkout route is per-tour and only one tour per
            // destination is prerendered, so the client router's flight request
            // is answered with the HTML document, discarded, and turned into a
            // browser navigation anyway - just several hundred ms later, after
            // a wasted ~180 KB fetch. See `lib/checkout/leave-to.ts`.
            setNavigating(true);
            leaveTo(query ? `${checkoutBase}?${query}` : checkoutBase);
            return;
        }
        handleCtaClick();
    }

    // Free cancellation is offered on every model; its clickable phrase opens the
    // cancellation modal.
    const cancelTemplate = fillPolicy(dict.freeCancellation);
    const [cancelBefore, cancelAfter] = cancelTemplate.split('{link}');
    const cancelLink = fillPolicy(dict.freeCancellationLink);

    return (
        <div className='flex flex-col gap-3.5'>
            {/* While choosing the party, if the plus button is capped, say why
                (master §3.3.1): genuine slot scarcity vs the per-booking max. */}
            {editingParty && atCapacity && (
                <span className='text-center text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                    {(capacityReason === 'slot'
                        ? dict.capacityNote
                        : dict.maxPerBooking
                    ).replace('{count}', String(effectiveMax))}
                </span>
            )}
            <div>
                {/* What's missing (date / departure time) after a blocked CTA
                    click - the button must never swallow a click silently. The
                    note's gap lives INSIDE the collapse (pb) so it animates
                    with the height tween. */}
                <Collapse open={ctaError != null}>
                    <p
                        role='alert'
                        className='m-0 pb-3 text-center text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                        {ctaError === 'date'
                            ? dict.errorSelectDate
                            : dict.errorSelectSlot}
                    </p>
                </Collapse>
                <motion.button
                    type='button'
                    onClick={onCta}
                    disabled={navigating}
                    aria-busy={navigating || undefined}
                    whileTap={navigating ? undefined : { scale: 0.98 }}
                    transition={springPop}
                    className={`flex w-full items-center justify-center rounded-it-sm border-none bg-it-primary px-8 py-3.5 text-[16.5px] font-bold leading-[1.5] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover ${
                        navigating
                            ? 'cursor-default opacity-80'
                            : 'cursor-pointer'
                    }`}>
                    <AnimatePresence mode='wait' initial={false}>
                        <motion.span
                            key={
                                navigating
                                    ? 'navigating'
                                    : ready
                                      ? 'continue'
                                      : 'check'
                            }
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={swapFade}
                            className='inline-flex items-center justify-center gap-2'>
                            {navigating && (
                                <span
                                    aria-hidden
                                    className='inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent'
                                />
                            )}
                            {ready ? dict.continue : dict.checkAvailability}
                        </motion.span>
                    </AnimatePresence>
                </motion.button>
            </div>
            <div className='flex flex-col gap-[7px]'>
                {/* Free cancellation (always). */}
                <TrustRow>
                    {cancelBefore}
                    <TrustLink onClick={() => setPolicyModal('cancellation')}>
                        {cancelLink}
                    </TrustLink>
                    {cancelAfter}
                </TrustRow>

                {/* Payment line (model-specific). */}
                {paymentTrust?.kind === 'modal' && (
                    <TrustRow>
                        {paymentTrust.before}
                        <TrustLink onClick={() => setPolicyModal('deposit')}>
                            {paymentTrust.link}
                        </TrustLink>
                        {paymentTrust.after}
                    </TrustRow>
                )}
                {paymentTrust?.kind === 'plain' && (
                    <TrustRow>{paymentTrust.text}</TrustRow>
                )}
            </div>
        </div>
    );
}

/** A trust line: the check icon + its (partly clickable) copy. */
function TrustRow({ children }: { children: React.ReactNode }) {
    return (
        <span className='flex items-center gap-2 text-[13px] font-semibold leading-[1.6] text-it-ink'>
            <Image
                src='/icons/trust-check-green.svg'
                alt=''
                width={20}
                height={20}
                className='size-[15px] shrink-0'
            />
            <span>{children}</span>
        </span>
    );
}

/** The underlined, clickable phrase inside a trust line (opens a policy modal). */
function TrustLink({
    onClick,
    children,
}: {
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <motion.button
            type='button'
            onClick={onClick}
            whileTap={{ scale: 0.98 }}
            transition={springPop}
            className='cursor-pointer border-none bg-transparent p-0 text-left text-[13px] font-semibold leading-[1.6] text-it-ink underline decoration-it-border underline-offset-[3px] transition-colors duration-300 hover:text-it-primary'>
            {children}
        </motion.button>
    );
}
