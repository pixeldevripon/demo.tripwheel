'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import type { Resolver } from 'react-hook-form';
import { useCreateTrip } from '@/hooks/trips/use-trips';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useActiveHubs } from '@/hooks/hubs/use-hubs';

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

const createTripSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(120),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only')
    .optional()
    .or(z.literal('')),
  destinationId: z.string().min(1, 'Destination is required'),
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
  // UNIT/GROUP charter surcharge: base covers `unitIncludedGuests`; each extra
  // guest costs `extraPersonPrice`. Only meaningful for GROUP (D1a); other unit
  // types are a flat basePrice and never collect these.
  unitIncludedGuests: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .or(z.literal('')),
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
  minPartySize: z.coerce.number().int().min(1).optional(),
  maxPartySize: z.coerce.number().int().min(1).optional().or(z.literal('')),
  bookingCutoffMinutes: z.coerce.number().int().min(0).max(10080).optional(),
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
}).superRefine((val, ctx) => {
  // A unit-priced tour needs a base price and a unit type to be bookable (mirrors the
  // backend publish gate). PER_PERSON finishes its price (age bands) in the Pricing tab.
  if (val.pricingModel === 'UNIT') {
    if (!val.basePrice) {
      ctx.addIssue({
        code: 'custom',
        path: ['basePrice'],
        message: 'Base price is required for a unit-priced tour',
      });
    }
    if (!val.wholeUnitType) {
      ctx.addIssue({
        code: 'custom',
        path: ['wholeUnitType'],
        message: 'Unit type is required for a unit-priced tour',
      });
    }
  }
});

type CreateTripFormValues = {
  name: string;
  slug: string;
  destinationId: string;
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
};

