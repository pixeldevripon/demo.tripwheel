'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDownIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { isValidIanaTimeZone } from '@/utils/intl-utils';
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
import type {
  TripListItem,
  OctoAvailabilityType,
  DeliveryFormat,
  DeliveryMethod,
  RedemptionMethod,
} from '@/types/trip';

const DELIVERY_FORMAT_OPTIONS: { value: DeliveryFormat; label: string }[] = [
  { value: 'PDF_URL', label: 'PDF URL' },
  { value: 'QRCODE', label: 'QR code' },
  { value: 'CODE128', label: 'Code 128' },
  { value: 'PKPASS_URL', label: 'PKPASS URL' },
];

const DELIVERY_METHOD_OPTIONS: { value: DeliveryMethod; label: string }[] = [
  { value: 'VOUCHER', label: 'Voucher' },
  { value: 'TICKET', label: 'Ticket' },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

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
              <span>Lists the spoken languages your guide conducts the tour in - not the website&apos;s UI language.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 size-1.5 rounded-full bg-primary shrink-0" />
              <span>Appears as a badge strip (e.g. <strong className="text-foreground">EN · NL · ES</strong>) on your trip&apos;s booking page so travelers know before they book.</span>
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

function toSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const detailsSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only'),
  categoryIds: z.array(z.string()).min(1, 'Select at least one category'),
  primaryCategoryId: z.string().optional(),
  hubIds: z.array(z.string()).optional(),
  pricingModel: z.enum(['PER_PERSON', 'UNIT']),
  wholeUnitType: z.enum(['GROUP', 'BOAT', 'VEHICLE', 'AIRCRAFT', 'PACKAGE']).optional().or(z.literal('')),
  defaultCurrency: z.enum(['USD', 'EUR']),
  basePrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
    .optional()
    .or(z.literal('')),
  unitIncludedGuests: z.coerce.number().int().min(1).optional().or(z.literal('')),
  extraPersonPrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
    .optional()
    .or(z.literal('')),
  durationMinutesFrom: z.coerce.number().int().min(1).max(10080).optional().or(z.literal('')),
  durationMinutesTo: z.coerce.number().int().min(1).max(10080).optional().or(z.literal('')),
  pickupModel: z.enum(['NONE', 'INCLUDED', 'PAID_ADDON']),
  pickupRequired: z.boolean(),
  bookingType: z.enum(['PRIVATE', 'SHARED']).optional().or(z.literal('')),
  paymentModel: z.enum(['OPERATOR_LINK', 'ON_ARRIVAL', 'PAID_IN_FULL', 'OPERATOR_FULL']),
  instantConfirmation: z.boolean(),
  minPartySize: z.coerce.number().int().min(1),
  maxPartySize: z.coerce.number().int().min(1).optional().or(z.literal('')),
  bookingCutoffMinutes: z.coerce.number().int().min(0).max(10080),
  cancellationHours: z.enum(['24', '48', '72', '168']),
  departureCity: z.string().max(120).optional().or(z.literal('')),
  meetingPointLat: z.string().optional().or(z.literal('')),
  meetingPointLng: z.string().optional().or(z.literal('')),
  minAgeYears: z.coerce.number().int().min(0).max(120).optional().or(z.literal('')),
  fitnessLevel: z.enum(['EASY', 'MODERATE', 'CHALLENGING']).optional().or(z.literal('')),
  weatherDependent: z.boolean(),
  wheelchairAccessible: z.boolean(),
  familyFriendly: z.boolean(),
  suitableForBeginners: z.boolean(),
  isLocalsFavourite: z.boolean(),
  checkInMinutesBefore: z.coerce.number().int().min(0).max(240).optional().or(z.literal('')),
  reference: z.string().max(120).optional().or(z.literal('')),
  h1Override: z.string().max(200).optional().or(z.literal('')),
  breadcrumbLabel: z.string().max(60).optional().or(z.literal('')),
  availabilityType: z.enum(['START_TIME', 'OPENING_HOURS']),
  redemptionMethod: z.enum(['DIGITAL', 'PRINT', 'MANIFEST']),
  instantDelivery: z.boolean(),
  availabilityRequired: z.boolean(),
  allowFreesale: z.boolean(),
  deliveryFormats: z.array(z.enum(['PDF_URL', 'QRCODE', 'CODE128', 'PKPASS_URL'])),
  deliveryMethods: z.array(z.enum(['VOUCHER', 'TICKET'])),
  timeZone: z
    .string()
    .max(60)
    .optional()
    .or(z.literal(''))
    .refine(
      v => !v || isValidIanaTimeZone(v),
      'Must be a valid IANA timezone (e.g. America/Curacao), not an offset like UTC-4'
    ),
  startTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)),
  isActive: z.boolean().optional(),
});

