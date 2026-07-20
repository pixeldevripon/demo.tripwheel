'use client';

import { IconTile, type IconTileVariant } from '@/components/common/icon-tile';
import { Badge } from '@/components/ui/badge';
import {
    Card,
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
    type ChartConfig,
} from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
    Airplane01Icon,
    Alert02Icon,
    Analytics01Icon,
    ArrowDown01Icon,
    ArrowUp01Icon,
    Award01Icon,
    Building06Icon,
    Calendar03Icon,
    Coins01Icon,
    CreditCardIcon,
    GlobalIcon,
    InformationCircleIcon,
    Mail01Icon,
    MoneyBagIcon,
    PercentIcon,
    TradeDownIcon,
    TradeUpIcon,
    UserGroupIcon,
    Wallet01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { Suspense, use, useState } from 'react';

import { StatisticsSkeleton } from '@/components/skeletons/statistics-skeleton';
import type { DashboardStats, FxDisplay } from '@/types/analytics';
import {
    Area,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts';

interface StatisticsProps {
    /** Resolves to `null` when the analytics fetch failed - never to zeros. */
    statsPromise?: Promise<DashboardStats | null>;
    visibleSections: Record<string, boolean>;
}

/** A single pie slice, already resolved to a display label and a fill colour. */
interface StatusSlice {
    name: string;
    value: number;
    fill: string;
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

// ─── Formatting helpers ──────────────────────────────────────────────────────

/**
 * Every money field in the payload is already EUR-normalized backend-side using
 * each booking's snapshotted `fxRateToEur`, so a mixed-currency ledger sums
 * correctly. The symbol therefore has to be the euro sign - rendering these
 * amounts with a dollar sign would mislabel real converted values.
 */
function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'EUR',
    }).format(amount);
}

/** Axis-scale money such as `€8.9K`. Full precision stays in the tooltip. */
function formatCompactMoney(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'EUR',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(amount);
}

/**
 * Ratios are rendered from a nullable number on purpose. A metric whose
 * denominator is zero is UNDEFINED, not zero percent, so it renders as a dash
 * rather than a figure the data does not support.
 */
function formatRate(rate: number | null) {
    return rate === null ? '-' : `${rate.toFixed(1)}%`;
}

