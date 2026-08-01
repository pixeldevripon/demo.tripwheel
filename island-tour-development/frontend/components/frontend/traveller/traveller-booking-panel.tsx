'use client';

import { ArrowUpRight, SquareArrowOutUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type { TravellerBooking } from '@/lib/api/public/traveller';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';

import { TravellerCancelPanel } from './traveller-cancel-panel';
import {
    durationLabel,
    formatDay,
    mapsUrl,
    partyLabel,
} from './traveller-format';
import { TravellerPaymentBox } from './traveller-payment-box';

/**
 * The expanded booking detail panel (review 5.4), shared by the list card and
 * the next-trip module so the two can never drift: TOUR DETAILS and PAYMENT
 * side by side, the cancellation box on its OWN full-width row beneath them
 * (final.html layout), then the 5.8 support row and the quiet footer links.
 */
export function TravellerBookingPanel({
    booking,
    dict,
    typDict,
    locale,
    nowMs,
    whatsappHref,
    active,
    past,
}: {
    booking: TravellerBooking;
    dict: Dictionary['traveller'];
    typDict: Dictionary['thankYou'];
    locale: Locale;
    nowMs: number;
    whatsappHref: string | null;
    /** True for upcoming cards - support row, check-in and deadline notes. */
    active: boolean;
    /** True for completed cards - enables "Book this tour again". */
    past: boolean;
}) {
    const dateLine = [formatDay(booking.localDate, locale), booking.startTime]
        .filter(Boolean)
        .join(' · ');

    // The manage view is the thank-you page - locale-less by design (the proxy
    // rewrites it) and keyed on the unguessable publicRef.
    const manageHref = booking.destinationSlug
        ? `/${booking.destinationSlug}/thank-you/${booking.publicRef}`
        : null;
    // Canonical flat tour URL, for "Book this tour again" on completed trips.
    const tourHref =
        past && booking.destinationSlug
            ? localizeHref(
                  locale,
                  `/${booking.destinationSlug}/${booking.tourSlug}`
              )
            : null;

    const duration = durationLabel(booking.durationMinutesFrom);
    const hasPickup = Boolean(booking.pickupAddress);
    // Pickup rows get a Maps link too (founder 2026-07-30, revising the
    // review's meeting-point-only rule): the snapshot holds a real address.
    const maps = hasPickup
        ? mapsUrl(null, null, booking.pickupAddress)
        : mapsUrl(
              booking.meetingPointLat,
              booking.meetingPointLng,
              booking.meetingPoint
          );

    const showCancellation =
        (active && booking.displayStatus === 'CONFIRMED') ||
        booking.cancellationBlockedReason === 'ALREADY_REQUESTED';

    return (
        <div className='border-t border-it-heading/10 bg-it-surface p-5 sm:p-6'>
            {/* The booking page link leads the panel (founder 2026-07-30),
                dashboard live-page style: icon + label + green Live pill. */}
            {manageHref && (
                <div className='mb-4 flex items-center gap-2.5 border-b border-it-heading/10 pb-4'>
                    <Link
                        href={manageHref}
                        className='inline-flex items-center gap-2 text-[13.5px] font-normal text-it-ink/70 no-underline transition-colors hover:text-it-heading'>
                        <SquareArrowOutUpRight
                            className='size-4'
                            strokeWidth={2}
                        />
                        {dict.openBookingPage}
                    </Link>
                    <span className='inline-flex items-center gap-1.5 rounded-full border border-it-green/25 bg-it-green-subtle px-2.5 py-0.5 text-[12px] font-normal text-it-green'>
                        <span
                            aria-hidden
                            className='size-1.5 rounded-full bg-it-green'
                        />
                        {dict.liveChip}
                    </span>
                </div>
            )}
            <div className='grid gap-4 lg:grid-cols-2'>
                <Panel title={typDict.tourDetails}>
                    <DetailRow
                        icon='/icons/thank-you/detail-calendar.svg'
                        label={typDict.dateTime}>
                        {dateLine}
                    </DetailRow>
                    <DetailRow
                        icon='/icons/thank-you/detail-travelers.svg'
                        label={typDict.traveler}>
                        {partyLabel(booking.partySize, dict)}
                    </DetailRow>
                    {hasPickup ? (
                        <DetailRow
                            icon='/icons/thank-you/detail-location.svg'
                            label={dict.rowPickup}>
                            {booking.pickupAddress}
                            {active && booking.arrivalBufferMinutes ? (
                                <MutedInline>
                                    {dict.beReadyEarly.replace(
                                        '{minutes}',
                                        String(booking.arrivalBufferMinutes)
                                    )}
                                </MutedInline>
                            ) : null}
                            {maps && (
                                <>
                                    {' · '}
                                    <a
                                        href={maps}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='font-normal text-it-primary no-underline hover:opacity-80'>
                                        {dict.mapsLink}
                                    </a>
                                </>
                            )}
                        </DetailRow>
                    ) : booking.meetingPoint ? (
                        <DetailRow
                            icon='/icons/thank-you/detail-location.svg'
                            label={dict.rowMeetingPoint}>
                            {booking.meetingPoint}
                            {active && booking.arrivalBufferMinutes ? (
                                <MutedInline>
                                    {dict.beThereEarly.replace(
                                        '{minutes}',
                                        String(booking.arrivalBufferMinutes)
                                    )}
                                </MutedInline>
                            ) : null}
                            {maps && (
                                <>
                                    {' · '}
                                    <a
                                        href={maps}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='font-normal text-it-primary no-underline hover:opacity-80'>
                                        {dict.mapsLink}
                                    </a>
                                </>
                            )}
                        </DetailRow>
                    ) : null}
                    {duration && (
                        <DetailRow
                            icon='/icons/thank-you/detail-clock.svg'
                            label={dict.rowDuration}>
                            {duration}
                        </DetailRow>
                    )}
                    <DetailRow label={dict.rowBooked}>
                        {formatDay(booking.createdAt, locale)}
                    </DetailRow>
                    <DetailRow label={typDict.ref}>
                        <span className='font-mono'>{booking.displayRef}</span>
                    </DetailRow>
                    {/* LD4 made visible: the ref + a photo ID IS the ticket -
                        no voucher, no QR. */}
                    {active && (
                        <DetailRow label={dict.rowCheckIn}>
                            {dict.checkInValue}
                        </DetailRow>
                    )}
                </Panel>

                <Panel title={typDict.paymentTitle}>
                    <TravellerPaymentBox
                        booking={booking}
                        dict={dict}
                        typDict={typDict}
                        locale={locale}
                        nowMs={nowMs}
                        active={active}
                    />
                </Panel>
            </div>

            {/* Cancellation gets its own row (final.html): squeezed into a
                third column it towers empty next to the money box. */}
            {showCancellation && (
                <div className='mt-4'>
                    <Panel title={dict.cancellationTitle}>
                        <TravellerCancelPanel
                            booking={booking}
                            dict={dict}
                            locale={locale}
                            nowMs={nowMs}
                        />
                    </Panel>
                </div>
            )}

            {/* Support row (5.8): operator first, WhatsApp fallback - active
                bookings only. */}
            {active && (booking.operator.name || whatsappHref) && (
                <div className='mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13.5px] leading-[1.6] text-it-text-muted'>
                    {booking.operator.name && (
                        <span>
                            {dict.supportTourQ}{' '}
                            <strong className='font-normal text-it-heading'>
                                {booking.operator.name}
                            </strong>
                            {booking.operator.phone && (
                                <>
                                    {' · '}
                                    <a
                                        href={`tel:${booking.operator.phone.replace(/\s/g, '')}`}
                                        className='text-it-heading no-underline hover:text-it-primary'>
                                        {booking.operator.phone}
                                    </a>
                                </>
                            )}
                            {booking.operator.email && (
                                <>
                                    {' · '}
                                    <a
                                        href={`mailto:${booking.operator.email}`}
                                        className='text-it-heading no-underline hover:text-it-primary'>
                                        {booking.operator.email}
                                    </a>
                                </>
                            )}
                        </span>
                    )}
                    {whatsappHref && (
                        <span>
                            {dict.supportBookingQ}{' '}
                            <a
                                href={whatsappHref}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='font-normal text-it-primary no-underline hover:opacity-80'>
                                {dict.whatsappUs}
                            </a>
                        </span>
                    )}
                </div>
            )}

            <div className='mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-it-heading/10 pt-4'>
                <span className='flex flex-wrap items-center gap-x-5 gap-y-2'>
                    {tourHref && (
                        <QuietLink href={tourHref}>{dict.bookAgain}</QuietLink>
                    )}
                    {booking.review.canReview && booking.review.reviewToken && (
                        <QuietLink
                            href={localizeHref(
                                locale,
                                `/review/${booking.review.reviewToken}`
                            )}>
                            {dict.reviewCta}
                        </QuietLink>
                    )}
                    {booking.review.reviewed && (
                        <span className='text-[13.5px] text-it-text-muted'>
                            {dict.reviewed}
                        </span>
                    )}
                </span>
                <span className='font-mono text-[12.5px] text-it-text-muted'>
                    {booking.displayRef}
                </span>
            </div>
        </div>
    );
}

/** A titled white panel - the thank-you summary card, at card scale. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className='flex h-full flex-col gap-3 rounded-[16px] border border-it-heading/10 bg-it-white p-5'>
            <h4 className='m-0 text-[13px] font-semibold tracking-[0.04em] text-it-text-muted uppercase'>
                {title}
            </h4>
            <div className='flex flex-col gap-2.5'>{children}</div>
        </div>
    );
}

/** Optional icon + muted label | right-aligned value (thank-you rows). */
function DetailRow({
    icon,
    label,
    children,
}: {
    icon?: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className='flex items-start justify-between gap-4'>
            <span className='flex shrink-0 items-center gap-2.5'>
                {icon && (
                    <Image
                        src={icon}
                        alt=''
                        width={24}
                        height={24}
                        className='size-5'
                    />
                )}
                <span className='text-[14px] leading-[1.6] text-it-text-muted'>
                    {label}
                </span>
            </span>
            <span className='min-w-0 text-right text-[14px] leading-[1.6] text-it-heading'>
                {children}
            </span>
        </div>
    );
}

function MutedInline({ children }: { children: ReactNode }) {
    return (
        <span className='text-it-text-muted'>
            {' · '}
            {children}
        </span>
    );
}

function QuietLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className='inline-flex items-center gap-1 text-[13.5px] font-normal text-it-primary no-underline transition-opacity hover:opacity-80'>
            {children}
            <ArrowUpRight className='size-3.5' strokeWidth={2} />
        </Link>
    );
}

