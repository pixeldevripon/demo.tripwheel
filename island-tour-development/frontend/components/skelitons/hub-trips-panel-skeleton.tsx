import { Bar, HUB_GRID } from './skeleton-bar';
import { HubTourCardSkeleton } from './hub-tour-card-skeleton';

/**
 * Loading skeleton for the streamed hub trips/charters block (the `<Suspense>`
 * fallback for `HubTripsData` on `hub-page.tsx`). Mirrors `HubTripsSection`:
 * the `it-section bg-it-white` shell, the sticky tab row, and a panel (title +
 * subtitle + date pill) whose card grid uses the exact hub grid (`HUB_GRID`)
 * and `HubTourCardSkeleton`, so the real cards stream in with no layout shift.
 */
export function HubTripsPanelSkeleton() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                {/* Sticky tab row (mirrors HubTripsTabs: underline bar, not pills). */}
                <div className='flex overflow-hidden border-b border-it-heading/10'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className='-mb-px shrink-0 border-b-2 border-transparent px-5 py-4 md:px-7.5 md:py-5'>
                            <Bar className='h-6 w-20 md:h-8 md:w-24' />
                        </div>
                    ))}
                </div>

                {/* Panel: header (title + subtitle + date pill) + card grid. */}
                <div className='flex flex-col gap-6 pt-6 md:gap-10 md:pt-10'>
                    <div className='flex flex-col gap-4 md:gap-6'>
                        <div className='flex flex-col gap-1'>
                            <Bar className='h-6 w-2/3 max-w-md md:h-10' />
                            <Bar className='h-5 w-1/3 md:h-6' />
                        </div>
                        <Bar className='h-10 w-40 rounded-it-full md:h-12.5' />
                    </div>
                    <div className={HUB_GRID}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <HubTourCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
