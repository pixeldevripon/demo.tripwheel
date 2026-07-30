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
    useHomePageTranslations,
    useUpsertHomePageTranslation,
} from '@/hooks/home-page/use-home-page';
import {
    useHotelTranslations,
    useUpsertHotelTranslation,
} from '@/hooks/hotels/use-hotels';
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
    HOMEPAGE_FIELDS,
    HOTEL_FIELDS,
    HUB_FIELDS,
    type TranslatableEntityType,
    type TranslatableFieldDef,
} from '@/lib/translatable-schema';
import {
    buildTourCopyPayload,
    TOUR_COPY_FIELDS,
} from '@/lib/trips/tour-copy';

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
            className='space-y-6'>
            {fields.map(f => {
                const disabled = disabledFields.includes(f.name);
                return (
                    <Field key={f.name}>
                        <Label htmlFor={`en-${f.name}`}>{f.label}</Label>
                        {f.kind === 'input' ? (
                            <Input
                                id={`en-${f.name}`}
                                maxLength={f.maxLength}
                                placeholder={f.placeholder}
                                disabled={disabled}
                                {...register(f.name)}
                            />
                        ) : (
                            <Textarea
                                id={`en-${f.name}`}
                                rows={f.rows ?? 3}
                                maxLength={f.maxLength}
                                placeholder={f.placeholder}
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
            fields={TOUR_COPY_FIELDS}
            record={data as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            // Shared with the wizard's grouped content step so both writers
            // produce byte-identical bodies (lib/trips/tour-copy.ts).
            onSave={values =>
                upsert.mutate(
                    {
                        tripId: id,
                        locale: 'en',
                        payload: buildTourCopyPayload(values),
                    } as never,
                    saveToasts,
                )
            }
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

/**
 * The homepage singleton. Its copy lives on ONE translation record (there is no
 * page-content record), so this single form covers every word on the page.
 *
 * SEO meta is filtered out for the same reason it is on tours: the SEO tab owns
 * it, with the SERP preview and counters that make those two fields legible.
 * `id` is unused - the singleton key is baked into the endpoint - but the
 * signature stays uniform with the other wrappers.
 */
const HOMEPAGE_EN_FIELDS = HOMEPAGE_FIELDS.filter(
    f => f.name !== 'metaTitle' && f.name !== 'metaDescription',
);

function HomepageEnglishContent() {
    const { data, isLoading } = useHomePageTranslations();
    const upsert = useUpsertHomePageTranslation();
    const english = data?.find(t => t.locale === 'en');

    return (
        <EnglishContentForm
            fields={HOMEPAGE_EN_FIELDS}
            record={english as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            onSave={values =>
                upsert.mutate(
                    {
                        locale: 'en',
                        payload: { fields: contentFields(values) },
                    },
                    saveToasts,
                )
            }
        />
    );
}

/**
 * One hotel's English copy. No field filtering, unlike the homepage: HOTEL_FIELDS
 * has no SEO entries to hold back, because the thank-you page it renders on is
 * `noindex` by design.
 */
function HotelEnglishContent({ id }: { id: string }) {
    const { data, isLoading } = useHotelTranslations(id);
    const upsert = useUpsertHotelTranslation(id);
    const english = data?.find(t => t.locale === 'en');

    return (
        <EnglishContentForm
            fields={HOTEL_FIELDS}
            record={english as never}
            isLoading={isLoading}
            isSaving={upsert.isPending}
            onSave={values =>
                upsert.mutate(
                    {
                        locale: 'en',
                        payload: { fields: contentFields(values) },
                    },
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
                    {type === 'homepage'
                        ? 'Every word on the public homepage, in the order the sections appear. Leave a field empty and the site keeps the copy it ships with - shown greyed in the box.'
                        : type === 'hotel'
                          ? 'The words on this hotel\'s card. The name is required: empty it and the hotel stops being promoted. The last two fall back to the label the site ships with, shown greyed in the box.'
                          : 'The source every other language translates from. Required publish fields (like the tour overview) live here.'}
                </CardDescription>
            </CardHeader>
            <CardContent className='pt-6'>
                {type === 'tour' && <TourEnglishContent id={id} />}
                {type === 'destination' && <DestinationEnglishContent id={id} />}
                {type === 'category' && <CategoryEnglishContent id={id} />}
                {type === 'hub' && <HubEnglishContent id={id} />}
                {type === 'collection' && <CollectionEnglishContent id={id} />}
                {type === 'homepage' && <HomepageEnglishContent />}
                {type === 'hotel' && <HotelEnglishContent id={id} />}
            </CardContent>
        </Card>
    );
}
