'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
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
import { ImageSelectorField } from '@/components/dashboard/media/image-selector-field';
import { ImageThumb } from './image-thumb';
import { TranslationRow } from './translation-row';
import {
  useExclusions,
  useAddExclusion,
  useUpdateExclusion,
  useRemoveExclusion,
  useUpsertExclusionTranslation,
} from '@/hooks/trips/use-trips';
import type { ExclusionType, TourExclusion } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

const ICON_OPTIONS = [
  { value: 'x', label: 'Cross' },
  { value: 'ban', label: 'Not allowed' },
  { value: 'drink', label: 'Drink' },
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'gear', label: 'Gear' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'money', label: 'Fees / Gratuities' },
];

const EXCLUSION_TYPE_OPTIONS = [
  { value: 'UNAVAILABLE', label: 'Not provided' },
  { value: 'NOT_PERMITTED', label: 'Not permitted' },
  { value: 'PAID_ADVANCE', label: 'Available - pay in advance' },
  { value: 'PAID_ONSITE', label: 'Available - pay on site' },
] as const;

const addExclusionSchema = z.object({
  label: z.string().min(2, 'At least 2 characters').max(100),
  icon: z.string().optional(),
  type: z.enum(['UNAVAILABLE', 'NOT_PERMITTED', 'PAID_ADVANCE', 'PAID_ONSITE']).optional().or(z.literal('')),
  priceText: z.string().max(120).optional(),
  imageUrl: z.string().optional(),
  displayOrder: z.string().optional(),
});

type AddExclusionFormValues = z.infer<typeof addExclusionSchema>;

// ── Exclusion list item ─────────────────────────────────────────────────────────

interface ExclusionItemProps {
  exclusion: TourExclusion;
  tripId: string;
}

