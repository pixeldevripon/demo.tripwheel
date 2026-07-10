'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { TourBadgeChip } from '@/components/frontend/tour-badge';
import { deriveTourBadge, tourPerfSummary } from '@/lib/tours/listing';
import { useHub, useHubOurPicksForEdit, useSetHubOurPicks } from '@/hooks/hubs/use-hubs';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/constants/locales';
import { HUB_PICK_TYPE_LABELS, HUB_PICK_TYPE_VALUES, type HubPickType } from '@/types/enums';
import { RationaleTranslationTabs } from '@/components/dashboard/rationale-translation-tabs';
import { HubTourSelect } from './hub-tour-select';

// Master caps Our Picks at 3 (Best overall / Most popular / Best for families).
const MAX_PICKS = 3;

interface DraftPick {
  key: string;
  tourId: string;
  pickType: HubPickType;
  /** Rationale per locale (English is the base, required for publish). */
  rationales: Record<string, string>;
  displayOrder: number;
}

let rowCounter = 0;
function nextKey() {
  rowCounter += 1;
  return `pick-${rowCounter}`;
}

interface HubOurPicksManagerProps {
  hubId: string;
}

export function HubOurPicksManager({ hubId }: HubOurPicksManagerProps) {
  const { data: hub } = useHub(hubId, 'en');
  const { data, isLoading } = useHubOurPicksForEdit(hubId);
  const { mutate: save, isPending } = useSetHubOurPicks();
  // Shared with HubTourSelect (same query key → one fetch) so a selected pick can
  // show its aggregated performance strip below the picker.
  const { data: adminTrips } = useAdminTrips({ limit: 200 }, !!hub?.destinationId);

  const [rows, setRows] = useState<DraftPick[]>([]);

  // Seed local edit state from the read-back (base blurb + every locale),
  // reference-guarded (render-time setState per repo convention).
  const [seededFrom, setSeededFrom] = useState<typeof data>(undefined);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setRows(
      data.map((p) => {
        const rationales: Record<string, string> = { [DEFAULT_LOCALE]: p.description };
        for (const t of p.translations) rationales[t.locale] = t.description;
        return {
          key: nextKey(),
          tourId: p.tourId,
          pickType: p.pickType,
          rationales,
          displayOrder: p.displayOrder,
        };
      })
    );
  }

  function updateRow(key: string, patch: Partial<DraftPick>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function updateRationale(key: string, locale: Locale, value: string) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, rationales: { ...r.rationales, [locale]: value } } : r
      )
    );
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    if (rows.length >= MAX_PICKS) return;
    setRows((prev) => [
      ...prev,
      {
        key: nextKey(),
        tourId: '',
        pickType: 'BEST_OVERALL',
        rationales: {},
        displayOrder: prev.length,
      },
    ]);
  }

  function handleSave() {
    if (rows.some((r) => !r.tourId)) {
      toast.error('Every pick needs a tour selected.');
      return;
    }
    if (rows.some((r) => !(r.rationales[DEFAULT_LOCALE] ?? '').trim())) {
      toast.error('Every pick needs an English rationale.');
      return;
    }
    save(
      {
        id: hubId,
        payload: {
          picks: rows.map((r) => ({
            tourId: r.tourId,
            pickType: r.pickType,
            description: r.rationales[DEFAULT_LOCALE].trim(),
            displayOrder: r.displayOrder,
            translations: ALL_LOCALES.filter(
              (l) => l !== DEFAULT_LOCALE && (r.rationales[l] ?? '').trim()
            ).map((l) => ({ locale: l, description: r.rationales[l].trim() })),
          })),
        },
      },
      {
        onSuccess: (res) => toast.success(`Saved ${res.count} pick(s).`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save Our Picks.'),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
        Up to {MAX_PICKS} editorial &quot;Our Pick&quot; tours for this hub (Best overall / Most
        popular / Best for families). The English rationale is required; switch locale tabs to
        translate it (blank locales fall back to English on the page). Saving replaces the full set.
      </div>

      <div className="flex items-center justify-end">
        <Button size="sm" type="button" onClick={addRow} disabled={rows.length >= MAX_PICKS}>
          <PlusIcon />
          Add Pick {rows.length > 0 ? `(${rows.length}/${MAX_PICKS})` : ''}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <StarIcon className="size-10 opacity-40" />
          <p className="text-sm">No picks yet.</p>
          <p className="text-xs">Add your first pick using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const trip = adminTrips?.data.find((t) => t.id === row.tourId);
            return (
            <Card key={row.key} size="sm">
              <CardContent className="pt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Tour</Label>
                    <HubTourSelect
                      destinationId={hub?.destinationId ?? ''}
                      value={row.tourId}
                      onChange={(tourId) => updateRow(row.key, { tourId })}
                      excludeIds={rows.map((r) => r.tourId)}
                    />
                    {trip && (
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                        <TourBadgeChip type={deriveTourBadge(trip)} />
                        <span>{tourPerfSummary(trip)}</span>
                      </div>
                    )}
                  </Field>
                  <Field>
                    <Label className="text-xs font-semibold uppercase">Pick Type</Label>
                    <Select
                      value={row.pickType}
                      onValueChange={(v) => updateRow(row.key, { pickType: v as HubPickType })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HUB_PICK_TYPE_VALUES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {HUB_PICK_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <RationaleTranslationTabs
                  label="Rationale"
                  values={row.rationales}
                  onChange={(locale, value) => updateRationale(row.key, locale, value)}
                  placeholder={(loc) =>
                    loc === DEFAULT_LOCALE
                      ? 'Why this tour is a pick'
                      : 'Translated rationale (optional)'
                  }
                />

                <div className="flex items-end justify-between gap-4">
                  <Field className="w-32">
                    <Label className="text-xs font-semibold uppercase">Display Order</Label>
                    <Input
                      type="number"
                      value={row.displayOrder}
                      onChange={(e) =>
                        updateRow(row.key, { displayOrder: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
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
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Our Picks'}
        </Button>
      </div>
    </div>
  );
}
