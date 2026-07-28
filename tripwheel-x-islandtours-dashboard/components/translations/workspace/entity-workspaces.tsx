'use client';

/**
 * Per-entity workspace wrappers: each calls ITS OWN hooks (fixed hook order -
 * hooks cannot branch on entity type) and renders the shared ContentWorkspace.
 *
 * FULL coverage per entity (user mandate: no per-locale field left behind):
 * - all four: core translation fields + PAGE CONTENT (aboutText/meta) + FAQs
 * - destination: + About-band content sections (heading/body per section)
 * - collection: + per-tour rationales (per-item upsert)
 * - hub: + Our Picks rationales, comparison table (group names + standout
 *   notes) and page-section blocks - via per-item upsert endpoints (user
 *   decision 2026-07-28, reversing 2026-07-17: the hub editor is now
 *   English-only and the console owns ALL hub translations).
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
    useHubComparisonForEdit,
    useHubContentSectionsForEdit,
    useHubOurPicksForEdit,
    useHubPageContent,
    useHubTranslationByLocale,
    useUpsertHubComparisonGroupTranslation,
    useUpsertHubComparisonTourTranslation,
    useUpsertHubContentSectionTranslation,
    useUpsertHubOurPickTranslation,
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
import { HUB_PICK_TYPE_LABELS, HUB_SECTION_TYPE_LABELS } from '@/types/enums';
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
                            // An UNTOUCHED field is carried over from the
                            // target row - as stored, NOT filled in from
                            // English, or re-saving a section would silently
                            // undo a field cleared earlier.
                            const heading =
                                edited.heading ?? valueOf(group, locale, 'heading');
                            const body =
                                edited.body ?? valueOf(group, locale, 'body');

                            // Heading and body clear INDEPENDENTLY: an emptied
                            // field is sent as '' and the row is kept, so the
                            // page falls back to English for that field alone.
                            // English is the source and cannot be blanked.
                            if (locale === 'en' && (!heading.trim() || !body.trim()))
                                return Promise.reject(
                                    new Error(
                                        `"${valueOf(group, 'en', 'heading') || groupId}" - English is the source every locale falls back to and cannot be left blank`,
                                    ),
                                );
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
    const { data: picks } = useHubOurPicksForEdit(id);
    const { data: comparison } = useHubComparisonForEdit(id);
    // ForEdit, NOT useHubContentSections: the public read's `locale` query
    // param defaults to `en` on the backend, so every translated field
    // came back blank and a save looked like it had vanished on reload.
    const { data: sections } = useHubContentSectionsForEdit(id);
    const upsert = useUpsertHubTranslation();
    const upsertPage = useUpsertHubPageContent();
    const upsertPick = useUpsertHubOurPickTranslation();
    const upsertGroup = useUpsertHubComparisonGroupTranslation();
    const upsertColumn = useUpsertHubComparisonTourTranslation();
    const upsertSection = useUpsertHubContentSectionTranslation();
    const generate = useGenerateTranslation('hub', id, locale);

    // The hub's curation surfaces (editor decision 2026-07-28: the hub editor
    // is English-only; ALL translation editing happens here). Each section
    // saves through a per-item upsert, so a console save can never race the
    // editor's replace-all endpoints into data loss. The copy columns are NOT
    // NULL, so clearing a field DELETES that locale's row and the page falls
    // back to English; the backend records a clear mark at the same time so
    // the AI cannot read the gap as "untranslated" and put it back.
    const extraSections = useMemo<ExtraSection[]>(() => {
        const result: ExtraSection[] = [];

        if (picks && picks.length > 0) {
            result.push({
                key: 'our-picks',
                label: 'Our Picks rationales',
                rows: picks.map(p => ({
                    itemId: p.id,
                    fieldKey: 'description',
                    label: `${p.tourName} (${HUB_PICK_TYPE_LABELS[p.pickType]})`,
                    source: p.description,
                    existing:
                        p.translations.find(t => t.locale === locale)
                            ?.description ?? '',
                    kind: 'textarea' as const,
                })),
                save: async changes => {
                    // An emptied rationale is sent as '' and the row is kept:
                    // the card falls back to the base English blurb. English
                    // is the source and is refused by the backend.
                    const results = await Promise.allSettled(
                        changes.map(c =>
                            upsertPick.mutateAsync({
                                id,
                                pickId: c.itemId,
                                locale,
                                payload: { description: c.value },
                            }),
                        ),
                    );
                    const failed = results.filter(r => r.status === 'rejected');
                    if (failed.length > 0)
                        throw new Error(`${failed.length} pick(s) failed to save`);
                    return results;
                },
            });
        }

        if (comparison && comparison.length > 0) {
            const rows = comparison.flatMap(group => [
                {
                    itemId: group.id,
                    fieldKey: 'groupName',
                    label: `${group.groupName} - group name`,
                    source: group.groupName,
                    existing:
                        group.translations.find(t => t.locale === locale)
                            ?.groupName ?? '',
                    kind: 'input' as const,
                },
                ...group.tours
                    // A column with no English note has nothing to translate.
                    .filter(t => (t.standoutNote ?? '').trim())
                    .map(t => ({
                        itemId: t.id,
                        fieldKey: 'standoutNote',
                        label: `${group.groupName} · ${t.tourName} - standout note`,
                        source: t.standoutNote ?? '',
                        existing:
                            t.translations.find(tr => tr.locale === locale)
                                ?.standoutNote ?? '',
                        kind: 'textarea' as const,
                    })),
            ]);
            result.push({
                key: 'comparison',
                label: 'Comparison table',
                rows,
                save: async changes => {
                    // Group name and standout note clear independently: an
                    // emptied field is sent as '' and the row is kept, so that
                    // field alone falls back to the base English text.
                    const results = await Promise.allSettled(
                        changes.map(c =>
                            c.fieldKey === 'groupName'
                                ? upsertGroup.mutateAsync({
                                      id,
                                      groupId: c.itemId,
                                      locale,
                                      payload: { groupName: c.value },
                                  })
                                : upsertColumn.mutateAsync({
                                      id,
                                      comparisonTourId: c.itemId,
                                      locale,
                                      payload: { standoutNote: c.value },
                                  }),
                        ),
                    );
                    const failed = results.filter(r => r.status === 'rejected');
                    if (failed.length > 0)
                        throw new Error(
                            `${failed.length} comparison item(s) failed to save`,
                        );
                    return results;
                },
            });
        }

        const enBlocks = (sections ?? []).filter(s => s.locale === 'en');
        if (enBlocks.length > 0) {
            const siblingOf = (block: (typeof enBlocks)[number]) =>
                sections!.find(
                    s =>
                        s.locale === locale &&
                        s.sectionType === block.sectionType &&
                        s.displayOrder === block.displayOrder,
                );
            // A block's cross-locale identity is (sectionType, displayOrder) -
            // there is no FK group key (mirrors the backend's addressing).
            const blockId = (block: (typeof enBlocks)[number]) =>
                `${block.sectionType}#${block.displayOrder}`;

            result.push({
                key: 'page-sections',
                label: 'Page sections',
                rows: enBlocks.flatMap(block => {
                    // Headingless block types store the body copied into
                    // `heading` - show only the body and let the backend mirror.
                    const headingIsBody = block.heading === block.body;
                    const anchor = `${HUB_SECTION_TYPE_LABELS[block.sectionType]}: ${
                        headingIsBody
                            ? `${block.body.slice(0, 40)}${block.body.length > 40 ? '…' : ''}`
                            : block.heading
                    }`;
                    const sibling = siblingOf(block);
                    const bodyRow = {
                        itemId: blockId(block),
                        fieldKey: 'body',
                        label: headingIsBody ? anchor : `${anchor} - body`,
                        source: block.body,
                        existing: sibling?.body ?? '',
                        kind: 'textarea' as const,
                    };
                    if (headingIsBody) return [bodyRow];
                    return [
                        {
                            itemId: blockId(block),
                            fieldKey: 'heading',
                            label: `${anchor} - heading`,
                            source: block.heading,
                            existing: sibling?.heading ?? '',
                            kind: 'input' as const,
                        },
                        bodyRow,
                    ];
                }),
                save: async changes => {
                    // One PUT per block: both fields belong to the same row.
                    const byBlock = new Map<string, Record<string, string>>();
                    for (const c of changes) {
                        const held = byBlock.get(c.itemId) ?? {};
                        held[c.fieldKey] = c.value;
                        byBlock.set(c.itemId, held);
                    }

                    const results = await Promise.allSettled(
                        [...byBlock.entries()].map(([key, edited]) => {
                            const block = enBlocks.find(b => blockId(b) === key);
                            if (!block)
                                return Promise.reject(
                                    new Error(`Block ${key} no longer exists`),
                                );
                            const headingIsBody = block.heading === block.body;
                            const sibling = siblingOf(block);
                            // An UNTOUCHED field is carried over AS STORED -
                            // not filled in from English, or re-saving a block
                            // would silently undo a field cleared earlier.
                            // Heading and body clear independently: an emptied
                            // field is sent as '' and the row is kept, so that
                            // field alone falls back to English.
                            const body = edited.body ?? sibling?.body ?? '';
                            const heading = headingIsBody
                                ? undefined
                                : (edited.heading ?? sibling?.heading ?? '');
                            if (locale === 'en' && !body.trim())
                                return Promise.reject(
                                    new Error(
                                        'English is the source every locale falls back to and cannot be left blank',
                                    ),
                                );
                            return upsertSection.mutateAsync({
                                id,
                                sectionType: block.sectionType,
                                displayOrder: block.displayOrder,
                                locale,
                                payload: { heading, body },
                            });
                        }),
                    );
                    const failed = results.filter(r => r.status === 'rejected');
                    if (failed.length > 0)
                        throw new Error(
                            `${failed.length} block(s) failed to save`,
                        );
                    return results;
                },
            });
        }

        return result;
    }, [
        picks,
        comparison,
        sections,
        locale,
        id,
        upsertPick,
        upsertGroup,
        upsertColumn,
        upsertSection,
    ]);

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
            extraSections={extraSections}
            isLoading={l1 || l2 || (locale !== 'en' && l3)}
            isMachineTranslated={target?.isMachineTranslated}
            isSaving={
                upsert.isPending ||
                upsertPage.isPending ||
                upsertPick.isPending ||
                upsertGroup.isPending ||
                upsertColumn.isPending ||
                upsertSection.isPending
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
                    // An emptied rationale is sent as '' and the row is kept,
                    // so the card falls back to the English note. English is
                    // the source (and a publish gate) - the backend refuses a
                    // blank there.
                    const results = await Promise.allSettled(
                        changes.map(c =>
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
