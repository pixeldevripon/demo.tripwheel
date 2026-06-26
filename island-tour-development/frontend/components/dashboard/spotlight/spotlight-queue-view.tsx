'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DatePickerField } from '@/components/dashboard/date-picker-field';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRole } from '@/contexts/role-context';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import {
  useApproveSpotlight,
  useRejectSpotlight,
  useSpotlightQueue,
} from '@/hooks/tiers/use-tiers';
import { formatDate } from '@/lib/utils';
import type { SpotlightRequest, SpotlightStatus } from '@/types/tier';
import {
  SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION,
  SPOTLIGHT_STATUS_LABELS,
  SPOTLIGHT_STATUS_VALUES,
} from '@/types/tier';

const statusVariant: Record<SpotlightStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
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

  const [approveTarget, setApproveTarget] = useState<SpotlightRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SpotlightRequest | null>(null);

  // Tour id -> display info (name, operator, destination) from the admin tour list.
  const tourMap = useMemo(() => {
    const map = new Map<string, { name: string; operator: string; destination: string }>();
    for (const t of adminTrips?.data ?? []) {
      map.set(t.id, {
        name: t.name,
        operator: t.operatorInfo?.companyName ?? t.operatorInfo?.userName ?? '—',
        destination: t.destinationName ?? '—',
      });
    }
    return map;
  }, [adminTrips]);

  const rows = queue?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs font-semibold uppercase">Destination</Label>
            <Select value={destinationId} onValueChange={setDestinationId}>
              <SelectTrigger className="mt-1 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Destinations</SelectItem>
                {(destinations ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {SPOTLIGHT_STATUS_VALUES.map((s) => (
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
            variant={queue.activeCount >= SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION ? 'destructive' : 'secondary'}
            className="h-9 px-3"
          >
            Active {queue.activeCount}/{SPOTLIGHT_MAX_ACTIVE_PER_DESTINATION}
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-none" />
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
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No spotlight requests match these filters.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((req) => {
                  const info = tourMap.get(req.tourId);
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="text-sm font-medium">
                        {info?.name ?? <span className="font-mono text-xs text-muted-foreground">{req.tourId.slice(0, 8)}…</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{info?.operator ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{info?.destination ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(req.requestedAt)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.requestedStartsAt ? formatDate(req.requestedStartsAt) : '—'}
                        {req.requestedDurationDays ? ` · ${req.requestedDurationDays}d` : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[req.status]}>{SPOTLIGHT_STATUS_LABELS[req.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        {canApprove && req.status === 'REQUESTED' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="xs" onClick={() => setApproveTarget(req)}>
                              <CheckIcon className="size-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectTarget(req)}
                            >
                              <XIcon className="size-3.5" />
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

      <ApproveDialog target={approveTarget} onClose={() => setApproveTarget(null)} tourName={approveTarget ? tourMap.get(approveTarget.tourId)?.name : undefined} />
      <RejectDialog target={rejectTarget} onClose={() => setRejectTarget(null)} tourName={rejectTarget ? tourMap.get(rejectTarget.tourId)?.name : undefined} />
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
    setStartsAt(target.requestedStartsAt ? target.requestedStartsAt.slice(0, 10) : '');
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
      { id: target.id, payload: { startsAt, endsAt, note: note.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success('Spotlight approved.');
          onClose();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to approve.'),
      }
    );
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-4" />
            Approve Spotlight{tourName ? ` — ${tourName}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Set the live window. While active the tour&apos;s commission is overlaid at 35% and it
            counts toward the max 3 active spotlights for its destination.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <Label className="text-xs font-semibold uppercase">Starts</Label>
              <DatePickerField value={startsAt} onChange={setStartsAt} placeholder="Start date" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Ends</Label>
              <DatePickerField value={endsAt} onChange={setEndsAt} placeholder="End date" />
            </Field>
          </div>
          <Field>
            <Label className="text-xs font-semibold uppercase">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Internal note" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
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
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to reject.'),
      }
    );
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Spotlight{tourName ? ` — ${tourName}` : ''}</DialogTitle>
        </DialogHeader>
        <Field>
          <Label className="text-xs font-semibold uppercase">Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Tell the operator why this was rejected"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={isPending}>
            {isPending ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
