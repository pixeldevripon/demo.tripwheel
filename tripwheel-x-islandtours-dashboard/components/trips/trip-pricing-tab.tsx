'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon, StarIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
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
  useUpdateTrip,
} from '@/hooks/trips/use-trips';
import type {
  AddOnUnit,
  AgeBandType,
  BandParticipation,
  TourAddOn,
  TourAgeBand,
  TripListItem,
} from '@/types/trip';

// ── Age Bands ─────────────────────────────────────────────────────────────────

const priceRegex = /^\d+(\.\d{1,2})?$/;

/** Age-type options (AgeBandType enum). The type drives the API's typed pricing
 *  object (pricing.adult, pricing.child, ...) so it is required on every band. */
const AGE_BAND_TYPES: { value: AgeBandType; label: string }[] = [
  { value: 'ADULT', label: 'Adult' },
  { value: 'CHILD', label: 'Child' },
  { value: 'INFANT', label: 'Infant' },
  { value: 'YOUTH', label: 'Youth' },
  { value: 'SENIOR', label: 'Senior' },
];

/** Participation options (BandParticipation enum). Spectators are banded ride-alongs
 *  (Figma "Bringing Spectators?") - they count toward capacity but skip the activity. */
const PARTICIPATION_TYPES: { value: BandParticipation; label: string }[] = [
  { value: 'PARTICIPANT', label: 'Participant' },
  { value: 'SPECTATOR', label: 'Spectator' },
];

