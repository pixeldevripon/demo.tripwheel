'use client';

/**
 * English content editor - lives INSIDE each entity's edit page (user rule
 * 2026-07-17: "every entity's English content must stay in the entity page;
 * only translation to other locales happens in the Translation Console").
 *
 * Edits the EN translation record's core fields, one save. `name` is managed
 * in the Details tab for the content entities (the long-standing rule) and
 * rendered disabled here. Page content (about/meta) and FAQs keep their own
 * per-locale editors on the entity page; tour SEO meta stays in the SEO tab.
 * EN clearing upserts nulls - EN is never deleted (backend rule).
 */

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    useCategoryTranslationByLocale,
    useUpsertCategoryTranslation,
} from '@/hooks/categories/use-categories';
import {
    useCollectionTranslationByLocale,
    useUpsertCollectionTranslation,
} from '@/hooks/collections/use-collections';
import {
    useDestinationTranslationByLocale,
    useUpsertTranslation as useUpsertDestinationTranslation,
} from '@/hooks/destinations/use-destinations';
import {
    useHubTranslationByLocale,
    useUpsertHubTranslation,
} from '@/hooks/hubs/use-hubs';
import {
    useTripTranslationByLocale,
    useUpsertTripTranslation,
} from '@/hooks/trips/use-trips';
import {
    CATEGORY_FIELDS,
    COLLECTION_FIELDS,
    DESTINATION_FIELDS,
    HUB_FIELDS,
    TOUR_FIELDS,
    type TranslatableEntityType,
    type TranslatableFieldDef,
} from '@/lib/translatable-schema';

function toFormValue(v: unknown): string {
    if (Array.isArray(v)) return v.join('\n');
    return typeof v === 'string' ? v : '';
}

/* ── Generic single-column EN form ───────────────────────────────────────── */

interface EnglishContentFormProps {
    fields: TranslatableFieldDef[];
    record: Record<string, unknown> | undefined;
    isLoading: boolean;
    isSaving: boolean;
    /** Field names rendered disabled (managed elsewhere). */
    disabledFields?: string[];
    onSave: (values: Record<string, string>) => void;
}

function EnglishContentForm({
    fields,
    record,
    isLoading,
    isSaving,
    disabledFields = [],
    onSave,
}: EnglishContentFormProps) {
    const defaults = useMemo(() => {
        const d: Record<string, string> = {};
        for (const f of fields) d[f.name] = toFormValue(record?.[f.name]);
        return d;
    }, [fields, record]);

    const {
        register,
        handleSubmit,
        reset,
        formState: { isDirty },
    } = useForm<Record<string, string>>({ defaultValues: defaults });

    useEffect(() => {
        reset(defaults);
    }, [defaults, reset]);

    if (isLoading) {
        return (
            <div className='space-y-4'>
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className='h-16 w-full' />
                ))}
            </div>
        );
    }

    return (
        <form
            onSubmit={handleSubmit(onSave)}
            className='space-y-5'>
            {fields.map(f => {
                const disabled = disabledFields.includes(f.name);
                return (
                    <Field key={f.name}>
                        <Label htmlFor={`en-${f.name}`}>{f.label}</Label>
                        {f.kind === 'input' ? (
                            <Input
                                id={`en-${f.name}`}
                                maxLength={f.maxLength}
                                disabled={disabled}
                                {...register(f.name)}
                            />
                        ) : (
                            <Textarea
                                id={`en-${f.name}`}
                                rows={f.rows ?? 3}
                                maxLength={f.maxLength}
                                disabled={disabled}
                                {...register(f.name)}
                            />
                        )}
                        {disabled ? (
                            <FieldDescription>
                                Managed in the Details tab.
                            </FieldDescription>
                        ) : (
                            f.description && (
                                <FieldDescription>
                                    {f.description}
                                </FieldDescription>
                            )
                        )}
                    </Field>
                );
            })}
            <div className='flex justify-end border-t border-line pt-4'>
                <Button type='submit' disabled={isSaving || !isDirty}>
                    {isSaving ? 'Saving...' : 'Save English Content'}
                </Button>
            </div>
        </form>
    );
}

/* ── Per-entity wrappers (fixed hook order) ──────────────────────────────── */

const LINES_FIELDS = new Set(
    TOUR_FIELDS.filter(f => f.kind === 'lines').map(f => f.name),
);

