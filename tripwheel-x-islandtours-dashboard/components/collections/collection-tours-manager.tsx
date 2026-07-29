'use client';

import {
    ArrowDown02Icon,
    ArrowUp02Icon,
    Delete02Icon,
    LeftToRightListNumberIcon,
    PlusSignIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { TourBadgeChip } from '@/components/common/tour-badge';
import { RationaleTranslationTabs } from '@/components/rationale-translation-tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
    useCollection,
    useCollectionResolvedTours,
    useCollectionToursForEdit,
    useReplaceCollectionTours,
    useUpsertCollectionTourRationale,
} from '@/hooks/collections/use-collections';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import {
    ALL_LOCALES,
    LOCALE_LABELS,
    type Locale,
} from '@/lib/constants/locales';
import { deriveTourBadge } from '@/lib/tours/derive-badge';
import { tourPerfSummary } from '@/lib/tours/signals';
import type {
    CollectionRenderTour,
    CollectionTourForEdit,
} from '@/types/collection';
import type { TripListItem } from '@/types/trip';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CollectionTourSelect } from './collection-tour-select';

const RATIONALE_MAX_WORDS = 20;

function wordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

let counter = 0;
function nextKey() {
    counter += 1;
    return `ct-${counter}`;
}

interface DraftRow {
    key: string;
    tourId: string;
    name: string | null;
    /** Rationale per locale (English is the base, required for publish). */
    rationales: Record<string, string>;
}

function seedRow(m: CollectionTourForEdit): DraftRow {
    const rationales: Record<string, string> = {};
    for (const locale of ALL_LOCALES)
        rationales[locale] = m.rationales[locale] ?? '';
    return { key: nextKey(), tourId: m.tourId, name: m.name, rationales };
}

interface ManualToursEditorProps {
    collectionId: string;
    destinationId: string;
    members: CollectionTourForEdit[];
}

