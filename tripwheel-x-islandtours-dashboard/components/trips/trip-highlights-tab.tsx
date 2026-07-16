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
import { TranslationRow } from './translation-row';
import {
  useHighlights,
  useAddHighlight,
  useRemoveHighlight,
  useUpsertHighlightTranslation,
} from '@/hooks/trips/use-trips';
import type { TourHighlight } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

const addHighlightSchema = z.object({
  text: z.string().min(5, 'At least 5 characters').max(100, 'Max 100 characters'),
  imageUrl: z.string().optional().or(z.literal('')),
  displayOrder: z.string().optional(),
});

type AddHighlightFormValues = z.infer<typeof addHighlightSchema>;

// ── Highlight list item ───────────────────────────────────────────────────────

interface HighlightItemProps {
  highlight: TourHighlight;
  tripId: string;
}

function HighlightItem({ highlight, tripId }: HighlightItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: removeHighlight, isPending: isRemoving } = useRemoveHighlight();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertHighlightTranslation();

  const enTranslation = highlight.translations.find((t) => t.locale === 'en');

  function handleDelete() {
    removeHighlight(
      { tripId, highlightId: highlight.id },
      {
        onSuccess: () => toast.success('Highlight removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {/* Left: order + thumbnail + text */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">#{highlight.displayOrder}</span>
          <p className="text-sm truncate">{enTranslation?.text ?? '(no EN translation)'}</p>
        </div>

        {/* Right: expand translations + delete */}
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

      {/* Translations panel */}
      {expanded && (
        <div className="pt-3 border-t space-y-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Translations</p>
          {ALL_LOCALES.map((locale) => {
            const existing = highlight.translations.find((t) => t.locale === locale);
            return (
              <TranslationRow
                key={locale}
                locale={locale}
                localeLabel={LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale}
                defaultValue={existing?.text ?? ''}
                onSave={(text) => upsertTranslation(
                  { tripId, highlightId: highlight.id, locale, payload: { text } },
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

interface TripHighlightsTabProps {
  tripId: string;
}

export function TripHighlightsTab({ tripId }: TripHighlightsTabProps) {
  const { data: highlights, isLoading } = useHighlights(tripId);
  const { mutate: addHighlight, isPending: isAdding } = useAddHighlight();

  const count = highlights?.length ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddHighlightFormValues>({
    resolver: zodResolver(addHighlightSchema),
    defaultValues: { text: '', imageUrl: '', displayOrder: String(count) },
  });

  function onAdd(values: AddHighlightFormValues) {
    addHighlight(
      {
        tripId,
        payload: {
          text: values.text,
          imageUrl: values.imageUrl || undefined,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Highlight added.');
          reset({ text: '', imageUrl: '', displayOrder: String((highlights?.length ?? 0) + 1) });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add highlight.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Highlights</CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">{count}/6</Badge>
            {count < 3 && <Badge variant="destructive">Need at least 3</Badge>}
          </div>
        </div>
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
            {(highlights ?? []).map((h) => (
              <HighlightItem key={h.id} highlight={h} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No highlights yet. Add at least 3 to publish.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Highlight</p>
          <Field>
            <Label className="text-xs font-semibold uppercase">Text (English)</Label>
            <Input
              {...register('text')}
              placeholder="e.g. Stunning ocean views"
              aria-invalid={!!errors.text}
            />
            <FieldError>{errors.text?.message}</FieldError>
          </Field>
 {/*          <Field>
            <Label className="text-xs font-semibold uppercase">Image URL</Label>
            <Input {...register('imageUrl')} placeholder="Optional image URL" />
          </Field> */}
          <Field>
            <Label className="text-xs font-semibold uppercase">Display Order</Label>
            <Input {...register('displayOrder')} type="number" min={0} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding || count >= 6}>
              {isAdding ? 'Adding...' : 'Add Highlight'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
