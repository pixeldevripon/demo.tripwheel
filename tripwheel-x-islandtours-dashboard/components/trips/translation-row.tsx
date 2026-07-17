'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const rowSchema = z.object({ value: z.string().min(1, 'Required') });
type RowValues = z.infer<typeof rowSchema>;

export interface TranslationRowProps {
  locale: string;
  localeLabel: string;
  defaultValue: string;
  onSave: (value: string) => void;
  isSaving: boolean;
}

export function TranslationRow({ locale, localeLabel, defaultValue, onSave, isSaving }: TranslationRowProps) {
  const { register, handleSubmit, reset } = useForm<RowValues>({
    resolver: zodResolver(rowSchema),
    defaultValues: { value: defaultValue },
  });

  useEffect(() => {
    reset({ value: defaultValue });
  }, [defaultValue, reset]);

  return (
    <form onSubmit={handleSubmit((v) => onSave(v.value))} className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase w-8 shrink-0">{locale}</span>
      <Input
        {...register('value')}
        placeholder={`${localeLabel} translation`}
        className="flex-1 h-8 text-sm"
      />
      <Button type="submit" size="sm" disabled={isSaving}>Save</Button>
    </form>
  );
}
