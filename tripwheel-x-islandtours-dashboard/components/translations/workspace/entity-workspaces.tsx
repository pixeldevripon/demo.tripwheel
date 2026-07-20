'use client';

/**
 * Per-entity workspace wrappers: each calls ITS OWN hooks (fixed hook order -
 * hooks cannot branch on entity type) and renders the shared ContentWorkspace.
 *
 * FULL coverage per entity (user mandate: no per-locale field left behind):
 * - all four: core translation fields + PAGE CONTENT (aboutText/meta) + FAQs
 * - collection: + per-tour rationales (per-item upsert)
 * - hub: our-picks, comparison and page-sections translations are handled
 *   by their entity-page managers (user decision 2026-07-17) - they save via
 *   wholesale replace endpoints that belong with their structure editors.
 *
 * Payload notes: the 4 translation upserts use the wrapped-fields pattern
 * `{ fields: {...} }` ('' → null clears); page content is a flat partial.
 * Destination's hooks have GENERIC names (useUpsertTranslation /
 * useUpsertPageContent) - aliased on import.
 */

import { useMemo } from 'react';

import {
    useCategory,
    useCategoryPageContent,
    useCategoryTranslationByLocale,
    useUpsertCategoryPageContent,
    useUpsertCategoryTranslation,
} from '@/hooks/categories/use-categories';
import {
    useCollection,
    useCollectionPageContent,
    useCollectionToursForEdit,
    useCollectionTranslationByLocale,
    useUpsertCollectionPageContent,
    useUpsertCollectionTourRationale,
    useUpsertCollectionTranslation,
} from '@/hooks/collections/use-collections';
import {
    useDestination,
    useDestinationPageContent,
    useDestinationTranslationByLocale,
    useUpsertPageContent as useUpsertDestinationPageContent,
    useUpsertTranslation as useUpsertDestinationTranslation,
} from '@/hooks/destinations/use-destinations';
import {
    useHub,
    useHubPageContent,
    useHubTranslationByLocale,
    useUpsertHubPageContent,
    useUpsertHubTranslation,
} from '@/hooks/hubs/use-hubs';
import {
    useHomePageTranslations,
    useUpsertHomePageTranslation,
} from '@/hooks/home-page/use-home-page';
import { HOME_ID } from '@/lib/api/home-page';
import { type Locale } from '@/lib/constants/locales';
import {
    CATEGORY_FIELDS,
    COLLECTION_FIELDS,
    DESTINATION_FIELDS,
    HOMEPAGE_FIELDS,
    HUB_FIELDS,
} from '@/lib/translatable-schema';
import { ContentWorkspace, type ExtraSection } from './content-workspace';

function toFields(values: Record<string, string>) {
    const fields: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(values)) {
        fields[k] = v.trim() ? v.trim() : null;
    }
    return fields;
}

function toPageContent(values: Record<string, string>) {
    return {
        aboutText: values.aboutText?.trim() || null,
        metaTitle: values.metaTitle?.trim() || null,
        metaDescription: values.metaDescription?.trim() || null,
    };
}

/**
 * The homepage singleton. Two differences from every other workspace:
 * its records come from ONE list endpoint (there is one row, so per-locale
 * fetches would be three calls for the same payload), and it passes no
 * page-content props because the homepage has no About/SEO body of its own.
 */
export function HomepageWorkspace({ locale }: { locale: Locale }) {
    const { data: translations, isLoading } = useHomePageTranslations();
    const upsert = useUpsertHomePageTranslation();

    const source = useMemo(
        () => translations?.find(t => t.locale === 'en'),
        [translations],
    );
    const target = useMemo(
        () => translations?.find(t => t.locale === locale),
        [translations, locale],
    );

    return (
        <ContentWorkspace
            type='homepage'
            id={HOME_ID}
            locale={locale}
            faqBasePath='/home-page'
            fields={HOMEPAGE_FIELDS}
            entityName='Homepage'
            source={source as never}
            target={target as never}
            isLoading={isLoading}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={upsert.isPending}
            onSave={values =>
                upsert.mutateAsync({
                    locale,
                    payload: { fields: toFields(values) },
                })
            }
        />
    );
}

