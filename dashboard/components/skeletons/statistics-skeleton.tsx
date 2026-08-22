import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';

/**
 * Loading skeleton for the dashboard `Statistics` block. Mirrors the real
 * section layouts (KPI grid + tabbed charts, the payment/customer row, recent
 * activity) so the stats area streams in behind a matching placeholder instead
 * of a bare "loading..." string. Honors `visibleSections` so it reserves only
 * the sections the user has enabled - matching what will actually render, and
 * in the same order, so nothing jumps when the real content arrives.
 */

/** A single shimmering placeholder block. */
function Shimmer({ className }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-md bg-muted ${className ?? ''}`}
        />
    );
}

export function StatisticsSkeleton({
    visibleSections,
}: {
    visibleSections: Record<string, boolean>;
}) {
    return (
        <div className='w-full space-y-8'>
            {/* KPI cards + tabbed charts. */}
            {visibleSections['statistics'] && (
                <>
                    {/* Eight role-shaped KPI cards. Mirrors the real anatomy:
                        tile + movement, then value, reserved USD slot, label,
                        and one supporting line. */}
                    <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4'>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Card key={i} size='sm' className='gap-3'>
                                <CardHeader className='flex flex-row items-center justify-between space-y-0 p-0'>
                                    <Shimmer className='size-8 rounded-md' />
                                    <CardAction>
                                        <Shimmer className='h-3.5 w-10' />
                                    </CardAction>
                                </CardHeader>
                                <CardContent className='p-0'>
                                    <Shimmer className='h-8 w-28' />
                                    <Shimmer className='mt-1 h-3 w-20' />
                                    <Shimmer className='mt-2 h-4 w-24' />
                                </CardContent>
                                <CardFooter className='p-0'>
                                    <Shimmer className='h-2.5 w-32' />
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Tab bar (with the scope + FX line riding alongside it)
                        and the two chart cards of the default tab. */}
                    <div className='space-y-6'>
                        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                            <Shimmer className='h-9 w-full max-w-2xl rounded-lg' />
                            <Shimmer className='h-4 w-52 max-w-full' />
                        </div>
                        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                            {Array.from({ length: 2 }).map((_, i) => (
                                <Card key={i}>
                                    <CardHeader>
                                        <Shimmer className='h-5 w-40' />
                                        <Shimmer className='mt-1.5 h-3.5 w-56 max-w-full' />
                                    </CardHeader>
                                    <CardContent>
                                        <Shimmer className='h-[260px] w-full' />
                                    </CardContent>
                                    <CardFooter className='flex-col items-start gap-2'>
                                        <Shimmer className='h-3.5 w-40' />
                                        <Shimmer className='h-3 w-32' />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Payment status donut + customer insight rows, one row 2-up. */}
            {visibleSections['matrics'] && (
                <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                    <Card>
                        <CardHeader>
                            <Shimmer className='h-5 w-36' />
                            <Shimmer className='mt-1.5 h-3.5 w-56 max-w-full' />
                        </CardHeader>
                        <CardContent className='flex items-center justify-center'>
                            <Shimmer className='aspect-square h-[280px] w-[280px] max-w-full rounded-full' />
                        </CardContent>
                        <CardFooter>
                            <Shimmer className='h-3 w-48 max-w-full' />
                        </CardFooter>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Shimmer className='h-5 w-36' />
                            <Shimmer className='mt-1.5 h-3.5 w-56 max-w-full' />
                        </CardHeader>
                        <CardContent className='space-y-4'>
                            {Array.from({ length: 5 }).map((_, r) => (
                                <div
                                    key={r}
                                    className='flex items-center justify-between'>
                                    <Shimmer className='h-4 w-28' />
                                    <Shimmer className='h-4 w-10' />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Recent activity: single card with a list of rows. */}
            {visibleSections['recent-activity'] && (
                <Card>
                    <CardHeader>
                        <Shimmer className='h-5 w-40' />
                        <Shimmer className='mt-1.5 h-3.5 w-64 max-w-full' />
                    </CardHeader>
                    <CardContent>
                        <div className='space-y-3'>
                            <Shimmer className='h-4 w-32' />
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='flex items-center gap-3 border-b border-border py-3 last:border-0'>
                                    <Shimmer className='size-10 shrink-0 rounded-lg' />
                                    <div className='flex flex-1 flex-col gap-1.5'>
                                        <Shimmer className='h-4 w-1/2' />
                                        <Shimmer className='h-3 w-1/3' />
                                    </div>
                                    <Shimmer className='h-4 w-16' />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
