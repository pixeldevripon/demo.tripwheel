'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  Delete02Icon,
  PlusSignIcon,
  StarIcon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TourBadgeChip } from '@/components/common/tour-badge';
import { CurationLoadError } from '@/components/common/curation-load-error';
import {
  countFilledLocales,
  LocaleCompletenessChip,
  TranslationConsoleNote,
} from '@/components/common/locale-completeness';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { tourPerfSummary } from '@/lib/tours/signals';
import { useHub, useHubOurPicksForEdit, useSetHubOurPicks } from '@/hooks/hubs/use-hubs';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/constants/locales';
import { HUB_PICK_TYPE_LABELS, HUB_PICK_TYPE_VALUES, type HubPickType } from '@/types/enums';
import { HubTourSelect } from './hub-tour-select';

// Master caps Our Picks at 3 (Best overall / Most popular / Best for families).
const MAX_PICKS = 3;

interface DraftPick {
  key: string;
  tourId: string;
  pickType: HubPickType;
  /** Rationale per locale (English is the base, required for publish). */
  rationales: Record<string, string>;
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
  const { data, isLoading, isError, error, refetch } = useHubOurPicksForEdit(hubId);
  const { mutate: save, isPending } = useSetHubOurPicks();
  // Shared with HubTourSelect (same query key → one fetch) so a selected pick can
  // show its aggregated performance strip below the picker.
  const { data: adminTrips } = useAdminTrips({ limit: 200 }, !!hub?.destinationId);

  const [rows, setRows] = useState<DraftPick[]>([]);
  // Whole-section collapsed state, mirroring the comparison groups below it
  // on the Curation tab: starts collapsed, opens on demand (or when a pick
  // is added so the new card is visible).
  const [open, setOpen] = useState(false);

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

  /** Swap a pick with its neighbour - list position drives displayOrder on save. */
  function moveRow(key: string, dir: -1 | 1) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      const swapWith = idx + dir;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
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
      },
    ]);
    setOpen(true);
  }

  function handleSave() {
    // Replace-all backstop: never submit a payload built from unseeded state -
    // it would wipe every existing pick.
    if (!seededFrom) {
      toast.error('Our Picks have not loaded yet - reload before saving.');
      return;
    }
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
          // Non-English rationales are round-tripped from the read-back
          // untouched - the editor is English-only, the Translation Console
          // owns them. Dropping them here would DELETE them (replace-all).
          picks: rows.map((r, index) => ({
            tourId: r.tourId,
            pickType: r.pickType,
            description: r.rationales[DEFAULT_LOCALE].trim(),
            displayOrder: index,
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

  if (isError) {
    return (
      <CurationLoadError label="Our Picks" error={error} onRetry={() => void refetch()} />
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border bg-card">
      {/* Same section header pattern as the comparison groups below on this
          tab - one collapsible for the whole Our Picks block. */}
      <div className="flex items-center gap-2 px-3 py-2">
        <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <HugeiconsIcon icon={ArrowDown01Icon}
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${
              open ? 'rotate-0' : '-rotate-90'
            }`}
          />
          <span className="truncate text-sm font-medium">Our Picks</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            ({rows.length}/{MAX_PICKS} pick{rows.length === 1 ? '' : 's'})
          </span>
        </CollapsibleTrigger>
        <Button
          size="sm"
          type="button"
          className="shrink-0"
          onClick={addRow}
          disabled={rows.length >= MAX_PICKS}
        >
          <HugeiconsIcon icon={PlusSignIcon} />
          Add Pick
        </Button>
      </div>

      <CollapsibleContent className="space-y-4 border-t px-3 py-4">
        <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
          {`Up to ${MAX_PICKS} editorial "Our Pick" tours for this hub (Best overall / Most popular / Best for families). The English rationale is required; blank locales fall back to English on the page. Saving replaces the full set. `}
          <TranslationConsoleNote type="hub" id={hubId} />
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <HugeiconsIcon icon={StarIcon} className="size-10 opacity-40" />
            <p className="text-sm">No picks yet.</p>
            <p className="text-xs">Add your first pick using the button above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row, idx) => {
              const trip = adminTrips?.data.find((t) => t.id === row.tourId);
              const filledLocales = countFilledLocales(row.rationales);
              return (
              <Card key={row.key} size="sm">
                <CardContent className="pt-4 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <Label>Tour</Label>
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
                      <Label>Pick Type</Label>
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

                  <Field>
                    <Label>Rationale (English)</Label>
                    <Textarea
                      value={row.rationales[DEFAULT_LOCALE] ?? ''}
                      onChange={(e) =>
                        updateRationale(row.key, DEFAULT_LOCALE, e.target.value)
                      }
                      rows={3}
                      placeholder="Why this tour is a pick"
                    />
                  </Field>

                  <div className="flex items-center justify-between gap-4">
                    <LocaleCompletenessChip filled={filledLocales} />
                    <div className="flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={idx === 0}
                        onClick={() => moveRow(row.key, -1)}
                        aria-label="Move up"
                      >
                        <HugeiconsIcon icon={ArrowUp02Icon} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={idx === rows.length - 1}
                        onClick={() => moveRow(row.key, 1)}
                        aria-label="Move down"
                      >
                        <HugeiconsIcon icon={ArrowDown02Icon} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeRow(row.key)}
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                        Remove
                      </Button>
                    </div>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
