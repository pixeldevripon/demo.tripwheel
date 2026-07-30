import { Bar } from './skeleton-bar';

/**
 * Placeholder for the streamed traveller account body. Mirrors the live band
 * structure (white header + surface content) and the real class strings, so
 * the page does not shift under the reader when the content lands.
 */
export function TravellerPageSkeleton() {
    return (
        <>
            <section className='bg-it-white pt-10 pb-8 md:pt-14 md:pb-10'>
                <div className='it-container'>
                    <div className='flex flex-wrap items-start justify-between gap-4'>
                        <div>
                            <Bar className='h-9 w-60' />
                            <Bar className='mt-3 h-4 w-80 max-w-full' />
                        </div>
                        <Bar className='h-5 w-56 shrink-0' />
                    </div>
                </div>
            </section>

            <section className='min-h-[480px] bg-it-surface pt-8 pb-16 md:min-h-[660px] md:pt-12 md:pb-24'>
                <div className='it-container flex flex-col gap-6'>
                    <div className='flex items-center gap-7 border-b border-it-heading/10 pb-3.5'>
                        <Bar className='h-5 w-24' />
                        <Bar className='h-5 w-24' />
                    </div>
                    <div className='flex flex-col gap-4'>
                        {[0, 1, 2].map(i => (
                            <div
                                key={i}
                                className='rounded-[16px] border border-it-heading/10 bg-it-white p-5 sm:p-6'>
                                <div className='flex items-start justify-between gap-4'>
                                    <div className='w-full'>
                                        <Bar className='h-6 w-40 rounded-full' />
                                        <Bar className='mt-3 h-6 w-2/5' />
                                        <Bar className='mt-2 h-4 w-3/5' />
                                    </div>
                                    <div className='shrink-0 text-right'>
                                        <Bar className='h-7 w-24' />
                                        <Bar className='mt-2 ml-auto h-4 w-28' />
                                    </div>
                                </div>
                                <div className='mt-5 flex gap-2.5'>
                                    <Bar className='h-10 w-36 rounded-full' />
                                    <Bar className='h-10 w-28 rounded-full' />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
