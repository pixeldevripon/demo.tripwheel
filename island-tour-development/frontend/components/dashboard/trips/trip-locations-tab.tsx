'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon, ChevronDownIcon, ChevronUpIcon, MapPinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MultiSelect } from '@/components/ui/multi-select';
import { DualTranslationRow } from './dual-translation-row';
import {
  useLocations,
  useAddLocation,
  useUpdateLocation,
  useRemoveLocation,
  useUpsertLocationTranslation,
} from '@/hooks/trips/use-trips';
import type { TourLocation, CreateTourLocationPayload, UpdateTourLocationPayload } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

const LOCATION_TYPE_OPTIONS = [
  { value: 'START', label: 'Start' },
  { value: 'ITINERARY_ITEM', label: 'Itinerary stop' },
  { value: 'END', label: 'End' },
  { value: 'POI', label: 'Point of interest' },
];

function typeLabel(value: string): string {
  return LOCATION_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const numeric = z.string().optional();

const locationFieldsSchema = {
  types: z.array(z.string()).min(1, 'Select at least one type'),
  latitude: numeric,
  longitude: numeric,
  streetAddress: z.string().max(160).optional().or(z.literal('')),
  addressLocality: z.string().max(120).optional().or(z.literal('')),
  addressRegion: z.string().max(120).optional().or(z.literal('')),
  postalCode: z.string().max(40).optional().or(z.literal('')),
  addressCountry: z.string().max(80).optional().or(z.literal('')),
  minutesTo: numeric,
  minutesAt: numeric,
  displayOrder: numeric,
};

const addLocationSchema = z.object({
  ...locationFieldsSchema,
  title: z.string().min(2, 'At least 2 characters').max(160),
  shortDescription: z.string().max(500).optional().or(z.literal('')),
});
type AddLocationFormValues = z.infer<typeof addLocationSchema>;

const editLocationSchema = z.object(locationFieldsSchema);
type EditLocationFormValues = z.infer<typeof editLocationSchema>;

const numOrNull = (v: string | undefined): number | null => (v && v.trim() !== '' ? Number(v) : null);
const numOrUndef = (v: string | undefined): number | undefined => (v && v.trim() !== '' ? Number(v) : undefined);
const strOrNull = (v: string | undefined): string | null => (v && v.trim() !== '' ? v : null);

// ── Location list item ────────────────────────────────────────────────────────

interface LocationItemProps {
  location: TourLocation;
  tripId: string;
}

function LocationItem({ location, tripId }: LocationItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: updateLocation, isPending: isUpdating } = useUpdateLocation();
  const { mutate: removeLocation, isPending: isRemoving } = useRemoveLocation();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertLocationTranslation();

  const enTranslation = location.translations.find((t) => t.locale === 'en');

  const { register, handleSubmit, control } = useForm<EditLocationFormValues>({
    resolver: zodResolver(editLocationSchema),
    defaultValues: {
      types: location.types,
      latitude: location.latitude != null ? String(location.latitude) : '',
      longitude: location.longitude != null ? String(location.longitude) : '',
      streetAddress: location.streetAddress ?? '',
      addressLocality: location.addressLocality ?? '',
      addressRegion: location.addressRegion ?? '',
      postalCode: location.postalCode ?? '',
      addressCountry: location.addressCountry ?? '',
      minutesTo: location.minutesTo != null ? String(location.minutesTo) : '',
      minutesAt: location.minutesAt != null ? String(location.minutesAt) : '',
      displayOrder: String(location.displayOrder),
    },
  });

  function onSaveDetails(values: EditLocationFormValues) {
    const payload: UpdateTourLocationPayload = {
      types: values.types,
      latitude: numOrNull(values.latitude),
      longitude: numOrNull(values.longitude),
      streetAddress: strOrNull(values.streetAddress),
      addressLocality: strOrNull(values.addressLocality),
      addressRegion: strOrNull(values.addressRegion),
      postalCode: strOrNull(values.postalCode),
      addressCountry: strOrNull(values.addressCountry),
      minutesTo: numOrNull(values.minutesTo),
      minutesAt: numOrNull(values.minutesAt),
      displayOrder: numOrUndef(values.displayOrder),
    };
    updateLocation(
      { tripId, locationId: location.id, payload },
      {
        onSuccess: () => toast.success('Location saved.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save.'),
      }
    );
  }

  function handleDelete() {
    removeLocation(
      { tripId, locationId: location.id },
      {
        onSuccess: () => toast.success('Location removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPinIcon className="size-4 text-muted-foreground shrink-0" />
          <div className="flex gap-1 shrink-0">
            {location.types.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">{typeLabel(t)}</Badge>
            ))}
          </div>
          <p className="text-sm truncate">{enTranslation?.title ?? '(no EN title)'}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
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
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="pt-3 border-t space-y-5">
          {/* Details */}
          <form onSubmit={handleSubmit(onSaveDetails)} className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Details</p>
            <Field>
              <Label className="text-xs font-semibold uppercase">Types</Label>
              <Controller
                name="types"
                control={control}
                render={({ field }) => (
                  <MultiSelect
                    options={LOCATION_TYPE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select types…"
                  />
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label className="text-xs font-semibold uppercase">Latitude</Label>
                <Input {...register('latitude')} placeholder="12.1091" />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Longitude</Label>
                <Input {...register('longitude')} placeholder="-68.9316" />
              </Field>
            </div>
            <Field>
              <Label className="text-xs font-semibold uppercase">Street Address</Label>
              <Input {...register('streetAddress')} placeholder="Pier 3, Main Dock" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <Label className="text-xs font-semibold uppercase">Locality / City</Label>
                <Input {...register('addressLocality')} placeholder="Willemstad" />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Region</Label>
                <Input {...register('addressRegion')} placeholder="Curaçao" />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Postal Code</Label>
                <Input {...register('postalCode')} />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Country</Label>
                <Input {...register('addressCountry')} placeholder="Curaçao" />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <Label className="text-xs font-semibold uppercase">Mins To</Label>
                <Input {...register('minutesTo')} type="number" min={0} placeholder="Travel" />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Mins At</Label>
                <Input {...register('minutesAt')} type="number" min={0} placeholder="Dwell" />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Order</Label>
                <Input {...register('displayOrder')} type="number" min={0} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isUpdating}>
                {isUpdating ? 'Saving...' : 'Save Details'}
              </Button>
            </div>
          </form>

          {/* Translations */}
          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Translations (title + short description)</p>
            {ALL_LOCALES.map((locale) => {
              const existing = location.translations.find((t) => t.locale === locale);
              return (
                <DualTranslationRow
                  key={locale}
                  locale={locale}
                  localeLabel={LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale}
                  primaryLabel="title"
                  primaryDefault={existing?.title ?? ''}
                  secondaryLabel="description"
                  secondaryDefault={existing?.shortDescription ?? ''}
                  onSave={(title, shortDescription) => upsertTranslation(
                    { tripId, locationId: location.id, locale, payload: { title, shortDescription: shortDescription || undefined } },
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

interface TripLocationsTabProps {
  tripId: string;
}

export function TripLocationsTab({ tripId }: TripLocationsTabProps) {
  const { data: locations, isLoading } = useLocations(tripId);
  const { mutate: addLocation, isPending: isAdding } = useAddLocation();

  const count = locations?.length ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AddLocationFormValues>({
    resolver: zodResolver(addLocationSchema),
    defaultValues: {
      types: ['ITINERARY_ITEM'],
      title: '',
      shortDescription: '',
      latitude: '',
      longitude: '',
      streetAddress: '',
      addressLocality: '',
      addressRegion: '',
      postalCode: '',
      addressCountry: '',
      minutesTo: '',
      minutesAt: '',
      displayOrder: String(count),
    },
  });

  function onAdd(values: AddLocationFormValues) {
    const payload: CreateTourLocationPayload = {
      types: values.types,
      title: values.title,
      shortDescription: values.shortDescription || undefined,
      latitude: numOrUndef(values.latitude),
      longitude: numOrUndef(values.longitude),
      streetAddress: values.streetAddress || undefined,
      addressLocality: values.addressLocality || undefined,
      addressRegion: values.addressRegion || undefined,
      postalCode: values.postalCode || undefined,
      addressCountry: values.addressCountry || undefined,
      minutesTo: numOrUndef(values.minutesTo),
      minutesAt: numOrUndef(values.minutesAt),
      displayOrder: numOrUndef(values.displayOrder),
    };
    addLocation(
      { tripId, payload },
      {
        onSuccess: () => {
          toast.success('Location added.');
          reset({
            types: ['ITINERARY_ITEM'],
            title: '',
            shortDescription: '',
            latitude: '',
            longitude: '',
            streetAddress: '',
            addressLocality: '',
            addressRegion: '',
            postalCode: '',
            addressCountry: '',
            minutesTo: '',
            minutesAt: '',
            displayOrder: String((locations?.length ?? 0) + 1),
          });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add location.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Itinerary &amp; Locations</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Start point, itinerary stops, end point and points of interest.</p>
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
            {(locations ?? []).map((loc) => (
              <LocationItem key={loc.id} location={loc} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No locations yet.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Location</p>
          <Field>
            <Label className="text-xs font-semibold uppercase">Types</Label>
            <Controller
              name="types"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={LOCATION_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select types…"
                />
              )}
            />
            <FieldError>{errors.types?.message}</FieldError>
          </Field>
          <Field>
            <Label className="text-xs font-semibold uppercase">Title (English)</Label>
            <Input {...register('title')} placeholder="e.g. Main Dock" aria-invalid={!!errors.title} />
            <FieldError>{errors.title?.message}</FieldError>
          </Field>
          <Field>
            <Label className="text-xs font-semibold uppercase">Short Description</Label>
            <Input {...register('shortDescription')} placeholder="Meet your crew beside the check-in counter." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Latitude</Label>
              <Input {...register('latitude')} placeholder="12.1091" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Longitude</Label>
              <Input {...register('longitude')} placeholder="-68.9316" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Mins To</Label>
              <Input {...register('minutesTo')} type="number" min={0} placeholder="Travel" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Mins At</Label>
              <Input {...register('minutesAt')} type="number" min={0} placeholder="Dwell" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Order</Label>
              <Input {...register('displayOrder')} type="number" min={0} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Location'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
