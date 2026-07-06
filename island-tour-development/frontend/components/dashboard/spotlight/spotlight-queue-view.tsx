'use client';

import { DatePickerField } from '@/components/dashboard/date-picker-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useRole } from '@/contexts/role-context';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import {
    useApproveSpotlight,
    useRejectSpotlight,
    useSpotlightQueue,
} from '@/hooks/tiers/use-tiers';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import { formatDate } from '@/lib/utils';
import type { SpotlightRequest, SpotlightStatus } from '@/types/tier';
import {
    SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION,
    SPOTLIGHT_STATUS_LABELS,
    SPOTLIGHT_STATUS_VALUES,
} from '@/types/tier';
import { CheckIcon, SparklesIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

const statusVariant: Record<
    SpotlightStatus,
    'default' | 'secondary' | 'destructive' | 'outline'
> = {
    REQUESTED: 'secondary',
    APPROVED: 'default',
    ACTIVE: 'default',
    REJECTED: 'destructive',
    EXPIRED: 'outline',
};

export function SpotlightQueueView() {
    const { can } = useRole();
    const canApprove = can('APPROVE_SPOTLIGHT');

    const [destinationId, setDestinationId] = useState<string>('all');
    const [status, setStatus] = useState<string>('all');

    const { data: destinations } = useActiveDestinations();
    const { data: adminTrips } = useAdminTrips({ limit: 200 });
    const { data: queue, isLoading } = useSpotlightQueue({
        destinationId: destinationId !== 'all' ? destinationId : undefined,
        status: status !== 'all' ? (status as SpotlightStatus) : undefined,
    });

    console.log(`destinations`, destinations);
    console.log(`adminTrips`, adminTrips);
    console.log(`queue`, queue);

    const [approveTarget, setApproveTarget] = useState<SpotlightRequest | null>(
        null
    );
    const [rejectTarget, setRejectTarget] = useState<SpotlightRequest | null>(
        null
    );

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

    const rows = queue?.data ?? [];

    return (
        <div className='space-y-4'>
            <div className='flex flex-wrap items-end justify-between gap-3'>
                <div className='flex flex-wrap items-end gap-3'>
                    <div>
                        <Label className='text-xs font-semibold uppercase'>
                            Destination
                        </Label>
                        <Select
                            value={destinationId}
                            onValueChange={setDestinationId}>
                            <SelectTrigger className='mt-1 w-56'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>
                                    All Destinations
                                </SelectItem>
                                {(destinations ?? []).map(d => (
                                    <SelectItem key={d.id} value={d.id}>
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className='text-xs font-semibold uppercase'>
                            Status
                        </Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger className='mt-1 w-44'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='all'>
                                    All Statuses
                                </SelectItem>
                                {SPOTLIGHT_STATUS_VALUES.map(s => (
                                    <SelectItem key={s} value={s}>
                                        {SPOTLIGHT_STATUS_LABELS[s]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

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
            </div>

            <Card>
                <CardContent className='p-0'>
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tour</TableHead>
                                    <TableHead>Operator</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead>Requested</TableHead>
                                    <TableHead>Preferred</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className='w-28' />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className='py-8 text-center text-sm text-muted-foreground'>
                                            No spotlight requests match these
                                            filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {rows.map(req => {
                                    const info = tourMap.get(req.tourId);
                                    const isEligible = (info?.reviewCount ?? 0) >= 10 && (info?.rating ?? 0) >= 4.5;
                                    return (
                                        <TableRow key={req.id}>
                                            <TableCell className='text-sm font-medium'>
                                                <div className='flex flex-col gap-1'>
                                                    <Link
                                                        href={`/dashboard/trips/${req.tourId}/edit`}
                                                        className='flex items-center gap-3 hover:underline w-fit'>
                                                        {info?.image ? (
                                                            <div className='size-10 shrink-0 overflow-hidden rounded-md bg-muted'>
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={info.image}
                                                                    alt={info.name}
                                                                    className='size-full object-cover'
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div className='size-10 shrink-0 rounded-md bg-muted' />
                                                        )}
                                                        <span>
                                                            {info?.name ?? (
                                                                <span className='font-mono text-xs text-muted-foreground'>
                                                                    {req.tourId.slice(0, 8)}
                                                                    …
                                                                </span>
                                                            )}
                                                        </span>
                                                    </Link>
                                                    {info?.reviewCount !== undefined && (
                                                        <span className='text-xs text-muted-foreground pl-[3.25rem]'>
                                                            {info.rating ? `${info.rating.toFixed(1)}/5` : 'No rating'} ({info.reviewCount} {info.reviewCount === 1 ? 'review' : 'reviews'})
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className='text-sm text-muted-foreground'>
                                                <Link
                                                    href={`/dashboard/tour-operators/${req.operatorId}`}
                                                    className='hover:underline'>
                                                    {info?.operator ?? '—'}
                                                </Link>
                                            </TableCell>
                                            <TableCell className='text-sm text-muted-foreground'>
                                                <div className='flex flex-col gap-1'>
                                                    <Link
                                                        href={`/dashboard/destinations/${req.destinationId}`}
                                                        className='hover:underline w-fit'>
                                                        {info?.destination ?? '—'}
                                                    </Link>
                                                    <span
                                                        className={`text-xs ${(queue?.activeCountByDestination?.[req.destinationId] ?? 0) >= SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                                                        Active: {queue?.activeCountByDestination?.[req.destinationId] ?? 0}/{SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className='text-xs text-muted-foreground'>
                                                {formatDate(req.requestedAt)}
                                            </TableCell>
                                            <TableCell className='text-xs text-muted-foreground'>
                                                {req.requestedStartsAt
                                                    ? formatDate(
                                                          req.requestedStartsAt
                                                      )
                                                    : '—'}
                                                {req.requestedDurationDays
                                                    ? ` · ${req.requestedDurationDays}d`
                                                    : ''}
                                            </TableCell>
                                            <TableCell>
                                                <div className='flex flex-col items-start gap-1.5'>
                                                    <Badge
                                                        variant={
                                                            statusVariant[
                                                                req.status
                                                            ]
                                                        }>
                                                        {
                                                            SPOTLIGHT_STATUS_LABELS[
                                                                req.status
                                                            ]
                                                        }
                                                    </Badge>
                                                    {req.status === 'REQUESTED' && (
                                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isEligible ? 'text-emerald-600' : 'text-destructive'}`}>
                                                            {isEligible ? 'Eligible' : 'Ineligible'}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {canApprove &&
                                                    req.status ===
                                                        'REQUESTED' && (
                                                        <div className='flex items-center justify-end gap-1'>
                                                            <Button
                                                                size='xs'
                                                                disabled={!isEligible}
                                                                title={!isEligible ? 'Does not meet eligibility requirements (>=10 reviews, >=4.5 rating)' : undefined}
                                                                onClick={() =>
                                                                    setApproveTarget(
                                                                        req
                                                                    )
                                                                }>
                                                                <CheckIcon className='size-3.5' />
                                                                Approve
                                                            </Button>
                                                            <Button
                                                                size='icon-xs'
                                                                variant='ghost'
                                                                className='text-destructive hover:text-destructive hover:bg-destructive/10'
                                                                onClick={() =>
                                                                    setRejectTarget(
                                                                        req
                                                                    )
                                                                }>
                                                                <XIcon className='size-3.5' />
                                                            </Button>
                                                        </div>
                                                    )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ApproveDialog
                target={approveTarget}
                onClose={() => setApproveTarget(null)}
                tourName={
                    approveTarget
                        ? tourMap.get(approveTarget.tourId)?.name
                        : undefined
                }
            />
            <RejectDialog
                target={rejectTarget}
                onClose={() => setRejectTarget(null)}
                tourName={
                    rejectTarget
                        ? tourMap.get(rejectTarget.tourId)?.name
                        : undefined
                }
            />
        </div>
    );
}

function ApproveDialog({
    target,
    onClose,
    tourName,
}: {
    target: SpotlightRequest | null;
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
                        <SparklesIcon className='size-4' />
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
                            <Label className='text-xs font-semibold uppercase'>
                                Starts
                            </Label>
                            <DatePickerField
                                value={startsAt}
                                onChange={setStartsAt}
                                placeholder='Start date'
                            />
                        </Field>
                        <Field>
                            <Label className='text-xs font-semibold uppercase'>
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
                        <Label className='text-xs font-semibold uppercase'>
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
    target: SpotlightRequest | null;
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
                    <Label className='text-xs font-semibold uppercase'>
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

