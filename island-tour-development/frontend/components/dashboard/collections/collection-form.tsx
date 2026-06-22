'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangleIcon } from 'lucide-react';
import { ImageSelectorField } from '@/components/dashboard/media/image-selector-field';
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
import { useCreateCollection, useUpdateCollection } from '@/hooks/collections/use-collections';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import type { Collection } from '@/types/collection';
import { COLLECTION_TYPE_VALUES } from '@/types/enums';

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
  // DYNAMIC filter fields
  categoryId: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  durationMin: z.string().optional(),
  durationMax: z.string().optional(),
  ratingMin: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CollectionFormProps {
  collection?: Collection;
}

export function CollectionForm({ collection }: CollectionFormProps) {
  const router = useRouter();
  const isEditMode = !!collection;
  const { mutate: create, isPending: creating } = useCreateCollection();
  const { mutate: update, isPending: updating } = useUpdateCollection();
  const isPending = creating || updating;

  const { data: destinations } = useActiveDestinations();
  const { data: categories } = useActiveCategories();
  const { data: adminTrips } = useAdminTrips({ limit: 100 });

  const fq = (collection?.filterQuery ?? {}) as Record<string, unknown>;

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
      categoryId: typeof fq.categoryId === 'string' ? fq.categoryId : '',
      minPrice: fq.minPrice != null ? String(fq.minPrice) : '',
      maxPrice: fq.maxPrice != null ? String(fq.maxPrice) : '',
      durationMin: fq.durationMin != null ? String(fq.durationMin) : '',
      durationMax: fq.durationMax != null ? String(fq.durationMax) : '',
      ratingMin: fq.ratingMin != null ? String(fq.ratingMin) : '',
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

  useEffect(() => {
    if (!isEditMode && !slugTouched) setValue('slug', toSlug(nameValue), { shouldValidate: !!nameValue });
  }, [nameValue, isEditMode, slugTouched, setValue]);

  // Clear selected tours when the destination changes (create mode) - tours are destination-scoped.
  useEffect(() => {
    if (!isEditMode) setValue('tourIds', []);
  }, [destinationId, isEditMode, setValue]);

  // Tours scoped to the selected destination (client-side filter of admin trips)
  const tourOptions = useMemo(
    () =>
      (adminTrips?.data ?? [])
        .filter(t => t.destinationId === destinationId)
        .map(t => ({ value: t.id, label: t.name })),
    [adminTrips, destinationId],
  );

  // Cannibalization warning: collection slug must not equal a category slug
  const slugClashesCategory = useMemo(
    () => !!slugValue && (categories ?? []).some(c => c.slug === slugValue),
    [slugValue, categories],
  );

  const num = (v: string | undefined) => (v && !isNaN(Number(v)) ? Number(v) : undefined);

  function buildFilterQuery(values: FormValues): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    if (values.categoryId) q.categoryId = values.categoryId;
    if (num(values.minPrice) !== undefined) q.minPrice = num(values.minPrice);
    if (num(values.maxPrice) !== undefined) q.maxPrice = num(values.maxPrice);
    if (num(values.durationMin) !== undefined) q.durationMin = num(values.durationMin);
    if (num(values.durationMax) !== undefined) q.durationMax = num(values.durationMax);
    if (num(values.ratingMin) !== undefined) q.ratingMin = num(values.ratingMin);
    return q;
  }

  function onSubmit(values: FormValues) {
    const isManual = values.collectionType === 'MANUAL';
    if (isManual && (values.tourIds ?? []).length === 0) {
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
            ...(isManual ? { tourIds: values.tourIds ?? [] } : { filterQuery: buildFilterQuery(values) }),
          },
        },
        {
          onSuccess: () => {
            toast.success('Collection updated.');
            router.push('/dashboard/collections');
          },
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
          ...(isManual ? { tourIds: values.tourIds ?? [] } : { filterQuery: buildFilterQuery(values) }),
        },
        {
          onSuccess: () => {
            toast.success('Collection created.');
            router.push('/dashboard/collections');
          },
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
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
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
          </Field>

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
              </div>
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
