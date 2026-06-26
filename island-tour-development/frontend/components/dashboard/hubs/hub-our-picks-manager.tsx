'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { useHub, useHubOurPicks, useSetHubOurPicks } from '@/hooks/hubs/use-hubs';
import { HUB_PICK_TYPE_LABELS, HUB_PICK_TYPE_VALUES, type HubPickType } from '@/types/enums';
import { HubTourSelect } from './hub-tour-select';

const MAX_PICKS = 4;

interface DraftPick {
  key: string;
  tourId: string;
  pickType: HubPickType;
  description: string;
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
  const { data, isLoading } = useHubOurPicks(hubId, 'en');
  const { mutate: save, isPending } = useSetHubOurPicks();

  const [rows, setRows] = useState<DraftPick[]>([]);

  // Seed local edit state from the loaded picks (render-time, reference-guarded).
  const [seededFrom, setSeededFrom] = useState<typeof data>(undefined);
  if (data && data !== seededFrom) {
    setSeededFrom(data);
    setRows(
      data.ourPicks.map((p) => ({
        key: nextKey(),
        tourId: p.tour.id,
        pickType: p.pickType,
        description: p.description,
        displayOrder: p.displayOrder,
      }))
    );
  }

  function updateRow(key: string, patch: Partial<DraftPick>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
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
        description: '',
        displayOrder: prev.length,
      },
    ]);
  }

  function handleSave() {
    if (rows.some((r) => !r.tourId)) {
      toast.error('Every pick needs a tour selected.');
      return;
    }
    if (rows.some((r) => !r.description.trim())) {
      toast.error('Every pick needs a description.');
      return;
    }
    save(
      {
        id: hubId,
        payload: {
          picks: rows.map((r) => ({
            tourId: r.tourId,
            pickType: r.pickType,
            description: r.description.trim(),
            displayOrder: r.displayOrder,
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
        Up to {MAX_PICKS} editorial &quot;Our Pick&quot; tours for this hub. Descriptions are the
        base English blurb; per-locale translations are managed via the API and are not editable
        here. Saving replaces the full set.
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
          {rows.map((row) => (
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

                <Field>
                  <Label className="text-xs font-semibold uppercase">Description (English)</Label>
                  <Textarea
                    value={row.description}
                    onChange={(e) => updateRow(row.key, { description: e.target.value })}
                    rows={2}
                    placeholder="Why this tour is a pick"
                  />
                </Field>

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
          ))}
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
