'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, InfoIcon, LockIcon, SparklesIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerField } from '@/components/date-picker-field';
import { useRole } from '@/contexts/role-context';
import { useChangeTier, useRequestSpotlight, useTourSpotlight } from '@/hooks/tiers/use-tiers';
import { useUpdateTrip } from '@/hooks/trips/use-trips';
import { formatDate } from '@/lib/utils';
import type { TripListItem } from '@/types/trip';
import type { SpotlightStatus, TierKey } from '@/types/tier';
import {
  SPOTLIGHT_COMMISSION_PCT,
  SPOTLIGHT_MIN_RATING,
  SPOTLIGHT_MIN_REVIEWS,
  SPOTLIGHT_STATUS_LABELS,
  TIER_KEY_VALUES,
  TIER_META,
} from '@/types/tier';

const spotlightStatusVariant: Record<SpotlightStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  APPROVED: 'default',
  ACTIVE: 'default',
  REJECTED: 'destructive',
  EXPIRED: 'outline',
};

/** Statuses that block submitting a new request (one is already live/pending). */
const BLOCKING_STATUSES: SpotlightStatus[] = ['REQUESTED', 'APPROVED', 'ACTIVE'];

// The demand-badge override is not needed in the dashboard right now, so it is
// hidden from the UI. Flip to true to bring the admin control back.
const SHOW_DEMAND_BADGE_OVERRIDE = false;

interface TripPromotionTabProps {
  trip: TripListItem;
}

export function TripPromotionTab({ trip }: TripPromotionTabProps) {
  const { can } = useRole();
  const canEdit = can('EDIT_TRIP');
  // The demand-badge override is an editorial/launch control - admin-only.
  const canManage = can('MANAGE_TRIPS');

  return (
    <div className="space-y-6">
      <TierCard trip={trip} canEdit={canEdit} />
      <SpotlightCard trip={trip} canEdit={canEdit} />
      {SHOW_DEMAND_BADGE_OVERRIDE && canManage && <DemandBadgeCard trip={trip} />}
    </div>
  );
}

