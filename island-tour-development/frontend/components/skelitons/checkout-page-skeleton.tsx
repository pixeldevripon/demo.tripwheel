import { Bar } from './skeleton-bar';

/**
 * Loading skeleton for the checkout page
 * (`/[locale]/[destination]/[slug]/checkout`). Mirrors the real layout 1:1 -
 * the phase back bar, the 116px step-indicator band, and the form + summary
 * grid (contact card left, booking summary right) with the exact containers,
 * paddings, and heights of `CheckoutClient` / `CheckoutForm` /
 * `CheckoutSummary` - so streaming in never shifts layout.
 *
 * Used as both the route `loading.tsx` shell and the `<Suspense>` fallback for
 * the searchParams-driven checkout body.
 */

/** One label + 50px input pair (mirrors `Field` / `SelectField`). */
function FieldSkeleton({ labelWidth = 'w-24' }: { labelWidth?: string }) {
    return (
        <div className='flex flex-col gap-2'>
            <Bar className={`h-[26px] ${labelWidth}`} />
            <Bar className='h-[50px] w-full rounded-[8px]' />
        </div>
    );
}

/** An icon + text detail row inside the summary card (mirrors `SummaryRow`). */
function SummaryRowSkeleton({ withValue = false }: { withValue?: boolean }) {
    return (
        <div className='flex items-center justify-between gap-2.5'>
            <div className='flex items-center gap-2.5'>
                <Bar className='size-6 rounded-full' />
                <Bar className='h-[26px] w-24' />
            </div>
            {withValue && <Bar className='h-[26px] w-12' />}
        </div>
    );
}

export function CheckoutPageSkeleton() {
    return (
        <div className='flex flex-col'>
            {/* Back bar */}
            <div className='border-b border-it-heading/10 bg-it-white'>
                <div className='mx-auto w-full max-w-360 px-4 py-5 md:px-8 xl:px-30'>
                    <div className='flex items-center gap-2'>
                        <Bar className='size-5 rounded-full' />
                        <Bar className='h-[22px] w-24' />
                    </div>
                </div>
            </div>

            {/* Step-indicator band */}
            <div className='mx-auto w-full max-w-360 px-4 py-5 md:px-8 xl:px-30'>
                <div className='relative flex w-fit items-start gap-[75px]'>
                    <div className='absolute inset-x-[21px] top-[21px] h-px bg-it-heading/10' />
                    <div className='flex flex-col items-center gap-2'>
                        <Bar className='size-[42px] rounded-full' />
                        <Bar className='h-[26px] w-16' />
                    </div>
                    <div className='flex flex-col items-center gap-2'>
                        <Bar className='size-[42px] rounded-full' />
                        <Bar className='h-[26px] w-16' />
                    </div>
                </div>
            </div>

            {/* Form (left) + summary (right) grid */}
            <div className='it-container'>
                <div className='flex flex-col gap-8 lg:grid lg:grid-cols-[792fr_384fr] lg:items-start lg:gap-6'>
                    {/* Booking summary */}
                    <div className='lg:col-start-2 lg:row-start-1'>
                        <div className='flex flex-col gap-6 rounded-[16px] bg-it-surface p-4'>
                            <div className='flex flex-col gap-4'>
                                <div className='flex items-start justify-between gap-4'>
                                    <Bar className='h-[27px] w-40' />
                                    <Bar className='size-6 rounded-full' />
                                </div>
                                <div className='h-px w-full bg-it-heading/10' />
                            </div>
                            <div className='flex flex-col gap-3'>
                                <div className='flex items-center gap-4'>
                                    <Bar className='h-[76px] w-[112px] shrink-0 rounded-[8px]' />
                                    <div className='flex w-full flex-col gap-2'>
                                        <Bar className='h-[22px] w-full' />
                                        <Bar className='h-[22px] w-3/4' />
                                    </div>
                                </div>
                                <div className='flex flex-col gap-3.5 rounded-[8px] bg-it-white px-4 py-[26px]'>
                                    <SummaryRowSkeleton />
                                    <SummaryRowSkeleton />
                                    <SummaryRowSkeleton withValue />
                                    <SummaryRowSkeleton />
                                    <div className='h-px w-full bg-it-heading/10' />
                                    <div className='flex items-center gap-2'>
                                        <Bar className='size-5 rounded-full' />
                                        <Bar className='h-[26px] w-44' />
                                    </div>
                                    <div className='h-px w-full bg-it-heading/10' />
                                    <div className='flex flex-col gap-2'>
                                        {Array.from({ length: 3 }).map(
                                            (_, i) => (
                                                <div
                                                    key={i}
                                                    className='flex items-center justify-between gap-1'>
                                                    <Bar className='h-[26px] w-24' />
                                                    <Bar className='h-[26px] w-12' />
                                                </div>
                                            )
                                        )}
                                        <Bar className='h-[26px] w-48' />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact card */}
                    <div className='min-w-0 lg:col-start-1 lg:row-start-1'>
                        <div className='rounded-[16px] border border-it-heading/10 bg-it-white p-6'>
                            <div className='flex flex-col gap-8'>
                                <Bar className='h-[29px] w-44' />
                                <div className='flex flex-col gap-12'>
                                    <div className='flex flex-col gap-4'>
                                        <FieldSkeleton labelWidth='w-24' />
                                        <div className='flex flex-col gap-2'>
                                            <FieldSkeleton labelWidth='w-32' />
                                            <Bar className='h-[26px] w-72 max-w-full' />
                                        </div>
                                        <div className='flex flex-col gap-2'>
                                            <div className='flex flex-col gap-4 sm:flex-row sm:gap-2'>
                                                <div className='flex-1'>
                                                    <FieldSkeleton labelWidth='w-20' />
                                                </div>
                                                <div className='flex-1'>
                                                    <FieldSkeleton labelWidth='w-28' />
                                                </div>
                                            </div>
                                            <Bar className='h-[26px] w-80 max-w-full' />
                                        </div>
                                        <FieldSkeleton labelWidth='w-36' />
                                        <div className='flex flex-col gap-2'>
                                            <Bar className='h-[26px] w-48' />
                                            <Bar className='h-[95px] w-full rounded-[8px]' />
                                            <Bar className='h-[26px] w-36' />
                                        </div>
                                    </div>
                                    <Bar className='h-[72px] w-full rounded-[6px]' />
                                </div>
                            </div>
                            <div className='-mx-6 mt-14 h-px bg-it-heading/10' />
                            <div className='mt-10 flex items-center justify-between gap-4'>
                                <Bar className='h-[29px] w-28' />
                                <Bar className='h-[26px] w-40' />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
