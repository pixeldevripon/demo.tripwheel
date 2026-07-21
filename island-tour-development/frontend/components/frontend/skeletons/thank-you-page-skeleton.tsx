import { Bar, CARD_GRID } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Thank-you page skeleton - mirrors the streamed TYP body section for section
 * (hero, booking-summary cards, next steps, related tours, apartment promo,
 * question card) so the fill-in never shifts layout. Used both as the page's
 * `<Suspense>` fallback and by the route `loading.tsx`.
 */

/** One icon-label | value row inside the summary cards. */
function SummaryRowSkeleton() {
    return (
        <div className='flex h-[26px] items-center justify-between gap-4'>
            <span className='flex items-center gap-2.5'>
                <Bar className='size-6 rounded-full' />
                <Bar className='h-4 w-24' />
            </span>
            <Bar className='h-4 w-36' />
        </div>
    );
}

/**
 * The "Your booking summary" band on its own - the section heading plus the two
 * side-by-side detail cards on the surface strip.
 *
 * Split out because the payment-processing hop holds this exact placeholder
 * while it polls for CONFIRMED. The TYP it then redirects to renders the very
 * same markup as its own fallback, so the band survives the navigation without
 * re-laying out - only the block above it swaps (spinner -> hero). Keep it 1:1
 * with `ThankYouSummary`; a drift here shows up as a jump mid-redirect.
 */
export function ThankYouSummarySkeleton() {
    return (
        <div className='it-section bg-it-surface'>
            <div className='it-container flex flex-col gap-6'>
                <Bar className='h-[34px] w-72 md:h-12 md:w-[420px]' />
                <div className='grid gap-6 lg:grid-cols-2'>
                    {[9, 6].map((rows, card) => (
                        <div
                            key={card}
                            className='flex flex-col gap-8 rounded-[16px] border border-it-heading/10 bg-it-white p-6'>
                            <Bar className='h-8 w-40' />
                            <div className='flex flex-col gap-3.5'>
                                {Array.from({ length: rows }, (_, i) => (
                                    <SummaryRowSkeleton key={i} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ThankYouPageSkeleton() {
    return (
        <>
            {/* Hero */}
            <div className='bg-it-white pt-12 pb-16 md:pt-[85px] md:pb-[116px]'>
                <div className='it-container flex flex-col items-center gap-14'>
                    <div className='flex w-full flex-col items-center gap-8'>
                        <div className='flex flex-col items-center gap-8'>
                            <Bar className='size-14 rounded-full' />
                            <div className='flex flex-col items-center gap-1'>
                                <Bar className='h-[39px] w-72 md:h-[58px] md:w-[516px]' />
                                <Bar className='mt-1 h-5 w-64 md:w-[460px]' />
                            </div>
                        </div>
                        <div className='flex items-center gap-2'>
                            <Bar className='h-5 w-[90px]' />
                            <Bar className='h-[42px] w-[204px] rounded-[8px]' />
                        </div>
                    </div>
                    <div className='flex flex-col items-center gap-8'>
                        <Bar className='h-14 w-[226px] rounded-full' />
                        <div className='flex flex-col items-center gap-1.5'>
                            <Bar className='h-4 w-80' />
                            <Bar className='h-4 w-64' />
                        </div>
                    </div>
                </div>
            </div>
            {/* Booking summary */}
            <ThankYouSummarySkeleton />
            {/* What happens next */}
            <div className='it-section !pb-0 bg-it-white'>
                <div className='it-container flex flex-col items-center gap-12'>
                    <Bar className='h-[34px] w-64 md:h-12 md:w-96' />
                    <div className='grid w-full gap-6 md:grid-cols-3'>
                        {Array.from({ length: 3 }, (_, i) => (
                            <div key={i} className='flex flex-col items-center gap-8'>
                                <Bar className='size-16 rounded-full' />
                                <div className='flex h-[72px] flex-col items-center justify-center gap-1.5'>
                                    <Bar className='h-[18px] w-44' />
                                    <Bar className='h-[18px] w-52' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Related tours */}
            <div className='it-section bg-it-white'>
                <div className='it-container flex flex-col gap-14'>
                    <div className='flex flex-col gap-12'>
                        <div className='flex flex-col gap-2'>
                            <Bar className='h-[34px] w-72 md:h-12 md:w-[380px]' />
                            <Bar className='h-5 w-60' />
                        </div>
                        <div className={CARD_GRID}>
                            {Array.from({ length: 3 }, (_, i) => (
                                <TourCardSkeleton key={i} />
                            ))}
                        </div>
                    </div>
                    <div className='relative flex h-[46px] items-center justify-center'>
                        <span className='absolute inset-x-0 top-1/2 h-px bg-it-heading/10' />
                        <span className='relative bg-it-white p-2.5'>
                            <Bar className='h-5 w-56' />
                        </span>
                    </div>
                </div>
            </div>
            {/* Apartment promo */}
            <div className='it-section !pt-0 bg-it-white'>
                <div className='it-container'>
                    <div className='grid overflow-hidden rounded-[16px] border border-it-heading/10 bg-it-surface lg:grid-cols-2'>
                        <Bar className='h-[240px] rounded-none lg:h-auto lg:min-h-[379px]' />
                        <div className='flex flex-col justify-between gap-6 p-6 lg:py-8 lg:pl-[42px] lg:pr-[22px]'>
                            <div className='flex flex-col gap-6'>
                                <Bar className='h-5 w-56' />
                                <div className='flex flex-col gap-5'>
                                    <div className='flex flex-col gap-1'>
                                        <Bar className='h-[29px] w-64' />
                                        <Bar className='mt-1 h-[18px] w-80' />
                                    </div>
                                    <div className='flex flex-col gap-1'>
                                        <Bar className='h-4 w-72' />
                                        <Bar className='h-4 w-64' />
                                    </div>
                                </div>
                            </div>
                            <Bar className='h-12 w-full max-w-[340px] rounded-full' />
                        </div>
                    </div>
                </div>
            </div>
            {/* Question card */}
            <div className='it-section bg-it-surface'>
                <div className='it-container flex flex-col gap-12'>
                    <Bar className='h-[34px] w-72 md:h-12 md:w-[460px]' />
                    <div className='grid rounded-[16px] bg-it-white lg:min-h-[222px] lg:grid-cols-2'>
                        <div className='flex flex-col gap-7 p-6 lg:p-8'>
                            <Bar className='h-8 w-80' />
                            <div className='flex flex-col gap-4'>
                                <Bar className='h-5 w-36' />
                                <div className='flex flex-col gap-1'>
                                    <Bar className='h-6 w-72' />
                                    <Bar className='h-6 w-48' />
                                </div>
                            </div>
                        </div>
                        <div className='flex flex-col gap-7 p-6 lg:py-8 lg:pl-[61px] lg:pr-8'>
                            <Bar className='h-8 w-60' />
                            <div className='flex flex-col gap-2'>
                                <Bar className='h-[52px] w-full max-w-[488px]' />
                                <Bar className='h-5 w-56' />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
