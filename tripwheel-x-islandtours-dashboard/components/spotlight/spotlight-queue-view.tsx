'use client';

import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { CalendarCheckIn01Icon, CancelCircleIcon, CheckmarkCircle02Icon, Clock03Icon, SparklesIcon, TimeQuarter02Icon } from '@hugeicons/core-free-icons';

import { DatePickerField } from '@/components/date-picker-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useRole } from '@/contexts/role-context';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import {
    useApproveSpotlight,
    useRejectSpotlight,
    useSpotlightQueue,
} from '@/hooks/tiers/use-tiers';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import type { SpotlightStatus } from '@/types/tier';
import {
    SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION,
    SPOTLIGHT_MIN_RATING,
    SPOTLIGHT_MIN_REVIEWS,
    SPOTLIGHT_STATUS_LABELS,
    SPOTLIGHT_STATUS_VALUES,
} from '@/types/tier';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { SpotlightTable } from './spotlight-table';
import type { SpotlightRequestWithInfo } from './spotlight-columns';

const statusKey: Array<{
    status: SpotlightStatus;
    Icon: IconSvgElement;
    className: string;
}> = [
    {
        status: 'REQUESTED',
        Icon: Clock03Icon,
        className: 'text-warning-fg',
    },
    {
        status: 'APPROVED',
        Icon: CalendarCheckIn01Icon,
        className: 'text-info-fg',
    },
    {
        status: 'ACTIVE',
        Icon: CheckmarkCircle02Icon,
        className: 'text-success-fg',
    },
    {
        status: 'REJECTED',
        Icon: CancelCircleIcon,
        className: 'text-danger-fg',
    },
    {
        status: 'EXPIRED',
        Icon: TimeQuarter02Icon,
        className: 'text-content-muted',
    },
];

