import type { Locale } from '@/lib/constants/locales';

/**
 * The translatable-surface registry (04 §3.3, Phase 17) - the keystone of the
 * Translation Console. ONE declarative description of what is translatable
 * per entity type: the matrix computes completeness from it, the workspace
 * renders from it. Adding a translatable field is one entry here, not a
 * change in five forked forms.
 *
 * Field `name`s are the EXACT payload keys of each entity's upsert:
 * - tour: flat `UpsertTripTranslationPayload` keys (types/trip.ts)
 * - destination/category/hub/collection: keys of `payload.fields`
 *   (wrapped-fields pattern; see each types/* file)
 *
 * A field with `kind: 'lines'` is `string[]` in the API and edited as a
 * one-per-line textarea (the exact convention of the old trip tab).
 */

export type TranslatableEntityType =
    | 'tour'
    | 'destination'
    | 'category'
    | 'hub'
    | 'collection'
    | 'homepage';

export const TRANSLATABLE_ENTITY_TYPES: TranslatableEntityType[] = [
    'tour',
    'destination',
    'hub',
    'category',
    'collection',
    // Singleton: exactly one row, keyed 'default'. It has no entity list to
    // page through and no page-content record - see HOMEPAGE_FIELDS.
    'homepage',
];

export const ENTITY_TYPE_LABELS: Record<TranslatableEntityType, string> = {
    tour: 'Tours',
    destination: 'Destinations',
    hub: 'Hubs',
    category: 'Categories',
    collection: 'Collections',
    homepage: 'Homepage',
};

export interface TranslatableFieldDef {
    /** RHF register name AND upsert payload key. */
    name: string;
    label: string;
    kind: 'input' | 'textarea' | 'lines';
    rows?: number;
    /** Optional cap surfaced as a counter (SEO fields). */
    maxLength?: number;
    /** One-line hint under the target input. */
    description?: string;
}

/** The 15 tour-level fields (13 body + 2 SEO; one flat upsert covers all). */
export const TOUR_FIELDS: TranslatableFieldDef[] = [
    { name: 'title', label: 'Display title', kind: 'input' },
    { name: 'overview', label: 'Overview', kind: 'textarea', rows: 3 },
    { name: 'description', label: 'Description', kind: 'textarea', rows: 5 },
    {
        name: 'shortDescription',
        label: 'Short description',
        kind: 'textarea',
        rows: 2,
    },
    {
        name: 'whatToBring',
        label: 'What to bring',
        kind: 'lines',
        rows: 3,
        description: 'One item per line.',
    },
    {
        name: 'knowBeforeYouGo',
        label: 'Know before you go',
        kind: 'lines',
        rows: 3,
        description: 'One item per line.',
    },
    {
        name: 'notSuitableFor',
        label: 'Not suitable for',
        kind: 'lines',
        rows: 2,
        description: 'One item per line.',
    },
    {
        name: 'whatToExpectIntro',
        label: 'What to expect (intro)',
        kind: 'textarea',
        rows: 2,
    },
    { name: 'categoryDisplay', label: 'Category display', kind: 'input' },
    { name: 'localTipTitle', label: 'Local tip - title', kind: 'input' },
    {
        name: 'localTipBody',
        label: 'Local tip - description',
        kind: 'textarea',
        rows: 2,
    },
    {
        name: 'operatorNote',
        label: 'Note to travellers',
        kind: 'textarea',
        rows: 2,
        description:
            'Shown as "A note from the operator" in the confirmation email.',
    },
    { name: 'meetingPointText', label: 'Meeting point text', kind: 'input' },
    { name: 'metaTitle', label: 'SEO - meta title', kind: 'input', maxLength: 60 },
    {
        name: 'metaDescription',
        label: 'SEO - meta description',
        kind: 'textarea',
        rows: 2,
        maxLength: 160,
    },
];

const CONTENT_COMMON: TranslatableFieldDef[] = [
    { name: 'name', label: 'Name', kind: 'input' },
    { name: 'overview', label: 'Overview', kind: 'textarea', rows: 4 },
    {
        name: 'h1Override',
        label: 'H1 override',
        kind: 'input',
        description: 'Overrides the page heading; empty = name.',
    },
    { name: 'breadcrumbLabel', label: 'Breadcrumb label', kind: 'input' },
];

export const DESTINATION_FIELDS: TranslatableFieldDef[] = CONTENT_COMMON;
export const CATEGORY_FIELDS: TranslatableFieldDef[] = CONTENT_COMMON;

export const HUB_FIELDS: TranslatableFieldDef[] = [
    CONTENT_COMMON[0],
    CONTENT_COMMON[1],
    { name: 'heroTagline', label: 'Hero tagline', kind: 'input' },
    CONTENT_COMMON[2],
    CONTENT_COMMON[3],
];

export const COLLECTION_FIELDS: TranslatableFieldDef[] = [
    CONTENT_COMMON[0],
    CONTENT_COMMON[1],
    {
        name: 'curationNote',
        label: 'Curation note',
        kind: 'textarea',
        rows: 2,
    },
    { name: 'eyebrowLabel', label: 'Eyebrow label', kind: 'input' },
    CONTENT_COMMON[2],
    CONTENT_COMMON[3],
];

