'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { useActiveCategories } from '@/hooks/categories/use-categories';
import { useAttributes, useTripAttributes, useSetTripAttributes } from '@/hooks/attributes/use-attributes';
import type { TripListItem } from '@/types/trip';
import type { AttributeDefinition } from '@/types/attribute';

function parseMulti(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [value];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

export function TripAttributesTab({ trip }: { trip: TripListItem }) {
  const { data: categories } = useActiveCategories();

  // Slugs for ALL of the tour's categories (not just primary) — drives which attributes apply.
  const tourCategorySlugs = useMemo(() => {
    const byId = new Map((categories ?? []).map(c => [c.id, c.slug]));
    return new Set(trip.categoryIds.map(id => byId.get(id)).filter(Boolean) as string[]);
  }, [categories, trip.categoryIds]);

  // Fetch the full dictionary, then keep global attributes + any scoped to one of the tour's categories.
  const { data: defs, isLoading: defsLoading } = useAttributes({});
  const { data: current, isLoading: valuesLoading } = useTripAttributes(trip.id);
  const { mutate: save, isPending } = useSetTripAttributes(trip.id);

  // Local form state: key -> value (string; ENUM_MULTI stored as comma-joined)
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!current) return;
    const next: Record<string, string> = {};
    for (const a of current) {
      next[a.key] = a.dataType === 'ENUM_MULTI' ? parseMulti(a.value).join(',') : a.value;
    }
    setValues(next);
  }, [current]);

  const activeDefs = (defs ?? []).filter(d => {
    if (!d.isActive) return false;
    const applies = d.appliesToCategories ?? [];
    // Global (empty) applies everywhere; otherwise must intersect the tour's categories.
    return applies.length === 0 || applies.some(slug => tourCategorySlugs.has(slug));
  });

  function setVal(key: string, v: string) {
    setValues(prev => ({ ...prev, [key]: v }));
  }

  function onSave() {
    const attributes = activeDefs
      .map(d => ({ key: d.key, value: (values[d.key] ?? '').trim() }))
      .filter(a => a.value !== '');
    save(
      { attributes },
      {
        onSuccess: () => toast.success('Attributes saved.'),
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save attributes.'),
      },
    );
  }

  if (defsLoading || valuesLoading) {
    return <Skeleton className="h-72 w-full rounded-none" />;
  }

  return (
    <Card>
      <CardHeader className="border-b pb-8">
        <CardTitle className="font-heading text-lg font-semibold uppercase tracking-wider">
          Attributes
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Global attributes + those for this tour&apos;s categories
          {tourCategorySlugs.size > 0 ? ` (${[...tourCategorySlugs].join(', ')})` : ''}. These power public filters.
        </p>
      </CardHeader>
      <CardContent className="pt-8">
        {activeDefs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attributes apply to this trip&apos;s categories.
          </p>
        ) : (
          <div className="space-y-6">
            {activeDefs.map(def => (
              <AttributeInput
                key={def.key}
                def={def}
                value={values[def.key] ?? ''}
                onChange={v => setVal(def.key, v)}
              />
            ))}
            <div className="flex justify-end pt-2">
              <Button type="button" onClick={onSave} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save Attributes'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttributeInput({
  def,
  value,
  onChange,
}: {
  def: AttributeDefinition;
  value: string;
  onChange: (v: string) => void;
}) {
  const allowed = def.allowedValues ?? [];
  return (
    <Field>
      <Label className="text-xs font-semibold uppercase">{def.displayName}</Label>

      {def.dataType === 'BOOLEAN' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`attr-${def.key}`}
            checked={value === 'true'}
            onCheckedChange={c => onChange(c ? 'true' : 'false')}
          />
          <Label htmlFor={`attr-${def.key}`} className="text-sm cursor-pointer">
            Yes
          </Label>
        </div>
      )}

      {def.dataType === 'ENUM' && (
        <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {allowed.map(v => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {def.dataType === 'ENUM_MULTI' && (
        <MultiSelect
          options={allowed.map(v => ({ value: v, label: v }))}
          value={value ? value.split(',').filter(Boolean) : []}
          onChange={vals => onChange(vals.join(','))}
          placeholder="Select values…"
        />
      )}

      {(def.dataType === 'INTEGER' || def.dataType === 'DECIMAL') && (
        <Input
          type="number"
          step={def.dataType === 'DECIMAL' ? 'any' : '1'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter a number"
        />
      )}

      {def.dataType === 'TEXT' && (
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Enter text" />
      )}

      {allowed.length > 0 && def.dataType !== 'ENUM' && def.dataType !== 'ENUM_MULTI' && (
        <FieldDescription>Allowed: {allowed.join(', ')}</FieldDescription>
      )}
    </Field>
  );
}
