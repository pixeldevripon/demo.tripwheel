'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon } from 'lucide-react';
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
  useAgeBands,
  useCreateAgeBand,
  useRemoveAgeBand,
  useAddOns,
  useCreateAddOn,
  useUpdateAddOn,
  useRemoveAddOn,
} from '@/hooks/trips/use-trips';
import type { TourAddOn, TourAgeBand } from '@/types/trip';

const addAgeBandSchema = z.object({
  bandType: z.enum(['ADULT', 'CHILD', 'INFANT']),
  label: z.string().min(1, 'Label is required').max(60),
  minAge: z.coerce.number().int().min(0).optional(),
  maxAge: z.coerce.number().int().min(0).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price'),
  minCount: z.coerce.number().int().min(0).optional(),
  maxCount: z.coerce.number().int().min(0).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const addAddOnSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80),
  description: z.string().optional().or(z.literal('')),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price'),
  unit: z.enum(['PER_PERSON', 'FLAT']),
  maxQuantity: z.coerce.number().int().min(1).optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

type AddAgeBandFormValues = {
  bandType: 'ADULT' | 'CHILD' | 'INFANT';
  label: string;
  minAge: string;
  maxAge: string;
  price: string;
  minCount: string;
  maxCount: string;
  displayOrder: string;
};
type AddAddOnFormValues = {
  name: string;
  description: string;
  price: string;
  unit: 'PER_PERSON' | 'FLAT';
  maxQuantity: string;
  displayOrder: string;
};

interface AgeBandRowProps {
  band: TourAgeBand;
  tripId: string;
}

function AgeBandRow({ band, tripId }: AgeBandRowProps) {
  const { mutate: removeBand, isPending } = useRemoveAgeBand();

  function handleDelete() {
    removeBand(
      { tripId, bandId: band.id },
      {
        onSuccess: () => toast.success('Age band removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 ring-1 ring-foreground/10 px-3 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <Badge variant="secondary">{band.bandType}</Badge>
        <span className="text-sm font-medium">{band.label}</span>
        <span className="text-sm text-muted-foreground">${band.price}</span>
        {band.minAge != null && band.maxAge != null && (
          <span className="text-xs text-muted-foreground">
            {band.minAge}–{band.maxAge} yrs
          </span>
        )}
      </div>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </div>
  );
}

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
  const { data: ageBands, isLoading: isLoadingBands } = useAgeBands(tripId);
  const { data: addOns, isLoading: isLoadingAddOns } = useAddOns(tripId);
  const { mutate: createAgeBand, isPending: isCreatingBand } = useCreateAgeBand();
  const { mutate: createAddOn, isPending: isCreatingAddOn } = useCreateAddOn();

  const {
    register: registerBand,
    handleSubmit: handleBandSubmit,
    reset: resetBand,
    control: bandControl,
    formState: { errors: bandErrors },
  } = useForm<AddAgeBandFormValues>({
    resolver: zodResolver(addAgeBandSchema) as unknown as Resolver<AddAgeBandFormValues>,
    defaultValues: {
      bandType: 'ADULT',
      label: '',
      minAge: '',
      maxAge: '',
      price: '',
      minCount: '',
      maxCount: '',
      displayOrder: '0',
    },
  });

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

  function onAddBand(values: AddAgeBandFormValues) {
    createAgeBand(
      {
        tripId,
        payload: {
          bandType: values.bandType,
          label: values.label,
          price: values.price,
          minAge: values.minAge ? Number(values.minAge) : undefined,
          maxAge: values.maxAge ? Number(values.maxAge) : undefined,
          minCount: values.minCount ? Number(values.minCount) : undefined,
          maxCount: values.maxCount ? Number(values.maxCount) : undefined,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Age band added.');
          resetBand({ bandType: 'ADULT', label: '', minAge: '', maxAge: '', price: '', minCount: '', maxCount: '', displayOrder: String(ageBands?.length ?? 0) });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add age band.'),
      }
    );
  }

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
      {/* Age Bands */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Age Bands</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoadingBands ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-none" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(ageBands ?? []).map((band) => (
                <AgeBandRow key={band.id} band={band} tripId={tripId} />
              ))}
              {(ageBands?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No age bands defined yet.</p>
              )}
            </div>
          )}

          <form onSubmit={handleBandSubmit(onAddBand)} className="space-y-4 pt-4 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Age Band</p>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Band Type</Label>
                <Controller
                  name="bandType"
                  control={bandControl}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADULT">Adult</SelectItem>
                        <SelectItem value="CHILD">Child</SelectItem>
                        <SelectItem value="INFANT">Infant</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Label</Label>
                <Input
                  {...registerBand('label')}
                  placeholder="e.g. Adult (18+)"
                  aria-invalid={!!bandErrors.label}
                />
                <FieldError>{bandErrors.label?.message}</FieldError>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Price</Label>
                <Input
                  {...registerBand('price')}
                  placeholder="49.99"
                  aria-invalid={!!bandErrors.price}
                />
                <FieldError>{bandErrors.price?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Min Age</Label>
                <Input {...registerBand('minAge')} type="number" min={0} placeholder="Optional" />
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Max Age</Label>
                <Input {...registerBand('maxAge')} type="number" min={0} placeholder="Optional" />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isCreatingBand}>
                {isCreatingBand ? 'Adding...' : 'Add Band'}
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