export function DestinationWorkspace({ id, locale }: { id: string; locale: Locale }) {
    const { data: entity, isLoading: l1 } = useDestination(id);
    const { data: source, isLoading: l2 } = useDestinationTranslationByLocale(id, 'en');
    const { data: target, isLoading: l3 } = useDestinationTranslationByLocale(id, locale);
    const { data: pageSource } = useDestinationPageContent(id, 'en');
    const { data: pageTarget } = useDestinationPageContent(id, locale);
    const upsert = useUpsertDestinationTranslation();
    const upsertPage = useUpsertDestinationPageContent();

    return (
        <ContentWorkspace
            type='destination'
            id={id}
            locale={locale}
            faqBasePath='/destinations'
            fields={DESTINATION_FIELDS}
            entityName={entity?.name}
            source={source as never}
            target={target as never}
            pageSource={pageSource as never}
            pageTarget={pageTarget as never}
            isLoading={l1 || l2 || (locale !== 'en' && l3)}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={upsert.isPending || upsertPage.isPending}
            onSave={values =>
                upsert.mutateAsync({ id, locale, payload: { fields: toFields(values) } })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
        />
    );
}

export function CategoryWorkspace({ id, locale }: { id: string; locale: Locale }) {
    const { data: entity, isLoading: l1 } = useCategory(id);
    const { data: source, isLoading: l2 } = useCategoryTranslationByLocale(id, 'en');
    const { data: target, isLoading: l3 } = useCategoryTranslationByLocale(id, locale);
    const { data: pageSource } = useCategoryPageContent(id, 'en');
    const { data: pageTarget } = useCategoryPageContent(id, locale);
    const upsert = useUpsertCategoryTranslation();
    const upsertPage = useUpsertCategoryPageContent();

    return (
        <ContentWorkspace
            type='category'
            id={id}
            locale={locale}
            faqBasePath='/categories'
            fields={CATEGORY_FIELDS}
            entityName={entity?.name}
            source={source as never}
            target={target as never}
            pageSource={pageSource as never}
            pageTarget={pageTarget as never}
            isLoading={l1 || l2 || (locale !== 'en' && l3)}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={upsert.isPending || upsertPage.isPending}
            onSave={values =>
                upsert.mutateAsync({ id, locale, payload: { fields: toFields(values) } })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
        />
    );
}

export function HubWorkspace({ id, locale }: { id: string; locale: Locale }) {
    const { data: entity, isLoading: l1 } = useHub(id);
    const { data: source, isLoading: l2 } = useHubTranslationByLocale(id, 'en');
    const { data: target, isLoading: l3 } = useHubTranslationByLocale(id, locale);
    const { data: pageSource } = useHubPageContent(id, 'en');
    const { data: pageTarget } = useHubPageContent(id, locale);
    const upsert = useUpsertHubTranslation();
    const upsertPage = useUpsertHubPageContent();


    return (
        <ContentWorkspace
            type='hub'
            id={id}
            locale={locale}
            faqBasePath='/hubs'
            fields={HUB_FIELDS}
            entityName={entity?.name}
            source={source as never}
            target={target as never}
            pageSource={pageSource as never}
            pageTarget={pageTarget as never}
            isLoading={l1 || l2 || (locale !== 'en' && l3)}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={upsert.isPending || upsertPage.isPending}
            onSave={values =>
                upsert.mutateAsync({ id, locale, payload: { fields: toFields(values) } })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
        />
    );
}

export function CollectionWorkspace({ id, locale }: { id: string; locale: Locale }) {
    const { data: entity, isLoading: l1 } = useCollection(id);
    const { data: source, isLoading: l2 } = useCollectionTranslationByLocale(id, 'en');
    const { data: target, isLoading: l3 } = useCollectionTranslationByLocale(id, locale);
    const { data: pageSource } = useCollectionPageContent(id, 'en');
    const { data: pageTarget } = useCollectionPageContent(id, locale);
    const { data: tours } = useCollectionToursForEdit(id);
    const upsert = useUpsertCollectionTranslation();
    const upsertPage = useUpsertCollectionPageContent();
    const upsertRationale = useUpsertCollectionTourRationale();

    const extraSections = useMemo<ExtraSection[]>(() => {
        if (!tours || tours.length === 0) return [];
        return [
            {
                key: 'tour-rationales',
                label: 'Tour rationales',
                rows: tours.map(t => ({
                    itemId: t.tourId,
                    fieldKey: 'rationale',
                    label: t.name ?? t.tourId,
                    source: t.rationales.en ?? '',
                    existing: t.rationales[locale] ?? '',
                    kind: 'textarea' as const,
                })),
                save: async changes => {
                    const results = await Promise.allSettled(
                        changes
                            .filter(c => c.value)
                            .map(c =>
                                upsertRationale.mutateAsync({
                                    id,
                                    tourId: c.itemId,
                                    locale,
                                    payload: { rationale: c.value },
                                }),
                            ),
                    );
                    const failed = results.filter(r => r.status === 'rejected');
                    if (failed.length > 0)
                        throw new Error(
                            `${failed.length} rationale(s) failed to save`,
                        );
                    return results;
                },
            },
        ];
    }, [tours, locale, id, upsertRationale]);

    return (
        <ContentWorkspace
            type='collection'
            id={id}
            locale={locale}
            faqBasePath='/collections'
            fields={COLLECTION_FIELDS}
            entityName={entity?.name}
            source={source as never}
            target={target as never}
            pageSource={pageSource as never}
            pageTarget={pageTarget as never}
            extraSections={extraSections}
            isLoading={l1 || l2 || (locale !== 'en' && l3)}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={
                upsert.isPending ||
                upsertPage.isPending ||
                upsertRationale.isPending
            }
            onSave={values =>
                upsert.mutateAsync({ id, locale, payload: { fields: toFields(values) } })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
        />
    );
}