type DetailsFormValues = {
  name: string;
  slug: string;
  categoryIds: string[];
  primaryCategoryId: string;
  hubIds: string[];
  pricingModel: 'PER_PERSON' | 'UNIT';
  wholeUnitType: '' | 'GROUP' | 'BOAT' | 'VEHICLE' | 'AIRCRAFT' | 'PACKAGE';
  defaultCurrency: 'USD' | 'EUR';
  basePrice: string;
  unitIncludedGuests: string;
  extraPersonPrice: string;
  durationMinutesFrom: string;
  durationMinutesTo: string;
  pickupModel: 'NONE' | 'INCLUDED' | 'PAID_ADDON';
  pickupRequired: boolean;
  bookingType: '' | 'PRIVATE' | 'SHARED';
  paymentModel: 'OPERATOR_LINK' | 'ON_ARRIVAL' | 'PAID_IN_FULL' | 'OPERATOR_FULL';
  instantConfirmation: boolean;
  minPartySize: string;
  maxPartySize: string;
  bookingCutoffMinutes: string;
  cancellationHours: '24' | '48' | '72' | '168';
  departureCity: string;
  meetingPointLat: string;
  meetingPointLng: string;
  minAgeYears: string;
  fitnessLevel: '' | 'EASY' | 'MODERATE' | 'CHALLENGING';
  weatherDependent: boolean;
  wheelchairAccessible: boolean;
  familyFriendly: boolean;
  suitableForBeginners: boolean;
  isLocalsFavourite: boolean;
  checkInMinutesBefore: string;
  reference: string;
  h1Override: string;
  breadcrumbLabel: string;
  availabilityType: OctoAvailabilityType;
  redemptionMethod: RedemptionMethod;
  instantDelivery: boolean;
  availabilityRequired: boolean;
  allowFreesale: boolean;
  deliveryFormats: DeliveryFormat[];
  deliveryMethods: DeliveryMethod[];
  timeZone: string;
  startTimes: string[];
  isActive: boolean;
};

const CANCELLATION_VALUES = ['24', '48', '72', '168'] as const;
function toCancellationValue(h: number): '24' | '48' | '72' | '168' {
  return (CANCELLATION_VALUES as readonly string[]).includes(String(h))
    ? (String(h) as '24' | '48' | '72' | '168')
    : '48';
}

function tripToDefaults(trip: TripListItem): DetailsFormValues {
  return {
    name: trip.name,
    slug: trip.slug,
    categoryIds: trip.categoryIds,
    primaryCategoryId: trip.primaryCategoryId ?? trip.categoryIds[0] ?? '',
    hubIds: trip.hubIds,
    pricingModel: trip.pricingModel,
    wholeUnitType: trip.wholeUnitType ?? '',
    defaultCurrency: trip.defaultCurrency,
    basePrice: trip.basePrice ?? '',
    unitIncludedGuests: trip.unitIncludedGuests != null ? String(trip.unitIncludedGuests) : '',
    extraPersonPrice: trip.extraPersonPrice ?? '',
    durationMinutesFrom: trip.durationMinutesFrom != null ? String(trip.durationMinutesFrom) : '',
    durationMinutesTo: trip.durationMinutesTo != null ? String(trip.durationMinutesTo) : '',
    pickupModel: trip.pickupModel,
    pickupRequired: trip.pickupRequired,
    bookingType: trip.bookingType ?? '',
    paymentModel: trip.paymentModel,
    instantConfirmation: trip.instantConfirmation,
    minPartySize: String(trip.minPartySize),
    maxPartySize: trip.maxPartySize != null ? String(trip.maxPartySize) : '',
    bookingCutoffMinutes: String(trip.bookingCutoffMinutes),
    cancellationHours: toCancellationValue(trip.cancellationHours),
    departureCity: trip.departureCity ?? '',
    meetingPointLat: trip.meetingPointLat != null ? String(trip.meetingPointLat) : '',
    meetingPointLng: trip.meetingPointLng != null ? String(trip.meetingPointLng) : '',
    minAgeYears: trip.minAgeYears != null ? String(trip.minAgeYears) : '',
    fitnessLevel: trip.fitnessLevel ?? '',
    weatherDependent: trip.weatherDependent,
    wheelchairAccessible: trip.wheelchairAccessible,
    familyFriendly: trip.familyFriendly,
    suitableForBeginners: trip.suitableForBeginners,
    isLocalsFavourite: trip.isLocalsFavourite,
    checkInMinutesBefore: trip.checkInMinutesBefore != null ? String(trip.checkInMinutesBefore) : '',
    reference: trip.reference ?? '',
    h1Override: trip.h1Override ?? '',
    breadcrumbLabel: trip.breadcrumbLabel ?? '',
    availabilityType: trip.availabilityType,
    redemptionMethod: trip.redemptionMethod,
    instantDelivery: trip.instantDelivery,
    availabilityRequired: trip.availabilityRequired,
    allowFreesale: trip.allowFreesale,
    deliveryFormats: trip.deliveryFormats ?? [],
    deliveryMethods: trip.deliveryMethods ?? [],
    timeZone: trip.timeZone ?? '',
    startTimes: trip.startTimes ?? [],
    isActive: trip.isActive,
  };
}

