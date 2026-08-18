import { MotionA } from '@/components/frontend/motion-primitives';
import { MountReveal } from '@/components/frontend/mount-reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { springPop } from '@/lib/motion';
import {
    buildCalendarUrl,
    type ThankYouBooking,
} from '@/lib/thank-you/thank-you';
import Image from 'next/image';
import { BookingRefPill } from './booking-ref-pill';
import { ResendEmailLine } from './thank-you-hero-actions';

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
    reviewHref,
    dict,
}: {
    booking: ThankYouBooking;
    cancelHref: string;
    /** Locale-prefixed `/review/{token}` path, built by the caller. */
    reviewHref: string;
    dict: ThankYouDict;
}) {
    // The server owns the verdict (already requested? departed? not
    // confirmed?), so the button can never be offered for a request the API
    // would refuse.
    const canCancel = booking.canCancel;
    const cancelled = booking.status === 'CANCELLED';
    // Requested but not yet processed by an admin.
    const cancellationPending = !cancelled && !!booking.cancellationRequestedAt;

    // The chip used to be a hardcoded green "Confirmed" - it stayed green even
    // on a booking that had been cancelled.
    const statusChip = cancelled
        ? {
              label: dict.statusCancelled,
              dot: 'bg-it-error',
              text: 'text-it-error',
              bg: 'bg-it-error-subtle',
          }
        : cancellationPending
          ? {
                label: dict.statusCancellationPending,
                dot: 'bg-it-warning',
                text: 'text-it-warning',
                bg: 'bg-it-warning-subtle',
            }
          : {
                label: dict.statusConfirmed,
                dot: 'bg-it-green',
                text: 'text-it-green',
                bg: 'bg-it-green/8',
            };
    /**
     * A trip that has already happened cannot be added to a calendar.
     *
     * The event is in the past, so the link creates a Google Calendar entry for
     * a date that has been and gone - and it sat directly above the "how was
     * your trip?" ask, which reads as a page that has not noticed the trip is
     * over. Keyed off the real end instant rather than `status` alone, so a
     * CONFIRMED booking that was never marked redeemed also drops it - the
     * verdict is computed in the mapper, because reading the clock during
     * render is impure.
     */
    // No calendar CTA while a cancellation request is pending either -
    // calendaring a trip the traveller just asked to cancel reads as the
    // platform not listening (same logic as hiding the resend line below).
    const showCalendar =
        !cancelled && !cancellationPending && !booking.departed;

    const stateNote = cancelled
        ? dict.cancelledNote
        : cancellationPending
          ? dict.cancellationPendingNote
          : null;

    return (
        <section className='bg-it-white pt-12 pb-12 md:pt-[64px] md:pb-[72px]'>
            <div className='it-container flex flex-col gap-8'>
                <MountReveal className='flex flex-col gap-4'>
                    <span
                        className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 ${statusChip.bg}`}>
                        <span
                            className={`size-1.5 shrink-0 rounded-full ${statusChip.dot}`}
                        />
                        <span
                            className={`text-[13px] font-normal leading-[1.2] tracking-[-0.012em] ${statusChip.text}`}>
                            {statusChip.label}
                        </span>
                    </span>
                    <div className='flex flex-col gap-1'>
                        <h1 className='m-0 font-medium text-[32px] md:text-[44px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.manageTitle}
                        </h1>
                        <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/60'>
                            {dict.manageSubtitle
                                .replace('{tour}', booking.tourTitle)
                                .replace('{date}', booking.dateLabel)
                                .replace('{time}', booking.startTimeLabel)}
                        </p>
                    </div>
                    {/* Verified viewers only - see the hero. In practice this
                        header is reached with a session, so the chip is
                        normally present. */}
                    {booking.displayRef && (
                        <BookingRefPill
                            displayRef={booking.displayRef}
                            dict={dict}
                            className='mt-1 self-start'
                        />
                    )}
                    {/* Says what is happening, so a traveller whose request is
                        pending is not left guessing whether it registered -
                        the reason the cancel form kept getting re-submitted. */}
                    {stateNote && (
                        <p className='m-0 max-w-160 text-[15px] leading-[1.6] tracking-[-0.012em] text-it-heading/60'>
                            {stateNote}
                        </p>
                    )}
                </MountReveal>

                {/* FE-12. The one surface a returning traveller actually
                    reaches, so it is where the review ask belongs. Gated on the
                    server's `canReview` - the same predicate the create endpoint
                    enforces - so it can never offer a review the API refuses.
                    The token is only ever present on a verified payload. */}
                {booking.canReview && booking.reviewToken && (
                    <MountReveal delay={0.05}>
                        <div className='flex flex-col gap-3 rounded-[16px] border border-it-border bg-it-surface p-5 sm:flex-row sm:items-center sm:justify-between'>
                            <div className='flex flex-col gap-1'>
                                <span className='font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                    {dict.reviewPrompt}
                                </span>
                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/60'>
                                    {dict.reviewPromptBody}
                                </span>
                            </div>
                            <MotionA
                                href={reviewHref}
                                whileTap={{ scale: 0.98 }}
                                transition={springPop}
                                className='flex shrink-0 items-center justify-center rounded-full bg-it-primary px-7 py-[11px] font-medium text-[15px] leading-[1.6] tracking-[-0.012em] text-it-white no-underline transition-colors hover:bg-it-primary-hover'>
                                {dict.reviewCta}
                            </MotionA>
                        </div>
                    </MountReveal>
                )}

                {/* Skipped entirely when neither action applies, or the row
                    would animate in an empty container. */}
                {(showCalendar || canCancel) && (
                    <MountReveal
                        delay={0.1}
                        className='flex flex-col gap-4 sm:flex-row sm:items-center'>
                        {showCalendar && (
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
                        )}
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
                )}

                {/* Re-sending "You're booked!" while a cancellation request
                    is pending (or after a cancel) reads as the platform
                    ignoring the request - the backend refuses it too. */}
                {!cancelled && !cancellationPending && (
                    <MountReveal
                        delay={0.15}
                        className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading/60'>
                        <ResendEmailLine
                            publicRef={booking.publicRef}
                            helpPrefix={dict.emailHelpPrefix}
                            resendLabel={dict.resendEmail}
                            resentLabel={dict.emailResent}
                            sendingLabel={dict.emailResending}
                            failedLabel={dict.emailResendFailed}
                        />
                    </MountReveal>
                )}
            </div>
        </section>
    );
}

