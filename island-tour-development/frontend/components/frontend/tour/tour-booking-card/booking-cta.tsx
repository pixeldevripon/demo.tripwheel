'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { springPop, swapFade } from '@/lib/motion';
import { useBooking } from '@/hooks/tours/use-booking';
import { buildCheckoutQuery, toDateParam } from '@/lib/checkout/checkout';
import { localizeHref, type Locale } from '@/lib/constants/locales';

/**
 * The primary action block: an optional over-capacity note, the CTA (label flips
 * from "Check Availability" to "Continue" once ready), and the two trust lines.
 * Each trust line carries a `{link}` marker where its clickable/underlined phrase
 * belongs; only that phrase opens the matching policy modal.
 */
export function BookingCta() {
    const {
        dict,
        ready,
        overCapacity,
        effectiveMax,
        fillPolicy,
        handleCtaClick,
        setPolicyModal,
        locale,
        destinationSlug,
        tourSlug,
        selectedDate,
        selectedTime,
        counts,
    } = useBooking();
    const router = useRouter();

    // Once the availability check passes, the CTA becomes "Continue" and carries
    // the selection (date / time / party) into the checkout page via the query
    // string. Without a destination/tour slug (design/demo usage) it falls back
    // to the in-card availability flow.
    function onCta() {
        if (ready && destinationSlug && tourSlug) {
            const query = buildCheckoutQuery({
                date: selectedDate ? toDateParam(selectedDate) : null,
                time: selectedTime,
                counts,
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

    const trustLines = [
        {
            modal: 'cancellation' as const,
            template: fillPolicy(dict.freeCancellation),
            link: fillPolicy(dict.freeCancellationLink),
        },
        {
            modal: 'deposit' as const,
            template: fillPolicy(dict.payLater),
            link: fillPolicy(dict.payLaterLink),
        },
    ];

    return (
        <div className='flex flex-col gap-5'>
            {overCapacity && (
                <span className='text-center text-[14px] leading-[1.5] tracking-[-0.012em] text-it-primary'>
                    {dict.capacityNote.replace('{count}', String(effectiveMax))}
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
                {trustLines.map(line => {
                    const [before, after] = line.template.split('{link}');
                    return (
                        <span
                            key={line.modal}
                            className='flex items-center gap-2 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            <Image
                                src='/icons/booking-check.svg'
                                alt=''
                                width={20}
                                height={20}
                                className='size-5 shrink-0'
                            />
                            <span>
                                {before}
                                <motion.button
                                    type='button'
                                    onClick={() => setPolicyModal(line.modal)}
                                    whileTap={{ scale: 0.98 }}
                                    transition={springPop}
                                    className='cursor-pointer border-none bg-transparent p-0 text-left text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline underline-offset-2 transition-colors duration-300 hover:text-it-primary'>
                                    {line.link}
                                </motion.button>
                                {after}
                            </span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
}
