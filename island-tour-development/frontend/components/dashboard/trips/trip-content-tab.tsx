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
import type { Resolver } from 'react-hook-form';
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
  displayOrder: z.coerce.number().int().min(0).optional(),
});

const inclusionTranslationSchema = z.object({
  label: z.string().min(1, 'Translation is required'),
});

type AddInclusionFormValues = { label: string; icon: string; displayOrder: string };
type InclusionTranslationFormValues = z.infer<typeof inclusionTranslationSchema>;

interface InclusionItemProps {
  inclusion: TourInclusion;
  tripId: string;
}

function InclusionItem({ inclusion, tripId }: InclusionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const { mutate: removeInclusion, isPending: isRemoving } = useRemoveInclusion();
  const { mutate: upsertTranslation, isPending: isUpserting } = useUpsertInclusionTranslation();

  const enTranslation = inclusion.translations.find((t) => t.locale === 'en');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InclusionTranslationFormValues>({ resolver: zodResolver(inclusionTranslationSchema) });

  function handleDelete() {
    removeInclusion(
      { tripId, inclusionId: inclusion.id },
      {
        onSuccess: () => toast.success('Inclusion removed.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to remove.'),
      }
    );
  }

  function onTranslationSubmit(locale: string) {
    return (values: InclusionTranslationFormValues) => {
      upsertTranslation(
        { tripId, inclusionId: inclusion.id, locale, payload: { label: values.label } },
        {
          onSuccess: () => toast.success(`${LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS] ?? locale} translation saved.`),
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to save translation.'),
        }
      );
    };
  }

  return (
    <div className="ring-1 ring-foreground/10 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className="text-xs shrink-0">{inclusion.icon}</Badge>
          <p className="text-sm truncate">{enTranslation?.label ?? '(no EN translation)'}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            title="Translations"
          >
            {expanded ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
          </Button>
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
        <div className="pt-2 border-t space-y-3">
          {ALL_LOCALES.map((locale) => {
            const existing = inclusion.translations.find((t) => t.locale === locale);
            return (
              <form key={locale} onSubmit={handleSubmit(onTranslationSubmit(locale))} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground uppercase w-8 shrink-0">{locale}</span>
                <Input
                  {...register('label')}
                  defaultValue={existing?.label ?? ''}
                  placeholder={`${LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS]} label`}
                  className="flex-1 h-8 text-sm"
                />
                <Button type="submit" size="xs" disabled={isUpserting}>
                  Save
                </Button>
              </form>
            );
          })}
          {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
        </div>
      )}
    </div>
  );
}

interface TripContentTabProps {
  tripId: string;
}

export function TripContentTab({ tripId }: TripContentTabProps) {
  const { data: inclusions, isLoading: isLoadingInclusions } = useInclusions(tripId);
  const { mutate: addInclusion, isPending: isAddingInclusion } = useAddInclusion();

  const inclusionCount = inclusions?.length ?? 0;

  const {
    register: registerInclusion,
    handleSubmit: handleInclusionSubmit,
    reset: resetInclusion,
    setValue: setInclusionValue,
    formState: { errors: inclusionErrors },
  } = useForm<AddInclusionFormValues>({
    resolver: zodResolver(addInclusionSchema) as unknown as Resolver<AddInclusionFormValues>,
    defaultValues: { label: '', icon: 'check', displayOrder: String(inclusionCount) },
  });

  function onAddInclusion(values: AddInclusionFormValues) {
    addInclusion(
      {
        tripId,
        payload: {
          label: values.label,
          icon: values.icon || 'check',
          displayOrder: values.displayOrder ? Number(values.displayOrder) : undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Inclusion added.');
          resetInclusion({ label: '', icon: 'check', displayOrder: String((inclusions?.length ?? 0) + 1) });
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add inclusion.'),
      }
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Inclusions */}
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Inclusions</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {isLoadingInclusions ? (
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
            </div>
          )}

          <form onSubmit={handleInclusionSubmit(onAddInclusion)} className="space-y-3 pt-4 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Add Inclusion</p>
            <Field>
              <Label className="text-xs font-semibold uppercase">Label (English)</Label>
              <Input
                {...registerInclusion('label')}
                placeholder="e.g. Welcome drink included"
                aria-invalid={!!inclusionErrors.label}
              />
              <FieldError>{inclusionErrors.label?.message}</FieldError>
            </Field>
            <Field>
              <Label className="text-xs font-semibold uppercase">Icon</Label>
              <Select
                defaultValue="check"
                onValueChange={(val) => setInclusionValue('icon', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select icon..." />
                </SelectTrigger>
                <SelectContent>
                  {ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isAddingInclusion}>
                {isAddingInclusion ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