/** Turns an enum value such as `PARTIALLY_REFUNDED` into `Partially refunded`. */
function humanizeStatus(status: string) {
    const s = status.replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A period-over-period movement, or `null` when there is nothing to say.
 *
 * `new` exists because growth measured against a zero base is UNDEFINED, not
 * infinite and not "+100%": there is no previous quantity to be a percentage
 * of. Such a period gets a neutral "New" chip with no direction attached.
 */
type Growth = { label: string; kind: 'up' | 'down' | 'new' } | null;

/**
 * Movement of `current` against `previous`.
 *
 * Both periods at zero returns `null` so the caller renders no chip at all -
 * "0%" would assert a measured flat result where in fact nothing happened.
 */
function calculateGrowth(current: number, previous: number): Growth {
    if (!previous || previous === 0) {
        if (current <= 0) return null;
        return { label: 'New', kind: 'new' };
    }
    const growth = ((current - previous) / previous) * 100;
    return {
        label: growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`,
        kind: growth >= 0 ? 'up' : 'down',
    };
}

/** Share of `part` in `whole`, or null when the question has no answer. */
function ratio(part: number, whole: number) {
    return whole > 0 ? (part / whole) * 100 : null;
}

/** Badge styles keyed off the real Booking/Payment/Tour status enum values. */
function getStatusColor(status: string) {
    const s = status?.toUpperCase() || '';
    if (
        [
            'CONFIRMED',
            'REDEEMED',
            'SUCCEEDED',
            'LIVE',
            'ACTIVE',
            'PAID',
        ].includes(s)
    ) {
        return 'border-success/30 bg-success/10 text-success hover:bg-success/20';
    }
    if (
        ['CANCELLED', 'FAILED', 'REJECTED', 'ARCHIVED', 'EXPIRED'].includes(s)
    ) {
        return 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20';
    }
    if (
        [
            'PENDING',
            'ON_HOLD',
            'DRAFT',
            'PROCESSING',
            'REQUIRES_PAYMENT',
            'PAUSED',
            'PARTIALLY_REFUNDED',
        ].includes(s)
    ) {
        return 'border-warning/30 bg-warning/10 text-warning hover:bg-warning/20';
    }
    return 'border-muted-foreground/30 bg-muted/50 text-muted-foreground hover:bg-muted/70';
}

/**
 * Builds pie data from a `byStatus` map. `alwaysShow` entries stay on the chart
 * even at zero (they are the statuses a healthy dataset is expected to have);
 * every other key is dropped when it is zero so the legend never carries a
 * slice that does not exist. Each entry gets its OWN chart colour - two slices
 * sharing a fill are indistinguishable and read as one wedge.
 */
function buildStatusSlices(
    byStatus: Record<string, number>,
    spec: { key: string; label: string; fill: string; alwaysShow?: boolean }[],
): StatusSlice[] {
    return spec
        .map((s) => ({
            name: s.label,
            value: byStatus?.[s.key] ?? 0,
            fill: s.fill,
            alwaysShow: s.alwaysShow ?? false,
        }))
        .filter((s) => s.alwaysShow || s.value > 0)
        .map(({ name, value, fill }) => ({ name, value, fill }));
}

/**
 * `ChartLegendContent` looks each slice up in the chart config BY ITS DISPLAYED
 * NAME, so the config has to be keyed by the same label the slice carries -
 * otherwise the legend renders coloured dots with no text next to them.
 */
function sliceChartConfig(slices: StatusSlice[]): ChartConfig {
    return Object.fromEntries(
        slices.map((s) => [s.name, { label: s.name, color: s.fill }]),
    );
}

// ─── Dual-currency money ─────────────────────────────────────────────────────

interface MoneyProps {
    /** The EUR figure straight off the payload. */
    eur: number;
    fx: FxDisplay | null;
    currency: string;
    /** `display` is KPI-headline scale, `inline` is row/table scale. */
    variant?: 'display' | 'inline';
    className?: string;
}

/**
 * THE money renderer for this surface. Owner requirement: every figure shows
 * EUR and its converted equivalent.
 *
 * The conversion uses `fx.rate` and nothing else, so the two readings can never
 * disagree with one another. When `fx` is null the backend had no fresh rate,
 * and the only honest response is to show EUR alone - converting at a stale or
 * invented rate would publish a number the platform cannot stand behind.
 *
 * Typography: `display` carries NO `font-mono`. A monospaced face only earns
 * its keep where digits must line up column-wise; a single headline figure has
 * nothing to align against, and the mono face just makes it look like debug
 * output. `inline` sits in rows and keeps plain `tabular-nums` so stacked
 * amounts align without switching typeface.
 */
function Money({
    eur,
    fx,
    currency,
    variant = 'inline',
    className,
}: MoneyProps) {
    return (
        <span className={cn('flex flex-col', className)}>
            <span
                className={cn(
                    variant === 'display'
                        ? 'truncate text-2xl font-semibold tracking-tight'
                        : 'text-sm font-medium tabular-nums',
                )}>
                {formatMoney(eur, currency)}
            </span>
            {fx && (
                <span
                    className={cn(
                        'text-muted-foreground',
                        variant === 'display'
                            ? 'text-xs'
                            : 'text-2xs tabular-nums',
                    )}>
                    ≈ {formatMoney(eur * fx.rate, fx.quote)}
                </span>
            )}
        </span>
    );
}

/** Info affordance for figures that need a caveat attached to them. */
function InfoNote({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type='button'
                    aria-label={text}
                    className='inline-flex text-muted-foreground transition-colors hover:text-foreground'>
                    <HugeiconsIcon
                        icon={InformationCircleIcon}
                        className='size-3.5'
                    />
                </button>
            </TooltipTrigger>
            <TooltipContent>{text}</TooltipContent>
        </Tooltip>
    );
}

/**
 * The movement chip on a KPI card. A `new` growth gets neutral styling and no
 * arrow: there is no direction to point in when the previous period was empty.
 */
function TrendBadge({ growth }: { growth: Growth }) {
    if (!growth) return null;

    if (growth.kind === 'new') {
        return (
            <Badge
                variant='outline'
                className='px-1.5 py-0 text-2xs font-medium text-muted-foreground'>
                New
            </Badge>
        );
    }

    const isUp = growth.kind === 'up';

    return (
        <Badge
            variant='outline'
            className={cn(
                'flex items-center gap-1 px-1.5 py-0 text-2xs font-medium tabular-nums',
                isUp
                    ? 'border-success-border bg-success-subtle text-success-fg'
                    : 'border-danger-border bg-danger-subtle text-danger-fg',
            )}>
            <HugeiconsIcon
                icon={isUp ? TradeUpIcon : TradeDownIcon}
                className='size-3'
            />
            {growth.label}
        </Badge>
    );
}

/** The same movement, stated as a chart footnote rather than a chip. */
function TrendFootnote({ growth }: { growth: Growth }) {
    if (!growth) return null;

    if (growth.kind === 'new') {
        return (
            <div className='text-sm leading-none font-medium text-muted-foreground'>
                New this month, with nothing recorded last month
            </div>
        );
    }

    const isUp = growth.kind === 'up';

    return (
        <div
            className={cn(
                'flex gap-2 text-sm leading-none font-medium',
                isUp ? 'text-success-fg' : 'text-danger-fg',
            )}>
            {growth.label} from last month
            <HugeiconsIcon
                icon={isUp ? TradeUpIcon : TradeDownIcon}
                className='size-4'
            />
        </div>
    );
}

// ─── Shared chart furniture ──────────────────────────────────────────────────

/**
 * THE donut on this surface. Four different distributions render through it, so
 * the tooltip/legend wiring and the per-slice `<Cell>` fills live in one place
 * instead of being copied per chart. Slice colours arrive on the data, since
 * only the caller knows which `--chart-N` slot each status should own.
 */
function StatusDonut({
    data,
    config,
    className,
}: {
    data: StatusSlice[];
    config: ChartConfig;
    className?: string;
}) {
    return (
        <ChartContainer
            config={config}
            className={cn('mx-auto aspect-square w-full', className)}>
            <PieChart>
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                    data={data}
                    dataKey='value'
                    nameKey='name'
                    innerRadius={60}
                    strokeWidth={5}>
                    {data.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                    ))}
                </Pie>
                <ChartLegend
                    content={<ChartLegendContent nameKey='name' />}
                    className='-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center'
                />
            </PieChart>
        </ChartContainer>
    );
}

/**
 * The "nothing to draw" state for a chart slot. It reserves the same height the
 * chart would have taken, so switching tabs on an empty dataset does not make
 * the card collapse and the page jump.
 */
function ChartEmpty({
    icon,
    message,
    className = 'h-[300px]',
}: {
    icon?: IconSvgElement;
    message: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex w-full flex-col items-center justify-center text-center',
                className,
            )}>
            {icon && (
                <HugeiconsIcon
                    icon={icon}
                    className='mb-4 size-12 text-muted-foreground'
                />
            )}
            <p className='text-sm text-muted-foreground'>{message}</p>
        </div>
    );
}

/** Titled header with a leading tile, shared by the four breakdown cards. */
function BreakdownHeader({
    icon,
    variant,
    title,
    description,
}: {
    icon: IconSvgElement;
    variant: IconTileVariant;
    title: string;
    description: string;
}) {
    return (
        <CardHeader>
            <div className='flex items-center gap-3'>
                <IconTile icon={icon} variant={variant} size='sm' />
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
            </div>
        </CardHeader>
    );
}

/** Chart config for `CategoryMoneyBar`, which always plots the `value` key. */
function categoryBarConfig(label: string, color: string): ChartConfig {
    return { value: { label, color } };
}

// ─── Recent-activity primitives ──────────────────────────────────────────────

/** A labelled run of activity rows. */
function ActivityGroup({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className='space-y-3'>
            <h4 className='text-sm font-medium text-muted-foreground'>
                {title}
            </h4>
            {children}
        </div>
    );
}

/**
 * Bookings, payments and customers all read as the same row: a tile, a title
 * with its date, a line of metadata, and a trailing badge. One component keeps
 * the three lists visually identical instead of three drifting copies.
 */
function ActivityRow({
    icon,
    variant,
    title,
    titleClassName,
    date,
    meta,
    badge,
}: {
    icon: IconSvgElement;
    variant: IconTileVariant;
    title: string;
    titleClassName?: string;
    date: string;
    meta: React.ReactNode;
    badge: React.ReactNode;
}) {
    return (
        <div className='-mx-2 flex items-center gap-3 rounded-md border-b border-border px-2 py-3 transition-colors last:border-0 hover:bg-muted/5'>
            <IconTile icon={icon} variant={variant} />
            <div className='min-w-0 flex-1'>
                <div className='mb-1 flex items-center justify-start gap-2'>
                    <p
                        className={cn(
                            'truncate pr-2 text-sm font-medium',
                            titleClassName,
                        )}>
                        {title}
                    </p>
                    <span className='whitespace-nowrap text-2xs tabular-nums text-muted-foreground'>
                        {new Date(date).toLocaleDateString()}
                    </span>
                </div>
                <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                    {meta}
                </div>
            </div>
            {badge}
        </div>
    );
}

/**
 * A booking/payment reference. Monospace is right here because a reference is
 * an IDENTIFIER, not a quantity - the fixed-width face aids character-by-
 * character reading rather than column alignment.
 */
function Ref({ value }: { value: string }) {
    return <span className='font-mono'>{value}</span>;
}

/** Status pill coloured from the real Booking/Payment status enums. */
function StatusBadge({ status }: { status: string }) {
    return (
        <Badge
            variant='outline'
            className={cn('h-5 px-2 py-0.5 text-2xs', getStatusColor(status))}>
            {humanizeStatus(status)}
        </Badge>
    );
}

// ─── Card models ─────────────────────────────────────────────────────────────

interface KpiCard {
    key: string;
    label: string;
    /** Money cards carry an EUR amount and render through `<Money>`. */
    eur?: number;
    /** Count cards (and "not tracked" states) carry a preformatted string. */
    value?: string;
    trend?: Growth;
    description: string;
    subtitle?: string;
    /** Honesty caveat surfaced as an info icon beside the label. */
    note?: string;
    icon: IconSvgElement;
    tile?: IconTileVariant;
}

interface BreakdownRow {
    id: string;
    name: string;
    count: number;
    eur: number;
    /** Optional qualifier shown beside the name (e.g. a tier's rate). */
    note?: string;
}

function StatisticsContent({ statsPromise, visibleSections }: StatisticsProps) {
    const stats = statsPromise ? use(statsPromise) : null;

    const [showAllActivity, setShowAllActivity] = useState(false);

    // A failed fetch must never be dressed up as an empty business. Bail out to
    // an explicit error state instead of rendering a dashboard full of zeros.
    if (!stats) {
        return (
            <div className='mx-auto w-full space-y-6'>
                <Card>
                    <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                        <IconTile
                            icon={Alert02Icon}
                            variant='danger'
                            size='lg'
                            className='mb-4'
                        />
                        <p className='text-sm font-medium'>
                            Couldn&apos;t load dashboard statistics
                        </p>
                        <p className='mt-1 max-w-md text-xs text-muted-foreground'>
                            The analytics service did not respond. Your data is
                            safe - this is a display problem only. Refresh the
                            page to try again.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const {
        revenue,
        bookings,
        trips,
        customers,
        payments,
        trend,
        breakdowns,
        recent,
        fx,
    } = stats;
    const currency = stats.currency || 'EUR';
    const money = (amount: number) => formatMoney(amount, currency);

    // The payload is role-shaped: the traveler's deposit IS the platform
    // commission, so admin and operator hold opposite halves of one booking.
    // `earnedEur` means commission to an admin and retail-minus-commission to
    // an operator, and every label below has to say which.
    const isPlatform = stats.scope === 'platform';
    const funnel = bookings.funnel;

    const paymentRowTotal = Object.values(payments.byStatus ?? {}).reduce(
        (sum, n) => sum + n,
        0,
    );
    const paymentSuccessRate = ratio(
        payments.byStatus?.['SUCCEEDED'] ?? 0,
        paymentRowTotal,
    );

    // ─── Trend series ────────────────────────────────────────────────────
    // A real time series from the backend, oldest bucket first. Genuinely-zero
    // buckets are included on purpose: a flat stretch is information, so it is
    // charted rather than dropped. `earned` is bucketed by RECOGNITION date
    // (tour completion) while `gmv` and `bookings` are bucketed by booking
    // date - the two answer different questions and must not be conflated.
    const trendData = trend.points.map((point) => ({
        label: point.label,
        earned: point.earnedEur,
        gmv: point.gmvEur,
        bookings: point.bookings,
    }));

    const bucketNoun = trend.granularity === 'month' ? 'months' : 'days';
    const bucketCount = trend.points.length;

    // The empty-state guards matter: without them a dataset of nothing but zero
    // buckets renders as a flat line pinned to the axis, which looks like real
    // (bad) performance rather than "no data yet".
    const hasEarningsTrend = trendData.some((p) => p.earned > 0 || p.gmv > 0);
    const hasBookingTrend = trendData.some((p) => p.bookings > 0);

    const earningsChartConfig: ChartConfig = {
        gmv: { label: 'Booking value (GMV)', color: 'var(--chart-3)' },
        earned: {
            label: isPlatform ? 'Commission earned' : 'Net earned',
            color: 'var(--chart-1)',
        },
    };

    const bookingsChartConfig: ChartConfig = {
        bookings: { label: 'Bookings', color: 'var(--chart-2)' },
    };

    // ─── Booking outcomes ────────────────────────────────────────────────
    // NOT a marketing funnel. The platform stores only a booking's CURRENT
    // status and has no view/cart event store, so anything before "created"
    // cannot be reported honestly. These three stages are what the data
    // genuinely supports.
    //
    // Kept in lifecycle order (created -> committed -> completed), NOT sorted
    // by size: the order IS the meaning here, and each stage is a subset of
    // the one above it. Bars therefore scale to `created`, so their lengths
    // read as the survival rate at each step.
    const funnelStages = [
        { name: 'Created', value: funnel.created },
        { name: 'Committed', value: funnel.committed },
        { name: 'Completed', value: funnel.completed },
    ];

    const funnelChartConfig = categoryBarConfig('Bookings', 'var(--chart-1)');

    const hasFunnelData = funnel.created > 0;

    const funnelRates = [
        {
            key: 'commit',
            label: 'Commit rate',
            value: funnel.commitRate,
            hint: 'Created bookings that survived the hold and committed.',
        },
        {
            key: 'completion',
            label: 'Completion rate',
            value: funnel.completionRate,
            hint: 'Committed bookings that were actually travelled.',
        },
        {
            key: 'expiry',
            label: 'Expiry rate',
            value: funnel.expiryRate,
            hint: 'Created bookings that timed out before payment.',
        },
        {
            key: 'cancellation',
            label: 'Cancellation rate',
            value: funnel.cancellationRate,
            hint: 'Committed bookings that were cancelled.',
        },
    ];

    const funnelCounts = [
        { key: 'held', label: 'On hold', value: funnel.held },
        { key: 'confirmed', label: 'Confirmed', value: funnel.confirmed },
        { key: 'expired', label: 'Expired', value: funnel.expired },
        { key: 'cancelled', label: 'Cancelled', value: funnel.cancelled },
    ];

    // ─── Payment model mix ───────────────────────────────────────────────
    // The platform's exposure map: OPERATOR_LINK / ON_ARRIVAL balances are
    // collected off-platform, PAID_IN_FULL creates a payout liability.
    const paymentModelData = buildStatusSlices(bookings.byPaymentModel, [
        {
            key: 'OPERATOR_LINK',
            label: 'Operator link',
            fill: 'var(--chart-1)',
        },
        { key: 'ON_ARRIVAL', label: 'On arrival', fill: 'var(--chart-2)' },
        { key: 'PAID_IN_FULL', label: 'Paid in full', fill: 'var(--chart-3)' },
        {
            key: 'OPERATOR_FULL',
            label: 'Operator full',
            fill: 'var(--chart-6)',
        },
    ]);

    const paymentModelChartConfig = sliceChartConfig(paymentModelData);
    const hasPaymentModelData = paymentModelData.some((d) => d.value > 0);

    // ─── Status distributions ────────────────────────────────────────────
    const bookingStatusData = buildStatusSlices(bookings.byStatus, [
        {
            key: 'ON_HOLD',
            label: 'On hold',
            fill: 'var(--chart-4)',
            alwaysShow: true,
        },
        {
            key: 'CONFIRMED',
            label: 'Confirmed',
            fill: 'var(--chart-1)',
            alwaysShow: true,
        },
        {
            key: 'REDEEMED',
            label: 'Completed',
            fill: 'var(--chart-2)',
            alwaysShow: true,
        },
        {
            key: 'CANCELLED',
            label: 'Cancelled',
            fill: 'var(--chart-5)',
            alwaysShow: true,
        },
        {
            key: 'EXPIRED',
            label: 'Expired',
            fill: 'var(--chart-3)',
            alwaysShow: true,
        },
        // Transient/rare states - charted only when they actually occur.
        { key: 'PENDING', label: 'Pending', fill: 'var(--chart-6)' },
        { key: 'REJECTED', label: 'Rejected', fill: 'var(--destructive)' },
    ]);

    // Every tour sits in exactly one of these four states, so a zero slice adds
    // nothing - only non-empty ones are charted.
    const tripStatusData = buildStatusSlices(trips.byStatus, [
        { key: 'DRAFT', label: 'Draft', fill: 'var(--chart-5)' },
        { key: 'LIVE', label: 'Live', fill: 'var(--chart-1)' },
        { key: 'PAUSED', label: 'Paused', fill: 'var(--chart-6)' },
        { key: 'ARCHIVED', label: 'Archived', fill: 'var(--chart-3)' },
    ]);

    const paymentStatusData = buildStatusSlices(payments.byStatus, [
        { key: 'SUCCEEDED', label: 'Succeeded', fill: 'var(--chart-1)' },
        { key: 'PROCESSING', label: 'Processing', fill: 'var(--chart-4)' },
        {
            key: 'REQUIRES_PAYMENT',
            label: 'Requires payment',
            fill: 'var(--chart-6)',
        },
        { key: 'REFUNDED', label: 'Refunded', fill: 'var(--chart-5)' },
        {
            key: 'PARTIALLY_REFUNDED',
            label: 'Partially refunded',
            fill: 'var(--chart-3)',
        },
        { key: 'FAILED', label: 'Failed', fill: 'var(--destructive)' },
        { key: 'CANCELLED', label: 'Cancelled', fill: 'var(--chart-2)' },
    ]);

    const bookingChartConfig = sliceChartConfig(bookingStatusData);
    const tripChartConfig = sliceChartConfig(tripStatusData);
    // Ranked largest-first for the horizontal bar chart. Sorting changes row
    // ORDER only - every bar shares one colour, so nothing is ever repainted
    // by its rank.
    //
    // The per-slice `fill` is dropped deliberately: Recharts prefers a `fill`
    // found on the datum over the one set on <Bar>, so leaving it in painted
    // each bar a different colour. That would double-encode length as hue when
    // the status label already carries identity.
    const paymentStatusRows = [...paymentStatusData]
        .sort((a, b) => b.value - a.value)
        .map(({ name, value }) => ({ name, value }));
    const paymentStatusConfig = categoryBarConfig(
        'Payment rows',
        'var(--chart-1)',
    );

    const hasBookingStatusData = bookingStatusData.some((d) => d.value > 0);
    const hasTripStatusData = tripStatusData.some((d) => d.value > 0);
    const hasPaymentStatusData = paymentStatusData.some((d) => d.value > 0);

    // ─── Growth ──────────────────────────────────────────────────────────
    // Earnings growth compares RECOGNIZED months against each other, which is
    // why it reads off `earnedThisMonthEur` rather than anything booked.
    const earningsGrowth = calculateGrowth(
        revenue.earnedThisMonthEur,
        revenue.earnedLastMonthEur,
    );

    const bookingsGrowth = calculateGrowth(
        bookings.thisMonth,
        bookings.lastMonth,
    );

    const customerGrowth = calculateGrowth(
        customers.newThisMonth,
        customers.newLastMonth,
    );

    const tripsGrowth = calculateGrowth(
        trips.createdThisMonth,
        trips.createdLastMonth,
    );

    // ─── Shared caveats ──────────────────────────────────────────────────
    // These two figures are the honesty-critical ones on this whole surface.
    const UNTRACKED_NOTE =
        'Collected on your own payment rails. Island Tours does not track these payments.';
    const UNTRACKED_NOTE_PLATFORM =
        "Balances collected on the operator's own payment rails. Island Tours does not track whether these payments were received.";
    const PAYOUT_NOTE =
        'Earned and not yet settled. No settlements ledger exists yet, so this is an amount owed, not a completed transfer.';

    // ─── KPI cards ───────────────────────────────────────────────────────
    const sharedTailCards: KpiCard[] = [
        {
            key: 'bookings',
            label: 'Total bookings',
            value: bookings.total.toString(),
            trend: bookingsGrowth,
            description:
                bookings.upcoming > 0
                    ? `${bookings.upcoming} upcoming`
                    : 'No upcoming bookings',
            subtitle: `${bookings.thisMonth} this month · ${formatRate(
                bookings.cancellationRate,
            )} cancelled`,
            icon: Calendar03Icon,
        },
        {
            key: 'trips',
            // The card says "Active", so it counts LIVE tours only - drafts and
            // archived tours are not active inventory.
            label: 'Active trips',
            value: trips.live.toString(),
            trend: tripsGrowth,
            description: `${trips.createdThisMonth} created this month`,
            subtitle: `${trips.withBookings} of ${trips.total} have bookings`,
            icon: Airplane01Icon,
        },
        {
            key: 'customers',
            // Distinct bookers, guests included - not just registered accounts.
            label: 'Customers',
            value: customers.total.toString(),
            trend: customerGrowth,
            description: `${customers.newThisMonth} new this month`,
            // `registered` is null for an operator caller (they cannot see the
            // platform account count), so the sub-line falls back to the repeat
            // rate rather than showing a zero that is not a zero.
            subtitle:
                customers.registered !== null
                    ? `${customers.registered} registered · ${formatRate(
                          customers.repeatRate,
                      )} repeat`
                    : `${formatRate(customers.repeatRate)} repeat`,
            icon: UserGroupIcon,
        },
    ];

    const platformCards: KpiCard[] = [
        {
            key: 'earned',
            label: 'Commission earned',
            eur: revenue.earnedEur,
            trend: earningsGrowth,
            description: `${money(revenue.earnedThisMonthEur)} this month`,
            subtitle: 'Recognized on tour completion',
            note: 'Commission on completed (travelled) bookings only. Revenue is recognized on completion, never at booking.',
            icon: MoneyBagIcon,
        },
        {
            key: 'pending',
            label: 'Pending commission',
            eur: revenue.pendingEur,
            description: 'Awaiting completion',
            subtitle: `${bookings.upcoming} upcoming departures`,
            note: 'Commission on confirmed bookings that have not travelled yet. Real money, not yet earned - it is never added into earned.',
            icon: Wallet01Icon,
            tile: 'warning',
        },
        {
            key: 'gmv',
            label: 'Gross merchandise value',
            eur: revenue.gmvEur,
            description: 'Confirmed + completed bookings',
            subtitle: `Across ${funnel.committed} committed bookings`,
            icon: Analytics01Icon,
            tile: 'info',
        },
        {
            key: 'payout',
            label: 'Payouts due to operators',
            eur: revenue.payoutDueEur,
            description: 'Earned, not yet settled',
            subtitle: 'On completed paid-in-full bookings',
            note: PAYOUT_NOTE,
            icon: Coins01Icon,
            tile: 'warning',
        },
        ...sharedTailCards,
        {
            key: 'cash',
            label: 'Cash collected via Stripe',
            // Null means "this ledger does not apply to you", which is not the
            // same as zero, so it is stated rather than rendered as a figure.
            eur: revenue.cashCollectedEur ?? undefined,
            value:
                revenue.cashCollectedEur === null ? 'Not tracked' : undefined,
            description:
                revenue.cashCollectedEur === null
                    ? 'Platform ledger only'
                    : 'Actually received on platform rails',
            subtitle:
                revenue.refundedEur !== null
                    ? `${money(revenue.refundedEur)} refunded out`
                    : undefined,
            icon: CreditCardIcon,
            tile: 'success',
        },
    ];

    const operatorCards: KpiCard[] = [
        {
            key: 'earned',
            label: 'Net earned',
            eur: revenue.earnedEur,
            trend: earningsGrowth,
            description: `${money(revenue.earnedThisMonthEur)} this month`,
            subtitle: 'Retail minus commission, on completed tours',
            note: 'Your share of completed (travelled) bookings. Revenue is recognized on tour completion, never at booking.',
            icon: MoneyBagIcon,
        },
        {
            key: 'pending',
            label: 'Pending',
            eur: revenue.pendingEur,
            description: 'Awaiting completion',
            subtitle: `${bookings.upcoming} upcoming departures`,
            note: 'Your share of confirmed bookings that have not travelled yet. Real money, not yet earned.',
            icon: Wallet01Icon,
            tile: 'warning',
        },
        {
            key: 'payout',
            label: 'Payout due from Island Tours',
            eur: revenue.payoutDueEur,
            description: 'Earned, not yet settled',
            subtitle: 'On completed paid-in-full bookings',
            note: PAYOUT_NOTE,
            icon: Coins01Icon,
            tile: 'info',
        },
        {
            key: 'untracked',
            label: 'Collected directly by you',
            eur: revenue.untrackedBalanceEur,
            description: 'Expected, not confirmed',
            subtitle: 'Operator link and on-arrival balances',
            note: UNTRACKED_NOTE,
            icon: Building06Icon,
            tile: 'neutral',
        },
        {
            key: 'commission',
            label: 'Commission paid to Island Tours',
            eur: revenue.commissionEur,
            description: 'On completed bookings',
            subtitle: 'The deposit travelers pay at checkout',
            icon: PercentIcon,
            tile: 'neutral',
        },
        ...sharedTailCards,
    ];

    const statCards = isPlatform ? platformCards : operatorCards;

    // ─── Breakdowns ──────────────────────────────────────────────────────
    // The operator/destination/tier leaderboards compare operators against one
    // another, so the backend returns them empty for an operator caller. The
    // length guards below are what keeps them off an operator's screen.
    const topTourRows: BreakdownRow[] = breakdowns.topTours.map((t) => ({
        id: t.id,
        name: t.name,
        count: t.bookings,
        eur: t.earnedEur,
    }));

    const topOperatorRows: BreakdownRow[] = breakdowns.topOperators.map(
        (o) => ({
            id: o.id,
            name: o.name,
            count: o.bookings,
            eur: o.earnedEur,
        }),
    );

    // Destinations and tiers are leaderboards too, so they use the SAME row
    // shape and the same text renderer as tours and operators. Four cards, one
    // consistent reading, and the exact amounts stay legible instead of being
    // estimated off an axis.
    const destinationRows: BreakdownRow[] = breakdowns.topDestinations.map(
        (d) => ({
            id: d.id,
            name: d.name,
            count: d.bookings,
            eur: d.gmvEur,
        }),
    );

    const tierRows: BreakdownRow[] = breakdowns.byTier.map((t) => ({
        id: t.tier,
        name: humanizeStatus(t.tier),
        count: t.bookings,
        eur: t.earnedEur,
        // Omitted rather than shown as 0% when the backend has no rate.
        note:
            t.commissionPct === null
                ? undefined
                : `${formatRate(t.commissionPct)} commission`,
    }));

    /**
     * Compact leaderboard, text only. The list is already ordered by value and
     * every amount is printed exactly, so a bar per row would re-encode the
     * ranking that the order and the numbers already carry.
     *
     * Laid out as two aligned columns with hairline dividers rather than free
     * floating text: the rank sits in a fixed-width gutter so names line up,
     * and each row's secondary line sits directly under the value it belongs
     * to. What the amount MEANS ("commission earned") is stated once in the
     * card description, so repeating it on every row is dropped.
     * Callers guard length.
     */
    const renderBreakdown = (rows: BreakdownRow[]) => (
        <div className='divide-y divide-border'>
            {rows.map((row, index) => (
                <div
                    key={row.id}
                    className='flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0'>
                    <span className='flex min-w-0 items-baseline gap-2'>
                        {/* Fixed-width rank gutter: `tabular-nums` keeps the
                            column aligned all the way down the list. */}
                        <span className='w-3 shrink-0 text-2xs tabular-nums text-muted-foreground'>
                            {index + 1}
                        </span>
                        <span className='min-w-0'>
                            <span className='block truncate text-sm font-medium'>
                                {row.name}
                            </span>
                            <span className='mt-0.5 block text-2xs text-muted-foreground'>
                                {row.count}{' '}
                                {row.count === 1 ? 'booking' : 'bookings'}
                                {row.note ? ` · ${row.note}` : ''}
                            </span>
                        </span>
                    </span>
                    <Money
                        eur={row.eur}
                        fx={fx}
                        currency={currency}
                        className='shrink-0 items-end'
                    />
                </div>
            ))}
        </div>
    );

    const hasAnyBreakdown =
        topTourRows.length > 0 ||
        topOperatorRows.length > 0 ||
        destinationRows.length > 0 ||
        tierRows.length > 0;

    // ─── Recent activity ─────────────────────────────────────────────────
    const recentBookings = recent.bookings ?? [];
    const recentPayments = recent.payments ?? [];
    const recentCustomers = recent.customers ?? [];

    const hasRecentActivity =
        recentBookings.length > 0 ||
        recentPayments.length > 0 ||
        recentCustomers.length > 0;

    const hasMoreActivity =
        recentBookings.length > 4 ||
        recentPayments.length > 4 ||
        recentCustomers.length > 4;

    return (
        <div className='mx-auto w-full space-y-8'>
            {/* Stats grid + charts */}
            {visibleSections['statistics'] && (
                <>
                    <div className='grid grid-cols-1 gap-4 *:min-w-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                        {statCards.map((stat) => (
                            /* Preset stat-card anatomy: tile top-left + trend
                               top-right (never sharing a line with the label,
                               so nothing wraps at any width), then the value,
                               then the label, then the sub-lines. */
                            <Card key={stat.key} size='sm' className='gap-4'>
                                <CardHeader className='flex flex-row items-start justify-between space-y-0 p-0'>
                                    <IconTile
                                        icon={stat.icon}
                                        variant={stat.tile ?? 'primary'}
                                    />
                                    <TrendBadge growth={stat.trend ?? null} />
                                </CardHeader>
                                <CardContent className='space-y-1.5 p-0'>
                                    {stat.eur !== undefined ? (
                                        <Money
                                            eur={stat.eur}
                                            fx={fx}
                                            currency={currency}
                                            variant='display'
                                        />
                                    ) : (
                                        /* No `font-mono` on a headline figure:
                                           it has nothing to align against. */
                                        <CardTitle className='truncate text-2xl font-semibold tracking-tight'>
                                            {stat.value}
                                        </CardTitle>
                                    )}
                                    <p className='flex items-center gap-1.5 text-sm text-content-muted'>
                                        {stat.label}
                                        {stat.note && (
                                            <InfoNote text={stat.note} />
                                        )}
                                    </p>
                                </CardContent>
                                <CardFooter className='flex-col items-start gap-1.5 p-0'>
                                    <div className='flex items-center gap-1.5 text-xs font-medium text-foreground'>
                                        {stat.description}
                                    </div>
                                    {stat.subtitle && (
                                        <p className='text-2xs text-muted-foreground'>
                                            {stat.subtitle}
                                        </p>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Charts. The scope + FX provenance rides on the tab row
                        rather than owning a tall band of its own. */}
                    <Tabs defaultValue='revenue' className='space-y-6'>
                        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                            <TabsList className='grid w-full max-w-2xl grid-cols-2 sm:grid-cols-4'>
                                <TabsTrigger value='revenue'>
                                    Revenue &amp; Bookings
                                </TabsTrigger>
                                <TabsTrigger value='flow'>
                                    Booking flow
                                </TabsTrigger>
                                <TabsTrigger value='status'>
                                    Status overview
                                </TabsTrigger>
                                <TabsTrigger value='breakdowns'>
                                    Breakdowns
                                </TabsTrigger>
                            </TabsList>
                            <div className='flex shrink-0 items-center gap-2 text-2xs text-muted-foreground'>
                                <Badge
                                    variant='outline'
                                    className='px-1.5 py-0 text-2xs font-medium'>
                                    {isPlatform
                                        ? 'Platform view'
                                        : 'Operator view'}
                                </Badge>
                                {fx ? (
                                    <span className='tabular-nums'>
                                        1 {fx.base} = {fx.rate.toFixed(4)}{' '}
                                        {fx.quote}
                                    </span>
                                ) : (
                                    <span>{currency} only, no FX rate</span>
                                )}
                                <InfoNote
                                    text={
                                        fx
                                            ? `All amounts are ${currency}. The converted figure uses this single rate${
                                                  fx.asOf
                                                      ? `, as of ${new Date(fx.asOf).toLocaleString()}`
                                                      : ''
                                              }.`
                                            : `No fresh FX rate is available, so amounts are shown in ${currency} alone rather than converted at a stale rate.`
                                    }
                                />
                            </div>
                        </div>

                        <TabsContent value='revenue' className='space-y-4'>
                            {/* Two charts per row throughout: at this container
                                width that leaves each chart ~560px, which is
                                where axis ticks and legends still fit. */}
                            <div className='grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-2'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            {isPlatform
                                                ? 'Commission & booking value'
                                                : 'Earnings & booking value'}
                                        </CardTitle>
                                        <CardDescription>
                                            Earnings are plotted on their
                                            recognition date (tour completion);
                                            booking value is plotted on the
                                            booking date.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {hasEarningsTrend ? (
                                            <ChartContainer
                                                config={earningsChartConfig}
                                                className='h-[260px] w-full'>
                                                <ComposedChart data={trendData}>
                                                    <defs>
                                                        <linearGradient
                                                            id='fillGmv'
                                                            x1='0'
                                                            y1='0'
                                                            x2='0'
                                                            y2='1'>
                                                            <stop
                                                                offset='5%'
                                                                stopColor='var(--chart-3)'
                                                                stopOpacity={
                                                                    0.5
                                                                }
                                                            />
                                                            <stop
                                                                offset='95%'
                                                                stopColor='var(--chart-3)'
                                                                stopOpacity={
                                                                    0.05
                                                                }
                                                            />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid
                                                        vertical={false}
                                                    />
                                                    <XAxis
                                                        dataKey='label'
                                                        tickLine={false}
                                                        axisLine={false}
                                                        tickMargin={8}
                                                    />
                                                    <YAxis
                                                        tickLine={false}
                                                        axisLine={false}
                                                        width={56}
                                                        tickFormatter={(
                                                            value,
                                                        ) =>
                                                            formatCompactMoney(
                                                                Number(value),
                                                                currency,
                                                            )
                                                        }
                                                    />
                                                    <ChartTooltip
                                                        cursor={false}
                                                        content={
                                                            <ChartTooltipContent
                                                                indicator='line'
                                                                formatter={(
                                                                    value,
                                                                    name,
                                                                ) => (
                                                                    <div className='flex w-full items-center justify-between gap-4'>
                                                                        <span className='text-muted-foreground'>
                                                                            {name ===
                                                                            'gmv'
                                                                                ? 'Booking value'
                                                                                : isPlatform
                                                                                  ? 'Commission'
                                                                                  : 'Net earned'}
                                                                        </span>
                                                                        <span className='font-medium tabular-nums'>
                                                                            {money(
                                                                                Number(
                                                                                    value,
                                                                                ),
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            />
                                                        }
                                                    />
                                                    {/* `monotone`, not `natural`.
                                                        Both draw the smooth
                                                        rounded curve, but a
                                                        `natural` spline
                                                        OVERSHOOTS between
                                                        sparse points - with
                                                        five empty months and
                                                        one spike it dipped
                                                        below zero, drawing
                                                        negative revenue that
                                                        never happened.
                                                        `monotone` is shape
                                                        preserving: it stays
                                                        smooth but never swings
                                                        past a real value, so
                                                        the money series can
                                                        only ever connect
                                                        numbers we actually
                                                        have. */}
                                                    <Area
                                                        dataKey='gmv'
                                                        type='monotone'
                                                        fill='url(#fillGmv)'
                                                        stroke='var(--chart-3)'
                                                    />
                                                    <Line
                                                        dataKey='earned'
                                                        type='monotone'
                                                        stroke='var(--chart-1)'
                                                        strokeWidth={2}
                                                        dot={false}
                                                    />
                                                    <ChartLegend
                                                        content={
                                                            <ChartLegendContent />
                                                        }
                                                    />
                                                </ComposedChart>
                                            </ChartContainer>
                                        ) : (
                                            <ChartEmpty
                                                message='No earnings recognized yet. Figures appear once a booked tour is completed.'
                                                className='h-[260px]'
                                            />
                                        )}
                                    </CardContent>
                                    <CardFooter className='flex-col items-start gap-2 text-sm'>
                                        <TrendFootnote
                                            growth={earningsGrowth}
                                        />
                                        <div className='text-xs leading-none text-muted-foreground'>
                                            Showing the last {bucketCount}{' '}
                                            {bucketNoun}
                                        </div>
                                    </CardFooter>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Booking volume</CardTitle>
                                        <CardDescription>
                                            {trend.granularity === 'month'
                                                ? 'Monthly'
                                                : 'Daily'}{' '}
                                            bookings created
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {hasBookingTrend ? (
                                            <ChartContainer
                                                config={bookingsChartConfig}
                                                className='h-[260px] w-full'>
                                                <BarChart data={trendData}>
                                                    <CartesianGrid
                                                        vertical={false}
                                                    />
                                                    <XAxis
                                                        dataKey='label'
                                                        tickLine={false}
                                                        tickMargin={10}
                                                        axisLine={false}
                                                    />
                                                    <YAxis
                                                        tickLine={false}
                                                        axisLine={false}
                                                        width={36}
                                                        allowDecimals={false}
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
                                            <ChartEmpty
                                                message='No bookings yet. Your first booking will appear here.'
                                                className='h-[260px]'
                                            />
                                        )}
                                    </CardContent>
                                    <CardFooter className='flex-col items-start gap-2 text-sm'>
                                        <TrendFootnote
                                            growth={bookingsGrowth}
                                        />
                                        <div className='text-xs leading-none text-muted-foreground'>
                                            Showing bookings for the last{' '}
                                            {bucketCount} {bucketNoun}
                                        </div>
                                    </CardFooter>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value='flow' className='space-y-4'>
                            <div className='grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-2'>
                                {/* Booking outcomes: stated, not charted. Three
                                    stages and four rates do not need a plotting
                                    library to be read accurately. */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Booking outcomes</CardTitle>
                                        <CardDescription>
                                            Where bookings end up. This is not a
                                            marketing funnel: the platform
                                            stores only a booking&apos;s current
                                            status and has no pre-booking event
                                            store, so steps before &quot;booking
                                            created&quot; cannot be reported.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-6'>
                                        {hasFunnelData ? (
                                            <>
                                                <ChartContainer
                                                    config={funnelChartConfig}
                                                    className='h-[200px] w-full'>
                                                    <BarChart
                                                        data={funnelStages}
                                                        layout='vertical'
                                                        margin={{
                                                            left: 8,
                                                            right: 16,
                                                        }}>
                                                        <CartesianGrid
                                                            horizontal={false}
                                                        />
                                                        <XAxis
                                                            type='number'
                                                            tickLine={false}
                                                            axisLine={false}
                                                            allowDecimals={
                                                                false
                                                            }
                                                        />
                                                        <YAxis
                                                            dataKey='name'
                                                            type='category'
                                                            tickLine={false}
                                                            axisLine={false}
                                                            width={96}
                                                        />
                                                        <ChartTooltip
                                                            cursor={false}
                                                            content={
                                                                <ChartTooltipContent
                                                                    hideLabel
                                                                />
                                                            }
                                                        />
                                                        <Bar
                                                            dataKey='value'
                                                            fill='var(--chart-1)'
                                                            radius={[
                                                                0, 4, 4, 0,
                                                            ]}
                                                            barSize={22}
                                                        />
                                                    </BarChart>
                                                </ChartContainer>

                                                <div className='grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-6 sm:grid-cols-4'>
                                                    {funnelRates.map((rate) => (
                                                        <div key={rate.key}>
                                                            <p className='text-base font-semibold'>
                                                                {formatRate(
                                                                    rate.value,
                                                                )}
                                                            </p>
                                                            <p className='mt-1 flex items-center gap-1 text-2xs text-muted-foreground'>
                                                                <span className='truncate'>
                                                                    {rate.label}
                                                                </span>
                                                                <InfoNote
                                                                    text={
                                                                        rate.hint
                                                                    }
                                                                />
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className='grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-6 sm:grid-cols-4'>
                                                    {funnelCounts.map(
                                                        (count) => (
                                                            <div
                                                                key={count.key}>
                                                                <p className='text-base font-semibold'>
                                                                    {
                                                                        count.value
                                                                    }
                                                                </p>
                                                                <p className='mt-1 text-2xs text-muted-foreground'>
                                                                    {
                                                                        count.label
                                                                    }
                                                                </p>
                                                            </div>
                                                        ),
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <ChartEmpty
                                                message='No bookings created yet.'
                                                className='h-[300px]'
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Payment model mix */}
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Payment model mix</CardTitle>
                                        <CardDescription>
                                            Committed bookings by how the money
                                            is collected. This is the exposure
                                            map, not a revenue split.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-6'>
                                        {hasPaymentModelData ? (
                                            <>
                                                <StatusDonut
                                                    data={paymentModelData}
                                                    config={
                                                        paymentModelChartConfig
                                                    }
                                                    className='max-h-[240px]'
                                                />

                                                {/* The honesty pair: money the
                                                    platform holds vs money it
                                                    can only ever infer. */}
                                                <div className='space-y-4 border-t border-border pt-6'>
                                                    <div className='flex items-start justify-between gap-3'>
                                                        <span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
                                                            Off-platform balance
                                                            <InfoNote
                                                                text={
                                                                    isPlatform
                                                                        ? UNTRACKED_NOTE_PLATFORM
                                                                        : UNTRACKED_NOTE
                                                                }
                                                            />
                                                        </span>
                                                        <Money
                                                            eur={
                                                                revenue.untrackedBalanceEur
                                                            }
                                                            fx={fx}
                                                            currency={currency}
                                                            className='items-end'
                                                        />
                                                    </div>
                                                    <p className='text-2xs text-muted-foreground'>
                                                        Expected on operator
                                                        link and on-arrival
                                                        bookings. Island Tours
                                                        does not track whether
                                                        it was received, so it
                                                        is never counted as
                                                        income.
                                                    </p>
                                                    <div className='flex items-start justify-between gap-3'>
                                                        <span className='flex items-center gap-1.5 text-sm text-muted-foreground'>
                                                            {isPlatform
                                                                ? 'Payouts due to operators'
                                                                : 'Payout due to you'}
                                                            <InfoNote
                                                                text={
                                                                    PAYOUT_NOTE
                                                                }
                                                            />
                                                        </span>
                                                        <Money
                                                            eur={
                                                                revenue.payoutDueEur
                                                            }
                                                            fx={fx}
                                                            currency={currency}
                                                            className='items-end'
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <ChartEmpty
                                                message='No committed bookings yet.'
                                                className='h-[300px]'
                                            />
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value='status' className='space-y-4'>
                            <div className='grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-2'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Booking status distribution
                                        </CardTitle>
                                        <CardDescription>
                                            Current booking statuses
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className='flex items-center justify-center'>
                                        {hasBookingStatusData ? (
                                            <StatusDonut
                                                data={bookingStatusData}
                                                config={bookingChartConfig}
                                                className='max-h-[300px]'
                                            />
                                        ) : (
                                            <ChartEmpty
                                                icon={Calendar03Icon}
                                                message='No bookings to display'
                                                className='h-[300px]'
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            Trip status distribution
                                        </CardTitle>
                                        <CardDescription>
                                            Your {trips.total} trips breakdown
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className='flex items-center justify-center'>
                                        {hasTripStatusData ? (
                                            <StatusDonut
                                                data={tripStatusData}
                                                config={tripChartConfig}
                                                className='max-h-[300px]'
                                            />
                                        ) : (
                                            <ChartEmpty
                                                icon={Airplane01Icon}
                                                message='No trips to display'
                                                className='h-[300px]'
                                            />
                                        )}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Payment status</CardTitle>
                                        <CardDescription>
                                            Every payment row on the ledger, by
                                            outcome
                                        </CardDescription>
                                    </CardHeader>
                                    {/* Ranked horizontal bars, not a donut. The
                                        outcomes are lopsided (one status
                                        dominates), and a donut turns the small
                                        ones into unreadable arcs - the eye
                                        judges LENGTH far more accurately than
                                        angle. Bars also let long labels sit
                                        inline with no legend.

                                        One colour for every bar: this is a
                                        single series (row counts), and the
                                        status label already carries identity.
                                        Tinting each bar by its status would
                                        double-encode length as hue and spend
                                        the colour channel on information the
                                        bar already shows.

                                        Sorted largest first so the axis reads
                                        as a ranking. Rounded data-ends sit at
                                        the value end only. */}
                                    <CardContent>
                                        {hasPaymentStatusData ? (
                                            <ChartContainer
                                                config={paymentStatusConfig}
                                                className='h-[300px] w-full'>
                                                <BarChart
                                                    data={paymentStatusRows}
                                                    layout='vertical'
                                                    margin={{
                                                        left: 8,
                                                        right: 16,
                                                    }}>
                                                    <CartesianGrid
                                                        horizontal={false}
                                                    />
                                                    <XAxis
                                                        type='number'
                                                        tickLine={false}
                                                        axisLine={false}
                                                        allowDecimals={false}
                                                    />
                                                    <YAxis
                                                        dataKey='name'
                                                        type='category'
                                                        tickLine={false}
                                                        axisLine={false}
                                                        width={132}
                                                    />
                                                    <ChartTooltip
                                                        cursor={false}
                                                        content={
                                                            <ChartTooltipContent
                                                                hideLabel
                                                            />
                                                        }
                                                    />
                                                    <Bar
                                                        dataKey='value'
                                                        fill='var(--chart-1)'
                                                        radius={[0, 4, 4, 0]}
                                                        barSize={22}
                                                    />
                                                </BarChart>
                                            </ChartContainer>
                                        ) : (
                                            <ChartEmpty
                                                icon={CreditCardIcon}
                                                message='No payments to display'
                                                className='h-[300px]'
                                            />
                                        )}
                                    </CardContent>
                                    <CardFooter>
                                        <p className='text-2xs text-muted-foreground'>
                                            {formatRate(paymentSuccessRate)}{' '}
                                            succeeded across {paymentRowTotal}{' '}
                                            payment rows
                                        </p>
                                    </CardFooter>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Customer insights</CardTitle>
                                        <CardDescription>
                                            A customer is a distinct booker,
                                            guests included, not just registered
                                            accounts.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className='space-y-4'>
                                        {/* Row context: `tabular-nums` without `font-mono`
                                            keeps the value column aligned. */}
                                        <div className='flex items-center justify-between'>
                                            <span className='text-sm text-muted-foreground'>
                                                Total bookers
                                            </span>
                                            <span className='font-semibold tabular-nums'>
                                                {customers.total}
                                            </span>
                                        </div>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-sm text-muted-foreground'>
                                                Repeat bookers
                                            </span>
                                            <span className='font-semibold tabular-nums'>
                                                {customers.repeat}
                                            </span>
                                        </div>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-sm text-muted-foreground'>
                                                Active this month
                                            </span>
                                            <span className='font-semibold tabular-nums'>
                                                {customers.activeThisMonth}
                                            </span>
                                        </div>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-sm text-muted-foreground'>
                                                New this month
                                            </span>
                                            <span className='font-semibold tabular-nums'>
                                                {customers.newThisMonth}
                                            </span>
                                        </div>
                                        <div className='flex items-center justify-between'>
                                            <span className='text-sm text-muted-foreground'>
                                                Repeat rate
                                            </span>
                                            <span className='font-semibold tabular-nums'>
                                                {formatRate(
                                                    customers.repeatRate,
                                                )}
                                            </span>
                                        </div>
                                        {/* Null for an operator caller, who cannot see the
                                            platform account table - omitted rather than
                                            shown as a zero. */}
                                        {customers.registered !== null && (
                                            <div className='flex items-center justify-between'>
                                                <span className='text-sm text-muted-foreground'>
                                                    Registered accounts
                                                </span>
                                                <span className='font-semibold tabular-nums'>
                                                    {customers.registered}
                                                </span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        <TabsContent value='breakdowns' className='space-y-4'>
                            {hasAnyBreakdown ? (
                                <div className='grid grid-cols-1 gap-4 *:min-w-0 lg:grid-cols-2'>
                                    {topTourRows.length > 0 && (
                                        <Card>
                                            <BreakdownHeader
                                                icon={Airplane01Icon}
                                                variant='primary'
                                                title='Top tours'
                                                description={
                                                    isPlatform
                                                        ? 'By commission earned on completed bookings'
                                                        : 'By net earnings on completed bookings'
                                                }
                                            />
                                            <CardContent>
                                                {renderBreakdown(topTourRows)}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {/* Platform-only leaderboards: they compare
                                        operators against one another, so the
                                        backend returns them empty for an
                                        operator and these guards hide them. */}
                                    {topOperatorRows.length > 0 && (
                                        <Card>
                                            <BreakdownHeader
                                                icon={Building06Icon}
                                                variant='info'
                                                title='Top operators'
                                                description='By commission the platform earned'
                                            />
                                            <CardContent>
                                                {renderBreakdown(
                                                    topOperatorRows,
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {destinationRows.length > 0 && (
                                        <Card>
                                            <BreakdownHeader
                                                icon={GlobalIcon}
                                                variant='success'
                                                title='Booking value by destination'
                                                description='By gross booking value on committed bookings'
                                            />
                                            <CardContent>
                                                {renderBreakdown(
                                                    destinationRows,
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    {tierRows.length > 0 && (
                                        <Card>
                                            <BreakdownHeader
                                                icon={Award01Icon}
                                                variant='warning'
                                                title='Commission by tier'
                                                description='The commission tier each booked tour was on'
                                            />
                                            <CardContent>
                                                {renderBreakdown(tierRows)}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            ) : (
                                <Card>
                                    <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
                                        <IconTile
                                            icon={Analytics01Icon}
                                            variant='neutral'
                                            size='lg'
                                            className='mb-4'
                                        />
                                        <p className='text-sm font-medium'>
                                            No breakdowns yet
                                        </p>
                                        <p className='mt-1 text-xs text-muted-foreground'>
                                            Leaderboards appear once bookings
                                            have been completed.
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            )}

            {/* Recent activity */}
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
                                    {recentBookings.length > 0 && (
                                        <ActivityGroup title='Recent Bookings'>
                                            {(showAllActivity
                                                ? recentBookings
                                                : recentBookings.slice(0, 4)
                                            ).map((booking, idx) => (
                                                <ActivityRow
                                                    key={booking.id || idx}
                                                    icon={Calendar03Icon}
                                                    variant='primary'
                                                    title={booking.tourName}
                                                    date={booking.createdAt}
                                                    meta={
                                                        <>
                                                            <span className='tabular-nums'>
                                                                {money(
                                                                    booking.totalEur,
                                                                )}
                                                            </span>
                                                            {fx && (
                                                                <span className='tabular-nums'>
                                                                    ≈{' '}
                                                                    {formatMoney(
                                                                        booking.totalEur *
                                                                            fx.rate,
                                                                        fx.quote,
                                                                    )}
                                                                </span>
                                                            )}
                                                            <span>•</span>
                                                            <Ref
                                                                value={
                                                                    booking.displayRef
                                                                }
                                                            />
                                                        </>
                                                    }
                                                    badge={
                                                        <StatusBadge
                                                            status={
                                                                booking.status
                                                            }
                                                        />
                                                    }
                                                />
                                            ))}
                                        </ActivityGroup>
                                    )}

                                    {recentPayments.length > 0 && (
                                        <ActivityGroup title='Recent Payments'>
                                            {(showAllActivity
                                                ? recentPayments
                                                : recentPayments.slice(0, 4)
                                            ).map((payment, idx) => (
                                                <ActivityRow
                                                    key={payment.id || idx}
                                                    icon={MoneyBagIcon}
                                                    variant='success'
                                                    title={money(
                                                        payment.amountEur,
                                                    )}
                                                    titleClassName='tabular-nums'
                                                    date={payment.createdAt}
                                                    meta={
                                                        <>
                                                            <span>
                                                                {humanizeStatus(
                                                                    payment.kind,
                                                                )}
                                                            </span>
                                                            <span>•</span>
                                                            <Ref
                                                                value={
                                                                    payment.displayRef
                                                                }
                                                            />
                                                        </>
                                                    }
                                                    badge={
                                                        <StatusBadge
                                                            status={
                                                                payment.status
                                                            }
                                                        />
                                                    }
                                                />
                                            ))}
                                        </ActivityGroup>
                                    )}

                                    {recentCustomers.length > 0 && (
                                        <ActivityGroup title='Recent Customers'>
                                            {(showAllActivity
                                                ? recentCustomers
                                                : recentCustomers.slice(0, 4)
                                            ).map((customer, idx) => (
                                                <ActivityRow
                                                    key={`${customer.email}-${idx}`}
                                                    icon={UserGroupIcon}
                                                    variant='primary'
                                                    title={customer.name}
                                                    date={
                                                        customer.firstBookingAt
                                                    }
                                                    /* Masked backend-side - dashboards get screenshotted. */
                                                    meta={
                                                        <span className='truncate'>
                                                            {customer.email}
                                                        </span>
                                                    }
                                                    badge={
                                                        <Badge
                                                            variant='outline'
                                                            className='h-5 border-muted-foreground/30 bg-muted/50 px-2 py-0.5 text-2xs text-muted-foreground'>
                                                            {customer.bookings}{' '}
                                                            {customer.bookings ===
                                                            1
                                                                ? 'booking'
                                                                : 'bookings'}
                                                        </Badge>
                                                    }
                                                />
                                            ))}
                                        </ActivityGroup>
                                    )}
                                </div>
                                {hasMoreActivity && (
                                    <div className='mt-4 flex justify-center'>
                                        <button
                                            onClick={() =>
                                                setShowAllActivity(
                                                    !showAllActivity,
                                                )
                                            }
                                            className='flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80'>
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
                                <IconTile
                                    icon={Mail01Icon}
                                    variant='neutral'
                                    size='lg'
                                    className='mb-4'
                                />
                                <p className='text-sm font-medium'>
                                    No recent activity
                                </p>
                                <p className='mt-1 text-xs text-muted-foreground'>
                                    Activity will appear here as you create
                                    bookings and manage customers
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