const addAgeBandSchema = z
  .object({
    bandType: z.enum(['ADULT', 'CHILD', 'INFANT', 'YOUTH', 'SENIOR']),
    participation: z.enum(['PARTICIPANT', 'SPECTATOR']),
    label: z.string().min(1, 'Label is required').max(60),
    minAge: z.string().optional().or(z.literal('')),
    maxAge: z.string().optional().or(z.literal('')),
    price: z.string().regex(priceRegex, 'Must be a valid price'),
    priceOriginal: z.string().regex(priceRegex, 'Must be a valid price').optional().or(z.literal('')),
    priceNet: z.string().regex(priceRegex, 'Must be a valid price').optional().or(z.literal('')),
    isDefault: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (v) => !v.minAge || !v.maxAge || Number(v.maxAge) >= Number(v.minAge),
    { message: 'Max age must be greater than or equal to min age', path: ['maxAge'] }
  );

type AddAgeBandFormValues = {
  bandType: AgeBandType;
  participation: BandParticipation;
  label: string;
  minAge: string;
  maxAge: string;
  price: string;
  priceOriginal: string;
  priceNet: string;
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
  const [editing, setEditing] = useState(false);

  // Local edit state, seeded from the band (numbers/prices as strings for inputs).
  const [bandType, setBandType] = useState<AgeBandType>(ageBand.bandType);
  const [participation, setParticipation] = useState<BandParticipation>(ageBand.participation);
  const [label, setLabel] = useState(ageBand.label);
  const [price, setPrice] = useState(ageBand.price);
  const [minAge, setMinAge] = useState(ageBand.minAge != null ? String(ageBand.minAge) : '');
  const [maxAge, setMaxAge] = useState(ageBand.maxAge != null ? String(ageBand.maxAge) : '');
  const [priceOriginal, setPriceOriginal] = useState(ageBand.priceOriginal ?? '');
  const [priceNet, setPriceNet] = useState(ageBand.priceNet ?? '');

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

  function handleSaveEdit() {
    if (!priceRegex.test(price)) {
      toast.error('Price must be a valid number.');
      return;
    }
    updateAgeBand(
      {
        tripId,
        ageBandId: ageBand.id,
        payload: {
          bandType,
          participation,
          label,
          price,
          minAge: minAge !== '' ? Number(minAge) : undefined,
          maxAge: maxAge !== '' ? Number(maxAge) : undefined,
          priceOriginal: priceOriginal || undefined,
          priceNet: priceNet || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Age band updated.');
          setEditing(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 px-3 py-2 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          {ageBand.isDefault ? (
            <StarIcon className="size-3.5 shrink-0 fill-rating text-rating" />
          ) : (
            <span className="size-1.5 rounded-full shrink-0 bg-muted-foreground" />
          )}
          <span className="text-sm font-medium truncate">{ageBand.label}</span>
          <Badge variant="secondary" className="text-xs capitalize">{ageBand.bandType.toLowerCase()}</Badge>
          {ageBand.participation === 'SPECTATOR' && (
            <Badge variant="outline" className="text-xs">Spectator</Badge>
          )}
          <Badge variant="outline" className="text-xs">{formatAgeRange(ageBand.minAge, ageBand.maxAge)}</Badge>
          <span className="text-sm text-muted-foreground">${ageBand.price}</span>
          {ageBand.priceOriginal && (
            <span className="text-xs text-muted-foreground line-through">${ageBand.priceOriginal}</span>
          )}
          {ageBand.priceNet && (
            <span className="text-xs text-muted-foreground">net ${ageBand.priceNet}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSetDefault}
            disabled={isUpdating || ageBand.isDefault}
          >
            {ageBand.isDefault ? 'Default' : 'Set Default'}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? 'Collapse age band' : 'Edit age band'}
            aria-expanded={editing}
          >
            <ChevronDownIcon
              className={`size-3.5 transition-transform ${editing ? 'rotate-180' : ''}`}
            />
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

      {editing && (
        <div className="pt-3 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Age Type</Label>
              <Select value={bandType} onValueChange={(v) => setBandType(v as AgeBandType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_BAND_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Participation</Label>
              <Select value={participation} onValueChange={(v) => setParticipation(v as BandParticipation)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Price</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="79.00" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Min Age</Label>
              <Input value={minAge} onChange={(e) => setMinAge(e.target.value)} type="number" min={0} max={120} placeholder="Any" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Max Age</Label>
              <Input value={maxAge} onChange={(e) => setMaxAge(e.target.value)} type="number" min={0} max={120} placeholder="Any" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Original Price</Label>
              <Input value={priceOriginal} onChange={(e) => setPriceOriginal(e.target.value)} placeholder="Optional" />
              <FieldDescription>Optional pre-discount price, shown struck through to signal a deal.</FieldDescription>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Net Price</Label>
              <Input value={priceNet} onChange={(e) => setPriceNet(e.target.value)} placeholder="Optional" />
              <FieldDescription>Optional operator net (what you keep). Internal only - not shown to travelers.</FieldDescription>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
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

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(addOn.name);
  const [price, setPrice] = useState(addOn.price);
  const [description, setDescription] = useState(addOn.description ?? '');
  const [unit, setUnit] = useState<AddOnUnit>(addOn.unit);
  const [maxQuantity, setMaxQuantity] = useState(String(addOn.maxQuantity));

  function handleToggleActive() {
    updateAddOn(
      { tripId, addOnId: addOn.id, payload: { isActive: !addOn.isActive } },
      {
        onSuccess: () => toast.success(`Add-on ${!addOn.isActive ? 'activated' : 'deactivated'}.`),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update.'),
      }
    );
  }

  function handleSaveEdit() {
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (!priceRegex.test(price)) {
      toast.error('Price must be a valid number (e.g. 19.99).');
      return;
    }
    updateAddOn(
      {
        tripId,
        addOnId: addOn.id,
        payload: {
          name: name.trim(),
          description: description.trim(),
          price,
          unit,
          maxQuantity: maxQuantity !== '' ? Number(maxQuantity) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Add-on updated.');
          setEditing(false);
        },
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
    <div className="ring-1 ring-foreground/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`size-1.5 rounded-full shrink-0 ${addOn.isActive ? 'bg-success-solid' : 'bg-muted-foreground'}`} />
          <span className="text-sm font-medium truncate">{addOn.name}</span>
          <span className="text-sm text-muted-foreground">${addOn.price}</span>
          <Badge variant="outline" className="text-xs">{addOn.unit === 'PER_PERSON' ? '/person' : 'flat'}</Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleActive}
            disabled={isUpdating}
          >
            {addOn.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? 'Collapse add-on' : 'Edit add-on'}
            aria-expanded={editing}
          >
            <ChevronDownIcon
              className={`size-3.5 transition-transform ${editing ? 'rotate-180' : ''}`}
            />
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

      {editing && (
        <div className="pt-3 mt-2 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Snorkel Equipment" />
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Price</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="19.99" />
            </Field>
          </div>
          <Field>
            <Label className="text-xs font-semibold uppercase">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label className="text-xs font-semibold uppercase">Pricing Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as AddOnUnit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_PERSON">Per Person</SelectItem>
                  <SelectItem value="FLAT">Flat Rate</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Max Quantity</Label>
              <Input value={maxQuantity} onChange={(e) => setMaxQuantity(e.target.value)} type="number" min={1} placeholder="10" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pricing basics (model + currency + base/unit fields) ────────────────────────

const pricingSchema = z
  .object({
    pricingModel: z.enum(['PER_PERSON', 'UNIT']),
    defaultCurrency: z.enum(['USD', 'EUR']),
    basePrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
      .optional()
      .or(z.literal('')),
    wholeUnitType: z
      .enum(['GROUP', 'BOAT', 'VEHICLE', 'AIRCRAFT', 'PACKAGE'])
      .optional()
      .or(z.literal('')),
    unitIncludedGuests: z.coerce.number().int().min(1).optional().or(z.literal('')),
    extraPersonPrice: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Must be a valid price')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((v, ctx) => {
    // Unit-priced tours need a whole-unit base price + a unit type.
    if (v.pricingModel === 'UNIT') {
      if (!v.basePrice)
        ctx.addIssue({ code: 'custom', path: ['basePrice'], message: 'Unit-priced tours need a base price.' });
      if (!v.wholeUnitType)
        ctx.addIssue({ code: 'custom', path: ['wholeUnitType'], message: 'Select a unit type.' });
    }
  });

type PricingFormValues = {
  pricingModel: 'PER_PERSON' | 'UNIT';
  defaultCurrency: 'USD' | 'EUR';
  basePrice: string;
  wholeUnitType: '' | 'GROUP' | 'BOAT' | 'VEHICLE' | 'AIRCRAFT' | 'PACKAGE';
  unitIncludedGuests: string;
  extraPersonPrice: string;
};

function PricingBasicsCard({ trip }: { trip: TripListItem }) {
  const { mutate: updateTrip, isPending } = useUpdateTrip();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<PricingFormValues>({
    resolver: zodResolver(pricingSchema) as unknown as Resolver<PricingFormValues>,
    defaultValues: {
      pricingModel: trip.pricingModel,
      defaultCurrency: trip.defaultCurrency,
      basePrice: trip.basePrice ?? '',
      wholeUnitType: trip.wholeUnitType ?? '',
      unitIncludedGuests: trip.unitIncludedGuests != null ? String(trip.unitIncludedGuests) : '',
      extraPersonPrice: trip.extraPersonPrice ?? '',
    },
  });
  const isUnit = watch('pricingModel') === 'UNIT';
  // The included-guests + extra-person surcharge applies ONLY to GROUP pricing;
  // boat/vehicle/aircraft/package charters are a flat whole-unit price.
  const isGroupUnit = isUnit && watch('wholeUnitType') === 'GROUP';

  function onSubmit(values: PricingFormValues) {
    updateTrip(
      {
        id: trip.id,
        payload: {
          pricingModel: values.pricingModel,
          defaultCurrency: values.defaultCurrency,
          basePrice: values.basePrice || undefined,
          wholeUnitType:
            values.pricingModel === 'UNIT' && values.wholeUnitType ? values.wholeUnitType : undefined,
          unitIncludedGuests:
            values.pricingModel === 'UNIT' && values.unitIncludedGuests
              ? Number(values.unitIncludedGuests)
              : undefined,
          extraPersonPrice:
            values.pricingModel === 'UNIT' && values.extraPersonPrice ? values.extraPersonPrice : undefined,
        },
      },
      {
        onSuccess: () => toast.success('Pricing saved.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save pricing.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-semibold uppercase tracking-wider">Pricing</CardTitle>
        <p className="text-sm text-muted-foreground">
          How this tour is priced. Per-person tours use age bands (below); unit-priced tours charge for
          the whole unit plus a per-extra-guest surcharge.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">Base Price</Label>
              <Input {...register('basePrice')} placeholder="e.g. 49.99" aria-invalid={!!errors.basePrice} />
              <FieldDescription>
                {isUnit
                  ? 'Whole-unit price (covers the included guests).'
                  : 'Optional "from" fallback when there are no age bands.'}
              </FieldDescription>
              <FieldError>{errors.basePrice?.message}</FieldError>
            </Field>
            {isUnit && (
              <Field>
                <Label className="text-xs font-semibold uppercase">Unit Type</Label>
                <Controller
                  name="wholeUnitType"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.wholeUnitType}>
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
              </Field>
            )}
          </div>

          {isGroupUnit && (
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
                <FieldDescription>Travelers covered by the base price.</FieldDescription>
                <FieldError>{errors.unitIncludedGuests?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Extra Person Price</Label>
                <Input
                  {...register('extraPersonPrice')}
                  placeholder="e.g. 175.00"
                  aria-invalid={!!errors.extraPersonPrice}
                />
                <FieldDescription>Charged per traveler beyond the included count.</FieldDescription>
                <FieldError>{errors.extraPersonPrice?.message}</FieldError>
              </Field>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save Pricing'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface TripPricingTabProps {
  trip: TripListItem;
}

export function TripPricingTab({ trip }: TripPricingTabProps) {
  const tripId = trip.id;
  // Age bands are a PER_PERSON construct. UNIT (whole-unit / charter) tours are
  // priced by the unit formula (base + per-extra-guest) set in Details, so the
  // age-band manager is hidden for them (the backend also rejects age bands on
  // UNIT tours).
  const isUnit = trip.pricingModel === 'UNIT';
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
      bandType: 'ADULT',
      participation: 'PARTICIPANT',
      label: '',
      minAge: '',
      maxAge: '',
      price: '',
      priceOriginal: '',
      priceNet: '',
      isDefault: false,
      displayOrder: '0',
    },
  });

  const ageBandDefaults: AddAgeBandFormValues = {
    bandType: 'ADULT',
    participation: 'PARTICIPANT',
    label: '',
    minAge: '',
    maxAge: '',
    price: '',
    priceOriginal: '',
    priceNet: '',
    isDefault: false,
    displayOrder: '0',
  };

  function onAddAgeBand(values: AddAgeBandFormValues) {
    createAgeBand(
      {
        tripId,
        payload: {
          bandType: values.bandType,
          participation: values.participation,
          label: values.label,
          minAge: values.minAge !== '' ? Number(values.minAge) : undefined,
          maxAge: values.maxAge !== '' ? Number(values.maxAge) : undefined,
          price: values.price,
          priceOriginal: values.priceOriginal || undefined,
          priceNet: values.priceNet || undefined,
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
      {/* Pricing basics: model + currency + base/unit fields (single home for pricing). */}
      <PricingBasicsCard trip={trip} />

      {/* Age Bands - PER_PERSON only. UNIT tours use a single guests count. */}
      {isUnit ? (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-semibold uppercase tracking-wider">Age Bands</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              This is a unit-priced tour (whole {(trip.wholeUnitType ?? 'unit').toLowerCase()}). It uses a
              single guests count, not age bands. Set the base price, included guests, and
              extra-person price in the Details tab.
            </p>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">Age Bands</CardTitle>
          <p className="text-sm text-muted-foreground">
            Per-traveler price tiers. The tour&apos;s &ldquo;from&rdquo; price is the default band (usually Adult).
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
                <Label className="text-xs font-semibold uppercase">Age Type</Label>
                <Controller
                  name="bandType"
                  control={ageBandControl}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!ageBandErrors.bandType}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AGE_BAND_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{ageBandErrors.bandType?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Participation</Label>
                <Controller
                  name="participation"
                  control={ageBandControl}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!ageBandErrors.participation}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTICIPATION_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{ageBandErrors.participation?.message}</FieldError>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Label</Label>
                <Input
                  {...registerAgeBand('label')}
                  placeholder="e.g. Adult (13+)"
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">Original Price</Label>
                <Input
                  {...registerAgeBand('priceOriginal')}
                  placeholder="Optional (strikethrough)"
                  aria-invalid={!!ageBandErrors.priceOriginal}
                />
                <FieldDescription>Optional pre-discount price, shown struck through to signal a deal.</FieldDescription>
                <FieldError>{ageBandErrors.priceOriginal?.message}</FieldError>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Net Price</Label>
                <Input
                  {...registerAgeBand('priceNet')}
                  placeholder="Optional (operator net)"
                  aria-invalid={!!ageBandErrors.priceNet}
                />
                <FieldDescription>Optional operator net (what you keep). Internal only - not shown to travelers.</FieldDescription>
                <FieldError>{ageBandErrors.priceNet?.message}</FieldError>
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
      )}

      {/* Add-Ons */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg font-semibold uppercase tracking-wider">Add-Ons</CardTitle>
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
