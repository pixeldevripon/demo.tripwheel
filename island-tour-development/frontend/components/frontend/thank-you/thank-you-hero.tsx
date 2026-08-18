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
    return (
        <section className='bg-it-white pt-12 pb-14 md:pt-[85px] md:pb-[116px]'>
            <div className='it-container flex flex-col items-center text-center'>
                <MountReveal className='flex w-full flex-col items-center'>
                    <MotionSpan
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ ...springPop, delay: 0.15 }}
                        className='inline-flex shrink-0'>
                        {/* Figma 47745:10764: a 56px green check. The brand
                            palm used to sit here - but this page's whole job in
                            its first half-second is to say "it worked", and a
                            logo says who we are, not that anything succeeded. */}
                        <Image
                            src='/icons/typ/check.svg'
                            alt=''
                            width={56}
                            height={56}
                            className='size-11 md:size-12'
                        />
                    </MotionSpan>
                    <h1 className='m-0 mt-8 it-h1 leading-[1.2] text-balance text-it-heading font-medium '>
                        {dict.title.replace('{name}', booking.guestFirstName)}
                    </h1>
                    {/* The emphasised words are MEDIUM INK at the same size as
                        the sentence around them (Figma 47745:10748).

                        They were `text-[12px] text-it-heading/70` - two thirds
                        the size of the muted text they sat inside, and lighter
                        than it. The tour name, the date and the time - the three
                        facts this page exists to confirm - were rendered as the
                        least readable thing in the sentence. */}
                    <p className='m-0 mt-1 it-text text-it-text-muted '>
                        {renderTemplate(dict.subtitle, {
                            tour: (
                                <b className='font-medium tracking-[-0.012em] text-it-heading'>
                                    {booking.tourTitle}
                                </b>
                            ),
                            date: (
                                <b className='font-medium tracking-[-0.012em] text-it-heading'>
                                    {booking.dateLabel}
                                </b>
                            ),
                            time: (
                                <b className='font-medium tracking-[-0.012em] text-it-heading'>
                                    {booking.startTimeLabel}
                                </b>
                            ),
                        })}
                    </p>
                    {/* Only for a viewer who proved they own this booking. The
                        reference is what support identifies a traveller by, so
                        the masked (shared-link) view does not carry it - and
                        the real owner already has it in their email. */}
                    {booking.displayRef && (
                        <BookingRefPill
                            displayRef={booking.displayRef}
                            dict={dict}
                            className='mt-8'
                        />
                    )}
                </MountReveal>
                <MountReveal
                    delay={0.15}
                    className='flex flex-col items-center'>
                    <div className='mt-14'>
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
                    <div className='mt-8 flex flex-col items-center text-center it-text text-it-text-muted '>
                        <p className='m-0'>
                            {renderTemplate(dict.emailSentTo, {
                                email: (
                                    <b className='font-medium tracking-[-0.012em] text-it-heading'>
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