interface TripDetailsTabProps {
  trip: TripListItem;
  onWarnings?: (warnings: string[]) => void;
}

/**
 * Mirrors the public card's duration chip (hub-page.tsx `formatDuration`): under
 * 6h reads in hours, 6-23h "Full day", 24h+ in days. English-only operator hint.
 */
function durationHint(mins: number): string {
  if (!mins || mins < 1) return '';
  if (mins >= 1440) {
    const d = Math.round(mins / 1440);
    return d <= 1 ? '1 day' : `${d} days`;
  }
  if (mins >= 360) return 'Full day';
  return `${Math.round(mins / 60)}h`;
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
    defaultValues: tripToDefaults(trip),
  });

  useEffect(() => {
    reset(tripToDefaults(trip));
  }, [trip, reset]);

  const isActiveValue = watch('isActive');
  const categoryIds = watch('categoryIds');
  const primaryCategoryId = watch('primaryCategoryId');
  const pricingModel = watch('pricingModel');
  const durationFromWatch = watch('durationMinutesFrom');
  const pickupRequired = watch('pickupRequired');
  const instantConfirmation = watch('instantConfirmation');
  const weatherDependent = watch('weatherDependent');
  const wheelchairAccessible = watch('wheelchairAccessible');
  const familyFriendly = watch('familyFriendly');
  const suitableForBeginners = watch('suitableForBeginners');
  const isLocalsFavourite = watch('isLocalsFavourite');
  const instantDelivery = watch('instantDelivery');
  const availabilityRequired = watch('availabilityRequired');
  const allowFreesale = watch('allowFreesale');
  const [startTimeDraft, setStartTimeDraft] = useState('');

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
          slug: values.slug,
          categoryIds: values.categoryIds,
          primaryCategoryId: values.primaryCategoryId || values.categoryIds[0],
          hubIds: values.hubIds,
          pricingModel: values.pricingModel,
          wholeUnitType: values.pricingModel === 'UNIT' && values.wholeUnitType ? values.wholeUnitType : undefined,
          defaultCurrency: values.defaultCurrency,
          basePrice: values.basePrice || undefined,
          unitIncludedGuests:
            values.pricingModel === 'UNIT' && values.unitIncludedGuests
              ? Number(values.unitIncludedGuests)
              : undefined,
          extraPersonPrice:
            values.pricingModel === 'UNIT' && values.extraPersonPrice
              ? values.extraPersonPrice
              : undefined,
          durationMinutesFrom: values.durationMinutesFrom ? Number(values.durationMinutesFrom) : undefined,
          durationMinutesTo: values.durationMinutesTo ? Number(values.durationMinutesTo) : undefined,
          pickupModel: values.pickupModel,
          pickupRequired: values.pickupRequired,
          bookingType: values.bookingType || undefined,
          paymentModel: values.paymentModel,
          instantConfirmation: values.instantConfirmation,
          minPartySize: Number(values.minPartySize),
          maxPartySize: values.maxPartySize ? Number(values.maxPartySize) : undefined,
          bookingCutoffMinutes: Number(values.bookingCutoffMinutes),
          cancellationHours: Number(values.cancellationHours),
          departureCity: values.departureCity || undefined,
          meetingPointLat: values.meetingPointLat ? Number(values.meetingPointLat) : undefined,
          meetingPointLng: values.meetingPointLng ? Number(values.meetingPointLng) : undefined,
          minAgeYears: values.minAgeYears ? Number(values.minAgeYears) : undefined,
          fitnessLevel: values.fitnessLevel || undefined,
          weatherDependent: values.weatherDependent,
          wheelchairAccessible: values.wheelchairAccessible,
          familyFriendly: values.familyFriendly,
          suitableForBeginners: values.suitableForBeginners,
          isLocalsFavourite: values.isLocalsFavourite,
          checkInMinutesBefore: values.checkInMinutesBefore !== '' ? Number(values.checkInMinutesBefore) : undefined,
          reference: values.reference || null,
          h1Override: values.h1Override || null,
          breadcrumbLabel: values.breadcrumbLabel || null,
          availabilityType: values.availabilityType,
          redemptionMethod: values.redemptionMethod,
          instantDelivery: values.instantDelivery,
          availabilityRequired: values.availabilityRequired,
          allowFreesale: values.allowFreesale,
          deliveryFormats: values.deliveryFormats,
          deliveryMethods: values.deliveryMethods,
          timeZone: values.timeZone || undefined,
          startTimes: values.startTimes,
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
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Slug</Label>
              <Input
                {...register('slug')}
                placeholder="e.g. sunset-catamaran-cruise"
                aria-invalid={!!errors.slug}
              />
              <FieldDescription>
                Renaming the slug issues an automatic 301 redirect; the old slug is reserved for a
                90-day cooldown before it can be reused.
              </FieldDescription>
              <FieldError>{errors.slug?.message}</FieldError>
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
                      <SelectItem value="UNIT">Per Unit (whole asset)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            {pricingModel === 'UNIT' ? (
              <Field>
                <Label className="text-xs font-semibold uppercase">Unit Type</Label>
                <Controller
                  name="wholeUnitType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GROUP">Group</SelectItem>
                        <SelectItem value="BOAT">Boat</SelectItem>
                        <SelectItem value="VEHICLE">Vehicle</SelectItem>
                        <SelectItem value="AIRCRAFT">Aircraft</SelectItem>
                        <SelectItem value="PACKAGE">Package</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            ) : (
              <Field>
                <Label className="text-xs font-semibold uppercase">Currency</Label>
                <Controller
                  name="defaultCurrency"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Base Price</Label>
              <Input
                {...register('basePrice')}
                placeholder="e.g. 49.99"
                aria-invalid={!!errors.basePrice}
              />
              <FieldError>{errors.basePrice?.message}</FieldError>
            </Field>
            {pricingModel === 'UNIT' && (
              <Field>
                <Label className="text-xs font-semibold uppercase">Currency</Label>
                <Controller
                  name="defaultCurrency"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>

          {/* UNIT (charter) pricing: base covers N guests; extra guests cost a
              per-person surcharge. Card reads "from $X /N people + $Y per extra person". */}
          {pricingModel === 'UNIT' && (
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Guests Included in Base Price</Label>
                <Input
                  {...register('unitIncludedGuests')}
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  aria-invalid={!!errors.unitIncludedGuests}
                />
                <FieldDescription>Travelers covered by the base price. Shown on the card as &ldquo;/N people&rdquo;.</FieldDescription>
                <FieldError>{errors.unitIncludedGuests?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Extra Person Price</Label>
                <Input
                  {...register('extraPersonPrice')}
                  placeholder="e.g. 175.00"
                  aria-invalid={!!errors.extraPersonPrice}
                />
                <FieldDescription>Charged per traveler beyond the included count, up to max party size.</FieldDescription>
                <FieldError>{errors.extraPersonPrice?.message}</FieldError>
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Duration From (minutes)</Label>
              <Input {...register('durationMinutesFrom')} type="number" min={1} placeholder="e.g. 180" />
              {durationHint(Number(durationFromWatch)) && (
                <FieldDescription>
                  Shows on cards as &ldquo;{durationHint(Number(durationFromWatch))}&rdquo;.
                </FieldDescription>
              )}
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Duration To (minutes)</Label>
              <Input {...register('durationMinutesTo')} type="number" min={1} placeholder="Optional" />
              <FieldDescription>Leave empty for a fixed duration.</FieldDescription>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem value="PAID_ADDON">Paid add-on</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Booking Type</Label>
              <Controller
                name="bookingType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIVATE">Private</SelectItem>
                      <SelectItem value="SHARED">Shared</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Payment Model</Label>
              <Controller
                name="paymentModel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERATOR_LINK">Operator link (deposit)</SelectItem>
                      <SelectItem value="ON_ARRIVAL">Pay on arrival</SelectItem>
                      <SelectItem value="PAID_IN_FULL">Paid in full</SelectItem>
                      <SelectItem value="OPERATOR_FULL">Operator-managed (full)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Cancellation Window</Label>
              <Controller
                name="cancellationHours"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                      <SelectItem value="72">72 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="instantConfirmation"
                checked={instantConfirmation}
                onCheckedChange={(c) => setValue('instantConfirmation', !!c)}
              />
              <Label htmlFor="instantConfirmation" className="text-xs font-semibold uppercase cursor-pointer">
                Instant confirmation
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="pickupRequired"
                checked={pickupRequired}
                onCheckedChange={(c) => setValue('pickupRequired', !!c)}
              />
              <Label htmlFor="pickupRequired" className="text-xs font-semibold uppercase cursor-pointer">
                Pickup required
              </Label>
            </div>
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
              <FieldDescription>How long before departure bookings close.</FieldDescription>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Check-in Before (minutes)</Label>
              <Input {...register('checkInMinutesBefore')} type="number" min={0} max={240} placeholder="e.g. 30" />
              <FieldDescription>How early travelers should arrive.</FieldDescription>
            </Field>
          </div>

          {/* Meeting point */}
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Departure City</Label>
              <Input {...register('departureCity')} placeholder="e.g. Willemstad" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Meeting Lat</Label>
              <Input {...register('meetingPointLat')} placeholder="e.g. 12.1091" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Meeting Lng</Label>
              <Input {...register('meetingPointLng')} placeholder="e.g. -68.9316" />
            </Field>
          </div>

          {/* Audience */}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Minimum Age</Label>
              <Input {...register('minAgeYears')} type="number" min={0} placeholder="Optional" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Fitness Level</Label>
              <Controller
                name="fitnessLevel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EASY">Easy</SelectItem>
                      <SelectItem value="MODERATE">Moderate</SelectItem>
                      <SelectItem value="CHALLENGING">Challenging</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="weatherDependent"
                checked={weatherDependent}
                onCheckedChange={(c) => setValue('weatherDependent', !!c)}
              />
              <Label htmlFor="weatherDependent" className="text-xs font-semibold uppercase cursor-pointer">
                Weather dependent
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="wheelchairAccessible"
                checked={wheelchairAccessible}
                onCheckedChange={(c) => setValue('wheelchairAccessible', !!c)}
              />
              <Label htmlFor="wheelchairAccessible" className="text-xs font-semibold uppercase cursor-pointer">
                Wheelchair accessible
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="familyFriendly"
                checked={familyFriendly}
                onCheckedChange={(c) => setValue('familyFriendly', !!c)}
              />
              <Label htmlFor="familyFriendly" className="text-xs font-semibold uppercase cursor-pointer">
                Family friendly
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="suitableForBeginners"
                checked={suitableForBeginners}
                onCheckedChange={(c) => setValue('suitableForBeginners', !!c)}
              />
              <Label htmlFor="suitableForBeginners" className="text-xs font-semibold uppercase cursor-pointer">
                Suitable for beginners
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isLocalsFavourite"
                checked={isLocalsFavourite}
                onCheckedChange={(c) => setValue('isLocalsFavourite', !!c)}
              />
              <Label htmlFor="isLocalsFavourite" className="text-xs font-semibold uppercase cursor-pointer">
                Locals&apos; favourite
              </Label>
            </div>
          </div>

          <Field>
            <Label className="text-xs font-semibold uppercase">H1 Override <span className="normal-case font-normal text-muted-foreground">(English only)</span></Label>
            <Input {...register('h1Override')} placeholder="e.g. Mambo Beach Snorkel Tour" />
            <FieldDescription>
              English-only heading tweak. Use when the auto-generated H1 reads awkwardly. Does not affect translated pages - those use the Display Title from the Translations tab.
            </FieldDescription>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Breadcrumb Label</Label>
            <Input {...register('breadcrumbLabel')} placeholder="Custom breadcrumb text" />
            <FieldDescription>Short label used in breadcrumb navigation.</FieldDescription>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">External Reference</Label>
            <Input {...register('reference')} placeholder="Your own product code / OCTO id" />
            <FieldDescription>Optional. Your external system&apos;s identifier for this product.</FieldDescription>
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

    {/* OCTO & Delivery: advanced integration fields, low priority for now.
        Collapsed by default; edits still save through the same form. */}
    <Collapsible>
      <Card className="gap-0 py-0">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="group/octo flex w-full items-center justify-between gap-2 px-8 py-6 text-left"
          >
            <span className="font-heading text-lg font-semibold uppercase tracking-wider">
              OCTO &amp; Delivery
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/octo:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="border-t">
          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Availability Type</Label>
                <Controller
                  name="availabilityType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="START_TIME">Start time</SelectItem>
                        <SelectItem value="OPENING_HOURS">Opening hours</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Redemption Method</Label>
                <Controller
                  name="redemptionMethod"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIGITAL">Digital</SelectItem>
                        <SelectItem value="PRINT">Print</SelectItem>
                        <SelectItem value="MANIFEST">Manifest</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="instantDelivery"
                  checked={instantDelivery}
                  onCheckedChange={(c) => setValue('instantDelivery', !!c)}
                />
                <Label htmlFor="instantDelivery" className="text-xs font-semibold uppercase cursor-pointer">
                  Instant delivery
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="availabilityRequired"
                  checked={availabilityRequired}
                  onCheckedChange={(c) => setValue('availabilityRequired', !!c)}
                />
                <Label htmlFor="availabilityRequired" className="text-xs font-semibold uppercase cursor-pointer">
                  Availability required
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allowFreesale"
                  checked={allowFreesale}
                  onCheckedChange={(c) => setValue('allowFreesale', !!c)}
                />
                <Label htmlFor="allowFreesale" className="text-xs font-semibold uppercase cursor-pointer">
                  Allow freesale
                </Label>
              </div>
            </div>

            <Field>
              <Label className="text-xs font-semibold uppercase">Delivery Formats</Label>
              <Controller
                name="deliveryFormats"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {DELIVERY_FORMAT_OPTIONS.map((opt) => {
                      const checked = field.value.includes(opt.value);
                      return (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`deliveryFormat-${opt.value}`}
                            checked={checked}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c
                                  ? [...field.value, opt.value]
                                  : field.value.filter((v) => v !== opt.value)
                              )
                            }
                          />
                          <Label
                            htmlFor={`deliveryFormat-${opt.value}`}
                            className="text-xs font-semibold uppercase cursor-pointer"
                          >
                            {opt.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Delivery Methods</Label>
              <Controller
                name="deliveryMethods"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4 pt-1">
                    {DELIVERY_METHOD_OPTIONS.map((opt) => {
                      const checked = field.value.includes(opt.value);
                      return (
                        <div key={opt.value} className="flex items-center gap-2">
                          <Checkbox
                            id={`deliveryMethod-${opt.value}`}
                            checked={checked}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c
                                  ? [...field.value, opt.value]
                                  : field.value.filter((v) => v !== opt.value)
                              )
                            }
                          />
                          <Label
                            htmlFor={`deliveryMethod-${opt.value}`}
                            className="text-xs font-semibold uppercase cursor-pointer"
                          >
                            {opt.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Time Zone</Label>
              <Input {...register('timeZone')} placeholder="e.g. America/Curacao" />
              <FieldDescription>IANA time zone identifier for the tour&apos;s local time.</FieldDescription>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Start Times</Label>
              <Controller
                name="startTimes"
                control={control}
                render={({ field }) => {
                  function addTime() {
                    const value = startTimeDraft.trim();
                    if (!TIME_PATTERN.test(value)) {
                      toast.error('Enter a valid time in HH:MM (24-hour).');
                      return;
                    }
                    if (field.value.includes(value)) {
                      toast.error('That start time is already added.');
                      return;
                    }
                    field.onChange([...field.value, value].sort());
                    setStartTimeDraft('');
                  }
                  return (
                    <div className="space-y-3">
                      {field.value.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {field.value.map((time) => (
                            <Badge key={time} variant="secondary" className="gap-1.5 pr-1">
                              <span>{time}</span>
                              <button
                                type="button"
                                onClick={() => field.onChange(field.value.filter((t) => t !== time))}
                                className="rounded-sm hover:bg-foreground/10 p-0.5 transition-colors"
                                aria-label={`Remove ${time}`}
                              >
                                <XIcon className="size-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <Input
                          value={startTimeDraft}
                          onChange={(e) => setStartTimeDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTime())}
                          placeholder="HH:MM (e.g. 09:30)"
                          className="max-w-45"
                        />
                        <Button type="button" size="sm" onClick={addTime}>
                          Add
                        </Button>
                      </div>
                    </div>
                  );
                }}
              />
              <FieldDescription>
                The tour&apos;s start times. Availability schedules switch these on per weekday.
              </FieldDescription>
            </Field>
          </CardContent>
          <div className="flex justify-end px-8 pb-8">
            <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
    </div>
  );
}
