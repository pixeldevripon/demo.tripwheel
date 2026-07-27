'use client';

/**
 * Per-entity workspace wrappers: each calls ITS OWN hooks (fixed hook order -
 * hooks cannot branch on entity type) and renders the shared ContentWorkspace.
 *
 * FULL coverage per entity (user mandate: no per-locale field left behind):
 * - all four: core translation fields + PAGE CONTENT (aboutText/meta) + FAQs
 * - destination: + About-band content sections (heading/body per section)
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
import {
    usePageContentSections,
    useUpsertPageContentSectionTranslation,
} from '@/hooks/page-content-sections/use-page-content-sections';
import { useGenerateTranslation } from '@/hooks/translations/use-generate-translation';
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
    const generate = useGenerateTranslation('homepage', HOME_ID, locale);

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
                    // A human save always clears the machine flag - otherwise
                    // the AI refresher would later overwrite this row.
                    payload: { fields: toFields(values), isMachineTranslated: false },
                })
            }
            onTranslateWithAI={() => generate.mutate({ force: true })}
            isTranslating={generate.isPending}
        />
    );
}

export function DestinationWorkspace({ id, locale }: { id: string; locale: Locale }) {
    const { data: entity, isLoading: l1 } = useDestination(id);
    const { data: source, isLoading: l2 } = useDestinationTranslationByLocale(id, 'en');
    const { data: target, isLoading: l3 } = useDestinationTranslationByLocale(id, locale);
    const { data: pageSource } = useDestinationPageContent(id, 'en');
    const { data: pageTarget } = useDestinationPageContent(id, locale);
    const { data: sections } = usePageContentSections('/destinations', id);
    const upsert = useUpsertDestinationTranslation();
    const upsertPage = useUpsertDestinationPageContent();
    const upsertSection = useUpsertPageContentSectionTranslation('/destinations', id);
    const generate = useGenerateTranslation('destination', id, locale);

    // The About-band blocks. Two translatable fields per section, and the upsert
    // endpoint replaces the whole locale row, so a heading-only edit still has to
    // send a body - `save` below fills the untouched field from the target row,
    // falling back to English when the locale has no row yet.
    const extraSections = useMemo<ExtraSection[]>(() => {
        if (!sections || sections.length === 0) return [];

        const valueOf = (
            group: (typeof sections)[number],
            loc: Locale,
            field: 'heading' | 'body',
        ) => group.translations.find(t => t.locale === loc)?.[field] ?? '';

        return [
            {
                key: 'about-sections',
                label: 'About sections',
                rows: sections.flatMap(group =>
                    (['heading', 'body'] as const).map(field => ({
                        itemId: group.sectionGroupId,
                        fieldKey: field,
                        label: `${valueOf(group, 'en', 'heading') || 'Untitled section'} - ${field}`,
                        source: valueOf(group, 'en', field),
                        existing: valueOf(group, locale, field),
                        kind: (field === 'body' ? 'textarea' : 'input') as
                            | 'input'
                            | 'textarea',
                    })),
                ),
                save: async changes => {
                    // One PUT per section, not per field: both edited fields of a
                    // section belong to the same row.
                    const byGroup = new Map<string, Record<string, string>>();
                    for (const c of changes) {
                        const held = byGroup.get(c.itemId) ?? {};
                        held[c.fieldKey] = c.value;
                        byGroup.set(c.itemId, held);
                    }

                    const results = await Promise.allSettled(
                        [...byGroup.entries()].map(([groupId, edited]) => {
                            const group = sections.find(
                                g => g.sectionGroupId === groupId,
                            );
                            if (!group)
                                return Promise.reject(
                                    new Error(`Section ${groupId} no longer exists`),
                                );
                            const heading =
                                edited.heading ??
                                valueOf(group, locale, 'heading') ??
                                valueOf(group, 'en', 'heading');
                            const body =
                                edited.body ??
                                valueOf(group, locale, 'body') ??
                                valueOf(group, 'en', 'body');
                            return upsertSection.mutateAsync({
                                groupId,
                                locale,
                                payload: { heading, body },
                            });
                        }),
                    );
                    const failed = results.filter(r => r.status === 'rejected');
                    if (failed.length > 0)
                        throw new Error(`${failed.length} section(s) failed to save`);
                    return results;
                },
            },
        ];
    }, [sections, locale, upsertSection]);

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
            extraSections={extraSections}
            isLoading={l1 || l2 || (locale !== 'en' && l3)}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={
                upsert.isPending || upsertPage.isPending || upsertSection.isPending
            }
            onSave={values =>
                upsert.mutateAsync({
                    id,
                    locale,
                    payload: { fields: toFields(values), isMachineTranslated: false },
                })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
            onTranslateWithAI={() => generate.mutate({ force: true })}
            isTranslating={generate.isPending}
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
    const generate = useGenerateTranslation('category', id, locale);

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
                upsert.mutateAsync({
                    id,
                    locale,
                    payload: { fields: toFields(values), isMachineTranslated: false },
                })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
            onTranslateWithAI={() => generate.mutate({ force: true })}
            isTranslating={generate.isPending}
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
    const generate = useGenerateTranslation('hub', id, locale);


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
                upsert.mutateAsync({
                    id,
                    locale,
                    payload: { fields: toFields(values), isMachineTranslated: false },
                })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
            onTranslateWithAI={() => generate.mutate({ force: true })}
            isTranslating={generate.isPending}
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
    const generate = useGenerateTranslation('collection', id, locale);

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
                upsert.mutateAsync({
                    id,
                    locale,
                    payload: { fields: toFields(values), isMachineTranslated: false },
                })
            }
            onSavePageContent={values =>
                upsertPage.mutateAsync({ id, locale, payload: toPageContent(values) })
            }
            onTranslateWithAI={() => generate.mutate({ force: true })}
            isTranslating={generate.isPending}
        />
    );
}