function ManualToursEditor({
    collectionId,
    destinationId,
    members,
}: ManualToursEditorProps) {
    const { mutateAsync: replaceTours, isPending: replacing } =
        useReplaceCollectionTours();
    const { mutateAsync: upsertRationale, isPending: savingRationale } =
        useUpsertCollectionTourRationale();
    const isSaving = replacing || savingRationale;

    // Shared with CollectionTourSelect (same query key → one fetch) so a selected
    // row can show the tour's performance signals + badge inline.
    const { data: adminTrips } = useAdminTrips({ limit: 200 }, !!destinationId);
    const tripById = useMemo(
        () =>
            new Map<string, TripListItem>(
                (adminTrips?.data ?? []).map(t => [t.id, t])
            ),
        [adminTrips]
    );

    const [rows, setRows] = useState<DraftRow[]>([]);

    // Seed from the read-back (order + every locale's rationale), reference-guarded
    // so a refetch after save reseeds without an effect (repo lints setState-in-effect).
    const [seededFrom, setSeededFrom] = useState<
        CollectionTourForEdit[] | null
    >(null);
    if (members !== seededFrom) {
        setSeededFrom(members);
        setRows(members.map(seedRow));
    }

    function updateRow(key: string, patch: Partial<DraftRow>) {
        setRows(prev =>
            prev.map(r => (r.key === key ? { ...r, ...patch } : r))
        );
    }
    function updateRationale(key: string, locale: Locale, value: string) {
        setRows(prev =>
            prev.map(r =>
                r.key === key
                    ? { ...r, rationales: { ...r.rationales, [locale]: value } }
                    : r
            )
        );
    }
    function removeRow(key: string) {
        setRows(prev => prev.filter(r => r.key !== key));
    }
    function addRow() {
        const rationales: Record<string, string> = {};
        for (const locale of ALL_LOCALES) rationales[locale] = '';
        setRows(prev => [
            ...prev,
            { key: nextKey(), tourId: '', name: null, rationales },
        ]);
    }
    function move(index: number, dir: -1 | 1) {
        setRows(prev => {
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
        if (rows.some(r => !r.tourId)) {
            toast.error('Every row needs a tour selected.');
            return;
        }
        const ids = rows.map(r => r.tourId);
        if (new Set(ids).size !== ids.length) {
            toast.error('A tour can only appear once.');
            return;
        }
        const overLimit = rows.some(r =>
            ALL_LOCALES.some(
                l => wordCount(r.rationales[l] ?? '') > RATIONALE_MAX_WORDS
            )
        );
        if (overLimit) {
            toast.error(
                `Each rationale must be ${RATIONALE_MAX_WORDS} words or fewer.`
            );
            return;
        }

        try {
            // Membership + order first (kept tours keep their rows, so their translations
            // survive; new tours get rows created), then upsert every non-empty rationale
            // across all locales.
            await replaceTours({
                id: collectionId,
                payload: {
                    tours: rows.map((r, i) => ({
                        tourId: r.tourId,
                        position: i,
                    })),
                },
            });

            const upserts = rows.flatMap(r =>
                ALL_LOCALES.filter(l => (r.rationales[l] ?? '').trim()).map(l =>
                    upsertRationale({
                        id: collectionId,
                        tourId: r.tourId,
                        locale: l,
                        payload: { rationale: r.rationales[l].trim() },
                    })
                )
            );
            await Promise.all(upserts);

            toast.success(
                `Saved ${rows.length} tour(s) and their rationale translations.`
            );
        } catch (err) {
            toast.error(
                err instanceof Error ? err.message : 'Failed to save tours.'
            );
        }
    }

    return (
        <div className='space-y-4'>
            <div className='text-xs text-muted-foreground bg-muted px-3 py-2 space-y-1'>
                <p>
                    Hand-picked tours in display order (set with the up/down
                    controls). Saving replaces the list; tours you keep retain
                    their translations.
                </p>
                <p>
                    Each tour&apos;s <strong>English rationale</strong> (≤
                    {RATIONALE_MAX_WORDS} words) is required before publishing.
                    Expand <strong>Rationale translations</strong> on a tour to
                    translate it into the other languages (blank falls back to
                    English on the public page).
                </p>
            </div>

            <div className='flex items-center justify-end'>
                <Button size='sm' type='button' onClick={addRow}>
                    <HugeiconsIcon icon={PlusSignIcon} />
                    Add Tour
                </Button>
            </div>

            {rows.length === 0 ? (
                <div className='flex flex-col items-center gap-3 py-16 text-muted-foreground'>
                    <HugeiconsIcon
                        icon={LeftToRightListNumberIcon}
                        className='size-10 opacity-40'
                    />
                    <p className='text-sm'>No tours yet.</p>
                    <p className='text-xs'>
                        Add your first tour using the button above.
                    </p>
                </div>
            ) : (
                <div className='space-y-3'>
                    {rows.map((row, index) => {
                        const trip = row.tourId
                            ? tripById.get(row.tourId)
                            : undefined;
                        return (
                            <Card key={row.key} size='sm'>
                                <CardContent className='pt-4 space-y-4'>
                                    <div className='flex items-start gap-3'>
                                        <div className='flex flex-col items-center gap-1 pt-6'>
                                            <span className='text-xs font-medium text-muted-foreground tabular-nums'>
                                                {String(index + 1).padStart(
                                                    2,
                                                    '0'
                                                )}
                                            </span>
                                            <div className='flex flex-col'>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='icon-sm'
                                                    disabled={index === 0}
                                                    onClick={() =>
                                                        move(index, -1)
                                                    }>
                                                    <HugeiconsIcon
                                                        icon={ArrowUp02Icon}
                                                        className='size-3.5'
                                                    />
                                                </Button>
                                                <Button
                                                    type='button'
                                                    variant='ghost'
                                                    size='icon-sm'
                                                    disabled={
                                                        index ===
                                                        rows.length - 1
                                                    }
                                                    onClick={() =>
                                                        move(index, 1)
                                                    }>
                                                    <HugeiconsIcon
                                                        icon={ArrowDown02Icon}
                                                        className='size-3.5'
                                                    />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className='flex-1 space-y-4'>
                                            <Field>
                                                <Label>Tour</Label>
                                                <CollectionTourSelect
                                                    destinationId={
                                                        destinationId
                                                    }
                                                    value={row.tourId}
                                                    onChange={tourId =>
                                                        updateRow(row.key, {
                                                            tourId,
                                                        })
                                                    }
                                                    excludeIds={rows.map(
                                                        r => r.tourId
                                                    )}
                                                />
                                                {trip && (
                                                    <div className='flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground'>
                                                        <TourBadgeChip
                                                            type={deriveTourBadge(
                                                                trip
                                                            )}
                                                        />
                                                        <span>
                                                            {tourPerfSummary(
                                                                trip
                                                            )}
                                                        </span>
                                                    </div>
                                                )}
                                            </Field>

                                            <RationaleTranslationTabs
                                                label='Rationale'
                                                values={row.rationales}
                                                onChange={(locale, value) =>
                                                    updateRationale(
                                                        row.key,
                                                        locale,
                                                        value
                                                    )
                                                }
                                                maxWords={RATIONALE_MAX_WORDS}
                                                placeholder={loc =>
                                                    loc === 'en'
                                                        ? 'Why this tour belongs in the collection'
                                                        : `Rationale in ${LOCALE_LABELS[loc]} (optional)`
                                                }
                                            />
                                        </div>

                                        <Button
                                            type='button'
                                            variant='ghost'
                                            size='icon-sm'
                                            className='text-destructive hover:text-destructive hover:bg-destructive/10 mt-6'
                                            onClick={() => removeRow(row.key)}>
                                            <HugeiconsIcon
                                                icon={Delete02Icon}
                                                className='size-3.5'
                                            />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            <div className='flex justify-end pt-2'>
                <Button type='button' onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Tours'}
                </Button>
            </div>
        </div>
    );
}

// ── DYNAMIC: read-only preview of the tours the saved filter resolves to ──────

function formatFromPrice(v: number | string | null | undefined): string {
    const n = Math.round(Number(v ?? 0));
    return Number.isFinite(n) && n > 0 ? `From $${n}` : '';
}

function DynamicToursPreview({ collectionId }: { collectionId: string }) {
    const {
        data: tours,
        isLoading,
        isError,
    } = useCollectionResolvedTours(collectionId);

    return (
        <div className='space-y-4'>
            <div className='text-xs text-muted-foreground bg-muted px-3 py-2 space-y-1'>
                <p>
                    This is a <strong>dynamic</strong> collection. Its tours are
                    resolved live from the saved filter query (edit it in the
                    Details tab) and ordered by the collection&apos;s Sort
                    Order, so there are no per-tour rationales.
                </p>
                <p>The preview below reflects the filter you last saved.</p>
            </div>

            {isLoading ? (
                <div className='space-y-2'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className='h-16 w-full rounded-none'
                        />
                    ))}
                </div>
            ) : isError ? (
                <p className='text-sm text-destructive'>
                    Failed to load resolved tours.
                </p>
            ) : !tours || tours.length === 0 ? (
                <div className='flex flex-col items-center gap-3 py-16 text-center text-muted-foreground'>
                    <HugeiconsIcon
                        icon={LeftToRightListNumberIcon}
                        className='size-10 opacity-40'
                    />
                    <p className='text-sm'>No tours match this filter.</p>
                    <p className='text-xs max-w-md'>
                        Adjust the filter query in the Details tab, or widen it,
                        to resolve some tours.
                    </p>
                </div>
            ) : (
                <>
                    <p className='text-xs font-medium text-muted-foreground'>
                        {tours.length} tour{tours.length === 1 ? '' : 's'}{' '}
                        resolved
                    </p>
                    <div className='space-y-2'>
                        {tours.map((tour: CollectionRenderTour, index) => {
                            const price = formatFromPrice(
                                tour.priceFrom ?? tour.basePrice
                            );
                            const hasReviews = tour.aggregateReviewCount > 0;
                            return (
                                <Card key={tour.id} size='sm'>
                                    <CardContent className='flex items-center gap-3 py-3'>
                                        <span className='w-6 shrink-0 text-xs font-medium tabular-nums text-muted-foreground'>
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                        <div className='min-w-0 flex-1'>
                                            <p className='truncate text-sm font-medium'>
                                                {tour.name}
                                            </p>
                                            <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground'>
                                                {hasReviews ? (
                                                    <span>
                                                        ★ {tour.aggregateRating}{' '}
                                                        (
                                                        {tour.aggregateReviewCount.toLocaleString()}
                                                        )
                                                    </span>
                                                ) : (
                                                    <span>No reviews yet</span>
                                                )}
                                                {tour.bookingCount != null && (
                                                    <span>
                                                        {tour.bookingCount.toLocaleString()}{' '}
                                                        booked
                                                    </span>
                                                )}
                                                {price && <span>{price}</span>}
                                            </div>
                                            {tour.overview && (
                                                <p className='truncate text-xs italic text-muted-foreground/80'>
                                                    {tour.overview}
                                                </p>
                                            )}
                                        </div>
                                        <TourBadgeChip
                                            type={tour.badge ?? null}
                                            className='shrink-0'
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Entry point ───────────────────────────────────────────────────────────────

interface CollectionToursManagerProps {
    collectionId: string;
}

export function CollectionToursManager({
    collectionId,
}: CollectionToursManagerProps) {
    const { data: collection, isLoading: loadingCollection } =
        useCollection(collectionId);
    const { data: members, isLoading: loadingMembers } =
        useCollectionToursForEdit(collectionId);

    if (loadingCollection || loadingMembers) {
        return (
            <div className='space-y-3'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className='h-28 w-full rounded-none' />
                ))}
            </div>
        );
    }

    if (collection && collection.collectionType !== 'MANUAL') {
        return <DynamicToursPreview collectionId={collectionId} />;
    }

    return (
        <ManualToursEditor
            collectionId={collectionId}
            destinationId={collection?.destinationId ?? ''}
            members={members ?? []}
        />
    );
}

