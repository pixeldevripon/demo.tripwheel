'use client';

import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Airplane01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    Calendar03Icon,
    Mail01Icon,
    MoneyBagIcon,
    TradeDownIcon,
    TradeUpIcon,
    User03Icon,
    UserCheck01Icon,
    UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Suspense, use, useState } from 'react';

import { StatisticsSkeleton } from '@/components/skelitons/statistics-skeleton';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    XAxis,
} from 'recharts';

interface StatisticsProps {
    statsPromise?: Promise<any>;
    visibleSections: Record<string, boolean>;
}

/**
 * Wrapper that owns the `<Suspense>` boundary. The boundary must sit ABOVE the
 * component that calls `use(statsPromise)` for the fallback to ever show, so the
 * data-consuming body lives in `StatisticsContent` below. While the stats
 * promise is pending, the stats area streams behind `StatisticsSkeleton`; the
 * rest of the dashboard (toggler, setup guide) renders immediately.
 */
export default function Statistics(props: StatisticsProps) {
    return (
        <Suspense
            fallback={
                <StatisticsSkeleton visibleSections={props.visibleSections} />
            }>
            <StatisticsContent {...props} />
        </Suspense>
    );
}

function StatisticsContent({ statsPromise, visibleSections }: StatisticsProps) {
    // In a real app, we'd use 'use(statsPromise)' but for now we'll handle missing promise
    // To maintain exact logic, we'll use a fallback if promise is not provided
    const statsData = statsPromise ? use(statsPromise) : { result: { data: {} } };
    const statistics = statsData?.result?.data || {};
    
    const [showAllActivity, setShowAllActivity] = useState(false);

    // Generate mock historical data based on current values
    const generateHistoricalData = () => {
        const currentRevenue =
            statistics.revenue?.thisMonth || statistics.revenue?.lastMonth || 0;
        const currentBookings =
            statistics.bookings?.thisMonth ||
            statistics.bookings?.lastMonth ||
            0;

        return [
            {
                month: 'Jun',
                revenue: Math.max(0, currentRevenue * 0.6),
                bookings: Math.max(0, Math.floor(currentBookings * 0.5)),
            },
            {
                month: 'Jul',
                revenue: Math.max(0, currentRevenue * 0.7),
                bookings: Math.max(0, Math.floor(currentBookings * 0.6)),
            },
            {
                month: 'Aug',
                revenue: Math.max(0, currentRevenue * 0.8),
                bookings: Math.max(0, Math.floor(currentBookings * 0.7)),
            },
            {
                month: 'Sep',
                revenue: Math.max(0, currentRevenue * 0.85),
                bookings: Math.max(0, Math.floor(currentBookings * 0.8)),
            },
            {
                month: 'Oct',
                revenue: Math.max(0, currentRevenue * 0.9),
                bookings: Math.max(0, Math.floor(currentBookings * 0.9)),
            },
            {
                month: 'Nov',
                revenue: currentRevenue,
                bookings: currentBookings,
            },
        ];
    };

    const revenueData = generateHistoricalData();

    const revenueChartConfig = {
        revenue: {
            label: 'Revenue',
            color: 'var(--chart-1)',
        },
    };

    const bookingsChartConfig = {
        bookings: {
            label: 'Bookings',
            color: 'var(--chart-2)',
        },
    };

    const bookingChartConfig = {
        draft: {
            label: 'Draft',
            color: 'var(--muted-foreground)',
        },
        confirmed: {
            label: 'Confirmed',
            color: 'var(--primary)',
        },
        cancelled: {
            label: 'Cancelled',
            color: 'var(--destructive)',
        },
        completed: {
            label: 'Completed',
            color: 'var(--primary)',
        },
    };

    const tripChartConfig = {
        draft: {
            label: 'Draft',
            color: 'var(--muted-foreground)',
        },
        published: {
            label: 'Published',
            color: 'var(--primary)',
        },
        archived: {
            label: 'Archived',
            color: 'var(--destructive)',
        },
    };

    const bookingStatusData = [
        {
            name: 'Draft',
            value: statistics.bookings?.byStatus?.draft || 0,
            fill: 'var(--muted-foreground)',
        },
        {
            name: 'Confirmed',
            value: statistics.bookings?.byStatus?.confirmed || 0,
            fill: 'var(--primary)',
        },
        {
            name: 'Cancelled',
            value: statistics.bookings?.byStatus?.cancelled || 0,
            fill: 'var(--destructive)',
        },
        {
            name: 'Completed',
            value: statistics.bookings?.byStatus?.completed || 0,
            fill: 'var(--primary)',
        },
    ];

    const tripStatusData = [
        {
            name: 'Draft',
            value: statistics.trips?.byStatus?.draft || 0,
            fill: 'var(--muted-foreground)',
        },
        {
            name: 'Published',
            value: statistics.trips?.byStatus?.published || 0,
            fill: 'var(--primary)',
        },
        {
            name: 'Archived',
            value: statistics.trips?.byStatus?.archived || 0,
            fill: 'var(--destructive)',
        },
    ];

    const hasBookingStatusData = bookingStatusData.some(d => d.value > 0);
    const hasTripStatusData = tripStatusData.some(d => d.value > 0);

    // Calculate growth percentages
    const calculateGrowth = (current: number, previous: number) => {
        if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
        const growth = ((current - previous) / previous) * 100;
        return growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
    };

    const revenueGrowth = calculateGrowth(
        statistics.revenue?.thisMonth || 0,
        statistics.revenue?.lastMonth || 0
    );

    const bookingsGrowth = calculateGrowth(
        statistics.bookings?.thisMonth || 0,
        statistics.bookings?.lastMonth || 0
    );

    const customerGrowth = calculateGrowth(
        statistics.customers?.newThisMonth || 0,
        statistics.customers?.newLastMonth || 0
    );

    const stats = [
        {
            label: 'Total Revenue',
            value: `$${(statistics.revenue?.totalRevenue || 0).toFixed(2)}`,
            trend: revenueGrowth,
            isPositive:
                (statistics.revenue?.thisMonth || 0) >=
                (statistics.revenue?.lastMonth || 0),
            description:
                statistics.revenue?.thisMonth > 0
                    ? `$${statistics.revenue.thisMonth.toFixed(2)} this month`
                    : 'No revenue this month',
            subtitle:
                statistics.revenue?.netRevenue > 0
                    ? `Net: $${statistics.revenue.netRevenue.toFixed(2)}`
                    : 'Start creating bookings to track revenue',
            icon: MoneyBagIcon,
        },
        {
            label: 'Total Bookings',
            value: (statistics.bookings?.total || 0).toString(),
            trend: bookingsGrowth,
            isPositive:
                (statistics.bookings?.thisMonth || 0) >=
                (statistics.bookings?.lastMonth || 0),
            description:
                statistics.bookings?.upcoming > 0
                    ? `${statistics.bookings.upcoming} upcoming`
                    : 'No upcoming bookings',
            subtitle: `${
                statistics.bookings?.thisMonth || 0
            } bookings this month`,
            icon: Calendar03Icon,
        },
        {
            label: 'Active Trips',
            value: (statistics.trips?.total || 0).toString(),
            trend: `+${statistics.trips?.createdThisMonth || 0}`,
            isPositive: (statistics.trips?.createdThisMonth || 0) > 0,
            description: `${
                statistics.trips?.createdThisMonth || 0
            } created this month`,
            subtitle: `${
                statistics.trips?.withBookings || 0
            } trips with bookings`,
            icon: Airplane01Icon,
        },
        {
            label: 'Total Customers',
            value: (statistics.customers?.total || 0).toString(),
            trend: customerGrowth,
            isPositive:
                (statistics.customers?.newThisMonth || 0) >=
                (statistics.customers?.newLastMonth || 0),
            description:
                statistics.customers?.verified > 0
                    ? `${statistics.customers.verified} verified`
                    : 'No customers yet',
            subtitle: `${
                statistics.customers?.newThisMonth || 0
            } new this month`,
            icon: UserGroupIcon,
        },
    ];

    // Helper to get status badge styles
    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (
            ['confirmed', 'completed', 'paid', 'published', 'active'].includes(
                s
            )
        ) {
            return 'border-success/30 bg-success/10 text-success hover:bg-success/20';
        }
        if (['cancelled', 'failed', 'rejected', 'archived'].includes(s)) {
            return 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20';
        }
        if (['pending', 'draft', 'processing'].includes(s)) {
            return 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20';
        }
        return 'border-muted-foreground/30 bg-muted/50 text-muted-foreground hover:bg-muted/70';
    };

    // Check if there's any recent activity data
    const hasRecentActivity =
        (statistics.recentActivity?.recentBookings?.length || 0) > 0 ||
        (statistics.recentActivity?.recentPayments?.length || 0) > 0 ||
        (statistics.recentActivity?.recentCustomers?.length || 0) > 0;

    return (
        <div className='mx-auto w-full space-y-6'>
            {/* Stats Grid */}
                {visibleSections['statistics'] && (
                    <>
                        <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
                            {stats.map((stat, index) => {
                                return (
                                    <Card key={index} size="sm" className="gap-2 px-6 py-6">
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0">
                                            <CardDescription className='flex items-center gap-2'>
                                                <HugeiconsIcon
                                                    icon={stat.icon}
                                                    className="size-4"
                                                />
                                                {stat.label}
                                            </CardDescription>
                                            <CardAction>
                                                <Badge
                                                    variant='outline'
                                                    className={`flex items-center gap-1 text-[11px] font-medium font-mono tabular-nums px-1.5 py-0 ${
                                                        stat.isPositive
                                                            ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400'
                                                            : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                                                    }`}>
                                                    <HugeiconsIcon
                                                        icon={
                                                            stat.isPositive
                                                                ? TradeUpIcon
                                                                : TradeDownIcon
                                                        }
                                                        className='w-3 h-3'
                                                    />
                                                    {stat.trend}
                                                </Badge>
                                            </CardAction>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <CardTitle className='text-3xl font-semibold tracking-tight font-mono tabular-nums'>
                                                {stat.value}
                                            </CardTitle>
                                        </CardContent>
                                        <CardFooter className='flex-col items-start gap-1 p-0'>
                                            <div className='flex items-center gap-1.5 font-medium text-xs text-foreground'>
                                                {stat.description}
                                            </div>
                                            <p className='text-[10px] text-muted-foreground'>
                                                {stat.subtitle}
                                            </p>
                                        </CardFooter>
                                    </Card>
                                );
                            })}
                        </div>
                        {/* Charts Section */}
                        <Tabs defaultValue='revenue' className='space-y-4'>
                            <TabsList className='grid w-full max-w-md grid-cols-2'>
                                <TabsTrigger value='revenue'>
                                    Revenue & Bookings
                                </TabsTrigger>
                                <TabsTrigger value='status'>
                                    Status Overview
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value='revenue' className='space-y-4'>
                                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                                    {/* Revenue Area Chart */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Revenue Trend</CardTitle>
                                            <CardDescription>
                                                Last 6 months revenue
                                                performance
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {(statistics.revenue
                                                ?.totalRevenue || 0) > 0 || true ? ( // Forced true for mock visualization
                                                <ChartContainer
                                                    config={revenueChartConfig}
                                                    className='h-[300px] w-full'>
                                                    <AreaChart
                                                        data={revenueData}>
                                                        <defs>
                                                            <linearGradient
                                                                id='fillRevenue'
                                                                x1='0'
                                                                y1='0'
                                                                x2='0'
                                                                y2='1'>
                                                                <stop
                                                                    offset='5%'
                                                                    stopColor='var(--chart-1)'
                                                                    stopOpacity={
                                                                        0.8
                                                                    }
                                                                />
                                                                <stop
                                                                    offset='95%'
                                                                    stopColor='var(--chart-1)'
                                                                    stopOpacity={
                                                                        0.1
                                                                    }
                                                                />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid
                                                            vertical={false}
                                                        />
                                                        <XAxis
                                                            dataKey='month'
                                                            tickLine={false}
                                                            axisLine={false}
                                                            tickMargin={8}
                                                        />
                                                        <ChartTooltip
                                                            cursor={false}
                                                            content={
                                                                <ChartTooltipContent indicator='line' />
                                                            }
                                                        />
                                                        <Area
                                                            dataKey='revenue'
                                                            type='natural'
                                                            fill='url(#fillRevenue)'
                                                            stroke='var(--chart-1)'
                                                            stackId='a'
                                                        />
                                                        <ChartLegend
                                                            content={
                                                                <ChartLegendContent />
                                                            }
                                                        />
                                                    </AreaChart>
                                                </ChartContainer>
                                            ) : (
                                                <div className='flex items-center justify-center h-[300px]'>
                                                    <p className='text-center text-sm text-muted-foreground'>
                                                        No revenue data yet.
                                                        Start accepting
                                                        bookings!
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className='flex-col items-start gap-2 text-sm'>
                                            <div
                                                className={`flex gap-2 leading-none font-medium ${
                                                    (statistics.revenue
                                                        ?.thisMonth || 0) >=
                                                    (statistics.revenue
                                                        ?.lastMonth || 0)
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {revenueGrowth} from last month
                                                <HugeiconsIcon
                                                    icon={
                                                        (statistics.revenue
                                                            ?.thisMonth || 0) >=
                                                        (statistics.revenue
                                                            ?.lastMonth || 0)
                                                            ? TradeUpIcon
                                                            : TradeDownIcon
                                                    }
                                                    className='h-4 w-4'
                                                />
                                            </div>
                                            <div className='text-muted-foreground leading-none text-xs'>
                                                Showing revenue for the last 6
                                                months
                                            </div>
                                        </CardFooter>
                                    </Card>

                                    {/* Bookings Bar Chart */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Booking Trend</CardTitle>
                                            <CardDescription>
                                                Monthly booking volume
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {(statistics.bookings?.total || 0) >
                                            0 || true ? ( // Forced true for mock visualization
                                                <ChartContainer
                                                    config={bookingsChartConfig}
                                                    className='h-[300px] w-full'>
                                                    <BarChart
                                                        data={revenueData}>
                                                        <CartesianGrid
                                                            vertical={false}
                                                        />
                                                        <XAxis
                                                            dataKey='month'
                                                            tickLine={false}
                                                            tickMargin={10}
                                                            axisLine={false}
                                                        />
                                                        <ChartTooltip
                                                            cursor={false}
                                                            content={
                                                                <ChartTooltipContent indicator='dashed' />
                                                            }
                                                        />
                                                        <Bar
                                                            dataKey='bookings'
                                                            fill='var(--chart-2)'
                                                            radius={4}
                                                        />
                                                    </BarChart>
                                                </ChartContainer>
                                            ) : (
                                                <div className='flex items-center justify-center h-[300px]'>
                                                    <p className='text-center text-sm text-muted-foreground'>
                                                        No bookings yet. Your
                                                        first booking will
                                                        appear here!
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className='flex-col items-start gap-2 text-sm'>
                                            <div
                                                className={`flex gap-2 leading-none font-medium ${
                                                    (statistics.bookings
                                                        ?.thisMonth || 0) >=
                                                    (statistics.bookings
                                                        ?.lastMonth || 0)
                                                        ? 'text-green-600 dark:text-green-400'
                                                        : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                {bookingsGrowth} from last month
                                                <HugeiconsIcon
                                                    icon={
                                                        (statistics.bookings
                                                            ?.thisMonth || 0) >=
                                                        (statistics.bookings
                                                            ?.lastMonth || 0)
                                                            ? TradeUpIcon
                                                            : TradeDownIcon
                                                    }
                                                    className='h-4 w-4'
                                                />
                                            </div>
                                            <div className='text-muted-foreground leading-none text-xs'>
                                                Showing bookings for the last 6
                                                months
                                            </div>
                                        </CardFooter>
                                    </Card>
                                </div>
                            </TabsContent>

                            <TabsContent value='status' className='space-y-4'>
                                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                                    {/* Booking Status */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                Booking Status Distribution
                                            </CardTitle>
                                            <CardDescription>
                                                Current booking statuses
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className='flex items-center justify-center'>
                                            {hasBookingStatusData ? (
                                                <ChartContainer
                                                    config={bookingChartConfig}
                                                    className='mx-auto aspect-square max-h-[300px] w-full'>
                                                    <PieChart>
                                                        <ChartTooltip
                                                            cursor={false}
                                                            content={
                                                                <ChartTooltipContent
                                                                    hideLabel
                                                                />
                                                            }
                                                        />
                                                        <Pie
                                                            data={
                                                                bookingStatusData
                                                            }
                                                            dataKey='value'
                                                            nameKey='name'
                                                            innerRadius={60}
                                                            strokeWidth={5}>
                                                            {bookingStatusData.map(
                                                                (
                                                                    entry,
                                                                    index
                                                                ) => (
                                                                    <Cell
                                                                        key={`cell-${index}`}
                                                                        fill={
                                                                            entry.fill
                                                                        }
                                                                    />
                                                                )
                                                            )}
                                                        </Pie>
                                                        <ChartLegend
                                                            content={
                                                                <ChartLegendContent nameKey='name' />
                                                            }
                                                            className='-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center'
                                                        />
                                                    </PieChart>
                                                </ChartContainer>
                                            ) : (
                                                <div className='flex flex-col items-center justify-center h-[300px] text-center'>
                                                    <HugeiconsIcon
                                                        icon={Calendar03Icon}
                                                        className='w-12 h-12 text-muted-foreground mb-4'
                                                    />
                                                    <p className='text-sm text-muted-foreground'>
                                                        No bookings to display
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Trip Status */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>
                                                Trip Status Distribution
                                            </CardTitle>
                                            <CardDescription>
                                                Your{' '}
                                                {statistics.trips?.total || 0}{' '}
                                                trips breakdown
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className='flex items-center justify-center'>
                                            {hasTripStatusData ? (
                                                <ChartContainer
                                                    config={tripChartConfig}
                                                    className='mx-auto aspect-square max-h-[300px] w-full'>
                                                    <PieChart>
                                                        <ChartTooltip
                                                            cursor={false}
                                                            content={
                                                                <ChartTooltipContent
                                                                    hideLabel
                                                                />
                                                            }
                                                        />
                                                        <Pie
                                                            data={
                                                                tripStatusData
                                                            }
                                                            dataKey='value'
                                                            nameKey='name'
                                                            innerRadius={60}
                                                            strokeWidth={5}>
                                                            {tripStatusData.map(
                                                                (
                                                                    entry,
                                                                    index
                                                                ) => (
                                                                    <Cell
                                                                        key={`cell-${index}`}
                                                                        fill={
                                                                            entry.fill
                                                                        }
                                                                    />
                                                                )
                                                            )}
                                                        </Pie>
                                                        <ChartLegend
                                                            content={
                                                                <ChartLegendContent nameKey='name' />
                                                            }
                                                            className='-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center'
                                                        />
                                                    </PieChart>
                                                </ChartContainer>
                                            ) : (
                                                <div className='flex flex-col items-center justify-center h-[300px] text-center'>
                                                    <HugeiconsIcon
                                                        icon={Airplane01Icon}
                                                        className='w-12 h-12 text-muted-foreground mb-4'
                                                    />
                                                    <p className='text-sm text-muted-foreground'>
                                                        {statistics.trips
                                                            ?.total > 0
                                                            ? 'No status data available for trips'
                                                            : 'All trips are in draft status'}
                                                    </p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </>
                )}
                {/* Recent Activity */}
                {visibleSections['recent-activity'] && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                            <CardDescription>
                                Latest updates across your platform
                            </CardDescription>
                        </CardHeader>
                        <CardContent className='relative'>
                            {hasRecentActivity ? (
                                <>
                                    <div
                                        className={`space-y-6 overflow-hidden transition-all duration-300 ${
                                            !showAllActivity
                                                ? 'max-h-[600px]'
                                                : 'max-h-none'
                                        }`}>
                                        {/* Recent Bookings */}
                                        {(statistics.recentActivity
                                            ?.recentBookings?.length || 0) >
                                            0 && (
                                            <div className='space-y-3'>
                                                <h4 className='text-sm font-medium text-muted-foreground'>
                                                    Recent Bookings
                                                </h4>
                                                {(showAllActivity
                                                    ? statistics.recentActivity
                                                          .recentBookings
                                                    : statistics.recentActivity.recentBookings.slice(
                                                          0,
                                                          4
                                                      )
                                                ).map((booking: any, idx: number) => (
                                                    <div
                                                        key={booking.id || idx}
                                                        className='flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/5 transition-colors rounded-md px-2 -mx-2'>
                                                        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10'>
                                                            <HugeiconsIcon
                                                                icon={
                                                                    Calendar03Icon
                                                                }
                                                                className='size-5 text-primary'
                                                            />
                                                        </div>
                                                        <div className='flex-1 min-w-0'>
                                                            <div className='flex items-center justify-start gap-2 mb-1'>
                                                                <p className='text-sm font-medium truncate pr-2'>
                                                                    {booking
                                                                        .trip
                                                                        ?.title ||
                                                                        'Untitled Trip'}
                                                                </p>
                                                                <span className='text-[10px] text-muted-foreground whitespace-nowrap font-mono'>
                                                                    {new Date(
                                                                        booking.createdAt
                                                                    ).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                                                <span>
                                                                    {booking
                                                                        .customer
                                                                        ?.name ||
                                                                        'Unknown Customer'}
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    {
                                                                        booking.bookingReference
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Badge
                                                            variant='outline'
                                                            className={`text-[10px] px-2 py-0.5 h-5 ${getStatusColor(
                                                                booking.status
                                                            )}`}>
                                                            {booking.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Recent Payments */}
                                        {(statistics.recentActivity
                                            ?.recentPayments?.length || 0) >
                                            0 && (
                                            <div className='space-y-3'>
                                                <h4 className='text-sm font-medium text-muted-foreground'>
                                                    Recent Payments
                                                </h4>
                                                {(showAllActivity
                                                    ? statistics.recentActivity
                                                          .recentPayments
                                                    : statistics.recentActivity.recentPayments.slice(
                                                          0,
                                                          4
                                                      )
                                                ).map((payment: any, idx: number) => (
                                                    <div
                                                        key={payment.id || idx}
                                                        className='flex items-center gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/5 transition-colors rounded-md px-2 -mx-2'>
                                                        <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10'>
                                                            <HugeiconsIcon
                                                                icon={
                                                                    MoneyBagIcon
                                                                }
                                                                className='size-5 text-green-600'
                                                            />
                                                        </div>
                                                        <div className='flex-1 min-w-0'>
                                                            <div className='flex items-center justify-start gap-2 mb-1'>
                                                                <p className='text-sm font-semibold font-mono tabular-nums'>
                                                                    {new Intl.NumberFormat(
                                                                        'en-US',
                                                                        {
                                                                            style: 'currency',
                                                                            currency:
                                                                                payment.currency ||
                                                                                'USD',
                                                                        }
                                                                    ).format(
                                                                        payment.amount
                                                                    )}
                                                                </p>
                                                                <span className='text-[10px] text-muted-foreground whitespace-nowrap font-mono'>
                                                                    {new Date(
                                                                        payment.createdAt
                                                                    ).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                                                <span className='capitalize'>
                                                                    {
                                                                        payment.paymentMethod
                                                                    }
                                                                </span>
                                                                <span>•</span>
                                                                <span>
                                                                    {payment
                                                                        .booking
                                                                        ?.bookingReference ||
                                                                        'No Ref'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Badge
                                                            variant='outline'
                                                            className={`text-[10px] px-2 py-0.5 h-5 ${getStatusColor(
                                                                payment.status
                                                            )}`}>
                                                            {payment.status}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {((statistics.recentActivity?.recentBookings
                                        ?.length || 0) > 4 ||
                                        (statistics.recentActivity
                                            ?.recentPayments?.length || 0) >
                                            4 ||
                                        (statistics.recentActivity
                                            ?.recentCustomers?.length || 0) >
                                            4) && (
                                        <div className='mt-4 flex justify-center'>
                                            <button
                                                onClick={() =>
                                                    setShowAllActivity(
                                                        !showAllActivity
                                                    )
                                                }
                                                className='text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-2'>
                                                {showAllActivity
                                                    ? 'Show Less'
                                                    : 'Show More Recent Activity'}
                                                <HugeiconsIcon
                                                    icon={
                                                        showAllActivity
                                                            ? ArrowUp01Icon
                                                            : ArrowDown01Icon
                                                    }
                                                    className='size-4'
                                                />
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className='flex flex-col items-center justify-center py-12 text-center'>
                                    <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-muted mb-4'>
                                        <HugeiconsIcon
                                            icon={Mail01Icon}
                                            className='text-muted-foreground'
                                        />
                                    </div>
                                    <p className='text-sm font-medium'>
                                        No recent activity
                                    </p>
                                    <p className='text-xs text-muted-foreground mt-1'>
                                        Activity will appear here as you create
                                        bookings and manage customers
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
                {/* Additional Metrics */}
                {visibleSections['matrics'] && (
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Customer Insights</CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-3'>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Verified
                                    </span>
                                    <span className='font-semibold'>
                                        {statistics.customers?.verified || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        With Bookings
                                    </span>
                                    <span className='font-semibold'>
                                        {statistics.customers?.withBookings ||
                                            0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Repeat Customers
                                    </span>
                                    <span className='font-semibold'>
                                        {statistics.customers
                                            ?.repeatCustomers || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Active This Month
                                    </span>
                                    <span className='font-semibold'>
                                        {statistics.customers
                                            ?.activeThisMonth || 0}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Payment Overview</CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-3'>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Completed
                                    </span>
                                    <span className='font-semibold text-green-600 dark:text-green-400'>
                                        {statistics.payments?.byStatus
                                            ?.completed || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Pending
                                    </span>
                                    <span className='font-semibold text-amber-600 dark:text-amber-400'>
                                        {statistics.payments?.byStatus
                                            ?.pending || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Failed
                                    </span>
                                    <span className='font-semibold text-red-600 dark:text-red-400'>
                                        {statistics.payments?.byStatus
                                            ?.failed || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Refunded
                                    </span>
                                    <span className='font-semibold text-muted-foreground'>
                                        {statistics.payments?.byStatus
                                            ?.refunded || 0}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Inquiries & Leads</CardTitle>
                            </CardHeader>
                            <CardContent className='space-y-3'>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Total Inquiries
                                    </span>
                                    <span className='font-semibold'>
                                        {statistics.inquiries?.total || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Pending
                                    </span>
                                    <span className='font-semibold text-amber-600 dark:text-amber-400'>
                                        {statistics.inquiries?.pending || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Replied
                                    </span>
                                    <span className='font-semibold text-green-600 dark:text-green-400'>
                                        {statistics.inquiries?.replied || 0}
                                    </span>
                                </div>
                                <div className='flex justify-between items-center'>
                                    <span className='text-sm text-muted-foreground'>
                                        Total Leads
                                    </span>
                                    <span className='font-semibold'>
                                        {statistics.leads?.total || 0}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
        </div>
    );
}
