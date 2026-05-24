'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { XIcon } from 'lucide-react';
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
import { useLanguages, useAddLanguage, useRemoveLanguage } from '@/hooks/trips/use-trips';

const COMMON_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Dutch' },
  { code: 'es', label: 'Spanish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
];

const addLanguageSchema = z.object({
  language: z.string().min(2, 'Language code required').max(10),
});

type AddLanguageFormValues = z.infer<typeof addLanguageSchema>;

interface TripLanguagesTabProps {
  tripId: string;
}

export function TripLanguagesTab({ tripId }: TripLanguagesTabProps) {
  const { data: languages, isLoading } = useLanguages(tripId);
  const { mutate: addLanguage, isPending: isAdding } = useAddLanguage();
  const { mutate: removeLanguage } = useRemoveLanguage();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [useCustom, setUseCustom] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<AddLanguageFormValues>({
    resolver: zodResolver(addLanguageSchema),
    defaultValues: { language: '' },
  });

  function onSubmit(values: AddLanguageFormValues) {
    const code = values.language.toLowerCase().trim();
    const existingCodes = (languages ?? []).map((l) => l.language.toLowerCase());
    if (existingCodes.includes(code)) {
      toast.error('This language is already added.');
      return;
    }

    addLanguage(
      { tripId, payload: { language: code } },
      {
        onSuccess: () => {
          toast.success(`${code.toUpperCase()} added.`);
          reset({ language: '' });
          setUseCustom(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to add language.'),
      }
    );
  }

  function handleDelete(languageId: string, code: string) {
    setDeletingId(languageId);
    removeLanguage(
      { tripId, languageId },
      {
        onSuccess: () => {
          toast.success(`${code.toUpperCase()} removed.`);
          setDeletingId(null);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to remove language.');
          setDeletingId(null);
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base">Languages</CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Current languages */}
        {isLoading ? (
          <Skeleton className="h-10 w-full rounded-none" />
        ) : (languages?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2">
            {languages!.map((lang) => (
              <Badge key={lang.id} variant="secondary" className="gap-1.5 pr-1">
                <span className="uppercase">{lang.language}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(lang.id, lang.language)}
                  disabled={deletingId === lang.id}
                  className="rounded-sm hover:bg-foreground/10 p-0.5 transition-colors"
                  aria-label={`Remove ${lang.language}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No languages specified yet.</p>
        )}

        {/* Add language form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Add Language</p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant={!useCustom ? 'default' : 'outline'}
              onClick={() => setUseCustom(false)}
            >
              Common
            </Button>
            <Button
              type="button"
              size="xs"
              variant={useCustom ? 'default' : 'outline'}
              onClick={() => setUseCustom(true)}
            >
              Custom
            </Button>
          </div>

          <Field>
            {useCustom ? (
              <>
                <Label className="text-xs font-semibold uppercase">ISO 639-1 Code</Label>
                <Input
                  {...register('language')}
                  placeholder="e.g. ja, ko, ru"
                  aria-invalid={!!errors.language}
                />
              </>
            ) : (
              <>
                <Label className="text-xs font-semibold uppercase">Select Language</Label>
                <Controller
                  name="language"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        field.onChange(val);
                        setValue('language', val);
                      }}
                    >
                      <SelectTrigger aria-invalid={!!errors.language}>
                        <SelectValue placeholder="Select a language..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_LANGUAGES.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.label} ({lang.code.toUpperCase()})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </>
            )}
            <FieldError>{errors.language?.message}</FieldError>
          </Field>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add Language'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
