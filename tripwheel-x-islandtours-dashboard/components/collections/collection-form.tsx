'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangleIcon, ListOrderedIcon } from 'lucide-react';
import { ImageSelectorField } from '@/components/media/image-selector-field';
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
import { TourBadgeChip } from '@/components/common/tour-badge';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { tourPerfSummary } from '@/lib/tours/signals';
import { useCreateCollection, useUpdateCollection } from '@/hooks/collections/use-collections';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useActiveHubs } from '@/hooks/hubs/use-hubs';
import { useAttributes } from '@/hooks/attributes/use-attributes';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import type { Collection, CollectionFilterQuery } from '@/types/collection';
import {
  COLLECTION_DISPLAY_STYLE_VALUES,
  COLLECTION_TYPE_VALUES,
  type CollectionDisplayStyle,
} from '@/types/enums';

function toSlug(value: string) {
  return value
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc', 'rating', 'newest'];

const schema = z.object({
  destinationId: z.string().min(1, 'Destination is required'),
  name: z.string().min(2, 'Name is required'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, hyphens only').optional().or(z.literal('')),
  collectionType: z.enum(COLLECTION_TYPE_VALUES as [string, ...string[]]),
  tourIds: z.array(z.string()).optional(),
  heroImage: z.string().optional(),
  sortOrder: z.string().optional(),
  displayStyle: z.enum(COLLECTION_DISPLAY_STYLE_VALUES as [string, ...string[]]),
  // DYNAMIC filter fields
  categoryId: z.string().optional(),
  hubId: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  durationMin: z.string().optional(),
  durationMax: z.string().optional(),
  ratingMin: z.string().optional(),
  cancellationMaxHours: z.string().optional(),
  pickupAvailable: z.string().optional(), // '' | 'true' | 'false'
  isLocalsFavourite: z.string().optional(), // '' | 'true'
  pricingModel: z.string().optional(), // '' | 'PER_PERSON' | 'UNIT'
});

type FormValues = z.infer<typeof schema>;

interface CollectionFormProps {
  collection?: Collection;
  /** Edit mode: switch the in-page tabs to the Tours tab (from the "Manage Tours" button). */
  onManageTours?: () => void;
}

export function CollectionForm({ collection, onManageTours }: CollectionFormProps) {
  const router = useRouter();
  const isEditMode = !!collection;
  const { mutate: create, isPending: creating } = useCreateCollection();
  const { mutate: update, isPending: updating } = useUpdateCollection();
  const isPending = creating || updating;

  const { data: destinations } = useActiveDestinations();
  const { data: categories } = useActiveCategories();
  const { data: adminTrips } = useAdminTrips({ limit: 100 });

  const fq: CollectionFilterQuery = collection?.filterQuery ?? {};

  // Dictionary attribute filters (dynamic keys) are held outside RHF. Seeded once
  // from the saved filter; each key holds the selected value(s).
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string[]>>(
    () => {
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(fq.attributes ?? {})) {
        out[k] = Array.isArray(v) ? v : [v];
      }
      return out;
    },
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      destinationId: collection?.destinationId ?? '',
      name: collection?.name ?? '',
      slug: collection?.slug ?? '',
      collectionType: collection?.collectionType ?? 'MANUAL',
      tourIds: collection?.tourIds ?? [],
      heroImage: collection?.heroImage ?? '',
      sortOrder: collection?.sortOrder ?? 'recommended',
      // Collections always render as a numbered ranked list; the field is kept
      // for API compatibility but is no longer user-selectable.
      displayStyle: collection?.displayStyle ?? 'NUMBERED',
      categoryId: typeof fq.categoryId === 'string' ? fq.categoryId : '',
      hubId: typeof fq.hubId === 'string' ? fq.hubId : '',
      minPrice: fq.minPrice != null ? String(fq.minPrice) : '',
      maxPrice: fq.maxPrice != null ? String(fq.maxPrice) : '',
      durationMin: fq.durationMin != null ? String(fq.durationMin) : '',
      durationMax: fq.durationMax != null ? String(fq.durationMax) : '',
      ratingMin: fq.ratingMin != null ? String(fq.ratingMin) : '',
      cancellationMaxHours:
        fq.cancellationMaxHours != null ? String(fq.cancellationMaxHours) : '',
      pickupAvailable:
        typeof fq.pickupAvailable === 'boolean' ? String(fq.pickupAvailable) : '',
      isLocalsFavourite: fq.isLocalsFavourite === true ? 'true' : '',
      pricingModel: typeof fq.pricingModel === 'string' ? fq.pricingModel : '',
    },
  });

  const [slugTouched, setSlugTouched] = useState(false);
  const nameValue = watch('name');
  const slugValue = watch('slug');
  const destinationId = watch('destinationId');
  const collectionType = watch('collectionType');
  const tourIds = watch('tourIds') ?? [];
  const heroImageValue = watch('heroImage');
  const sortOrder = watch('sortOrder');
  const categoryId = watch('categoryId');
  const hubId = watch('hubId');
  const pickupAvailable = watch('pickupAvailable');
  const isLocalsFavourite = watch('isLocalsFavourite');
  const pricingModel = watch('pricingModel');

  useEffect(() => {
    if (!isEditMode && !slugTouched) setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
  }, [nameValue, isEditMode, slugTouched, setValue]);

  // Clear selected tours when the destination changes (create mode) - tours are destination-scoped.
  useEffect(() => {
    if (!isEditMode) setValue('tourIds', []);
  }, [destinationId, isEditMode, setValue]);

  // Tours scoped to the selected destination (client-side filter of admin trips).
  // Each option carries the tour's badge + performance summary so the admin can
  // judge why to pick it, matching the edit-mode Tours tab.
  const tourOptions = useMemo(
    () =>
      (adminTrips?.data ?? [])
        .filter(t => t.destinationId === destinationId)
        .map(t => ({
          value: t.id,
          label: t.name,
          description: tourPerfSummary(t),
          badge: <TourBadgeChip type={deriveTourBadge(t)} />,
        })),
    [adminTrips, destinationId],
  );

  // Hubs scoped to the selected destination (for the DYNAMIC filter builder).
  const { data: hubs } = useActiveHubs(destinationId || undefined);

  // Filterable dictionary attributes, scoped to the chosen category (+ globals).
  const { data: allFilterableAttrs } = useAttributes({ filterableOnly: true });
  const selectedCategorySlug = useMemo(
    () => (categories ?? []).find(c => c.id === categoryId)?.slug,
    [categories, categoryId],
  );
  const scopedAttributes = useMemo(
    () =>
      (allFilterableAttrs ?? []).filter(a => {
        // Global attributes always apply; category-specific ones only when their
        // category is the one being filtered.
        if (!a.allowedValues?.length) return false; // only value-list attributes get a picker
        if (!a.appliesToCategories || a.appliesToCategories.length === 0) return true;
        return selectedCategorySlug
          ? a.appliesToCategories.includes(selectedCategorySlug)
          : false;
      }),
    [allFilterableAttrs, selectedCategorySlug],
  );

  // Cannibalization warning: collection slug must not equal a category slug
  const slugClashesCategory = useMemo(
    () => !!slugValue && (categories ?? []).some(c => c.slug === slugValue),
    [slugValue, categories],
  );

  const num = (v: string | undefined) => (v && !isNaN(Number(v)) ? Number(v) : undefined);

  function buildFilterQuery(values: FormValues): CollectionFilterQuery {
    const q: CollectionFilterQuery = {};
    if (values.categoryId) q.categoryId = values.categoryId;
    if (values.hubId) q.hubId = values.hubId;
    if (num(values.minPrice) !== undefined) q.minPrice = num(values.minPrice);
    if (num(values.maxPrice) !== undefined) q.maxPrice = num(values.maxPrice);
    if (num(values.durationMin) !== undefined) q.durationMin = num(values.durationMin);
    if (num(values.durationMax) !== undefined) q.durationMax = num(values.durationMax);
    if (num(values.ratingMin) !== undefined) q.ratingMin = num(values.ratingMin);
    if (num(values.cancellationMaxHours) !== undefined)
      q.cancellationMaxHours = num(values.cancellationMaxHours);
    if (values.pickupAvailable === 'true') q.pickupAvailable = true;
    else if (values.pickupAvailable === 'false') q.pickupAvailable = false;
    if (values.isLocalsFavourite === 'true') q.isLocalsFavourite = true;
    if (values.pricingModel)
      q.pricingModel = values.pricingModel as CollectionFilterQuery['pricingModel'];
    // Dictionary attribute filters (only non-empty selections).
    const attrs: Record<string, string[]> = {};
    for (const [key, vals] of Object.entries(attributeFilters)) {
      if (vals.length > 0) attrs[key] = vals;
    }
    if (Object.keys(attrs).length > 0) q.attributes = attrs;
    return q;
  }

  function onSubmit(values: FormValues) {
    const isManual = values.collectionType === 'MANUAL';
    // Membership is only set through this form on CREATE (the service seeds CollectionTour
    // rows). In edit mode, MANUAL membership/ordering lives in the Tours tab (PATCH does not
    // sync the authoritative CollectionTour rows).
    if (isManual && !isEditMode && (values.tourIds ?? []).length === 0) {
      toast.error('A manual collection needs at least one tour.');
      return;
    }

    if (isEditMode && collection) {
      update(
        {
          id: collection.id,
          payload: {
            name: values.name,
            heroImage: values.heroImage || null,
            sortOrder: values.sortOrder,
            displayStyle: values.displayStyle as CollectionDisplayStyle,
            ...(isManual ? {} : { filterQuery: buildFilterQuery(values) }),
          },
        },
        {
          // Stay on the editor so the admin can flip to the Tours tab and see the
          // resolved tours right after saving a filter.
          onSuccess: () => toast.success('Collection updated.'),
          onError: err => toast.error(err instanceof Error ? err.message : 'Update failed.'),
        },
      );
    } else {
      create(
        {
          destinationId: values.destinationId,
          name: values.name,
          slug: values.slug || undefined,
          collectionType: values.collectionType as Collection['collectionType'],
          heroImage: values.heroImage || null,
          sortOrder: values.sortOrder,
          displayStyle: values.displayStyle as CollectionDisplayStyle,
          ...(isManual ? { tourIds: values.tourIds ?? [] } : { filterQuery: buildFilterQuery(values) }),
        },
        {
          // Land on the new collection's editor so the admin can continue (tours,
          // translations, publish) instead of bouncing back to the list.
          onSuccess: created =>
            router.push(`/collections/${created.id}/edit`),
          onError: err => toast.error(err instanceof Error ? err.message : 'Create failed.'),
        },
      );
    }
  }

  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Collection Details</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Field>
            <Label className="text-xs font-semibold uppercase">
              Destination <span className="text-destructive">*</span>
            </Label>
            {isEditMode ? (
              <Input
                value={(destinations ?? []).find(d => d.id === destinationId)?.name ?? destinationId}
                readOnly
                className="opacity-60 cursor-not-allowed"
              />
            ) : (
              <Select value={destinationId} onValueChange={v => setValue('destinationId', v, { shouldValidate: true })}>
                <SelectTrigger aria-invalid={!!errors.destinationId}>
                  <SelectValue placeholder="Select a destination" />
                </SelectTrigger>
                <SelectContent>
                  {(destinations ?? []).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError>{errors.destinationId?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input {...register('name')} placeholder="e.g. Best Family Trips" aria-invalid={!!errors.name} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">
              Slug {!isEditMode && <span className="text-destructive">*</span>}
            </Label>
            {isEditMode ? (
              <Input value={collection?.slug ?? ''} readOnly className="opacity-60 cursor-not-allowed" />
            ) : (
              <Input
                {...register('slug')}
                placeholder="e.g. best-family-trips"
                aria-invalid={!!errors.slug || slugClashesCategory}
                onChange={e => {
                  setSlugTouched(true);
                  setValue('slug', e.target.value, { shouldValidate: true });
                }}
              />
            )}
            {!isEditMode && slugClashesCategory && (
              <div className="flex items-center gap-1.5 text-xs text-warning-fg">
                <AlertTriangleIcon className="size-3.5 shrink-0" />
                This slug matches a category slug - the server will reject it (409). Pick a different slug.
              </div>
            )}
            <FieldDescription>
              {isEditMode ? 'Slug cannot be changed after creation.' : 'Must not match a category slug.'}
            </FieldDescription>
            {!isEditMode && <FieldError>{errors.slug?.message}</FieldError>}
          </Field>

          <Field>
            <Label className="text-xs font-semibold uppercase">Hero Image</Label>
            <ImageSelectorField
              value={heroImageValue || null}
              onChange={url => setValue('heroImage', url ?? '', { shouldValidate: true })}
            />
          </Field>

          {/* Sort Order only applies to DYNAMIC collections (it drives how the
              filter resolves + orders tours). MANUAL order is the hand-picked list. */}
          {collectionType === 'DYNAMIC' && (
            <Field>
              <Label className="text-xs font-semibold uppercase">Sort Order</Label>
              <Select value={sortOrder || 'recommended'} onValueChange={v => setValue('sortOrder', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>How the filtered tours are ordered on the collection page.</FieldDescription>
            </Field>
          )}

          {/* Display Style selector removed: collection tours always render as a
              numbered ranked list. `displayStyle` stays NUMBERED (schema default). */}

          <Field>
            <Label className="text-xs font-semibold uppercase">Type</Label>
            {isEditMode ? (
              <Input value={collection?.collectionType ?? ''} readOnly className="opacity-60 cursor-not-allowed" />
            ) : (
              <Select value={collectionType} onValueChange={v => setValue('collectionType', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">Manual - hand-pick &amp; order tours</SelectItem>
                  <SelectItem value="DYNAMIC">Dynamic - filter query</SelectItem>
                </SelectContent>
              </Select>
            )}
            <FieldDescription>
              {isEditMode ? 'Type cannot be changed after creation.' : 'Manual = ordered tour list; Dynamic = saved filter.'}
            </FieldDescription>
          </Field>

          {collectionType === 'MANUAL' ? (
            isEditMode ? (
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
                <ListOrderedIcon className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Tour selection, ordering, and per-tour rationale are managed in the Tours tab.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onManageTours?.()}
                  >
                    Manage Tours
                  </Button>
                </div>
              </div>
            ) : (
              <Field>
                <Label className="text-xs font-semibold uppercase">Tours (ordered)</Label>
                <MultiSelect
                  options={tourOptions}
                  value={tourIds}
                  onChange={v => setValue('tourIds', v)}
                  placeholder={destinationId ? 'Select tours…' : 'Select a destination first'}
                  searchPlaceholder="Search tours…"
                  disabled={!destinationId}
                />
                <FieldDescription>Selection order is the display order.</FieldDescription>
              </Field>
            )
          ) : (
            <div className="space-y-6 rounded-md border border-border p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Filter query</p>
              <Field>
                <Label className="text-xs font-semibold uppercase">Category</Label>
                <Select value={categoryId || '__any__'} onValueChange={v => setValue('categoryId', v === '__any__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any category</SelectItem>
                    {(categories ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <Label className="text-xs font-semibold uppercase">Hub</Label>
                <Select
                  value={hubId || '__any__'}
                  onValueChange={v => setValue('hubId', v === '__any__' ? '' : v)}
                  disabled={!destinationId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={destinationId ? 'Any hub' : 'Select a destination first'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Any hub</SelectItem>
                    {(hubs ?? []).map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Only tours tagged with this activity hub.</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label className="text-xs font-semibold uppercase">Min Price</Label>
                  <Input type="number" min={0} {...register('minPrice')} placeholder="e.g. 0" />
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Max Price</Label>
                  <Input type="number" min={0} {...register('maxPrice')} placeholder="e.g. 200" />
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Min Duration (min)</Label>
                  <Input type="number" min={0} {...register('durationMin')} />
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Max Duration (min)</Label>
                  <Input type="number" min={0} {...register('durationMax')} />
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Min Rating</Label>
                  <Input type="number" min={0} max={5} step="0.1" {...register('ratingMin')} placeholder="e.g. 4" />
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Free-cancellation window (max hrs)</Label>
                  <Input type="number" min={0} {...register('cancellationMaxHours')} placeholder="e.g. 48" />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <Label className="text-xs font-semibold uppercase">Pickup</Label>
                  <Select
                    value={pickupAvailable || '__any__'}
                    onValueChange={v => setValue('pickupAvailable', v === '__any__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any</SelectItem>
                      <SelectItem value="true">Offers pickup</SelectItem>
                      <SelectItem value="false">No pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Pricing Model</Label>
                  <Select
                    value={pricingModel || '__any__'}
                    onValueChange={v => setValue('pricingModel', v === '__any__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any</SelectItem>
                      <SelectItem value="PER_PERSON">Per person</SelectItem>
                      <SelectItem value="UNIT">Per unit / group</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <Label className="text-xs font-semibold uppercase">Locals&apos; Favourite</Label>
                  <Select
                    value={isLocalsFavourite || '__any__'}
                    onValueChange={v => setValue('isLocalsFavourite', v === '__any__' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any</SelectItem>
                      <SelectItem value="true">Only locals&apos; favourites</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {/* Dictionary attribute filters (per-category, value-list attributes). */}
              {scopedAttributes.length > 0 && (
                <div className="space-y-4 border-t border-border pt-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Attributes
                  </p>
                  {!categoryId && (
                    <FieldDescription>
                      Showing global attributes. Pick a category above to also filter by that
                      category&apos;s attributes.
                    </FieldDescription>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {scopedAttributes.map(attr => (
                      <Field key={attr.key}>
                        <Label className="text-xs font-semibold uppercase">
                          {attr.displayName}
                        </Label>
                        <MultiSelect
                          options={(attr.allowedValues ?? []).map(v => ({ value: v, label: v }))}
                          value={attributeFilters[attr.key] ?? []}
                          onChange={vals =>
                            setAttributeFilters(prev => ({ ...prev, [attr.key]: vals }))
                          }
                          placeholder="Any"
                          searchPlaceholder="Search values…"
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending || (!isEditMode && slugClashesCategory)}>
              {isPending ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Collection'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
