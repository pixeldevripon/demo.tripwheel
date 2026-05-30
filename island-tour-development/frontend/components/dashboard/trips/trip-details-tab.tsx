'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Resolver } from 'react-hook-form';
import { useUpdateTrip } from '@/hooks/trips/use-trips';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import type { TripListItem } from '@/types/trip';

const detailsSchema = z.object({
  name: z.string().min(3).max(120),
  categoryId: z.string().min(1, 'Required'),
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
  categoryId: string;
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
      categoryId: trip.categoryId,
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
      categoryId: trip.categoryId,
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

  function onSubmit(values: DetailsFormValues) {
    updateTrip(
      {
        id: trip.id,
        payload: {
          name: values.name,
          categoryId: values.categoryId,
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
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Core Details</CardTitle>
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
              Category <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={!!errors.categoryId}>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{errors.categoryId?.message}</FieldError>
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
            <Label className="text-xs font-semibold uppercase">H1 Override</Label>
            <Input {...register('h1Override')} placeholder="Custom H1 heading" />
            <FieldDescription>Overrides the default H1 heading on the trip page.</FieldDescription>
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
  );
}
