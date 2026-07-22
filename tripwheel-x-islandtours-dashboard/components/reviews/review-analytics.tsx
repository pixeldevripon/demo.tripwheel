'use client';

import { useQuery } from '@tanstack/react-query';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';
import { reviewAnalyticsApi } from '@/lib/api/reviews';
import { useRole } from '@/contexts/role-context';

/**
 * DASH-9 - review analytics.
 *
 * Scope is decided SERVER-side by the caller's role: an operator sees only its
 * own tours, a platform role sees everything (and gets `eligibility: null`,
 * having no single operator to report). Nothing here filters client-side -
 * scoping on the client would be a suggestion, not a rule.
 *
 * ## The two series are deliberately different questions
 * **Rating trend** is quality over time. **Velocity** is how many reviews
 * arrived - and it charts `created`, not `approved`, because approval latency
 * is ours rather than the traveller's: charting approvals would make a
 * moderation backlog look like a collapse in review volume.
 */

const trendConfig = {
    avgRating: { label: 'Average rating', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const velocityConfig = {
    created: { label: 'Reviews submitted', color: 'var(--chart-2)' },
} satisfies ChartConfig;

/** `2026-03-01` -> `Mar 26`, so a 12-bucket axis stays readable. */
function periodLabel(period: string): string {
    const d = new Date(`${period}T00:00:00Z`);
    return Number.isNaN(d.getTime())
        ? period
        : d.toLocaleDateString(undefined, {
              month: 'short',
              year: '2-digit',
              timeZone: 'UTC',
          });
}

function EmptyChart({ message }: { message: string }) {
    return (
        <div className='flex h-[220px] items-center justify-center text-sm text-muted-foreground'>
            {message}
        </div>
    );
}

export function ReviewAnalytics() {
    const { can } = useRole();
    const enabled = can('VIEW_ANALYTICS');

    const { data, isLoading } = useQuery({
        queryKey: ['reviews', 'analytics'],
        queryFn: () => reviewAnalyticsApi.get(),
        enabled,
        staleTime: 5 * 60_000,
    });

    // Not an error state: a role without VIEW_ANALYTICS simply has no analytics
    // section, the same way gated actions are absent rather than disabled.
    if (!enabled) return null;

    if (isLoading) {
        return (
            <div className='grid gap-4 lg:grid-cols-2'>
                <Skeleton className='h-[300px]' />
                <Skeleton className='h-[300px]' />
            </div>
        );
    }
    if (!data) return null;

    const chartData = data.trend.map((t) => ({ ...t, label: periodLabel(t.period) }));
    const hasTrend = chartData.some((t) => t.avgRating !== null);

    return (
        <div className='space-y-4'>
            <div className='grid gap-4 lg:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle className='font-heading text-lg font-semibold tracking-wider uppercase'>
                            Rating trend
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {hasTrend ? (
                            <ChartContainer config={trendConfig} className='h-[220px] w-full'>
                                <AreaChart data={chartData}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey='label'
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                    />
                                    {/* Fixed 1-5 domain: an auto domain over 4.5-4.8
                                        turns normal variation into a dramatic cliff. */}
                                    <YAxis
                                        domain={[1, 5]}
                                        ticks={[1, 2, 3, 4, 5]}
                                        tickLine={false}
                                        axisLine={false}
                                        width={24}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Area
                                        dataKey='avgRating'
                                        type='monotone'
                                        stroke='var(--color-avgRating)'
                                        fill='var(--color-avgRating)'
                                        fillOpacity={0.15}
                                        connectNulls
                                    />
                                </AreaChart>
                            </ChartContainer>
                        ) : (
                            <EmptyChart message='No approved reviews in this period yet.' />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className='font-heading text-lg font-semibold tracking-wider uppercase'>
                            Review velocity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {chartData.length > 0 ? (
                            <ChartContainer
                                config={velocityConfig}
                                className='h-[220px] w-full'>
                                <BarChart data={chartData}>
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey='label'
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                    />
                                    <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        width={28}
                                        allowDecimals={false}
                                    />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Bar
                                        dataKey='created'
                                        fill='var(--color-created)'
                                        radius={4}
                                    />
                                </BarChart>
                            </ChartContainer>
                        ) : (
                            <EmptyChart message='No reviews submitted in this period.' />
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className='grid gap-4 lg:grid-cols-2'>
                <Card>
                    <CardHeader>
                        <CardTitle className='font-heading text-lg font-semibold tracking-wider uppercase'>
                            What guests mention
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.themes.length > 0 ? (
                            <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                {data.themes.map((t) => (
                                    <li key={t.tag} className='flex items-center gap-3'>
                                        <span className='w-40 shrink-0 truncate text-sm'>
                                            {t.tag}
                                        </span>
                                        {/* The shared Progress primitive rather
                                            than a hand-rolled bar: it already
                                            routes the runtime width through a
                                            CSS custom property, which is what
                                            03 §8.3 requires. Scaled against the
                                            TOP theme so the leader fills the
                                            row and the rest read relative to it. */}
                                        <Progress
                                            value={
                                                data.themes[0].count
                                                    ? (t.count / data.themes[0].count) *
                                                      100
                                                    : 0
                                            }
                                            className='h-2 flex-1'
                                        />
                                        <span className='w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground'>
                                            {t.count}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <EmptyChart message='No theme tags applied yet.' />
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className='font-heading text-lg font-semibold tracking-wider uppercase'>
                            Queue and standing
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='grid grid-cols-4 gap-3'>
                            {(
                                [
                                    ['Pending', data.moderation.pending],
                                    ['Approved', data.moderation.approved],
                                    ['Held', data.moderation.held],
                                    ['Rejected', data.moderation.rejected],
                                ] as const
                            ).map(([label, value]) => (
                                <div key={label} className='rounded-md border p-3'>
                                    <div className='text-xl font-semibold tabular-nums'>
                                        {value}
                                    </div>
                                    <div className='text-xs text-muted-foreground'>
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Eligibility is the operator's own standing, so it is
                            absent for a platform-wide caller rather than shown
                            as zeroes - there is no single operator to report. */}
                        {data.eligibility && (
                            <div className='space-y-1 border-t pt-3 text-sm'>
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>
                                        Operator rating
                                    </span>
                                    <span className='tabular-nums'>
                                        {data.eligibility.aggregateRating ?? '—'} (
                                        {data.eligibility.aggregateReviewCount})
                                    </span>
                                </div>
                                <div className='flex justify-between'>
                                    <span className='text-muted-foreground'>
                                        Cancellation rate (90d)
                                    </span>
                                    <span className='tabular-nums'>
                                        {data.eligibility.cancellationRate90d}%
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
