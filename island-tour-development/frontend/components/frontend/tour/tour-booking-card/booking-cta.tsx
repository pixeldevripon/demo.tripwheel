'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { useBookingCta } from '@/hooks/tours/use-booking-cta';
import { springPop, swapFade } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { Collapse } from './collapse';

/**
 * The primary action block: an optional over-capacity note, the CTA ("Continue"
 * once a selection is ready - the actual reserve + pay happens on the checkout
 * page this navigates to), and the trust lines. The free-cancellation line
 * always shows; the payment line only where the tour really takes a deposit
 * online, so paid-in-full and operator-settled tours are left with the single
 * cancellation line (LD5 / conflict log 81). A tour whose payment model is not
 * bookable in v1 (operator_full) shows a disabled state instead.
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
        setPolicyModal,
        ctaError,
    } = useBooking();
    // Shared with the mobile sticky bar, which stands in for this button once
    // the card scrolls away - see `use-booking-cta.ts`.
    const { navigating, onCta } = useBookingCta();

    // A payment-free reserve (operator_full) is not offered in v1: the card
    // shows a disabled notice in place of the CTA and trust lines.
    if (bookingBlocked) {
        return (
            <div className='flex w-full items-center justify-center rounded-it-sm bg-it-bg px-8 py-3.5 text-center text-[14px] font-semibold leading-[1.6] text-it-ink-muted'>
                {dict.bookingUnavailable}
            </div>
        );
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
                    // `.wcta` (mck-15): full width, 10px radius, 14px of
                    // padding, 16.5px bold.
                    className={`flex w-full items-center justify-center rounded-it-sm border-none bg-it-primary px-8 py-3.5 text-[16.5px] font-bold leading-[1.6] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover ${
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
            {/* `.wtrust`: two lines, 7px apart, each with a 15px green check. */}
            <div className='flex flex-col gap-[7px]'>
                {/* Free cancellation (always). */}
                <TrustRow>
                    {cancelBefore}
                    <TrustLink
                        onClick={() => setPolicyModal('cancellation')}
                        hint={dict.policyLinkHint}>
                        {cancelLink}
                    </TrustLink>
                    {cancelAfter}
                </TrustRow>

                {/* Payment line - present only on a tour that really takes a
                    deposit online. Everything else (paid in full, settled with
                    the operator, an unrecognised model) leaves the strip as the
                    single cancellation line. */}
                {paymentTrust && (
                    <TrustRow>
                        {paymentTrust.before}
                        <TrustLink
                            onClick={() => setPolicyModal('deposit')}
                            hint={dict.policyLinkHint}>
                            {paymentTrust.link}
                        </TrustLink>
                        {paymentTrust.after}
                    </TrustRow>
                )}
            </div>
        </div>
    );
}

/**
 * A trust line: the check icon + its (partly clickable) copy.
 *
 * The sentence is `font-normal` so the clickable phrase inside it can be a
 * weight heavier and actually look like something. Both were `font-semibold`,
 * which left the underline doing the whole job of saying "this opens something"
 * - and that underline was `decoration-it-border` (#e5e7eb) on white, at 13px.
 * The client read the lines as static text (Pastel #42).
 */
function TrustRow({ children }: { children: React.ReactNode }) {
    return (
        <span className='flex items-center gap-2 text-[16px] leading-[1.6] text-it-ink tracking-[-0.012em]'>
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

/**
 * The clickable phrase inside a trust line - opens a policy modal.
 *
 * Carries three separate signals, because any one of them fails somebody:
 * weight (a step above the sentence around it), a underline dark enough to see,
 * and colour on hover. Colour alone is not a signal - it is invisible to a
 * red-green colour-blind reader, which is why the weight and the underline both
 * stay in place rather than one replacing the other.
 *
 * `hint` is appended to the accessible name so a screen reader hears "Free
 * cancellation, view policy" instead of a bare fragment that sounds like a
 * statement. It is appended AFTER the visible text, never instead of it: voice
 * control matches on what a user can read on screen.
 */
function TrustLink({
    onClick,
    hint,
    children,
}: {
    onClick: () => void;
    /** Localized "view policy" - what this button opens. */
    hint: string;
    children: string;
}) {
    return (
        <motion.button
            type='button'
            onClick={onClick}
            aria-haspopup='dialog'
            aria-label={`${children}, ${hint}`}
            whileTap={{ scale: 0.98 }}
            transition={springPop}
            className='cursor-pointer rounded-[2px] border-none bg-transparent p-0 text-left text-[13px] font-medium leading-[1.6] text-it-ink underline decoration-it-ink-muted underline-offset-[3px] transition-colors duration-300 hover:text-it-primary hover:decoration-it-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
            {children}
        </motion.button>
    );
}
