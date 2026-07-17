'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, ArrowUp01Icon, Bus01Icon, Delete02Icon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { DualTranslationRow } from './dual-translation-row';
import {
  usePickupLocations,
  useAddPickupLocation,
  useUpdatePickupLocation,
  useRemovePickupLocation,
  useUpsertPickupLocationTranslation,
} from '@/hooks/trips/use-trips';
import type { PickupLocation, CreatePickupLocationPayload, UpdatePickupLocationPayload } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeField = z.string().regex(HHMM, 'Use HH:MM').optional().or(z.literal(''));

const addPickupSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(160),
  title: z.string().max(160).optional().or(z.literal('')),
  directions: z.string().max(500).optional().or(z.literal('')),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  address: z.string().max(240).optional().or(z.literal('')),
  minutesPrior: z.string().optional(),
  windowStart: timeField,
  windowEnd: timeField,
  displayOrder: z.string().optional(),
});
type AddPickupFormValues = z.infer<typeof addPickupSchema>;

const editPickupSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(160),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  address: z.string().max(240).optional().or(z.literal('')),
  minutesPrior: z.string().optional(),
  windowStart: timeField,
  windowEnd: timeField,
  displayOrder: z.string().optional(),
  isActive: z.boolean(),
});
type EditPickupFormValues = z.infer<typeof editPickupSchema>;

const numOrNull = (v: string | undefined): number | null => (v && v.trim() !== '' ? Number(v) : null);
const numOrUndef = (v: string | undefined): number | undefined => (v && v.trim() !== '' ? Number(v) : undefined);
const strOrNull = (v: string | undefined): string | null => (v && v.trim() !== '' ? v : null);

// ── Pickup list item ──────────────────────────────────────────────────────────

interface PickupItemProps {
  pickup: PickupLocation;
  tripId: string;
}

