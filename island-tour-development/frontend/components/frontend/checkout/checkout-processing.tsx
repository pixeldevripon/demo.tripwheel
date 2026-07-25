'use client';

import { getThankYouStatus, settleBooking } from '@/lib/api/bookings';
import { markJustBooked } from '@/lib/traveler-booking';
import { crossFade } from '@/lib/motion';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Poll cadence + ceiling. The synchronous settle below normally confirms on the
 * FIRST tick, so this is only the backstop for the redirect-return methods
 * (iDEAL/PayPal) whose intent settles a moment after the browser lands.
 * ~1s x 20 ≈ 20s before the manual link appears.
 */
const POLL_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 20;

export interface ProcessingDict {
    title: string;
    subtitle: string;
    stillWorking: string;
    viewBooking: string;
}

/**
 * The /payment/processing hop (BOOKING-FLOW-DESIGN-GUIDE §21.6). After the Stripe
 * charge, the booking is confirmed and redirected to the TYP.
 *
 * Fast path: `POST /payments/typ/:publicRef/settle` confirms the booking
 * synchronously (the backend re-verifies the PaymentIntent with Stripe), so the
 * redirect fires in ~1s instead of waiting for the async webhook. Polling
 * `GET /bookings/typ/:publicRef` is the backstop (redirect-return methods, or a
 * settle hiccup). Either way we `router.replace` to the TYP so Back doesn't
 * return to checkout. The "View my booking" link only appears if BOTH stall for
 * ~20s - it is never shown during normal loading.
 *
 * `typHref` is the locale-less TYP path (`/{destination}/thank-you/{publicRef}`),
 * served via the proxy rewrite.
 */
export function CheckoutProcessing({
    publicRef,
    tourId,
    typHref,
    checkoutHref,
    dict,
}: {
    publicRef: string;
    /** Booked tour id - used to clear its saved widget selection on confirm. */
    tourId?: string | null;
    typHref: string;
    /** Bare checkout path - the FAILED-payment landing (selection restores from
     *  the per-tour saved URL when available). */
    checkoutHref: string;
    dict: ProcessingDict;
}) {
    const router = useRouter();
    const [stalled, setStalled] = useState(false);
    // Set the instant we hand off to the TYP, so the poller block fades out
    // while Next fetches that route instead of vanishing on a hard cut. The
    // summary shimmer beneath is NOT part of this block - it stays on screen
    // and the TYP re-renders the same band, which is what makes the handoff
    // read as one continuous page rather than two.
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        let active = true;
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const goToTyp = () => {
            if (!active) return;
            // Mark the ONE-TIME "just booked" moment so the TYP shows the
            // celebratory hero now, but the calmer management view on any later
            // /bookings visit. ~15 min, publicRef-scoped, cleared naturally (or
            // eagerly retired when the traveller logs in via /bookings).
            markJustBooked(publicRef);
            // The trip is booked: drop this tour's saved widget selection so a
            // later visit starts fresh instead of restoring the booked party.
            if (tourId) {
                try {
                    window.sessionStorage.removeItem(
                        `it-booking-selection:${tourId}`
                    );
                } catch {
                    // Storage unavailable: nothing to clear.
                }
            }
            // Navigation is issued in the same tick, so the fade costs no
            // latency - it just plays over the RSC fetch that was happening
            // anyway. Never `await` an animation before replacing.
            setLeaving(true);
            router.replace(typHref);
        };

        // FAILED payment → back to the checkout to retry, with a message - a
        // traveller must never sit on an infinite spinner for money that never
        // moved. The full checkout URL (selection query intact) was saved per
        // tour when the checkout mounted; the bare path is the fallback.
        const goToCheckoutFailed = () => {
            if (!active) return;
            let target = `${checkoutHref}?payment=failed`;
            if (tourId) {
                try {
                    const saved = window.sessionStorage.getItem(
                        `it-checkout-return:${tourId}`
                    );
                    if (saved) {
                        const url = new URL(saved, window.location.origin);
                        url.searchParams.set('payment', 'failed');
                        target = url.pathname + url.search;
                    }
                } catch {
                    // Storage unavailable: the bare checkout path still works.
                }
            }
            setLeaving(true);
            router.replace(target);
        };

        // Stripe appends redirect_status to the return_url of its redirect
        // methods (iDEAL/PayPal) - a failed/expired hop is known BEFORE any
        // backend call. Mollie sends no such param; settle detects it below.
        const redirectStatus = new URLSearchParams(
            window.location.search
        ).get('redirect_status');
        if (redirectStatus === 'failed') {
            goToCheckoutFailed();
            return () => {
                active = false;
            };
        }

        // Fast path: confirm synchronously, then redirect the moment it reads
        // CONFIRMED - no webhook wait. Falls through to polling on anything else.
        const settleThenPoll = async () => {
            try {
                const settled = await settleBooking(publicRef);
                if (!active) return;
                if (settled.status === 'CONFIRMED') return goToTyp();
                if (settled.paymentFailed) return goToCheckoutFailed();
            } catch {
                // Settle unavailable (throttle/transient): the poll backstop covers it.
            }
            if (active) void poll();
        };

        const poll = async () => {
            attempts += 1;
            try {
                const booking = await getThankYouStatus(publicRef);
                if (!active) return;
                if (booking.status === 'CONFIRMED') return goToTyp();
            } catch {
                // Transient (booking not visible yet / throttle): keep polling.
            }
            if (!active) return;
            if (attempts >= MAX_ATTEMPTS) {
                setStalled(true);
                return;
            }
            timer = setTimeout(poll, POLL_INTERVAL_MS);
        };

        void settleThenPoll();
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [publicRef, tourId, typHref, checkoutHref, router]);

    return (
        // No longer 60vh: the page is not empty any more - the booking-summary
        // shimmer sits below, and a viewport-tall spacer would push it off screen.
        <div className='flex min-h-[136px] items-center justify-center px-4'>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={leaving ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
                transition={
                    leaving ? crossFade : { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
                }
                className='flex max-w-md flex-col items-center gap-6 text-center'>
                <span className='size-12 shrink-0 animate-spin rounded-full border-4 border-it-border border-t-it-primary' />
                <div className='flex flex-col gap-2'>
                    <h1 className='font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.title}
                    </h1>
                    <p className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/60'>
                        {stalled ? dict.stillWorking : dict.subtitle}
                    </p>
                </div>
                {stalled && (
                    <Link
                        href={typHref}
                        className='rounded-it-full bg-it-heading px-8 py-3.5 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white no-underline transition-opacity hover:opacity-90'>
                        {dict.viewBooking}
                    </Link>
                )}
            </motion.div>
        </div>
    );
}