/** Tour body copy; SEO meta stays in the SEO tab (its own per-locale panel). */
const TOUR_EN_FIELDS = TOUR_FIELDS.filter(
    f => f.name !== 'metaTitle' && f.name !== 'metaDescription',
);

const saveToasts = {
    onSuccess: () => toast.success('English content saved.'),
    onError: (err: unknown) =>
        toast.error(
            err instanceof Error ? err.message : 'Failed to save English content.',
        ),
};

function TourEnglishContent({ id }: { id: string }) {
    const { data, isLoading } = useTripTranslationByLocale(id, 'en');
    const upsert = useUpsertTripTranslation();
    return (
        <EnglishContentForm
            fields={TOUR_EN_FIELDS}
            record={data as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            onSave={values => {
                const payload: Record<string, unknown> = {};
                for (const f of TOUR_EN_FIELDS) {
                    const raw = (values[f.name] ?? '').trim();
                    if (LINES_FIELDS.has(f.name)) {
                        payload[f.name] = raw
                            ? raw.split('\n').map(l => l.trim()).filter(Boolean)
                            : [];
                    } else {
                        payload[f.name] = raw || null;
                    }
                }
                upsert.mutate(
                    { tripId: id, locale: 'en', payload } as never,
                    saveToasts,
                );
            }}
        />
    );
}

function contentFields(values: Record<string, string>) {
    const fields: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(values)) {
        fields[k] = v.trim() ? v.trim() : null;
    }
    delete fields.name; // managed in Details, never written from here
    return fields;
}

function DestinationEnglishContent({ id }: { id: string }) {
    const { data, isLoading } = useDestinationTranslationByLocale(id, 'en');
    const upsert = useUpsertDestinationTranslation();
    return (
        <EnglishContentForm
            fields={DESTINATION_FIELDS}
            record={data as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            disabledFields={['name']}
            onSave={values =>
                upsert.mutate(
                    { id, locale: 'en', payload: { fields: contentFields(values) } },
                    saveToasts,
                )
            }
        />
    );
}

function CategoryEnglishContent({ id }: { id: string }) {
    const { data, isLoading } = useCategoryTranslationByLocale(id, 'en');
    const upsert = useUpsertCategoryTranslation();
    return (
        <EnglishContentForm
            fields={CATEGORY_FIELDS}
            record={data as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            disabledFields={['name']}
            onSave={values =>
                upsert.mutate(
                    { id, locale: 'en', payload: { fields: contentFields(values) } },
                    saveToasts,
                )
            }
        />
    );
}

function HubEnglishContent({ id }: { id: string }) {
    const { data, isLoading } = useHubTranslationByLocale(id, 'en');
    const upsert = useUpsertHubTranslation();
    return (
        <EnglishContentForm
            fields={HUB_FIELDS}
            record={data as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            disabledFields={['name']}
            onSave={values =>
                upsert.mutate(
                    { id, locale: 'en', payload: { fields: contentFields(values) } },
                    saveToasts,
                )
            }
        />
    );
}

function CollectionEnglishContent({ id }: { id: string }) {
    const { data, isLoading } = useCollectionTranslationByLocale(id, 'en');
    const upsert = useUpsertCollectionTranslation();
    return (
        <EnglishContentForm
            fields={COLLECTION_FIELDS}
            record={data as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            disabledFields={['name']}
            onSave={values =>
                upsert.mutate(
                    { id, locale: 'en', payload: { fields: contentFields(values) } },
                    saveToasts,
                )
            }
        />
    );
}

/* ── The switch ──────────────────────────────────────────────────────────── */

export function EnglishContentEditor({
    type,
    id,
}: {
    type: TranslatableEntityType;
    id: string;
}) {
    return (
        <Card>
            <CardHeader className='border-b pb-4'>
                <CardTitle className='font-sans text-base'>
                    English content
                </CardTitle>
                <CardDescription>
                    The source every other language translates from. Required
                    publish fields (like the tour overview) live here.
                </CardDescription>
            </CardHeader>
            <CardContent className='pt-5'>
                {type === 'tour' && <TourEnglishContent id={id} />}
                {type === 'destination' && <DestinationEnglishContent id={id} />}
                {type === 'category' && <CategoryEnglishContent id={id} />}
                {type === 'hub' && <HubEnglishContent id={id} />}
                {type === 'collection' && <CollectionEnglishContent id={id} />}
            </CardContent>
        </Card>
    );
}
