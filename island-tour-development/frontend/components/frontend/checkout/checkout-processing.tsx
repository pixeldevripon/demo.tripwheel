'use client';

import { getThankYouStatus } from '@/lib/api/bookings';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Poll cadence + ceiling: ~2s x 24 ≈ 48s before we fall back to the manual link. */
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 24;

export interface ProcessingDict {
    title: string;
    subtitle: string;
    stillWorking: string;
    viewBooking: string;
}

/**
 * The /payment/processing hop (BOOKING-FLOW-DESIGN-GUIDE §21.6). After the Stripe
 * charge, the booking is confirmed asynchronously by the payment webhook
 * (`confirmFromPayment`). This screen polls `GET /bookings/typ/:publicRef` until
 * the booking reads `CONFIRMED`, then replaces the history entry with the TYP so
 * Back doesn't return to checkout. If confirmation is slow (webhook lag) it falls
 * back to a manual "View my booking" link - the TYP handles a not-yet-confirmed
 * booking too.
 *
 * `typHref` is the locale-less TYP path (`/{destination}/thank-you/{publicRef}`),
 * served via the proxy rewrite.
 */
export function CheckoutProcessing({
    publicRef,
    typHref,
    dict,
}: {
    publicRef: string;
    typHref: string;
    dict: ProcessingDict;
}) {
    const router = useRouter();
    const [stalled, setStalled] = useState(false);

    useEffect(() => {
        let active = true;
        let attempts = 0;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const poll = async () => {
            attempts += 1;
            try {
                const booking = await getThankYouStatus(publicRef);
                if (!active) return;
                if (booking.status === 'CONFIRMED') {
                    router.replace(typHref);
                    return;
                }
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

        poll();
        return () => {
            active = false;
            if (timer) clearTimeout(timer);
        };
    }, [publicRef, typHref, router]);

    return (
        <div className='flex min-h-[60vh] items-center justify-center px-4'>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
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
