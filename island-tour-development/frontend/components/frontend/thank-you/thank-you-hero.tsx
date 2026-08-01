import { MotionSpan } from '@/components/frontend/motion-primitives';
import { MountReveal } from '@/components/frontend/mount-reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import {
    buildCalendarUrl,
    buildIcsUrl,
    buildOutlookCalendarUrl,
    type ThankYouBooking,
} from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import { Fragment } from 'react';
import { renderTemplate } from './render-template';
import {
    AddToCalendar,
    BookingRefCopy,
    ResendEmailLine,
} from './thank-you-hero-actions';

type ThankYouDict = Dictionary['thankYou'];

/**
 * TYP hero (design v2 mockup MCK-08): brand palm mark, "You're booked"
 * headline with the tour + date bolded inline, the operator/meeting-point/party
 * meta line, the mono booking-ref pill with copy, the add-to-calendar dropdown
 * and the masked-email reassurance line with a resend action. Server shell
 * (streams inside the page Suspense boundary, revealing on mount); the copy
 * button, calendar menu and resend line are the client leaves in
 * `thank-you-hero-actions`.
 */
export function ThankYouHero({
    booking,
    dict,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
}) {
    // Operator · meeting point · party - each only when the payload carries it.
    const metaItems = [
        booking.operatorName,
        booking.pickupLabel,
        booking.partyLabel,
    ].filter(Boolean);

    return (
        <section className='bg-it-white pt-10 pb-9 md:pt-14 md:pb-11'>
            <div className='it-wrap flex flex-col items-center text-center'>
                <MountReveal className='flex w-full flex-col items-center'>
                    <MotionSpan
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ ...springPop, delay: 0.15 }}
                        className='mb-[18px] inline-flex shrink-0'>
                        <Image
                            src='/logo/it-palm-orange.svg'
                            alt=''
                            width={33}
                            height={44}
                            className='h-11 w-auto'
                        />
                    </MotionSpan>
                    <h1 className='m-0 font-it-display text-[clamp(28px,4vw,40px)] font-bold leading-[1.08] tracking-[-0.018em] text-it-ink'>
                        {dict.title.replace('{name}', booking.guestFirstName)}
                    </h1>
                    <p className='m-0 mt-3 text-[16.5px] leading-[1.6] text-it-ink'>
                        {renderTemplate(dict.subtitle, {
                            tour: (
                                <b className='font-bold'>{booking.tourTitle}</b>
                            ),
                            date: (
                                <b className='font-bold'>{booking.dateLabel}</b>
                            ),
                            time: (
                                <b className='font-bold'>
                                    {booking.startTimeLabel}
                                </b>
                            ),
                        })}
                    </p>
                    {metaItems.length > 0 && (
                        <div className='mt-2.5 flex flex-wrap items-center justify-center gap-2 text-[13.5px] leading-[1.6] text-it-text-muted'>
                            {metaItems.map((item, i) => (
                                <Fragment key={item}>
                                    {i > 0 && (
                                        <span
                                            aria-hidden='true'
                                            className='text-it-ink-muted'>
                                            ·
                                        </span>
                                    )}
                                    <span>{item}</span>
                                </Fragment>
                            ))}
                        </div>
                    )}
                    <div className='mt-5 flex items-center gap-2.5 rounded-it-full border border-it-border bg-it-bg px-4 py-[9px] text-[13.5px] leading-[1.5]'>
                        <span className='text-it-text-muted'>
                            {dict.bookingRef}
                        </span>
                        <code className='font-mono font-bold tracking-[0.02em] text-it-ink'>
                            {booking.displayRef}
                        </code>
                        <BookingRefCopy
                            displayRef={booking.displayRef}
                            copyLabel={dict.copy}
                            copiedLabel={dict.copied}
                            ariaLabel={`${dict.bookingRef} ${booking.displayRef}`}
                        />
                    </div>
                </MountReveal>
                <MountReveal
                    delay={0.15}
                    className='flex flex-col items-center'>
                    <div className='mt-5'>
                        <AddToCalendar
                            googleUrl={buildCalendarUrl(booking)}
                            outlookUrl={buildOutlookCalendarUrl(booking)}
                            icsUrl={buildIcsUrl(booking)}
                            labels={{
                                button: dict.addToCalendar,
                                google: dict.calGoogle,
                                apple: dict.calApple,
                                outlook: dict.calOutlook,
                                ics: dict.calIcs,
                            }}
                        />
                    </div>
                    <div className='mt-[18px] flex flex-col items-center text-center text-[13px] leading-[1.6] text-it-text-muted'>
                        <p className='m-0'>
                            {renderTemplate(dict.emailSentTo, {
                                email: (
                                    <b className='font-bold'>
                                        {booking.guestEmail}
                                    </b>
                                ),
                            })}
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
