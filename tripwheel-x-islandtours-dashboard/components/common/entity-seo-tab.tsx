'use client';

/**
 * EntitySeoTab (Phase 19) - ONE SEO tab where there were four ~350-line
 * forks with a ~10-line real diff (title formula + SERP crumb). Structure:
 *
 * - Search Engine Listing: per-locale meta title/description stored on the
 *   entity's PAGE CONTENT record; ENGLISH is edited here (partial upsert,
 *   backend merges) and the other locales live in the Translation Console.
 *   Suggestions derive from the entity's (translated) name/overview with a
 *   Regenerate affordance and a live SERP preview.
 * - Social Sharing: the entity-level OG image via the entity update.
 *
 * Per-entity wrappers at the bottom wire their own hooks (fixed hook order)
 * and keep the original export names, so edit views only changed an import.
 *
 * The homepage joined later and bends one thing: it has no page-content record,
 * so its meta lives on the translation row and its suggestions come from the
 * site-wide Settings defaults. Everything an admin sees is identical.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ImageSelectorField } from '@/components/common/image-selector-field';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
    useCategoryPageContent,
    useCategoryTranslationByLocale,
    useUpdateCategory,
    useUpsertCategoryPageContent,
} from '@/hooks/categories/use-categories';
import {
    useCollectionPageContent,
    useCollectionTranslationByLocale,
    useUpdateCollection,
    useUpsertCollectionPageContent,
} from '@/hooks/collections/use-collections';
import {
    useDestinationPageContent,
    useDestinationTranslationByLocale,
    useUpdateDestination,
    useUpsertPageContent as useUpsertDestinationPageContent,
} from '@/hooks/destinations/use-destinations';
import {
    useHomePageTranslations,
    useUpdateHomePage,
    useUpsertHomePageTranslation,
} from '@/hooks/home-page/use-home-page';
import {
    useHubPageContent,
    useHubTranslationByLocale,
    useUpdateHub,
    useUpsertHubPageContent,
} from '@/hooks/hubs/use-hubs';
import { useSeo, useSiteInfo } from '@/hooks/settings/use-settings';
import { HOME_ID } from '@/lib/api/home-page';
import { LOCALE_LABELS } from '@/lib/constants/locales';
import type { TranslatableEntityType } from '@/lib/translatable-schema';
import type { CategoryDetail } from '@/types/category';
import type { Collection } from '@/types/collection';
import type { DestinationDetail } from '@/types/destination';
import type { HomePageContent } from '@/types/home-page';
import type { HubDetail } from '@/types/hub';

// Recommended search-engine limits (soft caps).
const META_TITLE_MAX = 70;
const META_DESC_MAX = 170;

function collapse(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    const slice = text.slice(0, max - 1);
    const lastSpace = slice.lastIndexOf(' ');
    const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
    return `${cut.replace(/[\s.,;:-]+$/, '')}...`;
}

const metaSchema = z.object({
    metaTitle: z.string().max(META_TITLE_MAX).optional().or(z.literal('')),
    metaDescription: z.string().max(META_DESC_MAX).optional().or(z.literal('')),
});
type MetaValues = z.infer<typeof metaSchema>;

function CharCount({ value, max }: { value: string; max: number }) {
    const len = value.length;
    const over = len > max;
    return (
        <span
            className={`text-xs tabular-nums ${over ? 'text-danger-fg' : 'text-content-muted'}`}>
            {len}/{max}
        </span>
    );
}

/** The ~10 lines that actually differ per entity. */
interface SeoConfig {
    consoleType: TranslatableEntityType;
    /** SERP crumb, e.g. s => `islandtours.com › ${s}` */
    crumb: (slug: string) => string;
    /** Suggested meta-title formula. */
    suggestTitle: (name: string) => string;
    /** SERP fallback title when the field is empty. */
    fallbackTitle: (name: string) => string;
    /** FieldDescription noun ("destination name" etc.). */
    nameNoun: string;
    /** What an empty OG image falls back to. Defaults to the hero image. */
    ogFallbackNote?: string;
    /** Where the suggestions come from, when it is not name + overview. */
    metaSourceNote?: string;
}

