import { Bar } from './skeleton-bar';

/**
 * Loading skeleton for the checkout page
 * (`/[locale]/[destination]/[slug]/checkout`). Mirrors the design v2 layout
 * 1:1 - the back row, then the 1fr/340px grid with the step indicator + the
 * accordion card on the left and the booking summary on the right, all
 * sharing one `it-container` - so streaming in never shifts layout.
 *
 * Used as both the route `loading.tsx` shell and the `<Suspense>` fallback for
 * the searchParams-driven checkout body.
 */

/** One label + 46px input pair (mirrors `Field` / `SelectField`). */
function FieldSkeleton({ labelWidth = 'w-24' }: { labelWidth?: string }) {
    return (
        <div className='flex flex-col gap-1.5'>
            <Bar className={`h-5 ${labelWidth}`} />
            <Bar className='h-[46px] w-full rounded-it-sm' />
        </div>
    );
}

/** An icon + text detail row inside the summary card (mirrors `SummaryRow`). */
function SummaryRowSkeleton({ withValue = false }: { withValue?: boolean }) {
    return (
        <div className='flex items-center justify-between gap-2.5'>
            <div className='flex items-center gap-2.5'>
                <Bar className='size-4 rounded-full' />
                <Bar className='h-5 w-28' />
            </div>
            {withValue && <Bar className='h-5 w-12' />}
        </div>
    );
}

export function CheckoutPageSkeleton() {
    return (
        <div className='it-container'>
            {/* Back row */}
            <div className='pt-3.5'>
                <div className='flex items-center gap-1.5'>
                    <Bar className='size-[15px] rounded-full' />
                    <Bar className='h-5 w-24' />
                </div>
            </div>

            {/* Form (left, steps above the card) + summary (right) grid */}
            <div className='grid items-start gap-4 pt-5 pb-14 lg:grid-cols-[1fr_340px] lg:gap-7'>
                <div className='min-w-0'>
                    {/* Step indicator */}
                    <div className='mb-[18px] flex items-center'>
                        <Bar className='size-[27px] rounded-full' />
                        <Bar className='ml-2 h-5 w-16' />
                        <span className='mx-3 h-[1.5px] w-12 bg-it-divider' />
                        <Bar className='size-[27px] rounded-full' />
                        <Bar className='ml-2 h-5 w-16' />
                    </div>

                    {/* Accordion card */}
                    <div className='overflow-hidden rounded-it-lg border border-it-divider bg-it-white shadow-it-sm'>
                        <div className='flex items-center gap-3 px-[22px] py-[18px]'>
                            <Bar className='size-[26px] rounded-full' />
                            <Bar className='h-[22px] w-36' />
                        </div>
                        <div className='flex flex-col gap-4 px-[22px] pb-6 pt-0.5'>
                            <div className='flex flex-col gap-4 sm:flex-row sm:gap-3.5'>
                                <div className='flex-1'>
                                    <FieldSkeleton labelWidth='w-20' />
                                </div>
                                <div className='flex-1'>
                                    <FieldSkeleton labelWidth='w-20' />
                                </div>
                            </div>
                            <div className='flex flex-col gap-1.5'>
                                <FieldSkeleton labelWidth='w-28' />
                                <Bar className='h-4 w-56 max-w-full' />
                            </div>
                            <div className='flex flex-col gap-1.5'>
                                <div className='flex flex-col gap-4 sm:flex-row sm:gap-3.5'>
                                    <div className='flex-1'>
                                        <FieldSkeleton labelWidth='w-16' />
                                    </div>
                                    <div className='flex-1'>
                                        <FieldSkeleton labelWidth='w-28' />
                                    </div>
                                </div>
                                <Bar className='h-4 w-72 max-w-full' />
                            </div>
                            <FieldSkeleton labelWidth='w-32' />
                            <div className='flex flex-col gap-1.5'>
                                <Bar className='h-5 w-44' />
                                <Bar className='h-[70px] w-full rounded-it-sm' />
                                <Bar className='h-4 w-32' />
                            </div>
                            <Bar className='mt-1 h-[54px] w-full rounded-it-sm' />
                        </div>
                        <div className='flex items-center gap-3 border-t border-it-divider px-[22px] py-[18px]'>
                            <Bar className='size-[26px] rounded-full' />
                            <Bar className='h-[22px] w-24' />
                            <Bar className='ml-auto h-4 w-36' />
                        </div>
                    </div>
                </div>

                {/* Booking summary (sheet-first on mobile) */}
                <div className='max-lg:order-first'>
                    <div className='flex flex-col gap-4 rounded-it-lg border border-it-divider bg-it-white p-5 shadow-it-sm'>
                        <div className='flex flex-col gap-4'>
                            <div className='flex items-start justify-between gap-4'>
                                <Bar className='h-[22px] w-40' />
                                <Bar className='size-4 rounded-full' />
                            </div>
                            <div className='h-px w-full bg-it-divider' />
                        </div>
                        <div className='flex flex-col gap-3'>
                            <div className='flex items-center gap-4'>
                                <Bar className='size-[60px] shrink-0 rounded-it-sm' />
                                <div className='flex w-full flex-col gap-2'>
                                    <Bar className='h-4 w-full' />
                                    <Bar className='h-4 w-3/4' />
                                </div>
                            </div>
                            <div className='flex flex-col gap-2 border-t border-it-divider pt-3'>
                                <SummaryRowSkeleton />
                                <SummaryRowSkeleton />
                                <SummaryRowSkeleton withValue />
                                <SummaryRowSkeleton />
                                <div className='h-px w-full bg-it-divider' />
                                <div className='flex items-center gap-2'>
                                    <Bar className='size-4 rounded-full' />
                                    <Bar className='h-4 w-44' />
                                </div>
                                <div className='h-px w-full bg-it-divider' />
                                <div className='flex flex-col gap-2'>
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className='flex items-center justify-between gap-1'>
                                            <Bar className='h-5 w-24' />
                                            <Bar className='h-5 w-12' />
                                        </div>
                                    ))}
                                    <Bar className='h-4 w-48' />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
