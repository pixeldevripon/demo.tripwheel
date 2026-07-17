'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Delete02Icon, GridTableIcon, PlusSignIcon } from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { TourBadgeChip } from '@/components/common/tour-badge';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { tourPerfSummary } from '@/lib/tours/signals';
import { RationaleTranslationTabs } from '@/components/rationale-translation-tabs';
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
  displayOrder: number;
}

interface DraftGroup {
  key: string;
  groupName: string;
  /** Group-name translations, round-tripped untouched so a save never wipes them. */
  nameTranslations: ComparisonGroupNameTranslationInput[];
  displayOrder: number;
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
  const { data, isLoading } = useHubComparisonForEdit(hubId);
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
        displayOrder: g.displayOrder,
        tours: g.tours.map((t) => {
          const standouts: Record<string, string> = {
            [DEFAULT_LOCALE]: t.standoutNote ?? '',
          };
          for (const tr of t.translations) standouts[tr.locale] = tr.standoutNote;
          return {
            key: nextKey('tour'),
            tourId: t.tourId,
            standouts,
            displayOrder: t.displayOrder,
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

  function addGroup() {
    const key = nextKey('group');
    setGroups((prev) => [
      ...prev,
      { key, groupName: '', nameTranslations: [], displayOrder: prev.length, tours: [] },
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
                { key: nextKey('tour'), tourId: '', standouts: {}, displayOrder: g.tours.length },
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
          groups: groups.map((g) => ({
            groupName: g.groupName.trim(),
            displayOrder: g.displayOrder,
            translations: g.nameTranslations,
            tours: g.tours.map((t) => ({
              tourId: t.tourId,
              standoutNote: (t.standouts[DEFAULT_LOCALE] ?? '').trim() || undefined,
              displayOrder: t.displayOrder,
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

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2">
        Comparison groups (e.g. &quot;Comfort trips&quot;) and the tour columns inside them. The
        English standout note is the base; switch locale tabs to translate it (blank locales fall
        back to English on the page). Saving replaces the full set.
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
          {groups.map((group) => {
            const isOpen = openKeys.has(group.key);
            const title = group.groupName.trim() || 'Untitled group';
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeGroup(group.key)}
                >
                  <HugeiconsIcon icon={Delete02Icon} />
                  Remove Group
                </Button>
              </div>

              <CollapsibleContent className="space-y-4 border-t px-3 py-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <Field>
                    <Label>Group Name</Label>
                    <Input
                      value={group.groupName}
                      onChange={(e) => updateGroup(group.key, { groupName: e.target.value })}
                      placeholder="e.g. Comfort trips"
                    />
                  </Field>
                  <Field>
                    <Label>Display Order</Label>
                    <Input
                      type="number"
                      value={group.displayOrder}
                      onChange={(e) =>
                        updateGroup(group.key, { displayOrder: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                </div>

                {/* Tour columns */}
                <div className="space-y-3 border-l-2 border-muted pl-4">
                  {group.tours.map((tour) => {
                    const trip = adminTrips?.data.find((t) => t.id === tour.tourId);
                    return (
                      <Card key={tour.key} size="sm">
                        <CardContent className="pt-5 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
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
                            <Field>
                              <Label>Order</Label>
                              <Input
                                type="number"
                                value={tour.displayOrder}
                                onChange={(e) =>
                                  updateTour(group.key, tour.key, {
                                    displayOrder: Number(e.target.value) || 0,
                                  })
                                }
                              />
                            </Field>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 mb-1"
                              onClick={() => removeTour(group.key, tour.key)}
                            >
                              <HugeiconsIcon icon={Delete02Icon} />
                            </Button>
                          </div>

                          <RationaleTranslationTabs
                            label="Standout Note"
                            values={tour.standouts}
                            onChange={(locale, value) =>
                              updateStandout(group.key, tour.key, locale, value)
                            }
                            placeholder={(loc) =>
                              loc === DEFAULT_LOCALE
                                ? 'What stands out about this tour'
                                : 'Translated standout note (optional)'
                            }
                          />
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
