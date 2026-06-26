'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownIcon, ArrowUpIcon, ListOrderedIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useCollection,
  useReplaceCollectionTours,
  useUpsertCollectionTourRationale,
} from '@/hooks/collections/use-collections';
import { CollectionTourSelect } from './collection-tour-select';

const RATIONALE_MAX_WORDS = 20;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface DraftRow {
  key: string;
  tourId: string;
  /** English rationale. Write-only: the API does not return rationales for editing. */
  rationale: string;
}

let counter = 0;
function nextKey() {
  counter += 1;
  return `ct-${counter}`;
}

interface CollectionToursManagerProps {
  collectionId: string;
}

export function CollectionToursManager({ collectionId }: CollectionToursManagerProps) {
  const { data: collection, isLoading } = useCollection(collectionId);
  const { mutateAsync: replaceTours, isPending: replacing } = useReplaceCollectionTours();
  const { mutateAsync: upsertRationale, isPending: savingRationale } =
    useUpsertCollectionTourRationale();
  const isSaving = replacing || savingRationale;

  const [rows, setRows] = useState<DraftRow[]>([]);

  // Seed the order from the collection's tourIds (render-time, reference-guarded).
  // Rationale starts blank - there is no endpoint that returns existing rationales.
  const [seededFrom, setSeededFrom] = useState<typeof collection>(undefined);
  if (collection && collection !== seededFrom) {
    setSeededFrom(collection);
    setRows((collection.tourIds ?? []).map((tourId) => ({ key: nextKey(), tourId, rationale: '' })));
  }

  const destinationId = collection?.destinationId ?? '';

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: nextKey(), tourId: '', rationale: '' }]);
  }

  function move(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (rows.length === 0) {
      toast.error('Add at least one tour.');
      return;
    }
    if (rows.some((r) => !r.tourId)) {
      toast.error('Every row needs a tour selected.');
      return;
    }
    const ids = rows.map((r) => r.tourId);
    if (new Set(ids).size !== ids.length) {
      toast.error('A tour can only appear once.');
      return;
    }
    if (rows.some((r) => wordCount(r.rationale) > RATIONALE_MAX_WORDS)) {
      toast.error(`Each rationale must be ${RATIONALE_MAX_WORDS} words or fewer.`);
      return;
    }

    try {
      // Membership first (this replaces all members and clears existing rationales),
      // then re-apply each non-empty rationale.
      await replaceTours({
        id: collectionId,
        payload: { tours: rows.map((r, i) => ({ tourId: r.tourId, position: i })) },
      });
      const withRationale = rows.filter((r) => r.rationale.trim());
      await Promise.all(
        withRationale.map((r) =>
          upsertRationale({
            id: collectionId,
            tourId: r.tourId,
            locale: 'en',
            payload: { rationale: r.rationale.trim() },
          })
        )
      );
      toast.success(
        `Saved ${rows.length} tour(s)${withRationale.length ? `, ${withRationale.length} rationale(s)` : ''}.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save tours.');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-none" />
        ))}
      </div>
    );
  }

  if (collection && collection.collectionType !== 'MANUAL') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <ListOrderedIcon className="size-10 opacity-40" />
        <p className="text-sm">This is a dynamic collection.</p>
        <p className="text-xs max-w-md">
          Its tours are resolved from the saved filter query, not a hand-picked list. Edit the
          filter in the Details tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-muted px-3 py-2 space-y-1">
        <p>
          Hand-picked tours for this collection, in display order. Drag order is set with the
          up/down controls. Saving replaces the full list.
        </p>
        <p>
          <strong>Rationale</strong> (≤{RATIONALE_MAX_WORDS} words, English) is required on every
          tour before the collection can be published. It is not shown back here after saving (the
          API does not return it for editing), so re-enter it whenever you change the tour list.
        </p>
      </div>

      <div className="flex items-center justify-end">
        <Button size="sm" type="button" onClick={addRow}>
          <PlusIcon />
          Add Tour
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <ListOrderedIcon className="size-10 opacity-40" />
          <p className="text-sm">No tours yet.</p>
          <p className="text-xs">Add your first tour using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => {
            const words = wordCount(row.rationale);
            const overLimit = words > RATIONALE_MAX_WORDS;
            return (
              <Card key={row.key} size="sm">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-6">
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="flex flex-col">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUpIcon className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === rows.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownIcon className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <Field>
                        <Label className="text-xs font-semibold uppercase">Tour</Label>
                        <CollectionTourSelect
                          destinationId={destinationId}
                          value={row.tourId}
                          onChange={(tourId) => updateRow(row.key, { tourId })}
                          excludeIds={rows.map((r) => r.tourId)}
                        />
                      </Field>
                      <Field>
                        <Label className="text-xs font-semibold uppercase">Rationale (English)</Label>
                        <Textarea
                          value={row.rationale}
                          onChange={(e) => updateRow(row.key, { rationale: e.target.value })}
                          rows={2}
                          placeholder="Why this tour belongs in the collection"
                        />
                        <span
                          className={`text-xs ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}
                        >
                          {words}/{RATIONALE_MAX_WORDS} words
                        </span>
                      </Field>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 mt-6"
                      onClick={() => removeRow(row.key)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Tours'}
        </Button>
      </div>
    </div>
  );
}
