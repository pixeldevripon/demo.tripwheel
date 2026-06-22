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
  pricingModel: z.enum(['PER_PERSON', 'UNIT']).optional(),
  basePrice: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
    .optional()
    .or(z.literal('')),
  durationMinutes: z.coerce.number().int().min(1).max(10080).optional().or(z.literal('')),
  pickupModel: z.enum(['NONE', 'INCLUDED', 'OPTIONAL']).optional(),
  minPartySize: z.coerce.number().int().min(1).optional(),
  maxPartySize: z.coerce.number().int().min(1).optional().or(z.literal('')),
  bookingCutoffMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  cancellationHours: z.coerce.number().int().min(0).optional(),
});

type CreateTripFormValues = {
  name: string;
  slug: string;
  destinationId: string;
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
      basePrice: '',
      durationMinutes: '',
      pickupModel: 'NONE',
      minPartySize: '1',
      maxPartySize: '',
      bookingCutoffMinutes: '0',
      cancellationHours: '24',
    },
  });

  const nameValue = watch('name');
  const destinationId = watch('destinationId');
  const categoryIds = watch('categoryIds');
  const primaryCategoryId = watch('primaryCategoryId');

  // Hubs available for the chosen destination (only those whose allowed categories
  // intersect the selected categories are valid - the backend enforces this).
  const { data: hubs } = useActiveHubs(destinationId || undefined);

  useEffect(() => {
    if (!slugTouched) {
      setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
    }
  }, [nameValue, slugTouched, setValue]);

  // Clear selected hubs when the destination changes (hubs are destination-scoped).
  useEffect(() => {
    setValue('hubIds', []);
  }, [destinationId, setValue]);

  // Keep primary valid: default to the first category, clear if it leaves the set.
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
        basePrice: values.basePrice || undefined,
        durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
        pickupModel: values.pickupModel,
        minPartySize: Number(values.minPartySize),
        maxPartySize: values.maxPartySize ? Number(values.maxPartySize) : undefined,
        bookingCutoffMinutes: Number(values.bookingCutoffMinutes),
        cancellationHours: Number(values.cancellationHours),
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

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Pricing Model</Label>
              <Controller
                name="pricingModel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
                aria-invalid={!!errors.durationMinutes}
              />
              <FieldError>{errors.durationMinutes?.message}</FieldError>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Pickup Model</Label>
              <Controller
                name="pickupModel"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
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
              <Input
                {...register('minPartySize')}
                type="number"
                min={1}
                placeholder="1"
              />
              <FieldDescription>Minimum travelers per booking.</FieldDescription>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Max Party Size</Label>
              <Input
                {...register('maxPartySize')}
                type="number"
                min={1}
                placeholder="Optional"
              />
              <FieldDescription>Maximum travelers per booking. Leave empty for no limit.</FieldDescription>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Booking Cutoff (minutes)</Label>
              <Input
                {...register('bookingCutoffMinutes')}
                type="number"
                min={0}
                placeholder="0"
              />
              <FieldDescription>How many minutes before departure bookings close.</FieldDescription>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Cancellation (hours)</Label>
              <Input
                {...register('cancellationHours')}
                type="number"
                min={0}
                placeholder="24"
              />
              <FieldDescription>Hours before departure a guest can cancel.</FieldDescription>
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            These defaults can be changed any time from the trip&apos;s Details tab.
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
