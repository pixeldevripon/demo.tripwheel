import { MotionA } from '@/components/frontend/motion-primitives';
import { MountReveal } from '@/components/frontend/mount-reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { buildCalendarUrl, type ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import { BookingRefChip, ResendEmailLine } from './thank-you-hero-actions';

type ThankYouDict = Dictionary['thankYou'];

/**
 * Booking-management header - the RETURNING traveller's view (reached via the
 * /bookings pair login), deliberately calmer than the one-time celebratory
 * `ThankYouHero`. No "You're booked!" moment: this is the "manage my booking"
 * surface, so it leads with a status chip + ref and the management actions
 * (add to calendar, cancel, resend), and the page drops the upsell sections.
 *
 * `cancelHref` is the locale-less /cancel/{publicRef} path (proxy rewrite); the
 * cancel page itself re-checks the verified session before doing anything.
 */
export function BookingManageHeader({
    booking,
    cancelHref,
    dict,
}: {
    booking: ThankYouBooking;
    cancelHref: string;
    dict: ThankYouDict;
}) {
    const canCancel = booking.status === 'CONFIRMED';

    return (
        <section className='bg-it-white pt-12 pb-12 md:pt-[64px] md:pb-[72px]'>
            <div className='it-container flex flex-col gap-8'>
                <MountReveal className='flex flex-col gap-4'>
                    <span className='inline-flex w-fit items-center gap-2 rounded-full bg-it-green/8 px-3 py-1'>
                        <span className='size-1.5 shrink-0 rounded-full bg-it-green' />
                        <span className='text-[13px] font-medium leading-[1.2] tracking-[-0.012em] text-it-green'>
                            {dict.statusConfirmed}
                        </span>
                    </span>
                    <div className='flex flex-col gap-1'>
                        <h1 className='m-0 font-medium text-[32px] md:text-[44px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.manageTitle}
                        </h1>
                        <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                            {dict.manageSubtitle
                                .replace('{tour}', booking.tourTitle)
                                .replace('{date}', booking.dateLabel)
                                .replace('{time}', booking.startTimeLabel)}
                        </p>
                    </div>
                    <div className='mt-1 flex items-center gap-2'>
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.bookingRef}
                        </span>
                        <BookingRefChip
                            displayRef={booking.displayRef}
                            ariaLabel={`${dict.bookingRef} ${booking.displayRef}`}
                        />
                    </div>
                </MountReveal>

                <MountReveal
                    delay={0.1}
                    className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                    <MotionA
                        href={buildCalendarUrl(booking)}
                        target='_blank'
                        rel='noopener noreferrer'
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className='flex items-center justify-center gap-2.5 rounded-full bg-it-primary px-8 py-[13px] transition-colors hover:bg-it-primary-hover'>
                        <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                            {dict.addToCalendar}
                        </span>
                        <Image
                            src='/icons/thank-you/arrow-down-white.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-4'
                        />
                    </MotionA>
                    {canCancel && (
                        <MotionA
                            href={cancelHref}
                            whileTap={{ scale: 0.98 }}
                            transition={springPop}
                            className='flex items-center justify-center gap-2.5 rounded-full border-[1.5px] border-it-heading/15 px-8 py-[11.5px] transition-colors hover:border-it-heading/35'>
                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {dict.cancelBooking}
                            </span>
                        </MotionA>
                    )}
                </MountReveal>

                <MountReveal
                    delay={0.15}
                    className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                    <ResendEmailLine
                        publicRef={booking.publicRef}
                        helpPrefix={dict.emailHelpPrefix}
                        resendLabel={dict.resendEmail}
                        resentLabel={dict.emailResent}
                        sendingLabel={dict.emailResending}
                        failedLabel={dict.emailResendFailed}
                    />
                </MountReveal>
            </div>
        </section>
    );
}
