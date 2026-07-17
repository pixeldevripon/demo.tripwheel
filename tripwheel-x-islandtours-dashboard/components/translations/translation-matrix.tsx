'use client';

/**
 * Translation matrix (04 §3.2 B, Phase 17) - answers the question that used
 * to be unanswerable: "which entities are ready for which market?"
 *
 * One row per entity, one cell per locale, computed from the entity's
 * list-all-locales translation endpoint via the translatable-schema registry.
 * Click a cell → the workspace for that entity + locale.
 *
 * Uses ONLY existing hooks: the per-type list hooks for rows, and each row
 * lazily fetches its own translations (react-query caches per entity, so
 * revisits are free).
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRole } from '@/contexts/role-context';
import { useCategories, useCategoryTranslations } from '@/hooks/categories/use-categories';
import {
    useCollectionsByDestination,
    useCollectionTranslations,
} from '@/hooks/collections/use-collections';
import {
    useActiveDestinations,
    useDestinations,
    useDestinationTranslations,
} from '@/hooks/destinations/use-destinations';
import { useHubs, useHubTranslations } from '@/hooks/hubs/use-hubs';
import { useAdminTrips, useMyTrips, useTripTranslations } from '@/hooks/trips/use-trips';
import { ALL_LOCALES, localeFlag, LOCALE_LABELS } from '@/lib/constants/locales';
import {
    ENTITY_FIELDS,
    ENTITY_TYPE_LABELS,
    TRANSLATABLE_ENTITY_TYPES,
    type TranslatableEntityType,
} from '@/lib/translatable-schema';

const PAGE_LIMIT = 20;

import { Button } from '@/components/ui/button';
import { LocaleCells } from './locale-cells';

/* ── Row shells: each row owns its lazy translations query ─────────────── */

function MatrixRow({
    type,
    id,
    name,
    subtitle,
    records,
    isLoading,
}: {
    type: TranslatableEntityType;
    id: string;
    name: string;
    subtitle?: string | null;
    records: Array<Record<string, unknown> & { locale: string }> | undefined;
    isLoading: boolean;
}) {
    return (
        <tr className='border-b border-line last:border-0 hover:bg-surface-sunken/50 transition-colors duration-fast'>
            <td className='px-4 py-3'>
                <Link
                    href={`/translations/${type}/${id}/es`}
                    className='group/name block'
                    title='Open the translation workspace'>
                    <p className='max-w-72 truncate text-sm font-medium text-content underline-offset-4 transition-colors duration-fast group-hover/name:text-primary group-hover/name:underline'>
                        {name}
                    </p>
                    {subtitle && (
                        <p className='max-w-72 truncate text-xs text-content-muted'>
                            {subtitle}
                        </p>
                    )}
                </Link>
            </td>
            <LocaleCells
                type={type}
                id={id}
                fields={ENTITY_FIELDS[type]}
                records={records}
                isLoading={isLoading}
            />
        </tr>
    );
}

function TourRow({ id, name, subtitle }: { id: string; name: string; subtitle?: string | null }) {
    const { data, isLoading } = useTripTranslations(id);
    return (
        <MatrixRow
            type='tour'
            id={id}
            name={name}
            subtitle={subtitle}
            records={data as never}
            isLoading={isLoading}
        />
    );
}

function DestinationRow({ id, name }: { id: string; name: string }) {
    const { data, isLoading } = useDestinationTranslations(id);
    return (
        <MatrixRow type='destination' id={id} name={name} records={data as never} isLoading={isLoading} />
    );
}

function HubRow({ id, name }: { id: string; name: string }) {
    const { data, isLoading } = useHubTranslations(id);
    return <MatrixRow type='hub' id={id} name={name} records={data as never} isLoading={isLoading} />;
}

function CategoryRow({ id, name }: { id: string; name: string }) {
    const { data, isLoading } = useCategoryTranslations(id);
    return (
        <MatrixRow type='category' id={id} name={name} records={data as never} isLoading={isLoading} />
    );
}

