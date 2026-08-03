'use client';

import {
    Cancel01Icon,
    InformationCircleIcon,
    SparklesIcon,
    SquareLock02Icon,
    Tick02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { DatePickerField } from '@/components/date-picker-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useChangeTier,
    useRequestSpotlight,
    useTourSpotlight,
} from '@/hooks/tiers/use-tiers';
import { useSetLikelyToSellOut } from '@/hooks/trips/use-trips';
import { cn, formatDate } from '@/lib/utils';
import type { SpotlightStatus, TierKey } from '@/types/tier';
import {
    SPOTLIGHT_COMMISSION_PCT,
    SPOTLIGHT_MIN_RATING,
    SPOTLIGHT_MIN_REVIEWS,
    SPOTLIGHT_STATUS_LABELS,
    TIER_KEY_VALUES,
    TIER_LOCK_DAYS,
    TIER_META,
} from '@/types/tier';
import type { EligibilityState, TripListItem } from '@/types/trip';
import { useState } from 'react';
import { toast } from 'sonner';

const spotlightStatusVariant: Record<
    SpotlightStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    REQUESTED: 'secondary',
    APPROVED: 'default',
    ACTIVE: 'default',
    REJECTED: 'destructive',
    EXPIRED: 'outline',
};

/** Statuses that block submitting a new request (one is already live/pending). */
const BLOCKING_STATUSES: SpotlightStatus[] = [
    'REQUESTED',
    'APPROVED',
    'ACTIVE',
];

// The demand-badge override is not needed in the dashboard right now, so it is
// hidden from the UI. Flip to true to bring the admin control back - the
// wizard's reach step renders it behind this flag, gated on MANAGE_TRIPS.
export const SHOW_DEMAND_BADGE_OVERRIDE = false;

// ── Demand badge override (admin) ──────────────────────────────────────────────
// `likelyToSellOut` is recomputed nightly (§3.7). This override forces the badge on
// or off for launch, or defers to the computed value (null).
export function DemandBadgeCard({ trip }: { trip: TripListItem }) {
    // Its own verb, not a PATCH key - see tripsApi.setLikelyToSellOut.
    const { mutate: setLikelyToSellOut, isPending } = useSetLikelyToSellOut();

    const value: 'auto' | 'on' | 'off' =
        trip.likelyToSellOutOverride == null
            ? 'auto'
            : trip.likelyToSellOutOverride
              ? 'on'
              : 'off';

    function handleChange(next: 'auto' | 'on' | 'off') {
        if (next === value) return;
        const override = next === 'auto' ? null : next === 'on';
        setLikelyToSellOut(
            { id: trip.id, value: override },
            {
                onSuccess: () =>
                    toast.success('Demand badge override updated.'),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update override.'
                    ),
            }
        );
    }

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-sm'>Demand Badge Override</CardTitle>
            </CardHeader>
            <CardContent className='pt-6 space-y-6'>
                <div className='flex items-center gap-3 text-sm'>
                    <p className='text-xs font-medium text-muted-foreground'>
                        Computed now
                    </p>
                    <Badge
                        variant={
                            trip.likelyToSellOut ? 'default' : 'secondary'
                        }>
                        {trip.likelyToSellOut
                            ? 'Likely to sell out'
                            : 'Normal demand'}
                    </Badge>
                </div>
                <Field className='w-full sm:w-72'>
                    <Label>Override</Label>
                    <Select
                        value={value}
                        onValueChange={v =>
                            handleChange(v as 'auto' | 'on' | 'off')
                        }
                        disabled={isPending}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='auto'>
                                Automatic (use computed value)
                            </SelectItem>
                            <SelectItem value='on'>
                                Force on (show badge)
                            </SelectItem>
                            <SelectItem value='off'>
                                Force off (hide badge)
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <FieldDescription>
                        The &ldquo;Likely to sell out&rdquo; badge is recomputed
                        nightly. Use this to force it on or off for launch, or
                        leave on Automatic to defer to the computed value.
                    </FieldDescription>
                </Field>
            </CardContent>
        </Card>
    );
}

// ── Commission tier ──────────────────────────────────────────────────────────

/** "Ranks first" reads; "Rank 1" is a database column shown to a stranger. */
const RANK_WORD: Record<number, string> = {
    1: 'first',
    2: 'second',
    3: 'third',
    4: 'fourth',
    5: 'last',
};

/**
 * `eligibilityState` is a raw enum and was rendered as one - an operator seeing
 * the badge "GRACE" learns nothing, and "DEMOTED" reads like an accusation with
 * no explanation attached.
 */