function ExclusionItem({ exclusion, tripId }: ExclusionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [typeVal, setTypeVal] = useState<string>(exclusion.type ?? '');
  const [priceVal, setPriceVal] = useState<string>(exclusion.priceText ?? '');
  const { mutate: removeExclusion, isPending: isRemoving } = useRemoveExclusion();
  const { mutate: updateExclusion, isPending: isUpdatingImage } = useUpdateExclusion();
  const { mutate: saveHandling, isPending: isSavingHandling } = useUpdateExclusion();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertExclusionTranslation();

  const enTranslation = exclusion.translations.find((t) => t.locale === 'en');
  const isPaidType = typeVal === 'PAID_ADVANCE' || typeVal === 'PAID_ONSITE';
  const typeLabel = EXCLUSION_TYPE_OPTIONS.find((o) => o.value === exclusion.type)?.label;

  function handleImageSelect(url: string) {
    updateExclusion(
      { tripId, exclusionId: exclusion.id, payload: { imageUrl: url } },
      {
        onSuccess: () => toast.success('Image saved.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save image.'),
      }
    );
  }

  function handleImageRemove() {
    updateExclusion(
      { tripId, exclusionId: exclusion.id, payload: { imageUrl: null } },
      {
        onSuccess: () => toast.success('Image removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove image.'),
      }
    );
  }

  // Persist the structured handling of this exclusion (LD18): how the excluded
  // item is dealt with (`type`) and, for paid add-ons, the operator's price note
  // (`priceText`). The public "What's Included" column derives its "(available -
  // $X)" / "(pay on the day)" suffix from exactly these two fields, so keeping
  // them editable here is what lets operators shape that copy. `priceText` is
  // cleared when the type is not a paid one.
  function handleSaveHandling() {
    saveHandling(
      {
        tripId,
        exclusionId: exclusion.id,
        payload: {
          type: (typeVal || undefined) as ExclusionType | undefined,
          priceText: isPaidType ? priceVal || null : null,
        },
      },
      {
        onSuccess: () => toast.success('Handling saved.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save.'),
      }
    );
  }

  function handleDelete() {
    removeExclusion(
      { tripId, exclusionId: exclusion.id },
      {
        onSuccess: () => toast.success('Exclusion removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="text-xs shrink-0">{exclusion.icon}</Badge>

          <div onClick={(e) => e.stopPropagation()}>
            <ImageThumb
              imageUrl={exclusion.imageUrl}
              onSelect={handleImageSelect}
              onRemove={handleImageRemove}
              disabled={isUpdatingImage}
            />
          </div>

          <p className="text-sm truncate">{enTranslation?.label ?? '(no EN translation)'}</p>
          {typeLabel && (
            <Badge variant="outline" className="text-xs shrink-0 hidden md:inline-flex">
              {typeLabel}
              {exclusion.priceText ? ` · ${exclusion.priceText}` : ''}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={expanded ? 'Hide details' : 'Edit handling & translations'}
          >
            {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
            <span className="hidden sm:inline">Edit</span>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={isRemoving}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="pt-3 border-t space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Handling</p>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label className="text-xs font-semibold uppercase">
                  Type <span className="text-muted-foreground font-normal normal-case">(optional)</span>
                </Label>
                <Select
                  value={typeVal || ''}
                  onValueChange={(val) => setTypeVal(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How it's handled..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXCLUSION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {isPaidType && (
                <Field>
                  <Label className="text-xs font-semibold uppercase">Price Text</Label>
                  <Input
                    value={priceVal}
                    onChange={(e) => setPriceVal(e.target.value)}
                    placeholder="e.g. $15 per person"
                  />
                </Field>
              )}
            </div>
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="outline" onClick={handleSaveHandling} disabled={isSavingHandling}>
                {isSavingHandling ? 'Saving...' : 'Save handling'}
              </Button>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Translations</p>
          {ALL_LOCALES.map((locale) => {
            const existing = exclusion.translations.find((t) => t.locale === locale);
            return (
              <TranslationRow
                key={locale}
                locale={locale}
                localeLabel={LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale}
                defaultValue={existing?.label ?? ''}
                onSave={(label) => upsertTranslation(
                  { tripId, exclusionId: exclusion.id, locale, payload: { label } },
                  {
                    onSuccess: () => toast.success(`${LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale} translation saved.`),
                    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save translation.'),
                  }
                )}
                isSaving={isUpserting}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

interface TripExclusionsTabProps {
  tripId: string;
}

export function TripExclusionsTab({ tripId }: TripExclusionsTabProps) {
  const { data: exclusions, isLoading } = useExclusions(tripId);
  const { mutate: addExclusion, isPending: isAdding } = useAddExclusion();

  const count = exclusions?.length ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddExclusionFormValues>({
    resolver: zodResolver(addExclusionSchema),
    defaultValues: { label: '', icon: 'x', type: '', priceText: '', imageUrl: '', displayOrder: String(count) },
  });

  const imageUrlValue = watch('imageUrl');
  const typeValue = watch('type');
  const isPaidType = typeValue === 'PAID_ADVANCE' || typeValue === 'PAID_ONSITE';

  function onAdd(values: AddExclusionFormValues) {
    addExclusion(
      {
        tripId,
        payload: {
          label: values.label,
          icon: values.icon || 'x',
          type: values.type || undefined,
          priceText:
            (values.type === 'PAID_ADVANCE' || values.type === 'PAID_ONSITE') && values.priceText
              ? values.priceText
              : undefined,
          imageUrl: values.imageUrl || undefined,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Exclusion added.');
          reset({ label: '', icon: 'x', type: '', priceText: '', imageUrl: '', displayOrder: String((exclusions?.length ?? 0) + 1) });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add exclusion.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Exclusions</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">What&apos;s NOT included in this tour.</p>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-none" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(exclusions ?? []).map((exc) => (
              <ExclusionItem key={exc.id} exclusion={exc} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No exclusions yet.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Exclusion</p>
          <Field>
            <Label className="text-xs font-semibold uppercase">Label (English)</Label>
            <Input
              {...register('label')}
              placeholder="e.g. Gratuities not included"
              aria-invalid={!!errors.label}
            />
            <FieldError>{errors.label?.message}</FieldError>
          </Field>
          <Field>
            <Label className="text-xs font-semibold uppercase">Icon</Label>
            <Select defaultValue="x" onValueChange={(val) => setValue('icon', val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select icon..." />
              </SelectTrigger>
              <SelectContent>
                {ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Type <span className="text-muted-foreground font-normal normal-case">(optional)</span>
              </Label>
              <Select value={typeValue || ''} onValueChange={(val) => setValue('type', val as AddExclusionFormValues['type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="How it's handled..." />
                </SelectTrigger>
                <SelectContent>
                  {EXCLUSION_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {isPaidType && (
              <Field>
                <Label className="text-xs font-semibold uppercase">Price Text</Label>
                <Input {...register('priceText')} placeholder="e.g. $15 per person" />
              </Field>
            )}
          </div>
          <Field>
            <Label className="text-xs font-semibold uppercase">
              Image <span className="text-muted-foreground font-normal normal-case">(optional)</span>
            </Label>
            <ImageSelectorField
              value={imageUrlValue || null}
              onChange={(url) => setValue('imageUrl', url ?? '')}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Exclusion'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
