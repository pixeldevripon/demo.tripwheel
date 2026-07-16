import { MotionA, MotionSpan } from '@/components/frontend/motion-primitives';
import { MountReveal } from '@/components/frontend/mount-reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import { buildCalendarUrl, type ThankYouBooking } from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import { BookingRefChip, ResendEmailLine } from './thank-you-hero-actions';

type ThankYouDict = Dictionary['thankYou'];

/**
 * TYP hero (Figma 47744-9185): green check, "You're booked" headline, booking
 * ref chip with copy-to-clipboard, add-to-calendar CTA and the confirmation
 * email note with a resend action. Server shell (streams inside the page
 * Suspense boundary, revealing on mount); the ref chip and resend line are the
 * client leaves in `thank-you-hero-actions`.
 */
export function ThankYouHero({
    booking,
    dict,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
}) {
    return (
        <section className='bg-it-white pt-12 pb-16 md:pt-[85px] md:pb-[116px]'>
            <div className='it-container flex flex-col items-center gap-14'>
                <MountReveal className='flex w-full flex-col items-center gap-8'>
                    <div className='flex flex-col items-center gap-8'>
                        <MotionSpan
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ ...springPop, delay: 0.15 }}
                            className='inline-flex shrink-0'>
                            <Image
                                src='/icons/thank-you/success-check.svg'
                                alt=''
                                width={56}
                                height={56}
                                className='size-14'
                            />
                        </MotionSpan>
                        <div className='flex flex-col items-center gap-1'>
                            <h1 className='m-0 text-center font-medium text-[32px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                {dict.title.replace('{name}', booking.guestFirstName)}
                            </h1>
                            <p className='m-0 text-center text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                                {dict.subtitle
                                    .replace('{tour}', booking.tourTitle)
                                    .replace('{date}', booking.dateLabel)
                                    .replace('{time}', booking.startTimeLabel)}
                            </p>
                        </div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.bookingRef}
                        </span>
                        <BookingRefChip
                            displayRef={booking.displayRef}
                            ariaLabel={`${dict.bookingRef} ${booking.displayRef}`}
                        />
                    </div>
                </MountReveal>
                <MountReveal delay={0.15} className='flex flex-col items-center gap-8'>
                    <MotionA
                        href={buildCalendarUrl(booking)}
                        target='_blank'
                        rel='noopener noreferrer'
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className='flex items-center gap-2.5 rounded-full bg-it-primary px-10 py-[15px] transition-colors hover:bg-it-primary-hover'>
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
                    <div className='flex flex-col items-center text-center text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                        <p className='m-0'>
                            {dict.emailSentTo.replace('{email}', booking.guestEmail)}
                        </p>
                        <ResendEmailLine
                            publicRef={booking.publicRef}
                            helpPrefix={dict.emailHelpPrefix}
                            resendLabel={dict.resendEmail}
                            resentLabel={dict.emailResent}
                            sendingLabel={dict.emailResending}
                            failedLabel={dict.emailResendFailed}
                        />
                    </div>
                </MountReveal>
            </div>
        </section>
    );
}
