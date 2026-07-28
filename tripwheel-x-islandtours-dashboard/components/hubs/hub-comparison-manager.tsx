'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowDown02Icon,
  ArrowUp02Icon,
  Delete02Icon,
  GridTableIcon,
  PlusSignIcon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Field } from '@/components/ui/field';
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
import {
  useHub,
  useHubComparisonForEdit,
  useSetHubComparison,
} from '@/hooks/hubs/use-hubs';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/constants/locales';
import type { ComparisonGroupNameTranslationInput } from '@/types/hub';
import { HubTourSelect } from './hub-tour-select';

interface DraftTour {
  key: string;
  tourId: string;
  /** Standout note per locale (English is the base). */
  standouts: Record<string, string>;
}

interface DraftGroup {
  key: string;
  groupName: string;
  /** Group-name translations, round-tripped untouched so a save never wipes them. */
  nameTranslations: ComparisonGroupNameTranslationInput[];
  tours: DraftTour[];
}

let counter = 0;
function nextKey(prefix: string) {
  counter += 1;
  return `${prefix}-${counter}`;
}

interface HubComparisonManagerProps {
  hubId: string;
}

export function HubComparisonManager({ hubId }: HubComparisonManagerProps) {
  const { data: hub } = useHub(hubId, 'en');
  const { data, isLoading, isError, error, refetch } = useHubComparisonForEdit(hubId);
  const { mutate: save, isPending } = useSetHubComparison();
  // Shared query key with HubTourSelect (one fetch) so each selected column can
  // show its aggregated performance strip below the picker.
  const { data: adminTrips } = useAdminTrips({ limit: 200 }, !!hub?.destinationId);

  const [groups, setGroups] = useState<DraftGroup[]>([]);
  // Per-group open/collapsed state (kept out of the data model). Seeded groups
  // start collapsed; a freshly added group opens so it can be filled in.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggleOpen(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Seed local edit state from the all-locale read-back (base note + every locale),
  // reference-guarded (render-time setState per repo convention).
  const [seededFrom, setSeededFrom] = useState<typeof data>(undefined);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setGroups(
      data.map((g) => ({
        key: nextKey('group'),
        groupName: g.groupName,
        nameTranslations: g.translations,
        tours: g.tours.map((t) => {
          const standouts: Record<string, string> = {
            [DEFAULT_LOCALE]: t.standoutNote ?? '',
          };
          for (const tr of t.translations) standouts[tr.locale] = tr.standoutNote;
          return {
            key: nextKey('tour'),
            tourId: t.tourId,
            standouts,
          };
        }),
      }))
    );
  }

  function updateGroup(key: string, patch: Partial<Omit<DraftGroup, 'tours'>>) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function removeGroup(key: string) {
    setGroups((prev) => prev.filter((g) => g.key !== key));
  }

  /** Swap a group with its neighbour - list position drives displayOrder on save. */
  function moveGroup(key: string, dir: -1 | 1) {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.key === key);
      const swapWith = idx + dir;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  /** Swap a tour column with its neighbour within the group. */
  function moveTour(groupKey: string, tourKey: string, dir: -1 | 1) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.key !== groupKey) return g;
        const idx = g.tours.findIndex((t) => t.key === tourKey);
        const swapWith = idx + dir;
        if (idx === -1 || swapWith < 0 || swapWith >= g.tours.length) return g;
        const tours = [...g.tours];
        [tours[idx], tours[swapWith]] = [tours[swapWith], tours[idx]];
        return { ...g, tours };
      })
    );
  }

  function addGroup() {
    const key = nextKey('group');
    setGroups((prev) => [
      ...prev,
      { key, groupName: '', nameTranslations: [], tours: [] },
    ]);
    setOpenKeys((prev) => new Set(prev).add(key));
  }

  function addTour(groupKey: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? {
              ...g,
              tours: [
                ...g.tours,
                { key: nextKey('tour'), tourId: '', standouts: {} },
              ],
            }
          : g
      )
    );
  }

  function updateTour(groupKey: string, tourKey: string, patch: Partial<DraftTour>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? { ...g, tours: g.tours.map((t) => (t.key === tourKey ? { ...t, ...patch } : t)) }
          : g
      )
    );
  }

  function updateStandout(groupKey: string, tourKey: string, locale: Locale, value: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? {
              ...g,
              tours: g.tours.map((t) =>
                t.key === tourKey
                  ? { ...t, standouts: { ...t.standouts, [locale]: value } }
                  : t
              ),
            }
          : g
      )
    );
  }

  function removeTour(groupKey: string, tourKey: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey ? { ...g, tours: g.tours.filter((t) => t.key !== tourKey) } : g
      )
    );
  }

  function handleSave() {
    // Replace-all backstop: never submit a payload built from unseeded state -
    // it would wipe every existing group and column.
    if (!seededFrom) {
      toast.error('The comparison table has not loaded yet - reload before saving.');
      return;
    }
    if (groups.some((g) => !g.groupName.trim())) {
      toast.error('Every group needs a name.');
      return;
    }
    if (groups.some((g) => g.tours.length === 0)) {
      toast.error('Every group needs at least one tour column.');
      return;
    }
    if (groups.some((g) => g.tours.some((t) => !t.tourId))) {
      toast.error('Every tour column needs a tour selected.');
      return;
    }
    save(
      {
        id: hubId,
        payload: {
          // Group-name translations and non-English standout notes are
          // round-tripped from the read-back untouched - the editor is
          // English-only, the Translation Console owns them. Dropping them
          // here would DELETE them (replace-all).
          groups: groups.map((g, groupIndex) => ({
            groupName: g.groupName.trim(),
            displayOrder: groupIndex,
            translations: g.nameTranslations,
            tours: g.tours.map((t, tourIndex) => ({
              tourId: t.tourId,
              standoutNote: (t.standouts[DEFAULT_LOCALE] ?? '').trim() || undefined,
              displayOrder: tourIndex,
              translations: ALL_LOCALES.filter(
                (l) => l !== DEFAULT_LOCALE && (t.standouts[l] ?? '').trim()
              ).map((l) => ({ locale: l, standoutNote: t.standouts[l].trim() })),
            })),
          })),
        },
      },
      {
        onSuccess: (res) => toast.success(`Saved ${res.count} comparison group(s).`),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to save comparison table.'),
      }
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <CurationLoadError
        label="the comparison table"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
        Comparison groups (e.g. &quot;Comfort trips&quot;) and the tour columns inside them. The
        English standout note is the base; blank locales fall back to English on the page. Saving
        replaces the full set. <TranslationConsoleNote type="hub" id={hubId} />
      </div>

      <div className="flex items-center justify-end">
        <Button size="sm" type="button" onClick={addGroup}>
          <HugeiconsIcon icon={PlusSignIcon} />
          Add Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <HugeiconsIcon icon={GridTableIcon} className="size-10 opacity-40" />
          <p className="text-sm">No comparison groups yet.</p>
          <p className="text-xs">Add your first group using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group, groupIdx) => {
            const isOpen = openKeys.has(group.key);
            const title = group.groupName.trim() || 'Untitled group';
            const groupNameLocales =
              (group.groupName.trim() ? 1 : 0) + group.nameTranslations.length;
            return (
            <Collapsible
              key={group.key}
              open={isOpen}
              onOpenChange={() => toggleOpen(group.key)}
              className="border bg-card"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <HugeiconsIcon icon={ArrowDown01Icon}
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                      isOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                  <span className="truncate text-sm font-medium">{title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ({group.tours.length} tour{group.tours.length === 1 ? '' : 's'})
                  </span>
                </CollapsibleTrigger>
                <LocaleCompletenessChip filled={groupNameLocales} />
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={groupIdx === 0}
                    onClick={() => moveGroup(group.key, -1)}
                    aria-label="Move group up"
                  >
                    <HugeiconsIcon icon={ArrowUp02Icon} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={groupIdx === groups.length - 1}
                    onClick={() => moveGroup(group.key, 1)}
                    aria-label="Move group down"
                  >
                    <HugeiconsIcon icon={ArrowDown02Icon} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeGroup(group.key)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                    Remove Group
                  </Button>
                </div>
              </div>

              <CollapsibleContent className="space-y-4 border-t px-3 py-4">
                <Field>
                  <Label>Group Name (English)</Label>
                  <Input
                    value={group.groupName}
                    onChange={(e) => updateGroup(group.key, { groupName: e.target.value })}
                    placeholder="e.g. Comfort trips"
                  />
                </Field>

                {/* Tour columns */}
                <div className="space-y-3 border-l-2 border-muted pl-4">
                  {group.tours.map((tour, tourIdx) => {
                    const trip = adminTrips?.data.find((t) => t.id === tour.tourId);
                    const noteLocales = countFilledLocales(tour.standouts);
                    return (
                      <Card key={tour.key} size="sm">
                        <CardContent className="pt-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                            <Field>
                              <Label>Tour</Label>
                              <HubTourSelect
                                destinationId={hub?.destinationId ?? ''}
                                value={tour.tourId}
                                onChange={(tourId) => updateTour(group.key, tour.key, { tourId })}
                                excludeIds={group.tours.map((t) => t.tourId)}
                              />
                              {trip && (
                                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                                  <TourBadgeChip type={deriveTourBadge(trip)} />
                                  <span>{tourPerfSummary(trip)}</span>
                                </div>
                              )}
                            </Field>
                            <div className="mb-1 flex items-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={tourIdx === 0}
                                onClick={() => moveTour(group.key, tour.key, -1)}
                                aria-label="Move column up"
                              >
                                <HugeiconsIcon icon={ArrowUp02Icon} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={tourIdx === group.tours.length - 1}
                                onClick={() => moveTour(group.key, tour.key, 1)}
                                aria-label="Move column down"
                              >
                                <HugeiconsIcon icon={ArrowDown02Icon} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeTour(group.key, tour.key)}
                                aria-label="Remove column"
                              >
                                <HugeiconsIcon icon={Delete02Icon} />
                              </Button>
                            </div>
                          </div>

                          <Field>
                            <div className="flex items-center justify-between">
                              <Label>Standout Note (English)</Label>
                              <LocaleCompletenessChip filled={noteLocales} />
                            </div>
                            <Textarea
                              value={tour.standouts[DEFAULT_LOCALE] ?? ''}
                              onChange={(e) =>
                                updateStandout(
                                  group.key,
                                  tour.key,
                                  DEFAULT_LOCALE,
                                  e.target.value
                                )
                              }
                              rows={2}
                              placeholder="What stands out about this tour"
                            />
                          </Field>
                        </CardContent>
                      </Card>
                    );
                  })}
                  <Button type="button" variant="outline" size="sm" onClick={() => addTour(group.key)}>
                    <HugeiconsIcon icon={PlusSignIcon} />
                    Add Tour Column
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Comparison Table'}
        </Button>
      </div>
    </div>
  );
}