const ELIGIBILITY_COPY: Record<EligibilityState, string> = {
    ELIGIBLE: 'Meeting the requirements for this tier.',
    PROVISIONAL:
        'Newly listed - holding this tier while it builds a track record.',
    GRACE: 'Below the requirements for this tier, with time to recover before it changes.',
    DEMOTED: 'Moved down a tier after staying below the requirements.',
    LOCKED: 'Tier changes are paused on this tour.',
};

/**
 * A per-TOUR commercial decision, not an operator-level one: the tier drives
 * this tour's rank, its commission, and its deposit percentage. Every new tour
 * ships on `standard` whether the operator looks or not, which is exactly why
 * the wizard makes them look (07 §3, step 8). `bare` drops the Card chrome the
 * wizard's own section header provides.
 */
export function TierCard({
    trip,
    canEdit,
    bare = false,
}: {
    trip: TripListItem;
    canEdit: boolean;
    bare?: boolean;
}) {
    const { mutate: changeTier, isPending } = useChangeTier();

    // Keep the picker synced to the latest server value (render-time guard, not an effect).
    const [selectedTier, setSelectedTier] = useState<TierKey>(trip.tierKey);
    const [seedTier, setSeedTier] = useState<TierKey>(trip.tierKey);
    if (trip.tierKey !== seedTier) {
        setSeedTier(trip.tierKey);
        setSelectedTier(trip.tierKey);
    }

    // Capture "now" once at mount (lazy initializer keeps the render body pure).
    const [now] = useState(() => Date.now());
    const lockedUntil = trip.tierLockedUntil
        ? new Date(trip.tierLockedUntil)
        : null;
    const isLocked = !!lockedUntil && lockedUntil.getTime() > now;
    const dirty = selectedTier !== trip.tierKey;

    function handleSave() {
        changeTier(
            { tourId: trip.id, payload: { tierKey: selectedTier } },
            {
                onSuccess: () =>
                    toast.success(
                        `Tier changed to ${TIER_META[selectedTier].label}. Locked for 30 days.`
                    ),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to change tier.'
                    ),
            }
        );
    }

    const current = TIER_META[trip.tierKey];

    const body = (
        <div className='space-y-6'>
            {/* What you are on now, as a sentence rather than a stat grid. Four
                unlabelled numbers in a row made "Rank 1" and "30%" look like
                readings off a dashboard; they are the terms of a contract. */}
            <div className='rounded-lg border border-line bg-surface-sunken/50 px-4 py-3'>
                <p className='text-sm text-content'>
                    <span className='font-medium'>{current.label}</span>
                    <span className='text-content-muted'>
                        {' '}
                        · {trip.commissionTier}% commission · ranks{' '}
                        {RANK_WORD[current.rank] ?? `#${trip.tierRank}`}
                    </span>
                </p>
                <p className='mt-1 text-xs text-content-muted'>
                    {ELIGIBILITY_COPY[trip.eligibilityState] ??
                        trip.eligibilityState}
                </p>
                {isLocked && (
                    <p className='mt-2 flex items-center gap-1.5 text-xs text-content-muted'>
                        <HugeiconsIcon
                            icon={SquareLock02Icon}
                            className='size-3.5 shrink-0'
                        />
                        Locked until {formatDate(trip.tierLockedUntil!)} - a tier
                        change holds for {TIER_LOCK_DAYS} days.
                    </p>
                )}
            </div>

            {canEdit && (
                <div className='space-y-3'>
                    {/* A dropdown asked the operator to choose between five
                        numbers with no way to see what any of them buys - and
                        made the highest commission look like the worst option,
                        when it is the one that ranks first. Laid out, the
                        trade is legible: pay more, rank higher, and travellers
                        pay more up front. */}
                    <p className='text-sm font-medium text-content'>
                        Choose a tier
                    </p>
                    <div
                        role='radiogroup'
                        aria-label='Commission tier'
                        className='divide-y divide-line overflow-hidden rounded-lg border border-line'>
                        {TIER_KEY_VALUES.map(key => {
                            const meta = TIER_META[key];
                            const selected = key === selectedTier;
                            return (
                                <button
                                    key={key}
                                    type='button'
                                    role='radio'
                                    aria-checked={selected}
                                    disabled={isLocked || isPending}
                                    onClick={() => setSelectedTier(key)}
                                    className={cn(
                                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast',
                                        selected
                                            ? 'bg-primary-subtle'
                                            : 'hover:bg-surface-sunken/60',
                                        (isLocked || isPending) &&
                                            'cursor-not-allowed opacity-60'
                                    )}>
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                                            selected
                                                ? 'border-primary bg-primary'
                                                : 'border-line-strong'
                                        )}>
                                        {selected && (
                                            <span className='size-1.5 rounded-full bg-primary-foreground' />
                                        )}
                                    </span>
                                    <span className='min-w-0 flex-1'>
                                        <span className='flex flex-wrap items-baseline gap-x-2'>
                                            <span className='text-sm font-medium text-content'>
                                                {meta.label}
                                            </span>
                                            {key === trip.tierKey && (
                                                <span className='text-xs text-content-muted'>
                                                    current
                                                </span>
                                            )}
                                        </span>
                                        <span className='mt-0.5 block text-xs text-content-muted'>
                                            Ranks {RANK_WORD[meta.rank]} ·{' '}
                                            {meta.commission}% commission ·
                                            travellers pay {meta.commission}% up
                                            front
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className='flex items-center justify-between gap-3'>
                        <p className='text-xs text-content-muted'>
                            {dirty
                                ? `Saving locks ${TIER_META[selectedTier].label} for ${TIER_LOCK_DAYS} days.`
                                : 'Ranking is tier first, then quality score.'}
                        </p>
                        <Button
                            type='button'
                            onClick={handleSave}
                            disabled={!dirty || isLocked || isPending}>
                            {isPending ? 'Saving...' : 'Save tier'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-sm'>Commission Tier</CardTitle>
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

// ── Destination spotlight ────────────────────────────────────────────────────
/**
 * Spotlight is structurally unavailable on a new tour: it needs
 * SPOTLIGHT_MIN_REVIEWS reviews and a SPOTLIGHT_MIN_RATING average, and a tour
 * created today has zero of both. The card therefore has two states (07 §3,
 * step 8):
 *
 * - **not yet eligible** - the explainer plus the two criteria as live
 *   counters, and no form. The previous behaviour drew the date picker, the
 *   duration field and a Request button next to a warning saying the request
 *   would be rejected, which is a form inviting a guaranteed-failed action.
 * - **eligible, or a request already exists** - unchanged: the full request
 *   form, the status block and the history.
 *
 * The endpoint, the eligibility constants and the blocking-status rule are
 * untouched; only whether the form is worth drawing changed.
 */
export function SpotlightCard({
    trip,
    canEdit,
    bare = false,
}: {
    trip: TripListItem;
    canEdit: boolean;
    bare?: boolean;
}) {
    const { data, isLoading } = useTourSpotlight(trip.id);
    const { mutate: requestSpotlight, isPending } = useRequestSpotlight();

    const [startsAt, setStartsAt] = useState('');
    const [durationDays, setDurationDays] = useState('');

    const reviewsOk = trip.aggregateReviewCount >= SPOTLIGHT_MIN_REVIEWS;
    const ratingOk = (trip.aggregateRating ?? 0) >= SPOTLIGHT_MIN_RATING;
    const eligible = reviewsOk && ratingOk;

    const current = data?.current ?? null;
    const blocked = !!current && BLOCKING_STATUSES.includes(current.status);

    function handleRequest() {
        requestSpotlight(
            {
                tourId: trip.id,
                payload: {
                    requestedStartsAt: startsAt || undefined,
                    requestedDurationDays: durationDays
                        ? Number(durationDays)
                        : undefined,
                },
            },
            {
                onSuccess: () => {
                    toast.success(
                        'Spotlight requested. An admin will review it.'
                    );
                    setStartsAt('');
                    setDurationDays('');
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to request spotlight.'
                    ),
            }
        );
    }

    const body = (
        <div className='space-y-6'>
            <p className='text-xs text-muted-foreground'>
                A Destination Spotlight gives this tour a featured block on the
                destination page and raises its commission to{' '}
                {SPOTLIGHT_COMMISSION_PCT}% while active. Requests are reviewed
                and scheduled by an admin (max 3 active per destination).
            </p>

            {/* Eligibility */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                <EligibilityItem
                    label={`At least ${SPOTLIGHT_MIN_REVIEWS} reviews`}
                    detail={`${trip.aggregateReviewCount} so far`}
                    passed={reviewsOk}
                />
                <EligibilityItem
                    label={`Rating of ${SPOTLIGHT_MIN_RATING} or higher`}
                    detail={
                        trip.aggregateRating != null
                            ? `${trip.aggregateRating.toFixed(1)} now`
                            : 'no rating yet'
                    }
                    passed={ratingOk}
                />
            </div>

            {isLoading ? (
                <Skeleton className='h-24 w-full rounded-md' />
            ) : current ? (
                <div className='border bg-muted/40 px-4 py-3 space-y-2 text-sm'>
                    <div className='flex items-center gap-2'>
                        <span className='text-xs font-medium text-muted-foreground'>
                            Latest request
                        </span>
                        <Badge variant={spotlightStatusVariant[current.status]}>
                            {SPOTLIGHT_STATUS_LABELS[current.status]}
                        </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                        Requested {formatDate(current.requestedAt)}
                    </p>
                    {current.status === 'ACTIVE' ||
                    current.status === 'APPROVED' ? (
                        <p className='text-xs text-muted-foreground'>
                            Window:{' '}
                            {current.startsAt
                                ? formatDate(current.startsAt)
                                : '—'}{' '}
                            to{' '}
                            {current.endsAt ? formatDate(current.endsAt) : '—'}
                        </p>
                    ) : null}
                    {current.status === 'REJECTED' &&
                        current.rejectionReason && (
                            <p className='text-xs text-destructive'>
                                Reason: {current.rejectionReason}
                            </p>
                        )}
                </div>
            ) : null}

            {/* Not eligible yet: explain, do not offer. A request submitted now
            is rejected by definition, so there is no form to draw. */}
            {canEdit && !blocked && !eligible && (
                <div className='flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground'>
                    <HugeiconsIcon
                        icon={InformationCircleIcon}
                        className='size-3.5 shrink-0 mt-0.5'
                    />
                    <span>
                        Spotlight opens up once this tour has{' '}
                        {SPOTLIGHT_MIN_REVIEWS} reviews at a{' '}
                        {SPOTLIGHT_MIN_RATING} average. Keep running it and this
                        section becomes a request form on its own.
                    </span>
                </div>
            )}

            {canEdit && !blocked && eligible && (
                <div className='space-y-4 border-t pt-4'>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field>
                            <Label>Preferred Start (optional)</Label>
                            <DatePickerField
                                value={startsAt}
                                onChange={setStartsAt}
                                placeholder='Pick a start date'
                                clearable
                            />
                        </Field>
                        <Field>
                            <Label>Preferred Duration (days, optional)</Label>
                            <Input
                                type='number'
                                min={1}
                                max={365}
                                value={durationDays}
                                onChange={e => setDurationDays(e.target.value)}
                                placeholder='e.g. 30'
                            />
                        </Field>
                    </div>
                    <div className='flex justify-end'>
                        <Button
                            type='button'
                            onClick={handleRequest}
                            disabled={isPending}>
                            <HugeiconsIcon
                                icon={SparklesIcon}
                                className='size-3.5'
                            />
                            {isPending ? 'Requesting...' : 'Request Spotlight'}
                        </Button>
                    </div>
                </div>
            )}

            {canEdit && blocked && (
                <p className='text-xs text-muted-foreground border-t pt-4'>
                    A request is already{' '}
                    {SPOTLIGHT_STATUS_LABELS[current!.status].toLowerCase()}.
                    You can submit a new request once it is resolved.
                </p>
            )}

            {/* History */}
            {data && data.history.length > 1 && (
                <div className='border-t pt-4 space-y-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                        History
                    </p>
                    {data.history.map(req => (
                        <div
                            key={req.id}
                            className='flex items-center justify-between gap-3 text-xs'>
                            <span className='text-muted-foreground'>
                                {formatDate(req.requestedAt)}
                            </span>
                            <Badge variant={spotlightStatusVariant[req.status]}>
                                {SPOTLIGHT_STATUS_LABELS[req.status]}
                            </Badge>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    if (bare) return body;

    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='text-sm flex items-center gap-2'>
                    <HugeiconsIcon icon={SparklesIcon} className='size-4' />
                    Destination Spotlight
                </CardTitle>
            </CardHeader>
            <CardContent className='pt-6'>{body}</CardContent>
        </Card>
    );
}

function EligibilityItem({
    label,
    detail,
    passed,
}: {
    label: string;
    detail: string;
    passed: boolean;
}) {
    return (
        <div className='flex items-center gap-2 text-sm'>
            {passed ? (
                <HugeiconsIcon
                    icon={Tick02Icon}
                    className='size-4 text-success-solid shrink-0'
                />
            ) : (
                <HugeiconsIcon
                    icon={Cancel01Icon}
                    className='size-4 text-destructive shrink-0'
                />
            )}
            <span
                className={
                    passed ? 'text-muted-foreground' : 'text-destructive'
                }>
                {label}{' '}
                <span className='text-muted-foreground'>({detail})</span>
            </span>
        </div>
    );
}

