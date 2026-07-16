'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { springPop, swapFade } from '@/lib/motion';
import { useBooking } from '@/hooks/tours/use-booking';
import { buildCheckoutQuery, toDateParam } from '@/lib/checkout/checkout';
import { localizeHref, type Locale } from '@/lib/constants/locales';

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
        selectedDepartureId,
        quote,
        currency,
    } = useBooking();
    const router = useRouter();

    // A payment-free reserve (operator_full) is not offered in v1: the card
    // shows a disabled notice in place of the CTA and trust lines.
    if (bookingBlocked) {
        return (
            <div className='flex w-full items-center justify-center rounded-it-full bg-it-border px-10 py-[19px] text-center font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink-muted'>
                {dict.bookingUnavailable}
            </div>
        );
    }

    // Once ready, the CTA carries the selection (date / time / party) into the
    // checkout page via the query string. Without a destination/tour slug
    // (design/demo usage) it falls back to the in-card availability flow.
    function onCta() {
        if (ready && destinationSlug && tourSlug) {
            const query = buildCheckoutQuery({
                date: selectedDate ? toDateParam(selectedDate) : null,
                time: selectedTime,
                counts,
                departureId: selectedDepartureId,
                quoteId: quote?.quoteId ?? null,
                currency: currency ?? null,
            });
            const base = localizeHref(
                locale as Locale,
                `/${destinationSlug}/${tourSlug}/checkout`
            );
            router.push(query ? `${base}?${query}` : base);
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
        <div className='flex flex-col gap-5'>
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
            <motion.button
                type='button'
                onClick={onCta}
                whileTap={{ scale: 0.98 }}
                transition={springPop}
                className='flex w-full cursor-pointer items-center justify-center rounded-it-full border-none bg-it-primary px-10 py-[19px] font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white transition-colors hover:bg-it-primary-hover'>
                <AnimatePresence mode='wait' initial={false}>
                    <motion.span
                        key={ready ? 'continue' : 'check'}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={swapFade}>
                        {ready ? dict.continue : dict.checkAvailability}
                    </motion.span>
                </AnimatePresence>
            </motion.button>
            <div className='flex flex-col gap-2'>
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
        <span className='flex items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
            <Image
                src='/icons/booking-check.svg'
                alt=''
                width={20}
                height={20}
                className='size-5 shrink-0'
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
            className='cursor-pointer border-none bg-transparent p-0 text-left text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline underline-offset-2 transition-colors duration-300 hover:text-it-primary'>
            {children}
        </motion.button>
    );
}
