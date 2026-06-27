'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TranslationRow } from './translation-row';
import {
  useFeatures,
  useAddFeature,
  useUpdateFeature,
  useRemoveFeature,
  useUpsertFeatureTranslation,
} from '@/hooks/trips/use-trips';
import type { TourFeature, FeatureType } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

// INCLUSION / EXCLUSION have their own dedicated tabs, so they're
// intentionally excluded from the Features picker.
const FEATURE_TYPE_OPTIONS: { value: FeatureType; label: string }[] = [
  { value: 'PREBOOKING_INFORMATION', label: 'Pre-booking info' },
  { value: 'PREARRIVAL_INFORMATION', label: 'Pre-arrival info' },
  { value: 'REDEMPTION_INSTRUCTION', label: 'Redemption instructions' },
  { value: 'ACCESSIBILITY_INFORMATION', label: 'Accessibility info' },
  { value: 'ADDITIONAL_INFORMATION', label: 'Additional info' },
  { value: 'BOOKING_TERM', label: 'Booking term' },
  { value: 'CANCELLATION_TERM', label: 'Cancellation term' },
];

function featureTypeLabel(type: FeatureType): string {
  return FEATURE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

const addFeatureSchema = z.object({
  type: z.enum([
    'PREBOOKING_INFORMATION',
    'PREARRIVAL_INFORMATION',
    'REDEMPTION_INSTRUCTION',
    'ACCESSIBILITY_INFORMATION',
    'ADDITIONAL_INFORMATION',
    'BOOKING_TERM',
    'CANCELLATION_TERM',
  ]),
  text: z.string().min(2, 'At least 2 characters').max(2000),
  displayOrder: z.string().optional(),
});

type AddFeatureFormValues = z.infer<typeof addFeatureSchema>;

// ── Feature list item ─────────────────────────────────────────────────────────

interface FeatureItemProps {
  feature: TourFeature;
  tripId: string;
}

function FeatureItem({ feature, tripId }: FeatureItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: removeFeature, isPending: isRemoving } = useRemoveFeature();
  const { mutate: updateFeature, isPending: isUpdatingType } = useUpdateFeature();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertFeatureTranslation();

  const enTranslation = feature.translations.find((t) => t.locale === 'en');

  function handleTypeChange(value: string) {
    updateFeature(
      { tripId, featureId: feature.id, payload: { type: value as FeatureType } },
      {
        onSuccess: () => toast.success('Type updated.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to update type.'),
      }
    );
  }

  function handleDelete() {
    removeFeature(
      { tripId, featureId: feature.id },
      {
        onSuccess: () => toast.success('Feature removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Select value={feature.type} onValueChange={handleTypeChange} disabled={isUpdatingType}>
            <SelectTrigger className="h-7 w-44 shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FEATURE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm truncate">{enTranslation?.text ?? '(no EN text)'}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={expanded ? 'Hide translations' : 'Set translations'}
          >
            {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
            <span className="hidden sm:inline">Translations</span>
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
        <div className="pt-3 border-t space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Translations</p>
          {ALL_LOCALES.map((locale) => {
            const existing = feature.translations.find((t) => t.locale === locale);
            return (
              <TranslationRow
                key={locale}
                locale={locale}
                localeLabel={LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale}
                defaultValue={existing?.text ?? ''}
                onSave={(text) => upsertTranslation(
                  { tripId, featureId: feature.id, locale, payload: { text } },
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

interface TripFeaturesTabProps {
  tripId: string;
}

export function TripFeaturesTab({ tripId }: TripFeaturesTabProps) {
  const { data: features, isLoading } = useFeatures(tripId);
  const { mutate: addFeature, isPending: isAdding } = useAddFeature();

  const count = features?.length ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AddFeatureFormValues>({
    resolver: zodResolver(addFeatureSchema),
    defaultValues: { type: 'ADDITIONAL_INFORMATION', text: '', displayOrder: String(count) },
  });

  const typeValue = watch('type');

  function onAdd(values: AddFeatureFormValues) {
    addFeature(
      {
        tripId,
        payload: {
          type: values.type,
          text: values.text,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Feature added.');
          reset({ type: values.type, text: '', displayOrder: String((features?.length ?? 0) + 1) });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add feature.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Features &amp; Terms</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-booking / pre-arrival info, redemption &amp; accessibility notes, and booking / cancellation terms.
        </p>
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
            {(features ?? []).map((feat) => (
              <FeatureItem key={feat.id} feature={feat} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No features yet.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Feature</p>
          <Field>
            <Label className="text-xs font-semibold uppercase">Type</Label>
            <Select value={typeValue} onValueChange={(val) => setValue('type', val as AddFeatureFormValues['type'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {FEATURE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Label className="text-xs font-semibold uppercase">Text (English)</Label>
            <Textarea
              {...register('text')}
              rows={3}
              placeholder={`e.g. ${featureTypeLabel(typeValue)} details for travelers.`}
              aria-invalid={!!errors.text}
            />
            <FieldError>{errors.text?.message}</FieldError>
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Feature'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