function SerpPreview({
    title,
    description,
    name,
    slug,
    config,
}: {
    title: string;
    description: string;
    name: string;
    slug: string;
    config: SeoConfig;
}) {
    return (
        <div className='space-y-1 rounded-md border border-line bg-surface-sunken/60 px-4 py-3'>
            <p className='text-xs font-semibold text-content-muted'>
                Search preview
            </p>
            <p className='truncate text-sm text-success-fg'>
                {config.crumb(slug)}
            </p>
            <p className='truncate text-lg text-info-fg'>
                {title || config.fallbackTitle(name)}
            </p>
            <p className='line-clamp-2 text-sm text-content-muted'>
                {description ||
                    'Your meta description preview shows here. Keep it compelling and under the character limit.'}
            </p>
        </div>
    );
}

/* ── Generic view: entity data in, save callbacks out ────────────────────── */

interface EntitySeoViewProps {
    id: string;
    name: string;
    slug: string;
    ogImage: string | null;
    /** EN overview fallback from the entity record itself. */
    overviewFallback: string;
    config: SeoConfig;
    content: { metaTitle: string | null; metaDescription: string | null } | undefined;
    contentLoading: boolean;
    translation: { name?: string | null; overview?: string | null } | undefined;
    onSaveMeta: (v: { metaTitle: string | null; metaDescription: string | null }) => void;
    metaSaving: boolean;
    onSaveOg: (ogImage: string | null) => void;
    ogSaving: boolean;
}

