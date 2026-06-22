'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Resolver } from 'react-hook-form';
import { useUpdateTrip, useLanguages, useAddLanguage, useRemoveLanguage } from '@/hooks/trips/use-trips';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useActiveHubs } from '@/hooks/hubs/use-hubs';
import { MultiSelect } from '@/components/ui/multi-select';
import type { TripListItem } from '@/types/trip';

const COMMON_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Dutch' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];

// ── Guide Languages card ──────────────────────────────────────────────────────

function LanguagesCard({ tripId }: { tripId: string }) {
  const { data: languages, isLoading } = useLanguages(tripId);
  const { mutate: addLanguage, isPending: isAdding } = useAddLanguage();
  const { mutate: removeLanguage } = useRemoveLanguage();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selected, setSelected] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  function handleAdd() {
    const code = (showCustom ? customCode : selected).toLowerCase().trim();
    if (!code) return;
    const existing = (languages ?? []).map((l) => l.language.toLowerCase());
    if (existing.includes(code)) { toast.error('Already added.'); return; }

    addLanguage(
      { tripId, payload: { language: code } },
      {
        onSuccess: () => {
          toast.success(`${code.toUpperCase()} added.`);
          setSelected('');
          setCustomCode('');
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add.'),
      }
    );
  }

  function handleDelete(languageId: string, code: string) {
    setDeletingId(languageId);
    removeLanguage(
      { tripId, languageId },
      {
        onSuccess: () => { toast.success(`${code.toUpperCase()} removed.`); setDeletingId(null); },
        onError: (err) => { toast.error(err instanceof Error ? err.message : 'Failed to remove.'); setDeletingId(null); },
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
          Guide Languages
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Insight panel */}
        <div className="border border-border bg-muted/40 px-4 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider">What this does</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
              <span>Lists the spoken languages your guide conducts the tour in - not the website's UI language.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
              <span>Appears as a badge strip (e.g. <strong className="text-foreground">EN · NL · ES</strong>) on your trip's booking page so travelers know before they book.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
              <span>Not required to publish, but helps Caribbean travelers - many speak Dutch, Spanish, or Papiamentu - choose the right tour.</span>
            </li>
          </ul>
        </div>

        {isLoading ? (
          <Skeleton className="h-8 w-48 rounded-none" />
        ) : (languages?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {languages!.map((lang) => (
              <Badge key={lang.id} variant="secondary" className="gap-1.5 pr-1">
                <span className="uppercase">{lang.language}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(lang.id, lang.language)}
                  disabled={deletingId === lang.id}
                  className="rounded-sm hover:bg-foreground/10 p-0.5 transition-colors"
                  aria-label={`Remove ${lang.language}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No languages specified yet.</p>
        )}

        <div className="flex items-end gap-2 pt-2 border-t">
          {showCustom ? (
            <Field className="flex-1">
              <Label className="text-xs font-semibold uppercase">ISO 639-1 Code</Label>
              <Input
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value)}
                placeholder="e.g. ja, ko, ru"
                className="h-9"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAdd())}
              />
            </Field>
          ) : (
            <Field className="flex-1">
              <Label className="text-xs font-semibold uppercase">Language</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select language..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label} ({l.code.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Button type="button" size="sm" onClick={handleAdd} disabled={isAdding || (!showCustom && !selected) || (showCustom && !customCode.trim())} className="h-9">
            Add
          </Button>
          <button
            type="button"
            onClick={() => { setShowCustom((v) => !v); setSelected(''); setCustomCode(''); }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 whitespace-nowrap pb-0.5"
          >
            {showCustom ? 'Common' : 'Custom code'}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

const detailsSchema = z.object({
  name: z.string().min(3).max(120),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
  primaryCategoryId: z.string().optional(),
  hubIds: z.array(z.string()).optional(),
  pricingModel: z.enum(['PER_PERSON', 'UNIT']),
  basePrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
    .optional()
    .or(z.literal('')),
  durationMinutes: z.coerce.number().int().min(1).max(10080).optional().or(z.literal('')),
  pickupModel: z.enum(['NONE', 'INCLUDED', 'OPTIONAL']),
  minPartySize: z.coerce.number().int().min(1),
  maxPartySize: z.coerce.number().int().min(1).optional().or(z.literal('')),
  bookingCutoffMinutes: z.coerce.number().int().min(0).max(10080),
  cancellationHours: z.coerce.number().int().min(0),
  h1Override: z.string().max(200).optional().or(z.literal('')),
  breadcrumbLabel: z.string().max(60).optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

type DetailsFormValues = {
  name: string;
  categoryIds: string[];
  primaryCategoryId: string;
  hubIds: string[];
  pricingModel: 'PER_PERSON' | 'UNIT';
  basePrice: string;
  durationMinutes: string;
  pickupModel: 'NONE' | 'INCLUDED' | 'OPTIONAL';
  minPartySize: string;
  maxPartySize: string;
  bookingCutoffMinutes: string;
  cancellationHours: string;
  h1Override: string;
  breadcrumbLabel: string;
  isActive: boolean;
};

interface TripDetailsTabProps {
  trip: TripListItem;
  onWarnings?: (warnings: string[]) => void;
}

export function TripDetailsTab({ trip, onWarnings }: TripDetailsTabProps) {
  const { mutate: updateTrip, isPending } = useUpdateTrip();
  const { data: categories } = useActiveCategories();
  const { data: hubs } = useActiveHubs(trip.destinationId || undefined);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors },
  } = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema) as unknown as Resolver<DetailsFormValues>,
    defaultValues: {
      name: trip.name,
      categoryIds: trip.categoryIds,
      primaryCategoryId: trip.primaryCategoryId ?? trip.categoryIds[0] ?? '',
      hubIds: trip.hubIds,
      pricingModel: trip.pricingModel,
      basePrice: trip.basePrice ?? '',
      durationMinutes: trip.durationMinutes != null ? String(trip.durationMinutes) : '',
      pickupModel: trip.pickupModel,
      minPartySize: String(trip.minPartySize),
      maxPartySize: trip.maxPartySize != null ? String(trip.maxPartySize) : '',
      bookingCutoffMinutes: String(trip.bookingCutoffMinutes),
      cancellationHours: String(trip.cancellationHours),
      h1Override: trip.h1Override ?? '',
      breadcrumbLabel: trip.breadcrumbLabel ?? '',
      isActive: trip.isActive,
    },
  });

  useEffect(() => {
    reset({
      name: trip.name,
      categoryIds: trip.categoryIds,
      primaryCategoryId: trip.primaryCategoryId ?? trip.categoryIds[0] ?? '',
      hubIds: trip.hubIds,
      pricingModel: trip.pricingModel,
      basePrice: trip.basePrice ?? '',
      durationMinutes: trip.durationMinutes != null ? String(trip.durationMinutes) : '',
      pickupModel: trip.pickupModel,
      minPartySize: String(trip.minPartySize),
      maxPartySize: trip.maxPartySize != null ? String(trip.maxPartySize) : '',
      bookingCutoffMinutes: String(trip.bookingCutoffMinutes),
      cancellationHours: String(trip.cancellationHours),
      h1Override: trip.h1Override ?? '',
      breadcrumbLabel: trip.breadcrumbLabel ?? '',
      isActive: trip.isActive,
    });
  }, [trip, reset]);

  const isActiveValue = watch('isActive');
  const categoryIds = watch('categoryIds');
  const primaryCategoryId = watch('primaryCategoryId');

  // Keep primary valid within the selected set.
  useEffect(() => {
    if (categoryIds.length === 0) {
      if (primaryCategoryId) setValue('primaryCategoryId', '');
    } else if (!categoryIds.includes(primaryCategoryId)) {
      setValue('primaryCategoryId', categoryIds[0]);
    }
  }, [categoryIds, primaryCategoryId, setValue]);

  function onSubmit(values: DetailsFormValues) {
    updateTrip(
      {
        id: trip.id,
        payload: {
          name: values.name,
          categoryIds: values.categoryIds,
          primaryCategoryId: values.primaryCategoryId || values.categoryIds[0],
          hubIds: values.hubIds,
          pricingModel: values.pricingModel,
          basePrice: values.basePrice || undefined,
          durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
          pickupModel: values.pickupModel,
          minPartySize: Number(values.minPartySize),
          maxPartySize: values.maxPartySize ? Number(values.maxPartySize) : undefined,
          bookingCutoffMinutes: Number(values.bookingCutoffMinutes),
          cancellationHours: Number(values.cancellationHours),
          h1Override: values.h1Override || null,
          breadcrumbLabel: values.breadcrumbLabel || null,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: (result) => {
          toast.success('Trip updated successfully.');
          if (result.warnings?.length) {
            onWarnings?.(result.warnings);
          }
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to update trip.');
        },
      }
    );
  }

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Core Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Read-only fields */}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Slug</Label>
              <Input
                value={trip.slug}
                readOnly
                className="opacity-60 cursor-not-allowed"
              />
              <FieldDescription>Slug cannot be changed after creation.</FieldDescription>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Destination</Label>
              <Input
                value={trip.destinationName ?? trip.destinationId}
                readOnly
                className="opacity-60 cursor-not-allowed"
              />
              <FieldDescription>Destination cannot be changed after creation.</FieldDescription>
            </Field>
          </div>

          <Field>
            <Label className="text-xs font-semibold uppercase">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('name')}
              placeholder="e.g. Sunset Catamaran Cruise"
              aria-invalid={!!errors.name}
            />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">
              Categories <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="categoryIds"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select categories…"
                  searchPlaceholder="Search categories…"
                  primaryValue={primaryCategoryId || null}
                  onPrimaryChange={(v) => setValue('primaryCategoryId', v)}
                />
              )}
            />
            <FieldDescription>
              The starred category is the primary (breadcrumb &amp; canonical URL).
            </FieldDescription>
            <FieldError>{errors.categoryIds?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Activity Hubs</Label>
            <Controller
              name="hubIds"
              control={control}
              render={({ field }) => (
                <MultiSelect
                  options={(hubs ?? []).map((h) => ({ value: h.id, label: h.name }))}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select hubs…"
                  searchPlaceholder="Search hubs…"
                />
              )}
            />
            <FieldDescription>
              Optional discovery tags (0–n). A hub must allow one of the trip&apos;s categories.
            </FieldDescription>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Pricing Model</Label>
              <Controller
                name="pricingModel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PER_PERSON">Per Person</SelectItem>
                      <SelectItem value="UNIT">Per Unit</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Base Price</Label>
              <Input
                {...register('basePrice')}
                placeholder="e.g. 49.99"
                aria-invalid={!!errors.basePrice}
              />
              <FieldError>{errors.basePrice?.message}</FieldError>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Duration (minutes)</Label>
              <Input
                {...register('durationMinutes')}
                type="number"
                min={1}
                placeholder="e.g. 180"
              />
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Pickup Model</Label>
              <Controller
                name="pickupModel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="INCLUDED">Included</SelectItem>
                      <SelectItem value="OPTIONAL">Optional</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Min Party Size</Label>
              <Input {...register('minPartySize')} type="number" min={1} />
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Max Party Size</Label>
              <Input {...register('maxPartySize')} type="number" min={1} placeholder="Optional" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Booking Cutoff (minutes)</Label>
              <Input {...register('bookingCutoffMinutes')} type="number" min={0} />
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Cancellation (hours)</Label>
              <Input {...register('cancellationHours')} type="number" min={0} />
            </Field>
          </div>

          <Field>
            <Label className="text-xs font-semibold uppercase">H1 Override <span className="normal-case font-normal text-muted-foreground">(English only)</span></Label>
            <Input {...register('h1Override')} placeholder="e.g. Mambo Beach Snorkel Tour" />
            <FieldDescription>
              English-only SEO tweak. Use when the auto-generated H1 reads awkwardly. Does not affect translated pages - those use the Display Title from the Translations tab.
            </FieldDescription>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Breadcrumb Label</Label>
            <Input {...register('breadcrumbLabel')} placeholder="Custom breadcrumb text" />
            <FieldDescription>Short label used in breadcrumb navigation.</FieldDescription>
          </Field>

          <Field>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={isActiveValue}
                onCheckedChange={(checked) => setValue('isActive', !!checked)}
              />
              <Label htmlFor="isActive" className="text-xs font-semibold uppercase cursor-pointer">
                Active
              </Label>
            </div>
            <FieldDescription>Inactive trips are hidden from the public site.</FieldDescription>
          </Field>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <LanguagesCard tripId={trip.id} />
    </div>
  );
}
