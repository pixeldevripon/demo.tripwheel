import { Bar } from './skeleton-bar';

/**
 * Placeholder for the streamed receipt document. Mirrors the live page's
 * EXACT frame classes (same section padding, same 780px card, same border
 * rhythm between head / meta / line items / totals / notes), so the document
 * materialises in place instead of the layout re-arranging when it lands.
 */
export function TravellerReceiptSkeleton() {
    return (
        <section className='bg-it-surface py-10 md:py-14'>
            <div className='mx-auto w-full max-w-[780px] px-4'>
                <div className='rounded-[16px] border border-it-heading/10 bg-it-white p-7 sm:p-10'>
                    {/* Document head: logo | RECEIPT + number + date */}
                    <div className='flex flex-wrap items-start justify-between gap-6'>
                        <Bar className='h-10 w-24' />
                        <div className='flex flex-col items-end'>
                            <Bar className='h-6 w-36' />
                            <Bar className='mt-2 h-3.5 w-44' />
                            <Bar className='mt-1.5 h-3.5 w-28' />
                        </div>
                    </div>

                    {/* Meta grid: issued to | the booking */}
                    <div className='mt-9 grid gap-8 border-t border-it-heading/10 pt-7 sm:grid-cols-2'>
                        <div>
                            <Bar className='h-3 w-20' />
                            <Bar className='mt-2.5 h-4 w-40' />
                            <Bar className='mt-1.5 h-3.5 w-28' />
                        </div>
                        <div className='flex flex-col sm:items-end'>
                            <Bar className='h-3 w-16' />
                            <Bar className='mt-2.5 h-4 w-56 max-w-full' />
                            <Bar className='mt-1.5 h-3.5 w-44' />
                            <Bar className='mt-1 h-3.5 w-36' />
                            <Bar className='mt-1 h-3.5 w-28' />
                        </div>
                    </div>

                    {/* Line items: header row + three item rows */}
                    <div className='mt-9'>
                        <div className='flex items-center justify-between gap-4 border-b-[1.5px] border-it-heading/60 pb-2'>
                            <Bar className='h-3 w-24' />
                            <div className='flex items-center gap-8'>
                                <Bar className='h-3 w-8' />
                                <Bar className='h-3 w-16' />
                                <Bar className='h-3 w-16' />
                            </div>
                        </div>
                        {[0, 1, 2].map(i => (
                            <div
                                key={i}
                                className='flex items-center justify-between gap-4 border-b border-it-heading/10 py-3'>
                                <Bar className='h-4 w-44 max-w-[40%]' />
                                <div className='flex items-center gap-8'>
                                    <Bar className='h-3.5 w-6' />
                                    <Bar className='h-3.5 w-16' />
                                    <Bar className='h-3.5 w-16' />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Totals block, right-aligned like the live document */}
                    <div className='mt-5 ml-auto w-full max-w-[320px]'>
                        {[0, 1].map(i => (
                            <div
                                key={i}
                                className='flex items-center justify-between gap-6 py-1'>
                                <Bar className='h-3.5 w-24' />
                                <Bar className='h-3.5 w-20' />
                            </div>
                        ))}
                        <div className='mt-2.5 flex items-center justify-between gap-6 border-t-[1.5px] border-it-heading/60 pt-2.5'>
                            <Bar className='h-3.5 w-28' />
                            <Bar className='h-8 w-32' />
                        </div>
                        <Bar className='mt-2 ml-auto h-3 w-40' />
                    </div>

                    {/* Notes */}
                    <div className='mt-9 border-t border-it-heading/10 pt-5'>
                        <Bar className='h-3 w-full max-w-[520px]' />
                        <Bar className='mt-2 h-3 w-3/5' />
                    </div>
                </div>

                {/* Back link | Print button row under the card */}
                <div className='mt-5 flex flex-wrap items-center justify-between gap-3'>
                    <Bar className='h-4 w-32' />
                    <Bar className='h-10 w-40 rounded-full' />
                </div>
            </div>
        </section>
    );
}