/**
 * Per-locale PAGE CONTENT record shared by all four content entities
 * (types/*: XPageContent - aboutText + SEO meta). Saved via each entity's
 * page-content upsert, separate from the translation upsert.
 */
export const PAGE_CONTENT_FIELDS: TranslatableFieldDef[] = [
    {
        name: 'aboutText',
        label: 'About text',
        kind: 'textarea',
        rows: 5,
        description: 'The long-form "About" body on the public page.',
    },
    { name: 'metaTitle', label: 'SEO - meta title', kind: 'input', maxLength: 60 },
    {
        name: 'metaDescription',
        label: 'SEO - meta description',
        kind: 'textarea',
        rows: 2,
        maxLength: 160,
    },
];

/**
 * Homepage copy, in the order the sections appear on the page - a translator
 * reading top to bottom is walking the homepage top to bottom. Descriptions say
 * WHERE the text lands, because a translator has even less context than the
 * admin who wrote it.
 *
 * Every field is optional on the public site: an empty value renders the copy
 * the site ships with, so a partially translated homepage is coherent rather
 * than broken.
 */
export const HOMEPAGE_FIELDS: TranslatableFieldDef[] = [
    {
        name: 'heroTitle',
        label: 'Hero headline',
        kind: 'input',
        description: 'The large text over the hero photo.',
    },
    {
        name: 'heroSubtitle',
        label: 'Hero subheading',
        kind: 'input',
        description: 'The line directly under the headline.',
    },
    {
        name: 'experiencesTitle',
        label: 'Experiences heading',
        kind: 'input',
        description: 'Above the "Top island experiences" carousel.',
    },
    {
        name: 'editorialTitleLine1',
        label: 'CTA headline, line 1',
        kind: 'input',
        description: 'Top line of the two-line heading on the orange card.',
    },
    {
        name: 'editorialTitleLine2',
        label: 'CTA headline, line 2',
        kind: 'input',
        description: 'Bottom line of that heading.',
    },
    {
        name: 'editorialBody',
        label: 'CTA body',
        kind: 'textarea',
        rows: 3,
        description: 'The paragraph under the CTA heading.',
    },
    {
        name: 'editorialCta',
        label: 'CTA button',
        kind: 'input',
        description: 'The text inside the white button.',
    },
    {
        name: 'faqTitle',
        label: 'FAQ title',
        kind: 'input',
        description: 'The heading above the FAQ list.',
    },
    {
        name: 'faqSubtitle',
        label: 'FAQ intro',
        kind: 'textarea',
        rows: 3,
        description: 'The paragraph beside the FAQ list.',
    },
];

export const ENTITY_FIELDS: Record<
    TranslatableEntityType,
    TranslatableFieldDef[]
> = {
    tour: TOUR_FIELDS,
    destination: DESTINATION_FIELDS,
    category: CATEGORY_FIELDS,
    hub: HUB_FIELDS,
    collection: COLLECTION_FIELDS,
    homepage: HOMEPAGE_FIELDS,
};

/**
 * Tour sub-entities carry their own per-item translations (single or dual
 * field). The workspace renders one row per item per field.
 */
export interface TourSubEntityDef {
    key: 'highlights' | 'inclusions' | 'exclusions' | 'features' | 'locations' | 'pickups';
    label: string;
    /** Field names on the ITEM (EN base) and on its translation records. */
    fields: { name: string; label: string; optional?: boolean }[];
}

export const TOUR_SUB_ENTITIES: TourSubEntityDef[] = [
    { key: 'highlights', label: 'Highlights', fields: [{ name: 'text', label: 'Text' }] },
    { key: 'inclusions', label: 'Inclusions', fields: [{ name: 'label', label: 'Label' }] },
    { key: 'exclusions', label: 'Exclusions', fields: [{ name: 'label', label: 'Label' }] },
    { key: 'features', label: 'Info & Terms', fields: [{ name: 'text', label: 'Text' }] },
    {
        key: 'locations',
        label: 'Itinerary',
        fields: [
            { name: 'title', label: 'Title' },
            { name: 'shortDescription', label: 'Short description', optional: true },
        ],
    },
    {
        key: 'pickups',
        label: 'Pickups',
        fields: [
            { name: 'title', label: 'Title' },
            { name: 'directions', label: 'Directions', optional: true },
        ],
    },
];

/** A translation record is "filled" for a field when it has visible content. */
export function fieldFilled(value: unknown): boolean {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === 'string' && value.trim().length > 0;
}

export interface LocaleCompleteness {
    locale: Locale;
    filled: number;
    total: number;
}

/** Core-field completeness for one locale from a translation record. */
export function completenessFor(
    fields: TranslatableFieldDef[],
    record: Record<string, unknown> | undefined,
    locale: Locale,
): LocaleCompleteness {
    if (!record) return { locale, filled: 0, total: fields.length };
    const filled = fields.filter(f => fieldFilled(record[f.name])).length;
    return { locale, filled, total: fields.length };
}