export function TripForm() {
  const router = useRouter();
  const { mutate: createTrip, isPending } = useCreateTrip();
  const [slugTouched, setSlugTouched] = useState(false);

  const { data: destinations } = useActiveDestinations();
  const { data: categories } = useActiveCategories();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<CreateTripFormValues>({
    resolver: zodResolver(createTripSchema) as unknown as Resolver<CreateTripFormValues>,
    defaultValues: {
      name: '',
      slug: '',
      destinationId: '',
      categoryIds: [],
      primaryCategoryId: '',
      hubIds: [],
      pricingModel: 'PER_PERSON',
      wholeUnitType: '',
      defaultCurrency: 'USD',
      basePrice: '',
      unitIncludedGuests: '',
      extraPersonPrice: '',
      durationMinutesFrom: '',
      durationMinutesTo: '',
      pickupModel: 'NONE',
      pickupRequired: false,
      bookingType: '',
      paymentModel: 'OPERATOR_LINK',
      instantConfirmation: true,
      minPartySize: '1',
      maxPartySize: '',
      bookingCutoffMinutes: '0',
      cancellationHours: '48',
      departureCity: '',
      meetingPointLat: '',
      meetingPointLng: '',
      minAgeYears: '',
      fitnessLevel: '',
      weatherDependent: false,
      wheelchairAccessible: false,
      familyFriendly: false,
      suitableForBeginners: false,
    },
  });

  const nameValue = watch('name');
  const destinationId = watch('destinationId');
  const categoryIds = watch('categoryIds');
  const primaryCategoryId = watch('primaryCategoryId');
  const pricingModel = watch('pricingModel');
  const wholeUnitType = watch('wholeUnitType');
  const isGroupUnit = pricingModel === 'UNIT' && wholeUnitType === 'GROUP';

  const { data: hubs } = useActiveHubs(destinationId || undefined);

  useEffect(() => {
    if (!slugTouched) {
      setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
    }
  }, [nameValue, slugTouched, setValue]);

  useEffect(() => {
    setValue('hubIds', []);
  }, [destinationId, setValue]);

  useEffect(() => {
    if (categoryIds.length === 0) {
      if (primaryCategoryId) setValue('primaryCategoryId', '');
    } else if (!categoryIds.includes(primaryCategoryId)) {
      setValue('primaryCategoryId', categoryIds[0]);
    }
  }, [categoryIds, primaryCategoryId, setValue]);

  function onSubmit(values: CreateTripFormValues) {
    createTrip(
      {
        name: values.name,
        slug: values.slug || undefined,
        destinationId: values.destinationId,
        categoryIds: values.categoryIds,
        primaryCategoryId: values.primaryCategoryId || values.categoryIds[0],
        hubIds: values.hubIds,
        pricingModel: values.pricingModel,
        wholeUnitType: values.pricingModel === 'UNIT' && values.wholeUnitType ? values.wholeUnitType : undefined,
        defaultCurrency: values.defaultCurrency,
        basePrice: values.basePrice || undefined,
        // Surcharge is GROUP-only (D1a); other unit types are a flat basePrice.
        unitIncludedGuests:
          values.pricingModel === 'UNIT' &&
          values.wholeUnitType === 'GROUP' &&
          values.unitIncludedGuests
            ? Number(values.unitIncludedGuests)
            : undefined,
        extraPersonPrice:
          values.pricingModel === 'UNIT' &&
          values.wholeUnitType === 'GROUP' &&
          values.extraPersonPrice
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
      },
      {
        onSuccess: (created) => {
          toast.success('Trip created successfully.');
          router.push(`/dashboard/trips/${created.id}/edit`);
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : 'Failed to create trip.';
          if (message.includes('409') || message.toLowerCase().includes('slug')) {
            toast.error('A trip with this slug already exists in this destination.');
          } else {
            toast.error(message);
          }
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Trip Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
              Slug <span className="text-destructive">*</span>
            </Label>
            <Input
              {...register('slug')}
              placeholder="e.g. sunset-catamaran-cruise"
              aria-invalid={!!errors.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setValue('slug', e.target.value, { shouldValidate: true });
              }}
            />
            <FieldDescription>
              Used in the URL. Auto-generated from the name, but you can customise it.
            </FieldDescription>
            <FieldError>{errors.slug?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">
              Destination <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="destinationId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={!!errors.destinationId}>
                    <SelectValue placeholder="Select a destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(destinations ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{errors.destinationId?.message}</FieldError>
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
              Pick one or more. The starred category is the primary (used for the breadcrumb &amp; canonical URL).
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
                  placeholder={destinationId ? 'Select hubs…' : 'Select a destination first'}
                  searchPlaceholder="Search hubs…"
                  disabled={!destinationId}
                />
              )}
            />
            <FieldDescription>
              Optional discovery tags (0–n). A hub must allow at least one of the trip&apos;s categories.
            </FieldDescription>
          </Field>

          {/* Pricing */}
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
                <FieldError>{errors.wholeUnitType?.message}</FieldError>
                <FieldDescription>The whole-asset type priced as one unit.</FieldDescription>
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

          {/* GROUP charter surcharge (D1a): base covers N guests; extras cost more.
              Only GROUP collects these; other unit types are a flat base price. */}
          {isGroupUnit && (
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Guests Included in Base
                </Label>
                <Input
                  {...register('unitIncludedGuests')}
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  aria-invalid={!!errors.unitIncludedGuests}
                />
                <FieldDescription>
                  Guests the base price covers before extra charges apply.
                </FieldDescription>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Extra Person Price
                </Label>
                <Input
                  {...register('extraPersonPrice')}
                  placeholder="e.g. 220"
                  aria-invalid={!!errors.extraPersonPrice}
                />
                <FieldError>{errors.extraPersonPrice?.message}</FieldError>
                <FieldDescription>
                  Surcharge per guest beyond the included count.
                </FieldDescription>
              </Field>
            </div>
          )}

          {/* Duration range */}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Duration From (minutes)</Label>
              <Input
                {...register('durationMinutesFrom')}
                type="number"
                min={1}
                placeholder="e.g. 180"
                aria-invalid={!!errors.durationMinutesFrom}
              />
              <FieldError>{errors.durationMinutesFrom?.message}</FieldError>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Duration To (minutes)</Label>
              <Input
                {...register('durationMinutesTo')}
                type="number"
                min={1}
                placeholder="Optional - upper bound"
                aria-invalid={!!errors.durationMinutesTo}
              />
              <FieldDescription>Leave empty for a fixed duration.</FieldDescription>
            </Field>
          </div>

          {/* Booking */}
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
              <FieldDescription>Free-cancellation window before departure.</FieldDescription>
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            Pickup, party size, booking cutoff, meeting point, audience and
            accessibility are optional - add them any time after creating the trip,
            from its Details tab.
          </p>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Trip'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
