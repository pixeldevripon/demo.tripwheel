'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useCreateAttribute, useUpdateAttribute } from '@/hooks/attributes/use-attributes';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import type { AttributeDefinition } from '@/types/attribute';
import {
  ATTRIBUTE_DATA_TYPE_VALUES,
  FILTER_DISPLAY_TYPE_VALUES,
  type AttributeDataType,
} from '@/types/enums';

const schema = z.object({
  key: z
    .string()
    .min(2)
    .regex(/^[a-z][a-z0-9_]*$/, 'snake_case: lowercase letters, numbers, underscores'),
  displayName: z.string().min(2, 'Display name is required'),
  dataType: z.enum(ATTRIBUTE_DATA_TYPE_VALUES as [string, ...string[]]),
  allowedValues: z.string().optional(), // comma-separated in the form
  appliesToCategories: z.array(z.string()).optional(),
  isFilterable: z.boolean().optional(),
  isSortable: z.boolean().optional(),
  filterDisplayType: z.enum(FILTER_DISPLAY_TYPE_VALUES as [string, ...string[]]).optional().or(z.literal('')),
  sortOrder: z.string().optional().refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'Must be 0 or greater'),
});

type FormValues = z.infer<typeof schema>;

interface AttributeFormProps {
  attribute?: AttributeDefinition;
}

export function AttributeForm({ attribute }: AttributeFormProps) {
  const router = useRouter();
  const isEditMode = !!attribute;
  const { mutate: create, isPending: creating } = useCreateAttribute();
  const { mutate: update, isPending: updating } = useUpdateAttribute();
  const isPending = creating || updating;

  const { data: categories } = useActiveCategories();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      key: attribute?.key ?? '',
      displayName: attribute?.displayName ?? '',
      dataType: attribute?.dataType ?? 'ENUM',
      allowedValues: attribute?.allowedValues?.join(', ') ?? '',
      appliesToCategories: attribute?.appliesToCategories ?? [],
      isFilterable: attribute?.isFilterable ?? true,
      isSortable: attribute?.isSortable ?? false,
      filterDisplayType: attribute?.filterDisplayType ?? '',
      sortOrder: attribute?.sortOrder?.toString() ?? '0',
    },
  });

  const dataType = watch('dataType') as AttributeDataType;
  const filterDisplayType = watch('filterDisplayType');
  const appliesTo = watch('appliesToCategories') ?? [];
  const isFilterable = watch('isFilterable');
  const isSortable = watch('isSortable');

  const needsAllowedValues = dataType === 'ENUM' || dataType === 'ENUM_MULTI';

  function parseAllowed(v: string | undefined): string[] {
    return (v ?? '').split(',').map(s => s.trim()).filter(Boolean);
  }

  function onSubmit(values: FormValues) {
    const allowedValues = parseAllowed(values.allowedValues);
    if (needsAllowedValues && allowedValues.length === 0) {
      toast.error('Allowed values are required for ENUM / ENUM_MULTI.');
      return;
    }
    const common = {
      displayName: values.displayName,
      dataType: values.dataType as AttributeDataType,
      allowedValues,
      appliesToCategories: values.appliesToCategories ?? [],
      isFilterable: values.isFilterable ?? false,
      isSortable: values.isSortable ?? false,
      filterDisplayType: (values.filterDisplayType || null) as AttributeDefinition['filterDisplayType'],
      sortOrder: values.sortOrder ? Number(values.sortOrder) : 0,
    };

    if (isEditMode && attribute) {
      update(
        { key: attribute.key, payload: common },
        {
          onSuccess: () => {
            toast.success('Attribute updated.');
            router.push('/dashboard/attributes');
          },
          onError: err => toast.error(err instanceof Error ? err.message : 'Update failed.'),
        },
      );
    } else {
      create(
        { key: values.key, ...common },
        {
          onSuccess: () => {
            toast.success('Attribute created.');
            router.push('/dashboard/attributes');
          },
          onError: err => toast.error(err instanceof Error ? err.message : 'Create failed.'),
        },
      );
    }
  }

  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle>Attribute Definition</CardTitle>
      </CardHeader>
      <CardContent className="pt-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Key <span className="text-destructive">*</span>
              </Label>
              {isEditMode ? (
                <Input value={attribute?.key ?? ''} readOnly className="opacity-60 cursor-not-allowed" />
              ) : (
                <Input {...register('key')} placeholder="e.g. boat_type" aria-invalid={!!errors.key} />
              )}
              <FieldDescription>
                {isEditMode ? 'Key cannot be changed.' : 'snake_case identifier.'}
              </FieldDescription>
              {!isEditMode && <FieldError>{errors.key?.message}</FieldError>}
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">
                Display Name <span className="text-destructive">*</span>
              </Label>
              <Input {...register('displayName')} placeholder="e.g. Boat Type" aria-invalid={!!errors.displayName} />
              <FieldError>{errors.displayName?.message}</FieldError>
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <Label className="text-xs font-semibold uppercase">Data Type</Label>
              <Select value={dataType} onValueChange={v => setValue('dataType', v, { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTE_DATA_TYPE_VALUES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <Label className="text-xs font-semibold uppercase">Sort Order</Label>
              <Input type="number" min={0} {...register('sortOrder')} placeholder="0" aria-invalid={!!errors.sortOrder} />
              <FieldError>{errors.sortOrder?.message}</FieldError>
            </Field>
          </div>

          {needsAllowedValues && (
            <Field>
              <Label className="text-xs font-semibold uppercase">
                Allowed Values <span className="text-destructive">*</span>
              </Label>
              <Input {...register('allowedValues')} placeholder="catamaran, yacht, speedboat" />
              <FieldDescription>Comma-separated list of allowed values.</FieldDescription>
            </Field>
          )}

          <Field>
            <Label className="text-xs font-semibold uppercase">Applies To Categories</Label>
            <MultiSelect
              options={(categories ?? []).map(c => ({ value: c.slug, label: `${c.name} (${c.slug})` }))}
              value={appliesTo}
              onChange={v => setValue('appliesToCategories', v)}
              placeholder="Global (all categories)"
              searchPlaceholder="Search categories…"
            />
            <FieldDescription>Leave empty to apply globally to every category.</FieldDescription>
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <div className="flex items-center gap-2">
                <Checkbox id="isFilterable" checked={isFilterable} onCheckedChange={c => setValue('isFilterable', !!c)} />
                <Label htmlFor="isFilterable" className="text-xs font-semibold uppercase cursor-pointer">Filterable</Label>
              </div>
              <FieldDescription>Show in the public filter sidebar.</FieldDescription>
            </Field>
            <Field>
              <div className="flex items-center gap-2">
                <Checkbox id="isSortable" checked={isSortable} onCheckedChange={c => setValue('isSortable', !!c)} />
                <Label htmlFor="isSortable" className="text-xs font-semibold uppercase cursor-pointer">Sortable</Label>
              </div>
              <FieldDescription>Allow sorting listings by this attribute.</FieldDescription>
            </Field>
          </div>

          <Field>
            <Label className="text-xs font-semibold uppercase">Filter Display Type</Label>
            <Select
              value={filterDisplayType || '__none__'}
              onValueChange={v => setValue('filterDisplayType', v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {FILTER_DISPLAY_TYPE_VALUES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>UI widget used to render this filter.</FieldDescription>
          </Field>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Attribute'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
