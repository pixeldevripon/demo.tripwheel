import { Bar } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Thank-you page skeleton - mirrors the streamed TYP body section for section
 * (hero, booking-summary cards, next steps, related tours, apartment promo,
 * question card) on the design v2 880px wrap, so the fill-in never shifts
 * layout. Used both as the page's `<Suspense>` fallback and by the route
 * `loading.tsx`.
 */

/** One icon-label | value hairline row inside the summary cards. */
function SummaryRowSkeleton({ last = false }: { last?: boolean }) {
    return (
        <div
            className={`flex items-center justify-between gap-[18px] py-[11px] ${last ? '' : 'border-b border-it-divider'}`}>
            <span className='flex items-center gap-[9px]'>
                <Bar className='size-4 rounded-full' />
                <Bar className='h-4 w-24' />
            </span>
            <Bar className='h-4 w-36' />
        </div>
    );
}

/**
 * The "Your booking summary" band on its own - the section heading plus the two
 * side-by-side detail cards on the paper strip.
 *
 * Split out because the payment-processing hop holds this exact placeholder
 * while it polls for CONFIRMED. The TYP it then redirects to renders the very
 * same markup as its own fallback, so the band survives the navigation without
 * re-laying out - only the block above it swaps (spinner -> hero). Keep it 1:1
 * with `ThankYouSummary`; a drift here shows up as a jump mid-redirect.
 */
export function ThankYouSummarySkeleton() {
    return (
        <div className='bg-it-bg py-[52px]'>
            <div className='it-wrap flex flex-col'>
                <Bar className='mb-[22px] h-8 w-72' />
                <div className='grid items-start gap-2 md:grid-cols-2 md:gap-5'>
                    {[9, 6].map((rows, card) => (
                        <div
                            key={card}
                            className='rounded-it-lg border border-it-divider bg-it-white px-5 py-[22px] shadow-it-sm md:px-[26px]'>
                            <Bar className='mb-3 h-4 w-28' />
                            <div className='flex flex-col'>
                                {Array.from({ length: rows }, (_, i) => (
                                    <SummaryRowSkeleton
                                        key={i}
                                        last={i === rows - 1}
                                    />
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
            <div className='bg-it-white pt-10 pb-9 md:pt-14 md:pb-11'>
                <div className='it-wrap flex flex-col items-center'>
                    <Bar className='mb-[18px] h-11 w-9' />
                    <Bar className='h-[34px] w-72 md:h-[43px] md:w-[440px]' />
                    <Bar className='mt-3 h-5 w-64 md:w-[460px]' />
                    <Bar className='mt-2.5 h-4 w-72' />
                    <Bar className='mt-5 h-10 w-[280px] rounded-full' />
                    <Bar className='mt-5 h-[50px] w-[220px] rounded-it-sm' />
                    <div className='mt-[18px] flex flex-col items-center gap-1.5'>
                        <Bar className='h-4 w-80' />
                        <Bar className='h-4 w-64' />
                    </div>
                </div>
            </div>
            {/* Booking summary */}
            <ThankYouSummarySkeleton />
            {/* What happens next */}
            <div className='bg-it-white pt-14 pb-2'>
                <div className='it-wrap flex flex-col items-center'>
                    <Bar className='mb-7 h-7 w-64' />
                    <div className='mb-[18px] hidden items-center md:flex'>
                        <Bar className='size-[34px] rounded-full' />
                        <span className='h-0.5 w-[120px] bg-it-divider' />
                        <Bar className='size-[34px] rounded-full' />
                        <span className='h-0.5 w-[120px] bg-it-divider' />
                        <Bar className='size-[34px] rounded-full' />
                    </div>
                    <div className='grid w-full gap-4 md:grid-cols-3'>
                        {Array.from({ length: 3 }, (_, i) => (
                            <div
                                key={i}
                                className='rounded-it-md border border-it-divider bg-it-white px-5 py-[18px] shadow-it-sm'>
                                <Bar className='h-[18px] w-44' />
                                <Bar className='mt-2 h-4 w-52' />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Related tours */}
            <div className='bg-it-white pt-14'>
                <div className='it-wrap flex flex-col'>
                    <Bar className='h-7 w-72' />
                    <Bar className='mt-1.5 h-4 w-60' />
                    <div className='mt-[22px] grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4'>
                        {Array.from({ length: 3 }, (_, i) => (
                            <TourCardSkeleton key={i} />
                        ))}
                    </div>
                    <Bar className='mt-6 h-5 w-56' />
                </div>
            </div>
            {/* Apartment promo */}
            <div className='bg-it-white pt-12'>
                <div className='it-wrap'>
                    <div className='grid overflow-hidden rounded-it-lg border border-it-divider bg-it-white shadow-it-sm md:grid-cols-[280px_1fr]'>
                        <Bar className='h-[170px] rounded-none md:h-auto md:min-h-[220px]' />
                        <div className='flex flex-col items-start justify-center px-5 py-5 md:px-7 md:py-6'>
                            <Bar className='h-4 w-48' />
                            <Bar className='mt-2 h-6 w-64' />
                            <Bar className='mt-1 h-4 w-72' />
                            <Bar className='mt-2 h-4 w-56' />
                            <Bar className='mt-3.5 h-10 w-56 rounded-it-sm' />
                        </div>
                    </div>
                </div>
            </div>
            {/* Question card */}
            <div className='bg-it-white pt-14 pb-[72px]'>
                <div className='it-wrap'>
                    <div className='mx-auto w-full max-w-[560px] rounded-it-lg border border-it-divider bg-it-white px-5 py-[22px] shadow-it-sm md:px-8 md:py-7'>
                        <Bar className='h-6 w-72' />
                        <Bar className='mt-1.5 h-4 w-60' />
                        <div className='mt-4 flex flex-col gap-2'>
                            <Bar className='h-5 w-36' />
                            <Bar className='h-4 w-56' />
                            <Bar className='h-4 w-44' />
                        </div>
                        <div className='my-[18px] border-t border-it-divider' />
                        <Bar className='h-4 w-48' />
                        <Bar className='mt-1 h-4 w-full max-w-[400px]' />
                        <Bar className='mt-1 h-4 w-40' />
                    </div>
                </div>
            </div>
        </>
    );
}