export function SpotlightQueueView() {
    const { can } = useRole();
    const canApprove = can('APPROVE_SPOTLIGHT');

    const [destinationId, setDestinationId] = useState<string>('all');
    const [status, setStatus] = useState<string>('REQUESTED');

    const { data: destinations } = useActiveDestinations();
    const { data: adminTrips } = useAdminTrips({ limit: 200 });
    const { data: queue, isLoading } = useSpotlightQueue({
        destinationId: destinationId !== 'all' ? destinationId : undefined,
        status: status !== 'all' ? (status as SpotlightStatus) : undefined,
    });
    const { data: statusQueue } = useSpotlightQueue();

    const [approveTarget, setApproveTarget] = useState<SpotlightRequestWithInfo | null>(null);
    const [rejectTarget, setRejectTarget] = useState<SpotlightRequestWithInfo | null>(null);

    // Tour id -> display info (name, operator, destination, image, rating, reviewCount) from the admin tour list.
    const tourMap = useMemo(() => {
        const map = new Map<
            string,
            { name: string; operator: string; destination: string; image?: string | null; rating: number | null; reviewCount: number }
        >();
        for (const t of adminTrips?.data ?? []) {
            map.set(t.id, {
                name: t.name,
                operator:
                    t.operatorInfo?.companyName ??
                    t.operatorInfo?.userName ??
                    '—',
                destination: t.destinationName ?? '—',
                image: t.heroImage?.url,
                rating: t.aggregateRating,
                reviewCount: t.aggregateReviewCount,
            });
        }
        return map;
    }, [adminTrips]);

    // Enrich each spotlight request with tour info for the table
    const rows: SpotlightRequestWithInfo[] = useMemo(() => {
        return (queue?.data ?? []).map((req) => ({
            ...req,
            tourInfo: tourMap.get(req.tourId),
        }));
    }, [queue, tourMap]);

    const statusRows: SpotlightRequestWithInfo[] = useMemo(() => {
        return (statusQueue?.data ?? []).map((req) => ({
            ...req,
            tourInfo: tourMap.get(req.tourId),
        }));
    }, [statusQueue, tourMap]);

    const statusCounts = useMemo(() => {
        const counts = new Map<SpotlightStatus, number>();
        for (const s of SPOTLIGHT_STATUS_VALUES) counts.set(s, 0);
        let eligibleRequested = 0;
        let blockedRequested = 0;

        for (const row of statusRows) {
            counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
            if (row.status === 'REQUESTED') {
                const reviewCount = row.tourInfo?.reviewCount ?? 0;
                const rating = row.tourInfo?.rating ?? 0;
                if (
                    reviewCount >= SPOTLIGHT_MIN_REVIEWS &&
                    rating >= SPOTLIGHT_MIN_RATING
                ) {
                    eligibleRequested += 1;
                } else {
                    blockedRequested += 1;
                }
            }
        }

        return { counts, eligibleRequested, blockedRequested };
    }, [statusRows]);

    return (
        <div className='space-y-4'>
            {isLoading ? (
                <div className='space-y-2 p-4'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className='h-12 w-full rounded-none'
                        />
                    ))}
                </div>
            ) : (
                <>
                    <div
                        role='tablist'
                        aria-label='Filter spotlight requests by status'
                        className='flex flex-wrap items-center gap-1 border-b border-border/70'
                    >
                        {statusKey.map(({ status: key, Icon, className }) => (
                            <button
                                type='button'
                                role='tab'
                                key={key}
                                onClick={() => setStatus(key)}
                                aria-selected={status === key}
                                className={cn(
                                    'relative -mb-px inline-flex h-9 items-center gap-2 border-b-2 border-transparent px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                    status === key
                                        ? 'border-foreground text-foreground'
                                        : 'hover:border-border'
                                )}>
                                <HugeiconsIcon
                                    icon={Icon}
                                    className={cn('size-3.5', className)}
                                />
                                <span>{SPOTLIGHT_STATUS_LABELS[key]}</span>
                                <span
                                    className={cn(
                                        'rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums text-muted-foreground',
                                        status === key && 'bg-foreground text-background'
                                    )}
                                >
                                    {statusCounts.counts.get(key) ?? 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    <SpotlightTable
                        data={rows}
                        canApprove={canApprove}
                        onApprove={setApproveTarget}
                        onReject={setRejectTarget}
                        filterSlot={
                            <>
                                <Select
                                    value={destinationId}
                                    onValueChange={setDestinationId}>
                                    <SelectTrigger className='w-48 shrink-0'>
                                        <SelectValue placeholder='Destination' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='all'>
                                            All Destinations
                                        </SelectItem>
                                        {(destinations ?? []).map((d) => (
                                            <SelectItem key={d.id} value={d.id}>
                                                {d.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className='w-40 shrink-0'>
                                        <SelectValue placeholder='Status' />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='all'>
                                            All Statuses
                                        </SelectItem>
                                        {SPOTLIGHT_STATUS_VALUES.map((s) => (
                                            <SelectItem key={s} value={s}>
                                                {SPOTLIGHT_STATUS_LABELS[s]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                
                                {destinationId !== 'all' && queue && (
                                    <Badge
                                        variant={
                                            queue.activeCount >=
                                            SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION
                                                ? 'destructive'
                                                : 'secondary'
                                        }
                                        className='h-9 px-3'>
                                        Active {queue.activeCount}/
                                        {SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION}
                                    </Badge>
                                )}
                            </>
                        }
                    />
                </>
            )}

            <ApproveDialog
                target={approveTarget}
                onClose={() => setApproveTarget(null)}
                tourName={approveTarget?.tourInfo?.name}
            />
            <RejectDialog
                target={rejectTarget}
                onClose={() => setRejectTarget(null)}
                tourName={rejectTarget?.tourInfo?.name}
            />
        </div>
    );
}

function ApproveDialog({
    target,
    onClose,
    tourName,
}: {
    target: SpotlightRequestWithInfo | null;
    onClose: () => void;
    tourName?: string;
}) {
    const { mutate: approve, isPending } = useApproveSpotlight();
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [note, setNote] = useState('');

    // Reset the form when a new target opens (render-time guard, not an effect).
    const [seedId, setSeedId] = useState<string | null>(null);
    if (target && target.id !== seedId) {
        setSeedId(target.id);
        setStartsAt(
            target.requestedStartsAt
                ? target.requestedStartsAt.slice(0, 10)
                : ''
        );
        setEndsAt('');
        setNote('');
    }

    function handleApprove() {
        if (!target) return;
        if (!startsAt || !endsAt) {
            toast.error('Both a start and end date are required.');
            return;
        }
        if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
            toast.error('End date must be after the start date.');
            return;
        }
        approve(
            {
                id: target.id,
                payload: { startsAt, endsAt, note: note.trim() || undefined },
            },
            {
                onSuccess: () => {
                    toast.success('Spotlight approved.');
                    onClose();
                },
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to approve.'
                    ),
            }
        );
    }

    return (
        <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className='flex items-center gap-2'>
                        <HugeiconsIcon icon={SparklesIcon} className='size-4' />
                        Approve Spotlight{tourName ? ` — ${tourName}` : ''}
                    </DialogTitle>
                </DialogHeader>
                <div className='space-y-4'>
                    <p className='text-xs text-muted-foreground'>
                        Set the live window. While active the tour&apos;s
                        commission is overlaid at 35% and it counts toward the
                        max 3 active spotlights for its destination.
                    </p>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field>
                            <Label>
                                Starts
                            </Label>
                            <DatePickerField
                                value={startsAt}
                                onChange={setStartsAt}
                                placeholder='Start date'
                            />
                        </Field>
                        <Field>
                            <Label>
                                Ends
                            </Label>
                            <DatePickerField
                                value={endsAt}
                                onChange={setEndsAt}
                                placeholder='End date'
                            />
                        </Field>
                    </div>
                    <Field>
                        <Label>
                            Note (optional)
                        </Label>
                        <Textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={2}
                            placeholder='Internal note'
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={onClose}
                        disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleApprove} disabled={isPending}>
                        {isPending ? 'Approving...' : 'Approve'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function RejectDialog({
    target,
    onClose,
    tourName,
}: {
    target: SpotlightRequestWithInfo | null;
    onClose: () => void;
    tourName?: string;
}) {
    const { mutate: reject, isPending } = useRejectSpotlight();
    const [reason, setReason] = useState('');

    const [seedId, setSeedId] = useState<string | null>(null);
    if (target && target.id !== seedId) {
        setSeedId(target.id);
        setReason('');
    }

    function handleReject() {
        if (!target) return;
        if (!reason.trim()) {
            toast.error('A rejection reason is required.');
            return;
        }
        reject(
            { id: target.id, payload: { rejectionReason: reason.trim() } },
            {
                onSuccess: () => {
                    toast.success('Spotlight rejected.');
                    onClose();
                },
                onError: err =>
                    toast.error(
                        err instanceof Error ? err.message : 'Failed to reject.'
                    ),
            }
        );
    }

    return (
        <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Reject Spotlight{tourName ? ` — ${tourName}` : ''}
                    </DialogTitle>
                </DialogHeader>
                <Field>
                    <Label>
                        Reason
                    </Label>
                    <Textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={3}
                        placeholder='Tell the operator why this was rejected'
                    />
                </Field>
                <DialogFooter>
                    <Button
                        variant='outline'
                        onClick={onClose}
                        disabled={isPending}>
                        Cancel
                    </Button>
                    <Button
                        variant='destructive'
                        onClick={handleReject}
                        disabled={isPending}>
                        {isPending ? 'Rejecting...' : 'Reject'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
