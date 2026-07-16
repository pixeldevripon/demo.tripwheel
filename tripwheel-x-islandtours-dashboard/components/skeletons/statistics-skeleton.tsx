import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';

/**
 * Loading skeleton for the dashboard `Statistics` block. Mirrors the real
 * section layouts (stats grid + charts, recent activity, metrics) so the
 * stats area streams in behind a matching placeholder instead of a bare
 * "loading..." string. Honors `visibleSections` so it reserves only the
 * sections the user has enabled - matching what will actually render.
 */

/** A single shimmering placeholder block. */
function Shimmer({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-md bg-muted ${className ?? ''}`} />;
}

export function StatisticsSkeleton({
    visibleSections,
}: {
    visibleSections: Record<string, boolean>;
}) {
    return (
        <div className='mx-auto w-full space-y-6'>
            {/* Statistics overview: stat cards + charts. */}
            {visibleSections['statistics'] && (
                <>
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Card key={i} size='sm' className='gap-2 px-6 py-6'>
                                <CardHeader className='flex flex-row items-center justify-between space-y-0 px-0 pb-2'>
                                    <div className='flex items-center gap-2'>
                                        <Shimmer className='size-4' />
                                        <Shimmer className='h-4 w-24' />
                                    </div>
                                    <CardAction>
                                        <Shimmer className='h-4 w-12 rounded-full' />
                                    </CardAction>
                                </CardHeader>
                                <CardContent className='p-0'>
                                    <Shimmer className='h-8 w-28' />
                                </CardContent>
                                <CardFooter className='flex-col items-start gap-1 p-0'>
                                    <Shimmer className='h-3 w-32' />
                                    <Shimmer className='h-2.5 w-20' />
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Charts: tab bar + two chart cards. */}
                    <div className='space-y-4'>
                        <Shimmer className='h-9 w-full max-w-md rounded-lg' />
                        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
                            {Array.from({ length: 2 }).map((_, i) => (
                                <Card key={i}>
                                    <CardHeader>
                                        <Shimmer className='h-5 w-40' />
                                        <Shimmer className='mt-1.5 h-3.5 w-56 max-w-full' />
                                    </CardHeader>
                                    <CardContent>
                                        <Shimmer className='h-[250px] w-full' />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </>
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

            {/* Metrics: three-up insight cards. */}
            {visibleSections['matrics'] && (
                <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                    {Array.from({ length: 3 }).map((_, c) => (
                        <Card key={c}>
                            <CardHeader>
                                <Shimmer className='h-5 w-36' />
                            </CardHeader>
                            <CardContent className='space-y-3'>
                                {Array.from({ length: 4 }).map((_, r) => (
                                    <div
                                        key={r}
                                        className='flex items-center justify-between'>
                                        <Shimmer className='h-4 w-28' />
                                        <Shimmer className='h-4 w-10' />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
