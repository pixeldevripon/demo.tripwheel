'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { LayersIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useHubContentSections, useReplaceHubContentSections } from '@/hooks/hubs/use-hubs';
import { ALL_LOCALES, LOCALE_LABELS, type Locale } from '@/lib/constants/locales';
import {
  HUB_SECTION_TYPE_LABELS,
  HUB_SECTION_TYPE_VALUES,
  type HubSectionType,
} from '@/types/enums';
import type { HubContentSection } from '@/types/hub';

interface DraftSection extends HubContentSection {
  /** Stable client-side key for list rendering (rows have no server id). */
  key: string;
}

let rowCounter = 0;
function nextKey() {
  rowCounter += 1;
  return `cs-${rowCounter}`;
}

function emptyRow(locale: Locale): DraftSection {
  return { key: nextKey(), locale, sectionType: 'DISCOVER', heading: '', body: '', displayOrder: 0 };
}

interface HubContentSectionsManagerProps {
  hubId: string;
}

export function HubContentSectionsManager({ hubId }: HubContentSectionsManagerProps) {
  // Load every locale - this editor replaces the full set on save.
  const { data, isLoading } = useHubContentSections(hubId);
  const { mutate: replace, isPending } = useReplaceHubContentSections();

  const [rows, setRows] = useState<DraftSection[]>([]);
  const [localeFilter, setLocaleFilter] = useState<string>('all');

  // Seed local edit state from the loaded set. Setting state during render (guarded
  // by a reference check) is React's sanctioned alternative to a setState-in-effect.
  const [seededFrom, setSeededFrom] = useState<typeof data>(undefined);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setRows(data.map((s) => ({ ...s, key: nextKey() })));
  }

  function updateRow(key: string, patch: Partial<DraftSection>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    const locale = (localeFilter !== 'all' ? localeFilter : 'en') as Locale;
    setRows((prev) => [...prev, emptyRow(locale)]);
  }

  function handleSave() {
    const invalid = rows.find((r) => !r.heading.trim() || !r.body.trim());
    if (invalid) {
      toast.error('Every section needs a heading and body.');
      return;
    }
    replace(
      {
        id: hubId,
        payload: {
          sections: rows.map((r) => ({
            locale: r.locale,
            sectionType: r.sectionType,
            heading: r.heading.trim(),
            body: r.body.trim(),
            displayOrder: r.displayOrder,
          })),
        },
      },
      {
        onSuccess: (res) => toast.success(`Saved ${res.count} content section(s).`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save content sections.'),
      }
    );
  }

  const visibleRows =
    localeFilter === 'all' ? rows : rows.filter((r) => r.locale === localeFilter);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
        Editorial blocks for the hub page. <strong>Discover</strong> and{' '}
        <strong>Local Tip</strong> sections in English are required before the hub can be published;{' '}
        <strong>Fast Fact</strong> sections feed the hero bar. Saving replaces the full set across
        all locales.
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs font-semibold uppercase">Locale</Label>
          <Select value={localeFilter} onValueChange={setLocaleFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locales</SelectItem>
              {ALL_LOCALES.map((locale) => (
                <SelectItem key={locale} value={locale}>
                  {LOCALE_LABELS[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" type="button" onClick={addRow}>
          <PlusIcon />
          Add Section
        </Button>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <LayersIcon className="size-10 opacity-40" />
          <p className="text-sm">No content sections yet.</p>
          <p className="text-xs">Add your first section using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleRows.map((row) => (
            <Card key={row.key} size="sm">
              <CardContent className="pt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Locale</Label>
                    <Select
                      value={row.locale}
                      onValueChange={(v) => updateRow(row.key, { locale: v as Locale })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_LOCALES.map((locale) => (
                          <SelectItem key={locale} value={locale}>
                            {LOCALE_LABELS[locale]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Type</Label>
                    <Select
                      value={row.sectionType}
                      onValueChange={(v) =>
                        updateRow(row.key, { sectionType: v as HubSectionType })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HUB_SECTION_TYPE_VALUES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {HUB_SECTION_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Display Order</Label>
                    <Input
                      type="number"
                      value={row.displayOrder}
                      onChange={(e) =>
                        updateRow(row.key, { displayOrder: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                </div>

                <Field>
                  <Label className="text-xs font-semibold uppercase">Heading</Label>
                  <Input
                    value={row.heading}
                    onChange={(e) => updateRow(row.key, { heading: e.target.value })}
                    placeholder="e.g. The White Beach"
                  />
                </Field>

                <Field>
                  <Label className="text-xs font-semibold uppercase">Body</Label>
                  <Textarea
                    value={row.body}
                    onChange={(e) => updateRow(row.key, { body: e.target.value })}
                    rows={3}
                    placeholder="Section content"
                  />
                </Field>

                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{HUB_SECTION_TYPE_LABELS[row.sectionType]}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2Icon />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Content Sections'}
        </Button>
      </div>
    </div>
  );
}
