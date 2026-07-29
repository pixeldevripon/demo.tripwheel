'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type {
    TravellerBooking,
    TravellerPage,
    TravellerPayment,
    TravellerSummary,
} from '@/lib/api/public/traveller';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade, swapFade } from '@/lib/motion';
import { clearTravelerBooking } from '@/lib/traveler-booking';

import { MountReveal } from '../mount-reveal';
import { Pagination } from '../pagination';
import { TravellerBookingCard } from './traveller-booking-card';
import { TravellerPaymentsList } from './traveller-payments-list';
import { TravellerStats } from './traveller-stats';

export type TravellerTab = 'bookings' | 'payments';

/**
 * The signed-in account area.
 *
 * Laid out like the rest of the site rather than like a dashboard: a white
 * header band carrying the identity and the sign-out, then a surface band with
 * the stat row, the tab bar, and the content. Both datasets arrive as props, so
 * switching tabs is instant; pagination navigates, because it genuinely needs
 * new server data and a page of results should stay linkable.
 */
export function TravellerView({
    summary,
    bookings,
    payments,
    activeTab,
    dict,
    typDict,
    locale,
    nowMs,
}: {
    summary: TravellerSummary;
    bookings: TravellerPage<TravellerBooking>;
    payments: TravellerPage<TravellerPayment>;
    activeTab: TravellerTab;
    dict: Dictionary['traveller'];
    /** Shared booking-detail row labels, reused from the thank-you page. */
    typDict: Dictionary['thankYou'];
    locale: Locale;
    /** Server-stamped request instant, for the free-cancellation window copy. */
    nowMs: number;
}) {
    const router = useRouter();
    const [tab, setTab] = useState<TravellerTab>(activeTab);
    const [signingOut, setSigningOut] = useState(false);

    // Pagination navigates, which re-renders this component with a new
    // activeTab - keep the local tab in step with the URL it came from.
    useEffect(() => setTab(activeTab), [activeTab]);

    /**
     * Switch tab AND write it to the URL.
     *
     * `traveller/page.tsx` reads `searchParams.tab` server-side, so a tab held
     * only in local state was lost on refresh, on Back, and on any shared or
     * bookmarked link - the page silently reopened on Bookings. Pagination
     * already wrote `?tab=`; the tab buttons themselves did not.
     *
     * `scroll: false` matches pagination: the tab strip stays where it is.
     */
    function selectTab(next: TravellerTab) {
        if (next === tab) return;
        setTab(next); // optimistic - the strip highlights before the nav lands
        router.push(`${localizeHref(locale, '/traveller')}?tab=${next}`, {
            scroll: false,
        });
    }

    function signOut() {
        if (signingOut) return;
        setSigningOut(true);
        // Drops the HttpOnly session cookie AND the display-only client cookies.
        clearTravelerBooking();
        router.refresh();
    }

    const tabs: { key: TravellerTab; label: string; count: number }[] = [
        { key: 'bookings', label: dict.tabBookings, count: bookings.total },
        { key: 'payments', label: dict.tabPayments, count: payments.total },
    ];

    const active = tab === 'bookings' ? bookings : payments;
    const pageCount = Math.max(1, Math.ceil(active.total / active.limit));

    return (
        <>
            {/* Header band - white, like the thank-you page's management header. */}
            <section className='bg-it-white pt-10 pb-8 md:pt-14 md:pb-10'>
                <div className='it-container'>
                    <MountReveal>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <h1 className='m-0 font-medium text-[32px] leading-[1.2] tracking-[-0.012em] text-it-heading md:text-[40px]'>
                                    {dict.title}
                                </h1>
                                <p className='mt-2 mb-0 text-[15px] leading-[1.6] text-it-text-muted md:text-[16px]'>
                                    {dict.subtitle}
                                </p>
                            </div>
                        </div>
                    </MountReveal>

                    <MountReveal delay={0.05}>
                        <div className='mt-7'>
                            <TravellerStats
                                summary={summary}
                                dict={dict}
                                locale={locale}
                            />
                        </div>
                    </MountReveal>
                </div>
            </section>

            {/* Content band - surface, matching the summary section on the TYP.
                The min-height keeps a one-booking account from collapsing into
                a stub with the footer pushed up under the tabs. */}
            <section className='it-section min-h-[480px] bg-it-surface md:min-h-[660px]'>
                <div className='it-container flex flex-col gap-6'>
                    {/* Compact horizontal tabs with an underline indicator: a
                        full-width segmented control stretches two words across
                        the page and reads as a broken button. */}
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
                                className={`relative -mb-px cursor-pointer border-none bg-transparent px-0 pb-3.5 text-[16px] font-medium tracking-[-0.012em] transition-colors ${
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
                                but plenty of bookings, and "No bookings yet"
                                would be a lie. */}
                            {tab === 'bookings' ? (
                                bookings.data.length ? (
                                    <div className='flex flex-col gap-4'>
                                        {bookings.data.map(booking => (
                                            <MountReveal
                                                key={booking.id}
                                                listItem>
                                                <TravellerBookingCard
                                                    booking={booking}
                                                    dict={dict}
                                                    typDict={typDict}
                                                    locale={locale}
                                                    nowMs={nowMs}
                                                />
                                            </MountReveal>
                                        ))}
                                    </div>
                                ) : bookings.total === 0 ? (
                                    <EmptyState
                                        title={dict.emptyBookingsTitle}
                                        body={dict.emptyBookingsBody}
                                    />
                                ) : null
                            ) : payments.data.length ? (
                                <TravellerPaymentsList
                                    payments={payments.data}
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

                    {/* The sitewide numbered pagination, driven by the URL so a
                        page of results stays linkable and back works. */}
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
                </div>
            </section>
        </>
    );
}

function EmptyState({ title, body }: { title: string; body: string }) {
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
        </motion.div>
    );
}

