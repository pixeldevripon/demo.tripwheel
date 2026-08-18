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
import { BookingRefPill } from './booking-ref-pill';
import { renderTemplate } from './render-template';
import { AddToCalendar, ResendEmailLine } from './thank-you-hero-actions';

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
                    <h1 className='m-0 text-[27.5px] md:text-[37px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                        {dict.title.replace('{name}', booking.guestFirstName)}
                    </h1>
                    <p className='m-0 mt-3 text-[15px] leading-[1.6] text-it-heading tracking-[-0.012em]'>
                        {renderTemplate(dict.subtitle, {
                            tour: (
                                <b className='tracking-[-0.012em] text-it-heading/70 text-[10px]'>
                                    {booking.tourTitle}
                                </b>
                            ),
                            date: (
                                <b className='tracking-[-0.012em] text-it-heading/70 text-[10px]'>
                                    {booking.dateLabel}
                                </b>
                            ),
                            time: (
                                <b className='tracking-[-0.012em] text-it-heading/70 text-[10px]'>
                                    {booking.startTimeLabel}
                                </b>
                            ),
                        })}
                    </p>
                    {metaItems.length > 0 && (
                        <div className='mt-2.5 flex flex-wrap items-center justify-center gap-2 text-[12.5px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                            {/* Index key: a fixed-position array of
                                independent strings, where two entries CAN
                                coincide (operator name == party label is
                                unlikely but legal) and nothing reorders. */}
                            {metaItems.map((item, i) => (
                                <Fragment key={i}>
                                    {i > 0 && (
                                        <span
                                            aria-hidden='true'
                                            className='text-it-text-muted tracking-[-0.012em]'>
                                            ·
                                        </span>
                                    )}
                                    <span>{item}</span>
                                </Fragment>
                            ))}
                        </div>
                    )}
                    {/* Only for a viewer who proved they own this booking. The
                        reference is what support identifies a traveller by, so
                        the masked (shared-link) view does not carry it - and
                        the real owner already has it in their email. */}
                    {booking.displayRef && (
                        <BookingRefPill
                            displayRef={booking.displayRef}
                            dict={dict}
                            className='mt-5'
                        />
                    )}
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
                    <div className='mt-[18px] flex flex-col items-center text-center text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        <p className='m-0'>
                            {renderTemplate(dict.emailSentTo, {
                                email: (
                                    <b className='tracking-[-0.012em] text-it-heading/70 text-[10px]'>
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

