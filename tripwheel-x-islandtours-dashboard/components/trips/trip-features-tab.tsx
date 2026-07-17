'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Trash2Icon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { TranslationRow } from './translation-row';
import {
  useFeatures,
  useAddFeature,
  useRemoveFeature,
  useUpsertFeatureTranslation,
} from '@/hooks/trips/use-trips';
import type { FeatureType, TourFeature } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

// The informational + terms feature types (master E.3 / DS1). INCLUSION / EXCLUSION /
// HIGHLIGHT are authored in their own tabs, so they are intentionally excluded here.
const FEATURE_TYPES: { value: FeatureType; label: string }[] = [
  { value: 'PREBOOKING_INFORMATION', label: 'Pre-booking information' },
  { value: 'PREARRIVAL_INFORMATION', label: 'Pre-arrival information' },
  { value: 'REDEMPTION_INSTRUCTION', label: 'Redemption instructions' },
  { value: 'ACCESSIBILITY_INFORMATION', label: 'Accessibility information' },
  { value: 'ADDITIONAL_INFORMATION', label: 'Additional information' },
  { value: 'BOOKING_TERM', label: 'Booking terms' },
  { value: 'CANCELLATION_TERM', label: 'Cancellation terms' },
];

const FEATURE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FEATURE_TYPES.map((t) => [t.value, t.label]),
);

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
  text: z.string().min(5, 'At least 5 characters').max(2000, 'Max 2000 characters'),
  displayOrder: z.string().optional(),
});

type AddFeatureFormValues = z.infer<typeof addFeatureSchema>;

// ── Feature list item ───────────────────────────────────────────────────────────

interface FeatureItemProps {
  feature: TourFeature;
  tripId: string;
}

function FeatureItem({ feature, tripId }: FeatureItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: removeFeature, isPending: isRemoving } = useRemoveFeature();
  const { mutate: upsertTranslation, isPending: isUpserting } =
    useUpsertFeatureTranslation();

  const enTranslation = feature.translations.find((t) => t.locale === 'en');

  function handleDelete() {
    removeFeature(
      { tripId, featureId: feature.id },
      {
        onSuccess: () => toast.success('Feature removed.'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      },
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">
            #{feature.displayOrder}
          </span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {FEATURE_TYPE_LABELS[feature.type] ?? feature.type}
          </Badge>
          <p className="text-sm truncate">
            {enTranslation?.text ?? '(no EN text)'}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 px-2 h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={expanded ? 'Hide translations' : 'Set translations'}
          >
            {expanded ? (
              <ChevronUpIcon className="size-3.5" />
            ) : (
              <ChevronDownIcon className="size-3.5" />
            )}
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
          <p className="text-xs font-semibold text-muted-foreground">
            Translations
          </p>
          {ALL_LOCALES.map((locale) => {
            const existing = feature.translations.find(
              (t) => t.locale === locale,
            );
            const label =
              LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale;
            return (
              <TranslationRow
                key={locale}
                locale={locale}
                localeLabel={label}
                defaultValue={existing?.text ?? ''}
                onSave={(text) =>
                  upsertTranslation(
                    { tripId, featureId: feature.id, locale, payload: { text } },
                    {
                      onSuccess: () =>
                        toast.success(`${label} translation saved.`),
                      onError: (err) =>
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : 'Failed to save translation.',
                        ),
                    },
                  )
                }
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
    control,
    formState: { errors },
  } = useForm<AddFeatureFormValues>({
    resolver: zodResolver(addFeatureSchema),
    defaultValues: {
      type: 'ADDITIONAL_INFORMATION',
      text: '',
      displayOrder: String(count),
    },
  });

  function onAdd(values: AddFeatureFormValues) {
    addFeature(
      {
        tripId,
        payload: {
          type: values.type,
          text: values.text,
          displayOrder: values.displayOrder
            ? Number(values.displayOrder)
            : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Feature added.');
          reset({
            type: 'ADDITIONAL_INFORMATION',
            text: '',
            displayOrder: String((features?.length ?? 0) + 1),
          });
        },
        onError: (err) =>
          toast.error(
            err instanceof Error ? err.message : 'Failed to add feature.',
          ),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Info &amp; Terms
          </CardTitle>
          <Badge variant="secondary">{count}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Pre-booking / pre-arrival info, redemption + accessibility notes, and
          booking/cancellation terms. Shown across the tour&apos;s Important Info and
          Cancellation sections.
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
            {(features ?? []).map((f) => (
              <FeatureItem key={f.id} feature={f} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No info or terms yet. Add pre-arrival notes, redemption steps, or
                booking terms.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold text-muted-foreground">
            Add Info / Term
          </p>
          <Field>
            <Label className="text-xs font-semibold">Type</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-invalid={!!errors.type}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{errors.type?.message}</FieldError>
          </Field>
          <Field>
            <Label className="text-xs font-semibold">Text (English)</Label>
            <Textarea
              {...register('text')}
              rows={3}
              placeholder="e.g. Please arrive 15 minutes before departure with a valid ID."
              aria-invalid={!!errors.text}
            />
            <FieldError>{errors.text?.message}</FieldError>
          </Field>
          <Field>
            <Label className="text-xs font-semibold">Display Order</Label>
            <Input {...register('displayOrder')} type="number" min={0} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
