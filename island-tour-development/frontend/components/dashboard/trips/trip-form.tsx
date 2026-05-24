'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MapPinIcon, XIcon } from 'lucide-react';
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
import type { Resolver } from 'react-hook-form';
import { useCreateTrip } from '@/hooks/trips/use-trips';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useHubMatchForCategory } from '@/hooks/hubs/use-hubs';

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
  categoryId: z.string().min(1, 'Category is required'),
  hubId: z.string().optional(),
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
  categoryId: string;
  hubId: string;
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
  // null = not yet answered; true = accepted hub; false = declined hub
  const [hubDecision, setHubDecision] = useState<boolean | null>(null);

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
      categoryId: '',
      hubId: '',
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
  const categoryId = watch('categoryId');

  const { data: matchedHub, isFetching: isCheckingHub } = useHubMatchForCategory(
    destinationId || undefined,
    categoryId || undefined,
  );

  useEffect(() => {
    if (!slugTouched) {
      setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
    }
  }, [nameValue, slugTouched, setValue]);

  // Reset hub decision and hubId when destination or category changes
  useEffect(() => {
    setHubDecision(null);
    setValue('hubId', '');
  }, [destinationId, categoryId, setValue]);

  // When hub match is confirmed, set hubId in the form
  useEffect(() => {
    if (hubDecision === true && matchedHub) {
      setValue('hubId', matchedHub.id);
    } else if (hubDecision === false) {
      setValue('hubId', '');
    }
  }, [hubDecision, matchedHub, setValue]);

  function onSubmit(values: CreateTripFormValues) {
    createTrip(
      {
        name: values.name,
        slug: values.slug || undefined,
        destinationId: values.destinationId,
        categoryId: values.categoryId,
        hubId: values.hubId || null,
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

  const showHubPrompt = !!matchedHub && hubDecision === null && !isCheckingHub;

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

          {/* Hub auto-detection */}
          {destinationId && categoryId && (
            <div>
              {isCheckingHub && (
                <p className="text-xs text-muted-foreground">Checking for matching hub...</p>
              )}

              {showHubPrompt && (
                <div className="flex items-start gap-3 rounded-none border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 px-4 py-3">
                  <MapPinIcon className="size-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Hub match found: <span className="font-semibold">{matchedHub.name}</span>
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                      This destination + category combination is covered by the{' '}
                      <span className="font-medium">{matchedHub.name}</span> hub. Do you want to
                      list this trip under that hub? Hub-anchored trips appear at a dedicated hub
                      URL instead of the destination listing.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setHubDecision(true)}
                      >
                        Yes, list under {matchedHub.name}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setHubDecision(false)}
                      >
                        No, destination-only
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {hubDecision === true && matchedHub && (
                <div className="flex items-center justify-between gap-2 rounded-none border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="size-4 text-emerald-500 shrink-0" />
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      Trip will be listed under hub:{' '}
                      <span className="font-semibold">{matchedHub.name}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHubDecision(null)}
                    className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              )}

              {hubDecision === false && matchedHub && (
                <div className="flex items-center justify-between gap-2 rounded-none border border-foreground/10 bg-muted/40 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Trip will be listed as a destination-only tour (no hub).
                  </p>
                  <button
                    type="button"
                    onClick={() => setHubDecision(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}

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