function CollectionRow({ id, name }: { id: string; name: string }) {
    const { data, isLoading } = useCollectionTranslations(id);
    return (
        <MatrixRow type='collection' id={id} name={name} records={data as never} isLoading={isLoading} />
    );
}

/* ── Per-type bodies (fixed hook order inside each) ─────────────────────── */

function ToursBody({ search, page, onTotal }: { search: string; page: number; onTotal: (t: number) => void }) {
    const { can } = useRole();
    const isAdmin = can('MANAGE_OPERATORS');
    const params = { search: search || undefined, page, limit: PAGE_LIMIT };
    const admin = useAdminTrips(params, isAdmin);
    const mine = useMyTrips(params, !isAdmin);
    const q = isAdmin ? admin : mine;
    const total = q.data?.total;
    useEffect(() => {
        if (total != null) onTotal(total);
    }, [total, onTotal]);
    return (
        <>
            {(q.data?.data ?? []).map(t => (
                <TourRow key={t.id} id={t.id} name={t.name} subtitle={t.destinationName ?? null} />
            ))}
            {q.isLoading && <SkeletonRows />}
            {!q.isLoading && (q.data?.data ?? []).length === 0 && <EmptyRow label='No tours found.' />}
        </>
    );
}

function DestinationsBody({ page, onTotal }: { page: number; onTotal: (t: number) => void }) {
    const q = useDestinations({ page, limit: PAGE_LIMIT });
    const total = q.data?.total;
    useEffect(() => {
        if (total != null) onTotal(total);
    }, [total, onTotal]);
    return (
        <>
            {(q.data?.data ?? []).map(d => (
                <DestinationRow key={d.id} id={d.id} name={d.name} />
            ))}
            {q.isLoading && <SkeletonRows />}
            {!q.isLoading && (q.data?.data ?? []).length === 0 && <EmptyRow label='No destinations found.' />}
        </>
    );
}

function HubsBody({ page, onTotal }: { page: number; onTotal: (t: number) => void }) {
    const q = useHubs({ page, limit: PAGE_LIMIT });
    const total = q.data?.total;
    useEffect(() => {
        if (total != null) onTotal(total);
    }, [total, onTotal]);
    return (
        <>
            {(q.data?.data ?? []).map(h => (
                <HubRow key={h.id} id={h.id} name={h.name} />
            ))}
            {q.isLoading && <SkeletonRows />}
            {!q.isLoading && (q.data?.data ?? []).length === 0 && <EmptyRow label='No hubs found.' />}
        </>
    );
}

function CategoriesBody({ page, onTotal }: { page: number; onTotal: (t: number) => void }) {
    const q = useCategories({ page, limit: PAGE_LIMIT });
    const total = q.data?.total;
    useEffect(() => {
        if (total != null) onTotal(total);
    }, [total, onTotal]);
    return (
        <>
            {(q.data?.data ?? []).map(c => (
                <CategoryRow key={c.id} id={c.id} name={c.name} />
            ))}
            {q.isLoading && <SkeletonRows />}
            {!q.isLoading && (q.data?.data ?? []).length === 0 && <EmptyRow label='No categories found.' />}
        </>
    );
}

function CollectionsBody({ destinationSlug }: { destinationSlug: string | undefined }) {
    const q = useCollectionsByDestination(destinationSlug);
    return (
        <>
            {(q.data ?? []).map(c => (
                <CollectionRow key={c.id} id={c.id} name={c.name} />
            ))}
            {destinationSlug && q.isLoading && <SkeletonRows />}
            {!destinationSlug && (
                <EmptyRow label='Pick a destination to list its collections.' />
            )}
            {destinationSlug && !q.isLoading && (q.data ?? []).length === 0 && (
                <EmptyRow label='No collections for this destination.' />
            )}
        </>
    );
}