function PickupItem({ pickup, tripId }: PickupItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: updatePickup, isPending: isUpdating } = useUpdatePickupLocation();
  const { mutate: removePickup, isPending: isRemoving } = useRemovePickupLocation();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertPickupLocationTranslation();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditPickupFormValues>({
    resolver: zodResolver(editPickupSchema),
    defaultValues: {
      name: pickup.name,
      latitude: pickup.latitude != null ? String(pickup.latitude) : '',
      longitude: pickup.longitude != null ? String(pickup.longitude) : '',
      address: pickup.address ?? '',
      minutesPrior: pickup.minutesPrior != null ? String(pickup.minutesPrior) : '',
      windowStart: pickup.windowStart ?? '',
      windowEnd: pickup.windowEnd ?? '',
      displayOrder: String(pickup.displayOrder),
      isActive: pickup.isActive,
    },
  });

  const isActive = watch('isActive');

  function onSaveDetails(values: EditPickupFormValues) {
    const payload: UpdatePickupLocationPayload = {
      name: values.name,
      latitude: numOrNull(values.latitude),
      longitude: numOrNull(values.longitude),
      address: strOrNull(values.address),
      minutesPrior: numOrNull(values.minutesPrior),
      windowStart: strOrNull(values.windowStart),
      windowEnd: strOrNull(values.windowEnd),
      displayOrder: numOrUndef(values.displayOrder),
      isActive: values.isActive,
    };
    updatePickup(
      { tripId, pickupLocationId: pickup.id, payload },
      {
        onSuccess: () => toast.success('Pickup saved.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save.'),
      }
    );
  }

  function handleDelete() {
    removePickup(
      { tripId, pickupLocationId: pickup.id },
      {
        onSuccess: () => toast.success('Pickup removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <HugeiconsIcon icon={Bus01Icon} className="size-4 text-muted-foreground shrink-0" />
          <p className="text-sm truncate">{pickup.name}</p>
          {!pickup.isActive && <Badge variant="outline" className="text-xs shrink-0">Inactive</Badge>}
          {(pickup.windowStart || pickup.windowEnd) && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {pickup.windowStart ?? '—'}–{pickup.windowEnd ?? '—'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" /> : <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />}
            <span className="hidden sm:inline">Edit</span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={isRemoving}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="pt-3 border-t space-y-5">
          <form onSubmit={handleSubmit(onSaveDetails)} className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Details</p>
            <Field>
              <Label>Name</Label>
              <Input {...register('name')} aria-invalid={!!errors.name} />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>
            <Field>
              <Label>Address</Label>
              <Input {...register('address')} placeholder="Hotel / street address" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label>Latitude</Label>
                <Input {...register('latitude')} placeholder="12.1091" />
              </Field>
              <Field>
                <Label>Longitude</Label>
                <Input {...register('longitude')} placeholder="-68.9316" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <Label>Mins Prior</Label>
                <Input {...register('minutesPrior')} type="number" min={0} placeholder="30" />
                <FieldDescription>How many minutes before departure travelers are picked up here.</FieldDescription>
              </Field>
              <Field>
                <Label>Window Start</Label>
                <Input {...register('windowStart')} type="time" aria-invalid={!!errors.windowStart} />
                <FieldDescription>Earliest the pickup may arrive (e.g. 07:45).</FieldDescription>
              </Field>
              <Field>
                <Label>Window End</Label>
                <Input {...register('windowEnd')} type="time" aria-invalid={!!errors.windowEnd} />
                <FieldDescription>Latest the pickup may arrive (e.g. 08:15).</FieldDescription>
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <Field className="max-w-32">
                <Label>Order</Label>
                <Input {...register('displayOrder')} type="number" min={0} />
              </Field>
              <label className="flex items-center gap-2 cursor-pointer pt-5">
                <Checkbox checked={isActive} onCheckedChange={(c) => setValue('isActive', !!c)} />
                <span className="text-xs font-semibold">Active</span>
              </label>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </form>

          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground">Translations (title + directions)</p>
            {ALL_LOCALES.map((locale) => {
              const existing = pickup.translations.find((t) => t.locale === locale);
              return (
                <DualTranslationRow
                  key={locale}
                  locale={locale}
                  localeLabel={LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale}
                  primaryLabel="title"
                  primaryDefault={existing?.title ?? ''}
                  secondaryLabel="directions"
                  secondaryDefault={existing?.directions ?? ''}
                  onSave={(title, directions) => upsertTranslation(
                    { tripId, pickupLocationId: pickup.id, locale, payload: { title, directions: directions || undefined } },
                    {
                      onSuccess: () => toast.success(`${LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale} translation saved.`),
                      onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save translation.'),
                    }
                  )}
                  isSaving={isUpserting}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

interface TripPickupLocationsTabProps {
  tripId: string;
}

export function TripPickupLocationsTab({ tripId }: TripPickupLocationsTabProps) {
  const { data: pickups, isLoading } = usePickupLocations(tripId);
  const { mutate: addPickup, isPending: isAdding } = useAddPickupLocation();

  const count = pickups?.length ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPickupFormValues>({
    resolver: zodResolver(addPickupSchema),
    defaultValues: {
      name: '',
      title: '',
      directions: '',
      latitude: '',
      longitude: '',
      address: '',
      minutesPrior: '',
      windowStart: '',
      windowEnd: '',
      displayOrder: String(count),
    },
  });

  function onAdd(values: AddPickupFormValues) {
    const payload: CreatePickupLocationPayload = {
      name: values.name,
      title: values.title || undefined,
      directions: values.directions || undefined,
      latitude: numOrUndef(values.latitude),
      longitude: numOrUndef(values.longitude),
      address: values.address || undefined,
      minutesPrior: numOrUndef(values.minutesPrior),
      windowStart: values.windowStart || undefined,
      windowEnd: values.windowEnd || undefined,
      displayOrder: numOrUndef(values.displayOrder),
    };
    addPickup(
      { tripId, payload },
      {
        onSuccess: () => {
          toast.success('Pickup location added.');
          reset({
            name: '',
            title: '',
            directions: '',
            latitude: '',
            longitude: '',
            address: '',
            minutesPrior: '',
            windowStart: '',
            windowEnd: '',
            displayOrder: String((pickups?.length ?? 0) + 1),
          });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add pickup.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-semibold">Pickup Locations</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Hotel / meeting points where travelers can be collected, with pickup windows.</p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(pickups ?? []).map((p) => (
              <PickupItem key={p.id} pickup={p} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No pickup locations yet.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground">Add Pickup Location</p>
          <Field>
            <Label>Name</Label>
            <Input {...register('name')} placeholder="e.g. Marriott Beach Resort - main lobby" aria-invalid={!!errors.name} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>
          <Field>
            <Label>Directions (English)</Label>
            <Input {...register('directions')} placeholder="Wait near the concierge desk." />
          </Field>
          <Field>
            <Label>Address</Label>
            <Input {...register('address')} placeholder="Street address" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>Latitude</Label>
              <Input {...register('latitude')} placeholder="12.1091" />
            </Field>
            <Field>
              <Label>Longitude</Label>
              <Input {...register('longitude')} placeholder="-68.9316" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <Label>Mins Prior</Label>
              <Input {...register('minutesPrior')} type="number" min={0} placeholder="30" />
              <FieldDescription>How many minutes before departure travelers are picked up here.</FieldDescription>
            </Field>
            <Field>
              <Label>Window Start</Label>
              <Input {...register('windowStart')} type="time" aria-invalid={!!errors.windowStart} />
              <FieldDescription>Earliest the pickup may arrive (e.g. 07:45).</FieldDescription>
            </Field>
            <Field>
              <Label>Window End</Label>
              <Input {...register('windowEnd')} type="time" aria-invalid={!!errors.windowEnd} />
              <FieldDescription>Latest the pickup may arrive (e.g. 08:15).</FieldDescription>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Pickup'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
