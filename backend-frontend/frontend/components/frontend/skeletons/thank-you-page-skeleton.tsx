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
function SummaryRowSkeleton() {
    return (
        // Unstriped, like the real card - no divider, 24px glyph, 7px rhythm.
        <div className='flex items-center justify-between gap-[18px] py-[7px]'>
            <span className='flex items-center gap-2.5'>
                <Bar className='size-5 rounded-full' />
                <Bar className='h-5 w-24' />
            </span>
            <Bar className='h-5 w-36' />
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
            <div className='it-container flex flex-col'>
                <Bar className='mb-8 h-8 w-72 md:h-10' />
                <div className='grid gap-2 md:grid-cols-2 md:gap-6'>
                    {[9, 6].map((rows, card) => (
                        <div
                            key={card}
                            className='h-full rounded-[16px] bg-it-white p-5 md:p-6'>
                            <Bar className='mb-4 h-5 w-32' />
                            <div className='flex flex-col'>
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
            {/* Hero - 1:1 with `ThankYouHero` (Figma 47745:10745). The meta
                line it used to hold is gone with the real one; those facts live
                in the detail cards below. */}
            <div className='bg-it-white pt-12 pb-14 md:pt-[85px] md:pb-[116px]'>
                <div className='it-container flex flex-col items-center'>
                    <Bar className='size-11 rounded-full md:size-12' />
                    <Bar className='mt-8 h-8 w-72 md:h-[46px] md:w-[440px]' />
                    <Bar className='mt-1 h-6 w-64 md:w-[460px]' />
                    <Bar className='mt-8 h-[42px] w-[300px] rounded-[8px]' />
                    <Bar className='mt-14 h-[56px] w-[226px] rounded-[50px]' />
                    <div className='mt-8 flex flex-col items-center gap-1'>
                        <Bar className='h-6 w-[364px] max-w-full' />
                        <Bar className='h-6 w-[300px] max-w-full' />
                    </div>
                </div>
            </div>
            {/* Booking summary */}
            <ThankYouSummarySkeleton />
            {/* What happens next - 1:1 with `ThankYouNextSteps` (Figma
                47745:11792): a 64px circle over a bullet list per column, with
                one hairline behind the circle row. The step CARDS are gone. */}
            <div className='bg-it-white pt-14 pb-2'>
                <div className='it-container flex flex-col gap-10 md:gap-12'>
                    <Bar className='mx-auto h-8 w-64 md:h-12 md:w-80' />
                    <div className='relative grid gap-10 md:grid-cols-3 md:gap-6'>
                        <span className='absolute top-6 right-1/6 left-1/6 hidden h-px bg-it-divider md:block' />
                        {Array.from({ length: 3 }, (_, i) => (
                            <div
                                key={i}
                                className='flex flex-col items-center gap-6 md:gap-8'>
                                <Bar className='size-11 rounded-full md:size-12' />
                                <div className='flex flex-col gap-1.5'>
                                    <Bar className='h-5 w-44' />
                                    <Bar className='h-5 w-40' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Related tours */}
            <div className='bg-it-white pt-14'>
                <div className='it-container flex flex-col'>
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
            {/* Apartment promo - `pb-14` matches the real section, so the
                last card clears the grey support band below it. */}
            <div className='bg-it-white pt-12 pb-14'>
                <div className='it-container'>
                    {/* 1:1 with `AptCard`: even 50/50, photo flush to the edge. */}
                    <div className='grid items-stretch overflow-hidden rounded-[16px] border border-it-divider bg-it-white md:grid-cols-2'>
                        <Bar className='aspect-[16/10] w-full rounded-none md:aspect-auto md:min-h-[280px]' />
                        <div className='flex flex-col items-start justify-center gap-2 p-6 md:p-8'>
                            <Bar className='h-4 w-48' />
                            <Bar className='h-7 w-64 md:h-8' />
                            <Bar className='h-5 w-72 max-w-full' />
                            <Bar className='h-5 w-56' />
                            <Bar className='mt-2 h-11 w-56 rounded-[50px]' />
                        </div>
                    </div>
                </div>
            </div>
            {/* Support panel - 1:1 with `ThankYouQuestion` (Figma
                47745:12376): full width, split down the middle. */}
            <div className='bg-it-surface pt-14 pb-[72px]'>
                <div className='it-container flex flex-col gap-8 md:gap-12'>
                    <Bar className='h-8 w-72 md:h-12 md:w-[520px]' />
                    <div className='grid overflow-hidden rounded-[16px] bg-it-white md:grid-cols-2'>
                        {Array.from({ length: 2 }, (_, i) => (
                            <div
                                key={i}
                                className={`flex flex-col gap-5 border-it-divider p-6 md:gap-7 md:p-8 ${
                                    i === 1
                                        ? 'max-md:border-t md:border-l'
                                        : ''
                                }`}>
                                <Bar className='h-7 w-64 max-w-full' />
                                <div className='flex flex-col gap-3'>
                                    <Bar className='h-5 w-40' />
                                    <Bar className='h-5 w-60 max-w-full' />
                                    <Bar className='h-5 w-44' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
