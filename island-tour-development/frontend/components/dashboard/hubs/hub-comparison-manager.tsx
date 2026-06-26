'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ColumnsIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useHub, useHubComparison, useSetHubComparison } from '@/hooks/hubs/use-hubs';
import { HubTourSelect } from './hub-tour-select';

interface DraftTour {
  key: string;
  tourId: string;
  standoutNote: string;
  displayOrder: number;
}

interface DraftGroup {
  key: string;
  groupName: string;
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
  const { data, isLoading } = useHubComparison(hubId, 'en');
  const { mutate: save, isPending } = useSetHubComparison();

  const [groups, setGroups] = useState<DraftGroup[]>([]);

  useEffect(() => {
    if (data) {
      setGroups(
        data.groups.map((g) => ({
          key: nextKey('group'),
          groupName: g.groupName,
          displayOrder: g.displayOrder,
          tours: g.tours.map((t) => ({
            key: nextKey('tour'),
            tourId: t.tour.id,
            standoutNote: t.standoutNote ?? '',
            displayOrder: t.displayOrder,
          })),
        }))
      );
    }
  }, [data]);

  function updateGroup(key: string, patch: Partial<Omit<DraftGroup, 'tours'>>) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function removeGroup(key: string) {
    setGroups((prev) => prev.filter((g) => g.key !== key));
  }

  function addGroup() {
    setGroups((prev) => [
      ...prev,
      { key: nextKey('group'), groupName: '', displayOrder: prev.length, tours: [] },
    ]);
  }

  function addTour(groupKey: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? {
              ...g,
              tours: [
                ...g.tours,
                { key: nextKey('tour'), tourId: '', standoutNote: '', displayOrder: g.tours.length },
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
            tours: g.tours.map((t) => ({
              tourId: t.tourId,
              standoutNote: t.standoutNote.trim() || undefined,
              displayOrder: t.displayOrder,
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
        Comparison groups (e.g. &quot;Comfort trips&quot;) and the tour columns inside them. Group
        names and standout notes are the base English values; per-locale translations are managed
        via the API and are not editable here. Saving replaces the full set.
      </div>

      <div className="flex items-center justify-end">
        <Button size="sm" type="button" onClick={addGroup}>
          <PlusIcon />
          Add Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <ColumnsIcon className="size-10 opacity-40" />
          <p className="text-sm">No comparison groups yet.</p>
          <p className="text-xs">Add your first group using the button above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.key}>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <div className="grid flex-1 gap-4 sm:grid-cols-[1fr_8rem]">
                    <Field>
                      <Label className="text-xs font-semibold uppercase">Group Name</Label>
                      <Input
                        value={group.groupName}
                        onChange={(e) => updateGroup(group.key, { groupName: e.target.value })}
                        placeholder="e.g. Comfort trips"
                      />
                    </Field>
                    <Field>
                      <Label className="text-xs font-semibold uppercase">Display Order</Label>
                      <Input
                        type="number"
                        value={group.displayOrder}
                        onChange={(e) =>
                          updateGroup(group.key, { displayOrder: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeGroup(group.key)}
                  >
                    <Trash2Icon />
                    Remove Group
                  </Button>
                </div>

                {/* Tour columns */}
                <div className="space-y-3 border-l-2 border-muted pl-4">
                  {group.tours.map((tour) => (
                    <div key={tour.key} className="grid gap-3 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end">
                      <Field>
                        <Label className="text-xs font-semibold uppercase">Tour</Label>
                        <HubTourSelect
                          destinationId={hub?.destinationId ?? ''}
                          value={tour.tourId}
                          onChange={(tourId) => updateTour(group.key, tour.key, { tourId })}
                          excludeIds={group.tours.map((t) => t.tourId)}
                        />
                      </Field>
                      <Field>
                        <Label className="text-xs font-semibold uppercase">Standout Note</Label>
                        <Input
                          value={tour.standoutNote}
                          onChange={(e) =>
                            updateTour(group.key, tour.key, { standoutNote: e.target.value })
                          }
                          placeholder="What stands out"
                        />
                      </Field>
                      <Field>
                        <Label className="text-xs font-semibold uppercase">Order</Label>
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
                        size="icon-xs"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 mb-1"
                        onClick={() => removeTour(group.key, tour.key)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="xs" onClick={() => addTour(group.key)}>
                    <PlusIcon />
                    Add Tour Column
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
