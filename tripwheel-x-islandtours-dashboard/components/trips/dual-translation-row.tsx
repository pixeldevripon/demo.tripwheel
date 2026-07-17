'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface DualTranslationRowProps {
  locale: string;
  localeLabel: string;
  primaryLabel: string;
  primaryDefault: string;
  secondaryLabel: string;
  secondaryDefault: string;
  /** Secondary is optional; primary is required to save. */
  onSave: (primary: string, secondary: string) => void;
  isSaving: boolean;
}

interface RowValues {
  primary: string;
  secondary: string;
}

/**
 * Inline per-locale editor for child entities with two translatable fields
 * (location: title + short description, pickup: title + directions).
 */
export function DualTranslationRow({
  locale,
  localeLabel,
  primaryLabel,
  primaryDefault,
  secondaryLabel,
  secondaryDefault,
  onSave,
  isSaving,
}: DualTranslationRowProps) {
  const { register, handleSubmit, reset } = useForm<RowValues>({
    defaultValues: { primary: primaryDefault, secondary: secondaryDefault },
  });

  useEffect(() => {
    reset({ primary: primaryDefault, secondary: secondaryDefault });
  }, [primaryDefault, secondaryDefault, reset]);

  return (
    <form
      onSubmit={handleSubmit((v) => onSave(v.primary.trim(), v.secondary.trim()))}
      className="flex items-start gap-2"
    >
      <span className="text-xs text-muted-foreground uppercase w-8 shrink-0 pt-2">{locale}</span>
      <div className="flex-1 space-y-1.5">
        <Input {...register('primary')} placeholder={`${localeLabel} ${primaryLabel}`} className="h-8 text-sm" />
        <Input {...register('secondary')} placeholder={`${localeLabel} ${secondaryLabel} (optional)`} className="h-8 text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={isSaving} className="mt-0.5">
        Save
      </Button>
    </form>
  );
}