function SkeletonRows() {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className='border-b border-line last:border-0'>
                    <td className='px-4 py-3' aria-label='Loading'>
                        <div className='h-4 w-48 animate-pulse rounded bg-surface-inset' />
                    </td>
                    {ALL_LOCALES.map(l => (
                        <td key={l} className='px-2 py-3 text-center' aria-label='Loading'>
                            <div className='mx-auto size-5 animate-pulse rounded-full bg-surface-inset' />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}

function EmptyRow({ label }: { label: string }) {
    return (
        <tr>
            <td
                colSpan={1 + ALL_LOCALES.length}
                className='px-4 py-8 text-center text-sm text-content-muted'>
                {label}
            </td>
        </tr>
    );
}

/* ── The matrix shell ────────────────────────────────────────────────────── */

export function TranslationMatrix() {
    const [type, setType] = useState<TranslatableEntityType>('tour');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [destinationSlug, setDestinationSlug] = useState<string | undefined>();

    const { data: destinations } = useActiveDestinations();

    function switchType(t: string) {
        setType(t as TranslatableEntityType);
        setPage(1);
        setTotal(0);
        setSearch('');
    }

    const paginated = type !== 'collection';

    return (
        <div className='space-y-4'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <Tabs value={type} onValueChange={switchType}>
                    <TabsList>
                        {TRANSLATABLE_ENTITY_TYPES.map(t => (
                            <TabsTrigger key={t} value={t}>
                                {ENTITY_TYPE_LABELS[t]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className='flex items-center gap-2'>
                    {type === 'tour' && (
                        <Input
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder='Search tours…'
                            className='h-9 w-56'
                        />
                    )}
                    {type === 'collection' && (
                        <Select
                            value={destinationSlug ?? ''}
                            onValueChange={v => setDestinationSlug(v)}>
                            <SelectTrigger size='sm' className='w-52'>
                                <SelectValue placeholder='Select a destination…' />
                            </SelectTrigger>
                            <SelectContent>
                                {(destinations ?? []).map(d => (
                                    <SelectItem key={d.id} value={d.slug}>
                                        {d.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <div className='overflow-hidden rounded-lg border border-line bg-surface-raised'>
                <div className='scrollbar-thin overflow-x-auto'>
                    <table className='w-full caption-bottom text-sm'>
                        <thead>
                            <tr className='border-b border-line bg-surface-sunken/60'>
                                <th className='px-4 py-2.5 text-left text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                                    {ENTITY_TYPE_LABELS[type].replace(/s$/, '')}
                                </th>
                                {ALL_LOCALES.map(locale => (
                                    <th
                                        key={locale}
                                        className='px-2 py-2.5 text-center text-2xs font-semibold tracking-caps uppercase text-content-subtle'>
                                        <span className='inline-flex items-center gap-1'>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={localeFlag(locale)}
                                                alt=''
                                                aria-hidden
                                                className='size-3.5 rounded-full'
                                            />
                                            {locale.toUpperCase()}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {type === 'tour' && (
                                <ToursBody search={search} page={page} onTotal={setTotal} />
                            )}
                            {type === 'destination' && (
                                <DestinationsBody page={page} onTotal={setTotal} />
                            )}
                            {type === 'hub' && <HubsBody page={page} onTotal={setTotal} />}
                            {type === 'category' && (
                                <CategoriesBody page={page} onTotal={setTotal} />
                            )}
                            {type === 'collection' && (
                                <CollectionsBody destinationSlug={destinationSlug} />
                            )}
                        </tbody>
                    </table>
                </div>
                {paginated && total > PAGE_LIMIT && (
                    <div className='flex items-center justify-between border-t border-line px-4 py-2'>
                        <p className='text-xs text-content-muted'>
                            Page {page} of {Math.max(1, Math.ceil(total / PAGE_LIMIT))}
                        </p>
                        <div className='flex gap-2'>
                            <Button
                                variant='outline'
                                size='sm'
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}>
                                Previous
                            </Button>
                            <Button
                                variant='outline'
                                size='sm'
                                disabled={page >= Math.ceil(total / PAGE_LIMIT)}
                                onClick={() => setPage(p => p + 1)}>
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <p className='text-xs text-content-muted'>
                A cell shows how many of the entity&apos;s core fields are
                translated for that language. Click any cell to open the
                side-by-side workspace. {LOCALE_LABELS.en} is the source
                language.
            </p>
        </div>
    );
}
