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
import { TranslationRow } from './translation-row';
import {
  useInclusions,
  useAddInclusion,
  useRemoveInclusion,
  useUpsertInclusionTranslation,
} from '@/hooks/trips/use-trips';
import type { TourInclusion } from '@/types/trip';
import { ALL_LOCALES, LOCALE_LABELS } from '@/lib/constants/locales';

const ICON_OPTIONS = [
  { value: 'check', label: 'Check' },
  { value: 'drink', label: 'Drink' },
  { value: 'food', label: 'Food' },
  { value: 'transport', label: 'Transport' },
  { value: 'gear', label: 'Gear' },
  { value: 'guide', label: 'Guide' },
  { value: 'photo', label: 'Photo' },
  { value: 'ticket', label: 'Ticket' },
];

const addInclusionSchema = z.object({
  label: z.string().min(2, 'At least 2 characters').max(100),
  icon: z.string().optional(),
  imageUrl: z.string().optional().or(z.literal('')),
  displayOrder: z.string().optional(),
});

type AddInclusionFormValues = z.infer<typeof addInclusionSchema>;

// ── Inclusion list item ───────────────────────────────────────────────────────

interface InclusionItemProps {
  inclusion: TourInclusion;
  tripId: string;
}

function InclusionItem({ inclusion, tripId }: InclusionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: removeInclusion, isPending: isRemoving } = useRemoveInclusion();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertInclusionTranslation();

  const enTranslation = inclusion.translations.find((t) => t.locale === 'en');

  function handleDelete() {
    removeInclusion(
      { tripId, inclusionId: inclusion.id },
      {
        onSuccess: () => toast.success('Inclusion removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        {/* Left: icon badge + thumbnail + label */}
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="text-xs shrink-0">{inclusion.icon}</Badge>
          <p className="text-sm truncate">{enTranslation?.label ?? '(no EN translation)'}</p>
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
            const existing = inclusion.translations.find((t) => t.locale === locale);
            return (
              <TranslationRow
                key={locale}
                locale={locale}
                localeLabel={LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale}
                defaultValue={existing?.label ?? ''}
                onSave={(label) => upsertTranslation(
                  { tripId, inclusionId: inclusion.id, locale, payload: { label } },
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

interface TripInclusionsTabProps {
  tripId: string;
}

export function TripInclusionsTab({ tripId }: TripInclusionsTabProps) {
  const { data: inclusions, isLoading } = useInclusions(tripId);
  const { mutate: addInclusion, isPending: isAdding } = useAddInclusion();

  const count = inclusions?.length ?? 0;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<AddInclusionFormValues>({
    resolver: zodResolver(addInclusionSchema),
    defaultValues: { label: '', icon: 'check', imageUrl: '', displayOrder: String(count) },
  });

  function onAdd(values: AddInclusionFormValues) {
    addInclusion(
      {
        tripId,
        payload: {
          label: values.label,
          icon: values.icon || 'check',
          imageUrl: values.imageUrl || undefined,
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Inclusion added.');
          reset({ label: '', icon: 'check', imageUrl: '', displayOrder: String((inclusions?.length ?? 0) + 1) });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add inclusion.'),
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">Inclusions</CardTitle>
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
            {(inclusions ?? []).map((inc) => (
              <InclusionItem key={inc.id} inclusion={inc} tripId={tripId} />
            ))}
            {count === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No inclusions yet.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onAdd)} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Inclusion</p>
          <Field>
            <Label className="text-xs font-semibold uppercase">Label (English)</Label>
            <Input
              {...register('label')}
              placeholder="e.g. Welcome drink included"
              aria-invalid={!!errors.label}
            />
            <FieldError>{errors.label?.message}</FieldError>
          </Field>
          <Field>
            <Label className="text-xs font-semibold uppercase">Icon</Label>
            <Select defaultValue="check" onValueChange={(val) => setValue('icon', val)}>
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
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Inclusion'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