// ── Demand badge override (admin) ──────────────────────────────────────────────
// `likelyToSellOut` is recomputed nightly (§3.7). This override forces the badge on
// or off for launch, or defers to the computed value (null).
function DemandBadgeCard({ trip }: { trip: TripListItem }) {
  const { mutate: updateTrip, isPending } = useUpdateTrip();

  const value: 'auto' | 'on' | 'off' =
    trip.likelyToSellOutOverride == null
      ? 'auto'
      : trip.likelyToSellOutOverride
        ? 'on'
        : 'off';

  function handleChange(next: 'auto' | 'on' | 'off') {
    if (next === value) return;
    const likelyToSellOutOverride =
      next === 'auto' ? null : next === 'on';
    updateTrip(
      { id: trip.id, payload: { likelyToSellOutOverride } },
      {
        onSuccess: () => toast.success('Demand badge override updated.'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update override.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm">Demand Badge Override</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-center gap-3 text-sm">
          <p className="text-xs font-semibold text-muted-foreground">Computed now</p>
          <Badge variant={trip.likelyToSellOut ? 'default' : 'secondary'}>
            {trip.likelyToSellOut ? 'Likely to sell out' : 'Normal demand'}
          </Badge>
        </div>
        <Field className="w-full sm:w-72">
          <Label className="text-xs font-semibold">Override</Label>
          <Select value={value} onValueChange={(v) => handleChange(v as 'auto' | 'on' | 'off')} disabled={isPending}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automatic (use computed value)</SelectItem>
              <SelectItem value="on">Force on (show badge)</SelectItem>
              <SelectItem value="off">Force off (hide badge)</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            The &ldquo;Likely to sell out&rdquo; badge is recomputed nightly. Use this to force it on
            or off for launch, or leave on Automatic to defer to the computed value.
          </FieldDescription>
        </Field>
      </CardContent>
    </Card>
  );
}

// ── Commission tier ──────────────────────────────────────────────────────────
function TierCard({ trip, canEdit }: { trip: TripListItem; canEdit: boolean }) {
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
  const lockedUntil = trip.tierLockedUntil ? new Date(trip.tierLockedUntil) : null;
  const isLocked = !!lockedUntil && lockedUntil.getTime() > now;
  const dirty = selectedTier !== trip.tierKey;

  function handleSave() {
    changeTier(
      { tourId: trip.id, payload: { tierKey: selectedTier } },
      {
        onSuccess: () =>
          toast.success(`Tier changed to ${TIER_META[selectedTier].label}. Locked for 30 days.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to change tier.'),
      }
    );
  }

  const current = TIER_META[trip.tierKey];

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm">Commission Tier</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Current Tier</p>
            <p className="mt-1 font-medium">{current.label}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Commission</p>
            <p className="mt-1 font-medium">{trip.commissionTier}%</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Rank</p>
            <p className="mt-1 font-medium tabular-nums">{trip.tierRank}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Eligibility</p>
            <p className="mt-1">
              <Badge variant="secondary">{trip.eligibilityState}</Badge>
            </p>
          </div>
        </div>

        {isLocked && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-2">
            <LockIcon className="size-3.5 shrink-0" />
            <span>Tier is locked until {formatDate(trip.tierLockedUntil!)}. You can change it again after that date.</span>
          </div>
        )}

        {canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <Field className="w-full sm:w-72">
              <Label className="text-xs font-semibold">Change Tier</Label>
              <Select
                value={selectedTier}
                onValueChange={(v) => setSelectedTier(v as TierKey)}
                disabled={isLocked || isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_KEY_VALUES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {TIER_META[key].label} — {TIER_META[key].commission}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Higher tiers rank better and carry a higher commission. Changing locks the tier for 30 days.
              </FieldDescription>
            </Field>
            <Button type="button" onClick={handleSave} disabled={!dirty || isLocked || isPending}>
              {isPending ? 'Saving...' : 'Save Tier'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Destination spotlight ────────────────────────────────────────────────────
function SpotlightCard({ trip, canEdit }: { trip: TripListItem; canEdit: boolean }) {
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
          requestedDurationDays: durationDays ? Number(durationDays) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Spotlight requested. An admin will review it.');
          setStartsAt('');
          setDurationDays('');
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to request spotlight.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <SparklesIcon className="size-4" />
          Destination Spotlight
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        <p className="text-xs text-muted-foreground">
          A Destination Spotlight gives this tour a featured block on the destination page and raises
          its commission to {SPOTLIGHT_COMMISSION_PCT}% while active. Requests are reviewed and
          scheduled by an admin (max 3 active per destination).
        </p>

        {/* Eligibility */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <EligibilityItem
            label={`At least ${SPOTLIGHT_MIN_REVIEWS} reviews`}
            detail={`${trip.aggregateReviewCount} so far`}
            passed={reviewsOk}
          />
          <EligibilityItem
            label={`Rating of ${SPOTLIGHT_MIN_RATING} or higher`}
            detail={trip.aggregateRating != null ? `${trip.aggregateRating.toFixed(1)} now` : 'no rating yet'}
            passed={ratingOk}
          />
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-none" />
        ) : current ? (
          <div className="border bg-muted/40 px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Latest request</span>
              <Badge variant={spotlightStatusVariant[current.status]}>
                {SPOTLIGHT_STATUS_LABELS[current.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Requested {formatDate(current.requestedAt)}</p>
            {current.status === 'ACTIVE' || current.status === 'APPROVED' ? (
              <p className="text-xs text-muted-foreground">
                Window: {current.startsAt ? formatDate(current.startsAt) : '—'} to{' '}
                {current.endsAt ? formatDate(current.endsAt) : '—'}
              </p>
            ) : null}
            {current.status === 'REJECTED' && current.rejectionReason && (
              <p className="text-xs text-destructive">Reason: {current.rejectionReason}</p>
            )}
          </div>
        ) : null}

        {canEdit && !blocked && (
          <div className="space-y-4 border-t pt-4">
            {!eligible && (
              <div className="flex items-start gap-2 text-xs text-warning-fg">
                <InfoIcon className="size-3.5 shrink-0 mt-0.5" />
                <span>
                  This tour does not yet meet the spotlight criteria. You can still submit a request,
                  but it will be rejected until the criteria are met.
                </span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <Label className="text-xs font-semibold">Preferred Start (optional)</Label>
                <DatePickerField value={startsAt} onChange={setStartsAt} placeholder="Pick a start date" clearable />
              </Field>
              <Field>
                <Label className="text-xs font-semibold">Preferred Duration (days, optional)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder="e.g. 30"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleRequest} disabled={isPending}>
                <SparklesIcon className="size-3.5" />
                {isPending ? 'Requesting...' : 'Request Spotlight'}
              </Button>
            </div>
          </div>
        )}

        {canEdit && blocked && (
          <p className="text-xs text-muted-foreground border-t pt-4">
            A request is already {SPOTLIGHT_STATUS_LABELS[current!.status].toLowerCase()}. You can submit
            a new request once it is resolved.
          </p>
        )}

        {/* History */}
        {data && data.history.length > 1 && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">History</p>
            {data.history.map((req) => (
              <div key={req.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{formatDate(req.requestedAt)}</span>
                <Badge variant={spotlightStatusVariant[req.status]}>
                  {SPOTLIGHT_STATUS_LABELS[req.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EligibilityItem({ label, detail, passed }: { label: string; detail: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed ? (
        <CheckIcon className="size-4 text-success-solid shrink-0" />
      ) : (
        <XIcon className="size-4 text-destructive shrink-0" />
      )}
      <span className={passed ? 'text-muted-foreground' : 'text-destructive'}>
        {label} <span className="text-muted-foreground">({detail})</span>
      </span>
    </div>
  );
}