function EntitySeoView({
    id,
    name,
    slug,
    ogImage,
    overviewFallback,
    config,
    content,
    contentLoading,
    translation,
    onSaveMeta,
    metaSaving,
    onSaveOg,
    ogSaving,
}: EntitySeoViewProps) {
    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<MetaValues>({
        resolver: zodResolver(metaSchema),
        defaultValues: { metaTitle: '', metaDescription: '' },
    });

    const socialForm = useForm<{ ogImage: string }>({
        defaultValues: { ogImage: ogImage ?? '' },
    });

    const localizedName = translation?.name || name;
    const localizedOverview = translation?.overview || overviewFallback;

    const suggestedTitle = truncate(
        collapse(config.suggestTitle(localizedName)),
        META_TITLE_MAX,
    );
    const suggestedDescription = truncate(
        collapse(localizedOverview),
        META_DESC_MAX,
    );

    useEffect(() => {
        reset({
            metaTitle: content?.metaTitle ?? suggestedTitle,
            metaDescription: content?.metaDescription ?? suggestedDescription,
        });
        // suggested* derive from content/translation; those are the triggers.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, translation, reset]);

    useEffect(() => {
        socialForm.reset({ ogImage: ogImage ?? '' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ogImage]);

    const metaTitle = watch('metaTitle') ?? '';
    const metaDescription = watch('metaDescription') ?? '';

    return (
        <div className='space-y-6'>
            <Card>
                <CardHeader className='border-b pb-4'>
                    <CardTitle className='text-lg font-semibold'>
                        Search Engine Listing
                    </CardTitle>
                </CardHeader>
                <CardContent className='pt-6'>
                    <div className='mb-6 space-y-0.5 rounded-md bg-surface-sunken px-3 py-2 text-xs text-content-muted'>
                        <p>
                            <span className='font-semibold text-content'>
                                Meta title and description are per-locale.
                            </span>{' '}
                            {config.metaSourceNote ??
                                "They start pre-filled from each language's name and overview."}{' '}
                            English is edited here; other languages live in the
                            Translation Console.
                        </p>
                    </div>

                    {contentLoading ? (
                        <div className='space-y-4'>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className='h-10 w-full' />
                            ))}
                        </div>
                    ) : (
                        <form
                            onSubmit={handleSubmit(v =>
                                onSaveMeta({
                                    metaTitle: v.metaTitle || null,
                                    metaDescription: v.metaDescription || null,
                                }),
                            )}
                            className='space-y-6'>
                            <SerpPreview
                                title={metaTitle}
                                description={metaDescription}
                                name={localizedName}
                                slug={slug}
                                config={config}
                            />

                            <Field>
                                <div className='flex items-center justify-between'>
                                    <Label>Meta Title</Label>
                                    <CharCount value={metaTitle} max={META_TITLE_MAX} />
                                </div>
                                <Input
                                    {...register('metaTitle')}
                                    placeholder='Appears in the browser tab and search results'
                                    aria-invalid={!!errors.metaTitle}
                                />
                                <div className='flex items-center justify-between gap-3'>
                                    <FieldDescription>
                                        Pre-filled from the {config.nameNoun}.
                                        Edit to customize.
                                    </FieldDescription>
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setValue('metaTitle', suggestedTitle, {
                                                shouldDirty: true,
                                            })
                                        }
                                        className='shrink-0 text-xs font-semibold text-primary hover:underline'>
                                        Regenerate
                                    </button>
                                </div>
                                <FieldError>{errors.metaTitle?.message}</FieldError>
                            </Field>

                            <Field>
                                <div className='flex items-center justify-between'>
                                    <Label>Meta Description</Label>
                                    <CharCount
                                        value={metaDescription}
                                        max={META_DESC_MAX}
                                    />
                                </div>
                                <Textarea
                                    {...register('metaDescription')}
                                    rows={3}
                                    placeholder='Search-result snippet'
                                    aria-invalid={!!errors.metaDescription}
                                />
                                <div className='flex items-center justify-between gap-3'>
                                    <FieldDescription>
                                        Pre-filled from the overview. Edit to
                                        customize.
                                    </FieldDescription>
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setValue(
                                                'metaDescription',
                                                suggestedDescription,
                                                { shouldDirty: true },
                                            )
                                        }
                                        className='shrink-0 text-xs font-semibold text-primary hover:underline'>
                                        Regenerate
                                    </button>
                                </div>
                                <FieldError>
                                    {errors.metaDescription?.message}
                                </FieldError>
                            </Field>

                            <div className='flex justify-end pt-2'>
                                <Button type='submit' size='sm' disabled={metaSaving}>
                                    {metaSaving ? 'Saving...' : 'Save SEO'}
                                </Button>
                            </div>
                        </form>
                    )}

                    <p className='mt-4 text-xs text-content-muted'>
                        English only here - translate into the other languages
                        in the{' '}
                        <Link
                            href={`/translations/${config.consoleType}/${id}/es`}
                            className='underline underline-offset-4 hover:text-primary'>
                            Translation Console
                        </Link>
                        .
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className='border-b pb-4'>
                    <CardTitle className='text-lg font-semibold'>
                        Social Sharing
                    </CardTitle>
                </CardHeader>
                <CardContent className='pt-6'>
                    <form
                        onSubmit={socialForm.handleSubmit(v =>
                            onSaveOg(v.ogImage || null),
                        )}
                        className='space-y-6'>
                        <Field>
                            <Label>Social Share Image (OG)</Label>
                            <Controller
                                name='ogImage'
                                control={socialForm.control}
                                render={({ field }) => (
                                    <ImageSelectorField
                                        value={field.value || null}
                                        onChange={url => field.onChange(url ?? '')}
                                    />
                                )}
                            />
                            <FieldDescription>
                                Image shown when shared on social media (the
                                Open Graph image).{' '}
                                {config.ogFallbackNote ??
                                    'Falls back to the hero image when empty.'}
                            </FieldDescription>
                        </Field>
                        <div className='flex justify-end pt-2'>
                            <Button type='submit' disabled={ogSaving}>
                                {ogSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

/* ── Per-entity wrappers (fixed hook order; original export names) ───────── */

const saveToasts = (label: string) => ({
    onSuccess: () => toast.success(label),
    onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Failed to save.'),
});

export function DestinationSeoTab({ destination }: { destination: DestinationDetail }) {
    const { data: content, isLoading } = useDestinationPageContent(destination.id, 'en');
    const { data: translation } = useDestinationTranslationByLocale(destination.id, 'en');
    const upsert = useUpsertDestinationPageContent();
    const update = useUpdateDestination();

    return (
        <EntitySeoView
            id={destination.id}
            name={destination.name}
            slug={destination.slug}
            ogImage={destination.ogImage ?? null}
            overviewFallback={destination.overview ?? ''}
            config={{
                consoleType: 'destination',
                crumb: s => `islandtours.com › ${s || 'destination'}`,
                suggestTitle: n => `${n} Tours & Activities`,
                fallbackTitle: n => `${n || 'Destination'} tours & activities`,
                nameNoun: 'destination name',
            }}
            content={content}
            contentLoading={isLoading}
            translation={translation}
            onSaveMeta={v =>
                upsert.mutate(
                    { id: destination.id, locale: 'en', payload: v },
                    saveToasts(`${LOCALE_LABELS.en} SEO saved.`),
                )
            }
            metaSaving={upsert.isPending}
            onSaveOg={ogImage =>
                update.mutate(
                    { id: destination.id, payload: { ogImage } },
                    saveToasts('Social share image saved.'),
                )
            }
            ogSaving={update.isPending}
        />
    );
}

export function CategorySeoTab({ category }: { category: CategoryDetail }) {
    const { data: content, isLoading } = useCategoryPageContent(category.id, 'en');
    const { data: translation } = useCategoryTranslationByLocale(category.id, 'en');
    const upsert = useUpsertCategoryPageContent();
    const update = useUpdateCategory();

    return (
        <EntitySeoView
            id={category.id}
            name={category.name}
            slug={category.slug}
            ogImage={category.ogImage ?? null}
            overviewFallback={category.overview ?? ''}
            config={{
                consoleType: 'category',
                crumb: s => `islandtours.com › ... › ${s || 'category'}`,
                suggestTitle: n => `${n} | Island Tours`,
                fallbackTitle: n => `${n || 'Category'} Tours & Activities`,
                nameNoun: 'category name',
            }}
            content={content}
            contentLoading={isLoading}
            translation={translation}
            onSaveMeta={v =>
                upsert.mutate(
                    { id: category.id, locale: 'en', payload: v },
                    saveToasts(`${LOCALE_LABELS.en} SEO saved.`),
                )
            }
            metaSaving={upsert.isPending}
            onSaveOg={ogImage =>
                update.mutate(
                    { id: category.id, payload: { ogImage } },
                    saveToasts('Social share image saved.'),
                )
            }
            ogSaving={update.isPending}
        />
    );
}

export function HubSeoTab({ hub }: { hub: HubDetail }) {
    const { data: content, isLoading } = useHubPageContent(hub.id, 'en');
    const { data: translation } = useHubTranslationByLocale(hub.id, 'en');
    const upsert = useUpsertHubPageContent();
    const update = useUpdateHub();

    return (
        <EntitySeoView
            id={hub.id}
            name={hub.name}
            slug={hub.slug}
            ogImage={hub.ogImage ?? null}
            overviewFallback={hub.overview ?? ''}
            config={{
                consoleType: 'hub',
                crumb: s => `islandtours.com › ... › ${s || 'hub'}`,
                suggestTitle: n => `${n} Guide`,
                fallbackTitle: n => `${n || 'Hub'} Guide`,
                nameNoun: 'hub name',
            }}
            content={content}
            contentLoading={isLoading}
            translation={translation}
            onSaveMeta={v =>
                upsert.mutate(
                    { id: hub.id, locale: 'en', payload: v },
                    saveToasts(`${LOCALE_LABELS.en} SEO saved.`),
                )
            }
            metaSaving={upsert.isPending}
            onSaveOg={ogImage =>
                update.mutate(
                    { id: hub.id, payload: { ogImage } },
                    saveToasts('Social share image saved.'),
                )
            }
            ogSaving={update.isPending}
        />
    );
}

/**
 * The homepage singleton.
 *
 * Two structural differences from the content entities, both forced by the fact
 * that the homepage has no entity record of its own:
 * - meta lives on the TRANSLATION record, not a page-content record, so the
 *   same upsert that saves the hero headline saves the meta title;
 * - there is no name or overview to derive suggestions from, so they come from
 *   the site-wide SEO defaults in Settings - which is also exactly what the
 *   public page falls back to when these are left empty.
 */
export function HomepageSeoTab({ content }: { content: HomePageContent }) {
    const { data: translations, isLoading } = useHomePageTranslations();
    const { data: siteInfo } = useSiteInfo();
    const { data: siteSeo } = useSeo();
    const upsert = useUpsertHomePageTranslation();
    const update = useUpdateHomePage();

    const english = translations?.find(t => t.locale === 'en');
    const siteName = siteInfo?.siteName || 'Island Tours';

    return (
        <EntitySeoView
            id={HOME_ID}
            name={siteName}
            slug=''
            ogImage={content.ogImage ?? null}
            overviewFallback={
                siteSeo?.metaDescription || siteInfo?.siteDescription || ''
            }
            config={{
                consoleType: 'homepage',
                crumb: () => 'islandtours.com',
                suggestTitle: n =>
                    siteSeo?.metaTitle ||
                    (siteInfo?.siteTagline ? `${n} - ${siteInfo.siteTagline}` : n),
                fallbackTitle: n => siteSeo?.metaTitle || n,
                nameNoun: 'site-wide defaults in Settings',
                metaSourceNote:
                    'They start pre-filled from the site-wide defaults in Settings, which is also what the live page uses while these are empty.',
                ogFallbackNote:
                    'Falls back to the site-wide share image from Settings when empty.',
            }}
            content={english}
            contentLoading={isLoading}
            translation={undefined}
            onSaveMeta={v =>
                upsert.mutate(
                    { locale: 'en', payload: { fields: v } },
                    saveToasts('Homepage SEO saved.'),
                )
            }
            metaSaving={upsert.isPending}
            onSaveOg={ogImage =>
                update.mutate({ ogImage }, saveToasts('Social share image saved.'))
            }
            ogSaving={update.isPending}
        />
    );
}

export function CollectionSeoTab({ collection }: { collection: Collection }) {
    const { data: content, isLoading } = useCollectionPageContent(collection.id, 'en');
    const { data: translation } = useCollectionTranslationByLocale(collection.id, 'en');
    const upsert = useUpsertCollectionPageContent();
    const update = useUpdateCollection();

    return (
        <EntitySeoView
            id={collection.id}
            name={collection.name}
            slug={collection.slug}
            ogImage={collection.ogImage ?? null}
            // Collection list/detail record carries no overview field; the EN
            // translation is the only overview source (as in the old fork).
            overviewFallback={''}
            config={{
                consoleType: 'collection',
                crumb: s => `islandtours.com › ... › ${s || 'collection'}`,
                suggestTitle: n => `${n} | Island Tours`,
                fallbackTitle: n => `${n || 'Collection'} Tours & Activities`,
                nameNoun: 'collection name',
            }}
            content={content}
            contentLoading={isLoading}
            translation={translation}
            onSaveMeta={v =>
                upsert.mutate(
                    { id: collection.id, locale: 'en', payload: v },
                    saveToasts(`${LOCALE_LABELS.en} SEO saved.`),
                )
            }
            metaSaving={upsert.isPending}
            onSaveOg={ogImage =>
                update.mutate(
                    { id: collection.id, payload: { ogImage } },
                    saveToasts('Social share image saved.'),
                )
            }
            ogSaving={update.isPending}
        />
    );
}
