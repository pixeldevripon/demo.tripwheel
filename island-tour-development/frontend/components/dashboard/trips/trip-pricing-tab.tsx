'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon, StarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Resolver } from 'react-hook-form';
import {
  useAddOns,
  useCreateAddOn,
  useUpdateAddOn,
  useRemoveAddOn,
  useAgeBands,
  useCreateAgeBand,
  useUpdateAgeBand,
  useRemoveAgeBand,
} from '@/hooks/trips/use-trips';
import type { TourAddOn, TourAgeBand } from '@/types/trip';

// ── Age Bands ─────────────────────────────────────────────────────────────────

const priceRegex = /^\d+(\.\d{1,2})?$/;

const addAgeBandSchema = z
  .object({
    label: z.string().min(1, 'Label is required').max(60),
    minAge: z.string().optional().or(z.literal('')),
    maxAge: z.string().optional().or(z.literal('')),
    price: z.string().regex(priceRegex, 'Must be a valid price'),
    priceOriginal: z.string().regex(priceRegex, 'Must be a valid price').optional().or(z.literal('')),
    isDefault: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (v) => !v.minAge || !v.maxAge || Number(v.maxAge) >= Number(v.minAge),
    { message: 'Max age must be greater than or equal to min age', path: ['maxAge'] }
  );

type AddAgeBandFormValues = {
  label: string;
  minAge: string;
  maxAge: string;
  price: string;
  priceOriginal: string;
  isDefault: boolean;
  displayOrder: string;
};

/** Renders an age band's bounds as a human-readable range. */
function formatAgeRange(minAge: number | null, maxAge: number | null): string {
  if (minAge == null && maxAge == null) return 'All ages';
  if (minAge != null && maxAge == null) return `${minAge}+`;
  if (minAge == null && maxAge != null) return `Up to ${maxAge}`;
  return `${minAge}-${maxAge}`;
}

interface AgeBandRowProps {
  ageBand: TourAgeBand;
  tripId: string;
}

function AgeBandRow({ ageBand, tripId }: AgeBandRowProps) {
  const { mutate: updateAgeBand, isPending: isUpdating } = useUpdateAgeBand();
  const { mutate: removeAgeBand, isPending: isRemoving } = useRemoveAgeBand();

  function handleSetDefault() {
    if (ageBand.isDefault) return;
    updateAgeBand(
      { tripId, ageBandId: ageBand.id, payload: { isDefault: true } },
      {
        onSuccess: () => toast.success(`"${ageBand.label}" is now the default band.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  function handleDelete() {
    removeAgeBand(
      { tripId, ageBandId: ageBand.id },
      {
        onSuccess: () => toast.success('Age band removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 ring-1 ring-foreground/10 px-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        {ageBand.isDefault ? (
          <StarIcon className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
        ) : (
          <span className="size-1.5 rounded-full shrink-0 bg-muted-foreground" />
        )}
        <span className="text-sm font-medium truncate">{ageBand.label}</span>
        <Badge variant="outline" className="text-xs">{formatAgeRange(ageBand.minAge, ageBand.maxAge)}</Badge>
        <span className="text-sm text-muted-foreground">${ageBand.price}</span>
        {ageBand.priceOriginal && (
          <span className="text-xs text-muted-foreground line-through">${ageBand.priceOriginal}</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="xs"
          variant="outline"
          onClick={handleSetDefault}
          disabled={isUpdating || ageBand.isDefault}
        >
          {ageBand.isDefault ? 'Default' : 'Set Default'}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isRemoving}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Add-Ons ───────────────────────────────────────────────────────────────────

const addAddOnSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  description: z.string().optional().or(z.literal('')),
  price: z.string().regex(priceRegex, 'Must be a valid price'),
  unit: z.enum(['PER_PERSON', 'FLAT']),
  maxQuantity: z.coerce.number().int().min(1).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

type AddAddOnFormValues = {
  name: string;
  description: string;
  price: string;
  unit: 'PER_PERSON' | 'FLAT';
  maxQuantity: string;
  displayOrder: string;
};

interface AddOnRowProps {
  addOn: TourAddOn;
  tripId: string;
}

function AddOnRow({ addOn, tripId }: AddOnRowProps) {
  const { mutate: updateAddOn, isPending: isUpdating } = useUpdateAddOn();
  const { mutate: removeAddOn, isPending: isRemoving } = useRemoveAddOn();

  function handleToggleActive() {
    updateAddOn(
      { tripId, addOnId: addOn.id, payload: { isActive: !addOn.isActive } },
      {
        onSuccess: () => toast.success(`Add-on ${!addOn.isActive ? 'activated' : 'deactivated'}.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  function handleDelete() {
    removeAddOn(
      { tripId, addOnId: addOn.id },
      {
        onSuccess: () => toast.success('Add-on removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 ring-1 ring-foreground/10 px-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`size-1.5 rounded-full shrink-0 ${addOn.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
        <span className="text-sm font-medium truncate">{addOn.name}</span>
        <span className="text-sm text-muted-foreground">${addOn.price}</span>
        <Badge variant="outline" className="text-xs">{addOn.unit === 'PER_PERSON' ? '/person' : 'flat'}</Badge>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="xs"
          variant="outline"
          onClick={handleToggleActive}
          disabled={isUpdating}
        >
          {addOn.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isRemoving}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface TripPricingTabProps {
  tripId: string;
}

export function TripPricingTab({ tripId }: TripPricingTabProps) {
  const { data: ageBands, isLoading: isLoadingAgeBands } = useAgeBands(tripId);
  const { mutate: createAgeBand, isPending: isCreatingAgeBand } = useCreateAgeBand();

  const { data: addOns, isLoading: isLoadingAddOns } = useAddOns(tripId);
  const { mutate: createAddOn, isPending: isCreatingAddOn } = useCreateAddOn();

  const {
    register: registerAgeBand,
    handleSubmit: handleAgeBandSubmit,
    reset: resetAgeBand,
    control: ageBandControl,
    formState: { errors: ageBandErrors },
  } = useForm<AddAgeBandFormValues>({
    resolver: zodResolver(addAgeBandSchema) as unknown as Resolver<AddAgeBandFormValues>,
    defaultValues: {
      label: '',
      minAge: '',
      maxAge: '',
      price: '',
      priceOriginal: '',
      isDefault: false,
      displayOrder: '0',
    },
  });

  const ageBandDefaults: AddAgeBandFormValues = {
    label: '',
    minAge: '',
    maxAge: '',
    price: '',
    priceOriginal: '',
    isDefault: false,
    displayOrder: '0',
  };

  function onAddAgeBand(values: AddAgeBandFormValues) {
    createAgeBand(
      {
        tripId,
        payload: {
          label: values.label,
          minAge: values.minAge !== '' ? Number(values.minAge) : undefined,
          maxAge: values.maxAge !== '' ? Number(values.maxAge) : undefined,
          price: values.price,
          priceOriginal: values.priceOriginal || undefined,
          isDefault: values.isDefault,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Age band added.');
          resetAgeBand(ageBandDefaults);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add age band.'),
      }
    );
  }

  const {
    register: registerAddOn,
    handleSubmit: handleAddOnSubmit,
    reset: resetAddOn,
    control: addOnControl,
    formState: { errors: addOnErrors },
  } = useForm<AddAddOnFormValues>({
    resolver: zodResolver(addAddOnSchema) as unknown as Resolver<AddAddOnFormValues>,
    defaultValues: {
      name: '',
      description: '',
      price: '',
      unit: 'PER_PERSON',
      maxQuantity: '10',
      displayOrder: '0',
    },
  });

  function onAddAddOn(values: AddAddOnFormValues) {
    createAddOn(
      {
        tripId,
        payload: {
          name: values.name,
          description: values.description || undefined,
          price: values.price,
          unit: values.unit,
          maxQuantity: values.maxQuantity ? Number(values.maxQuantity) : undefined,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Add-on added.');
          resetAddOn({ name: '', description: '', price: '', unit: 'PER_PERSON', maxQuantity: '10', displayOrder: '0' });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add add-on.'),
      }
    );
  }

  return (
    <div className="space-y-6">
      {/* Age Bands - flat per-traveler pricing (Adult / Child / Infant ...) */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Age Bands</CardTitle>
          <p className="text-sm text-muted-foreground">
            Per-traveler price tiers. The tour&apos;s &ldquo;from&rdquo; price is the cheapest band.
          </p>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoadingAgeBands ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-none" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(ageBands ?? []).map((band) => (
                <AgeBandRow key={band.id} ageBand={band} tripId={tripId} />
              ))}
              {(ageBands?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No age bands defined yet. Add at least one (e.g. Adult) to set pricing.
                </p>
              )}
            </div>
          )}

          <form onSubmit={handleAgeBandSubmit(onAddAgeBand)} className="space-y-4 pt-4 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Age Band</p>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Label</Label>
                <Input
                  {...registerAgeBand('label')}
                  placeholder="e.g. Adult"
                  aria-invalid={!!ageBandErrors.label}
                />
                <FieldError>{ageBandErrors.label?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Price</Label>
                <Input
                  {...registerAgeBand('price')}
                  placeholder="79.00"
                  aria-invalid={!!ageBandErrors.price}
                />
                <FieldError>{ageBandErrors.price?.message}</FieldError>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Min Age</Label>
                <Input
                  {...registerAgeBand('minAge')}
                  type="number"
                  min={0}
                  max={120}
                  placeholder="Any"
                  aria-invalid={!!ageBandErrors.minAge}
                />
                <FieldError>{ageBandErrors.minAge?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Max Age</Label>
                <Input
                  {...registerAgeBand('maxAge')}
                  type="number"
                  min={0}
                  max={120}
                  placeholder="Any"
                  aria-invalid={!!ageBandErrors.maxAge}
                />
                <FieldError>{ageBandErrors.maxAge?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Original Price</Label>
                <Input
                  {...registerAgeBand('priceOriginal')}
                  placeholder="Optional"
                  aria-invalid={!!ageBandErrors.priceOriginal}
                />
                <FieldError>{ageBandErrors.priceOriginal?.message}</FieldError>
              </Field>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Controller
                name="isDefault"
                control={ageBandControl}
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="size-4 accent-foreground"
                    />
                    Default band (pre-selected at booking)
                  </label>
                )}
              />
              <Button type="submit" size="sm" disabled={isCreatingAgeBand}>
                {isCreatingAgeBand ? 'Adding...' : 'Add Age Band'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add-Ons */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Add-Ons</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoadingAddOns ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-none" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(addOns ?? []).map((addOn) => (
                <AddOnRow key={addOn.id} addOn={addOn} tripId={tripId} />
              ))}
              {(addOns?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No add-ons defined yet.</p>
              )}
            </div>
          )}

          <form onSubmit={handleAddOnSubmit(onAddAddOn)} className="space-y-4 pt-4 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Add-On</p>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Name</Label>
                <Input
                  {...registerAddOn('name')}
                  placeholder="e.g. Snorkel Equipment"
                  aria-invalid={!!addOnErrors.name}
                />
                <FieldError>{addOnErrors.name?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Price</Label>
                <Input
                  {...registerAddOn('price')}
                  placeholder="19.99"
                  aria-invalid={!!addOnErrors.price}
                />
                <FieldError>{addOnErrors.price?.message}</FieldError>
              </Field>
            </div>

            <Field>
              <Label className="text-xs font-semibold uppercase">Description</Label>
              <Input {...registerAddOn('description')} placeholder="Optional description" />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Pricing Unit</Label>
                <Controller
                  name="unit"
                  control={addOnControl}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PER_PERSON">Per Person</SelectItem>
                        <SelectItem value="FLAT">Flat Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Max Quantity</Label>
                <Input {...registerAddOn('maxQuantity')} type="number" min={1} placeholder="10" />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isCreatingAddOn}>
                {isCreatingAddOn ? 'Adding...' : 'Add Add-On'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
