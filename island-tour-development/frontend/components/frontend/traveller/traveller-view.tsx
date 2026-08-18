'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type {
    TravellerBooking,
    TravellerPage,
    TravellerPaymentsPage,
} from '@/lib/api/public/traveller';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade, swapFade } from '@/lib/motion';

import { MountReveal } from '../mount-reveal';
import { Pagination } from '../pagination';
import { TravellerBookingCard } from './traveller-booking-card';
import { groupTravellerBookings } from './traveller-groups';
import { TravellerNextTrip } from './traveller-next-trip';
import { TravellerPaymentsList } from './traveller-payments-list';
import { TravellerSessionRow } from './traveller-session-row';

export type TravellerTab = 'bookings' | 'payments';

/**
 * The signed-in account area, page = "Your bookings" (review section 4).
 *
 * Order: header (H1, sub, signed-in row) → next-trip module → tabs Bookings |
 * Payments → Upcoming / Past / Cancelled (collapsed) → NeedHelp → footer.
 * Both datasets arrive as props, so switching tabs is instant; pagination
 * navigates, because it genuinely needs new server data.
 */
export function TravellerView({
    bookings,
    payments,
    activeTab,
    dict,
    typDict,
    locale,
    nowMs,
    whatsappHref,
}: {
    bookings: TravellerPage<TravellerBooking>;
    payments: TravellerPaymentsPage;
    activeTab: TravellerTab;
    dict: Dictionary['traveller'];
    /** Shared booking-detail row labels, reused from the thank-you page. */
    typDict: Dictionary['thankYou'];
    locale: Locale;
    /** Server-stamped request instant, for the free-cancellation window copy. */
    nowMs: number;
    /** Dashboard-managed WhatsApp deep link (master 6.6); null hides it. */
    whatsappHref: string | null;
}) {
    const router = useRouter();
    const [tab, setTab] = useState<TravellerTab>(activeTab);

    // Pagination navigates, which re-renders this component with a new
    // activeTab - keep the local tab in step with the URL it came from.
    //
    // The local copy is genuinely needed (selectTab uses history.replaceState,
    // so state and prop legitimately diverge between clicks), but this is the
    // ADJUST-DURING-RENDER form rather than an effect. React's documented
    // pattern: an effect would commit one render showing the STALE tab, then
    // re-render - a visible flash of the wrong list on every paginate.
    const [lastActiveTab, setLastActiveTab] = useState<TravellerTab>(activeTab);
    if (activeTab !== lastActiveTab) {
        setLastActiveTab(activeTab);
        setTab(activeTab);
    }

    /**
     * Switch tab AND write it to the URL: `traveller/page.tsx` reads
     * `searchParams.tab` server-side, so a tab held only in local state was
     * lost on refresh, on Back, and on any shared link.
     *
     * SHALLOW on purpose (history.replaceState, the Next-documented SPA
     * pattern - same as the dashboard's EntityTabs): both tabs' datasets are
     * already in this component's props, so the old `router.push` bought
     * nothing except a full dynamic re-render - a skeleton flash and a
     * backend round trip per tab click. The URL still updates for refresh /
     * share / Back-from-receipt; pagination below keeps a real navigation
     * because a new page genuinely needs new data.
     */
    function selectTab(next: TravellerTab) {
        if (next === tab) return;
        setTab(next);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', next);
        params.delete('page'); // page numbers do not carry across tabs
        window.history.replaceState(
            null,
            '',
            `${localizeHref(locale, '/traveller')}?${params}`
        );
    }

    const tabs: { key: TravellerTab; label: string; count: number }[] = [
        { key: 'bookings', label: dict.tabBookings, count: bookings.total },
        { key: 'payments', label: dict.tabPayments, count: payments.total },
    ];

    // The next-trip module needs the whole account in view - only page 1 of a
    // 50+ booking account can claim to know the soonest trip.
    const groups = groupTravellerBookings(bookings.data, bookings.page === 1);

    const active = tab === 'bookings' ? bookings : payments;
    const pageCount = Math.max(1, Math.ceil(active.total / active.limit));

    const cardFor = (
        booking: TravellerBooking,
        variant: 'full' | 'compact'
    ) => (
        <MountReveal key={booking.id} listItem>
            <TravellerBookingCard
                booking={booking}
                dict={dict}
                typDict={typDict}
                locale={locale}
                nowMs={nowMs}
                whatsappHref={whatsappHref}
                variant={variant}
            />
        </MountReveal>
    );

    return (
        <>
            {/* Header band - white, like the thank-you page's management header. */}
            <section className='bg-it-white pt-10 pb-8 md:pt-14 md:pb-10'>
                <div className='it-container'>
                    <MountReveal>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <h1 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                    {dict.title}
                                </h1>
                                <p className='mt-2 mb-0 text-[15px] leading-[1.6] text-it-text-muted md:text-[16px]'>
                                    {dict.subtitle}
                                </p>
                            </div>
                            <TravellerSessionRow dict={dict} locale={locale} />
                        </div>
                    </MountReveal>
                </div>
            </section>

            {/* Content band - surface. Deliberately NOT `it-section`: its
                130px desktop padding is marketing-section rhythm, and here it
                opened a dead gap between the page's own header band and the
                next-trip hero. Responsive like the header band above. The
                min-height keeps a one-booking account from collapsing into a
                stub with the footer pushed up under the tabs. */}
            <section className='min-h-[480px] bg-it-surface pt-8 pb-16 md:min-h-[660px] md:pt-12 md:pb-24'>
                <div className='it-container flex flex-col gap-6'>
                    {groups.nextTrip && (
                        <MountReveal>
                            <TravellerNextTrip
                                booking={groups.nextTrip}
                                dict={dict}
                                typDict={typDict}
                                locale={locale}
                                nowMs={nowMs}
                                whatsappHref={whatsappHref}
                            />
                        </MountReveal>
                    )}

                    {/* Compact horizontal tabs with an underline indicator. */}
                    <div
                        role='tablist'
                        aria-label={dict.title}
                        className='flex items-center gap-7 border-b border-it-heading/10'>
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                role='tab'
                                type='button'
                                id={`traveller-tab-${t.key}`}
                                aria-selected={tab === t.key}
                                aria-controls='traveller-tabpanel'
                                onClick={() => selectTab(t.key)}
                                className={`relative -mb-px cursor-pointer border-none bg-transparent px-0 pb-3.5 text-[16px] font-normal tracking-[-0.012em] transition-colors ${
                                    tab === t.key
                                        ? 'text-it-heading'
                                        : 'text-it-text-muted hover:text-it-heading'
                                }`}>
                                {t.label}
                                <span className='ml-1.5 text-[14px] text-it-text-muted'>
                                    {t.count}
                                </span>
                                {tab === t.key && (
                                    <motion.span
                                        layoutId='traveller-tab-underline'
                                        transition={crossFade}
                                        className='absolute inset-x-0 -bottom-px block h-0.5 rounded-full bg-it-primary'
                                    />
                                )}
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode='wait' initial={false}>
                        <motion.div
                            key={tab}
                            id='traveller-tabpanel'
                            role='tabpanel'
                            aria-labelledby={`traveller-tab-${tab}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={swapFade}>
                            {/* The empty state is keyed on `total`, not on this
                                page's rows: a hand-edited `?page=99` has no rows
                                but plenty of bookings. */}
                            {tab === 'bookings' ? (
                                bookings.data.length ? (
                                    <div className='flex flex-col gap-8'>
                                        {groups.upcoming.length > 0 && (
                                            <CollapsibleGroup
                                                id='traveller-upcoming'
                                                title={dict.groupUpcoming}
                                                count={groups.upcoming.length}
                                                dict={dict}
                                                defaultOpen>
                                                {groups.upcoming.map(b =>
                                                    cardFor(b, 'full')
                                                )}
                                            </CollapsibleGroup>
                                        )}
                                        {groups.past.length > 0 && (
                                            <CollapsibleGroup
                                                id='traveller-past'
                                                title={dict.groupPast}
                                                count={groups.past.length}
                                                dict={dict}
                                                // Past-only account (5.9): Past
                                                // leads open; otherwise it is
                                                // dead weight below the fold.
                                                defaultOpen={
                                                    groups.upcoming.length ===
                                                        0 && !groups.nextTrip
                                                }>
                                                {groups.past.map(b =>
                                                    cardFor(b, 'compact')
                                                )}
                                            </CollapsibleGroup>
                                        )}
                                        {groups.cancelled.length > 0 && (
                                            <CollapsibleGroup
                                                id='traveller-cancelled'
                                                title={dict.groupCancelled}
                                                count={groups.cancelled.length}
                                                dict={dict}
                                                muted>
                                                {groups.cancelled.map(b =>
                                                    cardFor(b, 'compact')
                                                )}
                                            </CollapsibleGroup>
                                        )}
                                    </div>
                                ) : bookings.total === 0 ? (
                                    <EmptyState
                                        title={dict.emptyBookingsTitle}
                                        body={dict.emptyBookingsBody}
                                        cta={
                                            // GAP-07 empty-state pattern: point
                                            // at the launch destination's All
                                            // Tours page (same fallback slug as
                                            // the TYP deep link).
                                            <Link
                                                href={localizeHref(
                                                    locale,
                                                    '/curacao/tours'
                                                )}
                                                className='mt-5 inline-block rounded-full bg-it-primary px-6 py-2.5 text-[14px] font-medium text-it-primary-fg no-underline transition-[filter] hover:brightness-95'>
                                                {dict.emptyBookingsCta}
                                            </Link>
                                        }
                                    />
                                ) : null
                            ) : payments.data.length ? (
                                <TravellerPaymentsList
                                    payments={payments.data}
                                    totals={payments.totals ?? null}
                                    dict={dict}
                                    locale={locale}
                                />
                            ) : payments.total === 0 ? (
                                <EmptyState
                                    title={dict.emptyPaymentsTitle}
                                    body={dict.emptyPaymentsBody}
                                />
                            ) : null}
                        </motion.div>
                    </AnimatePresence>

                    {/* URL-driven pagination - only shows past one full page
                        (50 bookings / 10 payments). */}
                    <Pagination
                        page={active.page}
                        pageCount={pageCount}
                        ariaLabel={
                            tab === 'bookings'
                                ? dict.tabBookings
                                : dict.tabPayments
                        }
                        onPageChange={next =>
                            router.push(
                                `${localizeHref(locale, '/traveller')}?tab=${tab}&page=${next}`,
                                { scroll: false }
                            )
                        }
                    />

                    {/* NeedHelp (5.8 layer 2): one page-level support block on
                        both tabs, nothing else. */}
                    {whatsappHref && (
                        <MountReveal>
                            <div className='flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-it-heading/10 bg-it-white px-6 py-5'>
                                <div>
                                    <strong className='block font-medium text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                                        {dict.needHelpTitle}
                                    </strong>
                                    <p className='mt-1 mb-0 text-[14px] leading-[1.6] text-it-text-muted'>
                                        {dict.needHelpBody}
                                    </p>
                                </div>
                                <a
                                    href={whatsappHref}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='shrink-0 rounded-full bg-it-primary px-6 py-2.5 text-[14px] font-medium text-it-primary-fg no-underline transition-[filter] hover:brightness-95'>
                                    {dict.whatsappUs}
                                </a>
                            </div>
                        </MountReveal>
                    )}
                </div>
            </section>
        </>
    );
}

/**
 * One booking group as a collapsible section (founder 2026-07-30: every group
 * folds like Cancelled always did). The header IS the toggle - title, real
 * row count, chevron - so a long Past list stops burying the page.
 */
function CollapsibleGroup({
    id,
    title,
    count,
    dict,
    defaultOpen = false,
    muted = false,
    children,
}: {
    id: string;
    title: string;
    count: number;
    dict: Dictionary['traveller'];
    defaultOpen?: boolean;
    /** Cancelled reads quieter - dead weight, reachable but never loud. */
    muted?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section>
            <button
                type='button'
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen(v => !v)}
                className={`flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 font-normal tracking-[-0.012em] transition-colors ${
                    muted
                        ? 'text-[17px] text-it-text-muted hover:text-it-heading'
                        : 'text-[20px] leading-[1.3] text-it-heading'
                }`}>
                {title}
                <span className='text-[14px] font-normal text-it-text-muted'>
                    {count === 1
                        ? dict.tripCountOne
                        : dict.tripsCount.replace('{count}', String(count))}
                </span>
                <motion.span
                    aria-hidden
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={crossFade}
                    className='inline-flex text-it-text-muted'>
                    <ChevronDown className='size-4' strokeWidth={2} />
                </motion.span>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key='body'
                        id={id}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={crossFade}
                        className='overflow-hidden'>
                        <div className='flex flex-col gap-4 pt-4'>
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}

function EmptyState({
    title,
    body,
    cta,
}: {
    title: string;
    body: string;
    cta?: ReactNode;
}) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={crossFade}
            className='rounded-[16px] border border-dashed border-it-heading/15 bg-it-white px-6 py-16 text-center'>
            <strong className='block font-medium text-[18px] text-it-heading'>
                {title}
            </strong>
            <p className='mx-auto mt-2 mb-0 max-w-90 text-[15px] leading-[1.6] text-it-text-muted'>
                {body}
            </p>
            {cta}
        </motion.div>
    );
}

