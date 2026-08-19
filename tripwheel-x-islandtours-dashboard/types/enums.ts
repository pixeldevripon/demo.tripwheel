// Shared V2 enums (string unions to match the existing `types/trip.ts` style).
// Keep values identical to the backend Prisma enums.

export type Region = 'CARIBBEAN' | 'ATLANTIC' | 'MEDITERRANEAN' | 'ASIA' | 'AFRICA';

export const REGION_VALUES: Region[] = [
  'CARIBBEAN',
  'ATLANTIC',
  'MEDITERRANEAN',
  'ASIA',
  'AFRICA',
];

export type HubType = 'LOCATION' | 'HIGHLIGHT' | 'AREA';

export const HUB_TYPE_VALUES: HubType[] = ['LOCATION', 'HIGHLIGHT', 'AREA'];

/** Human label for each hub type (selectors / badges). */
export const HUB_TYPE_LABELS: Record<HubType, string> = {
  LOCATION: 'Location',
  HIGHLIGHT: 'Highlight',
  AREA: 'Area',
};

// Hub publish lifecycle (G6). New hubs default to DRAFT; promote to PUBLISHED via
// PATCH once the publish guard passes. Distinct from `isActive` (soft-delete).
export type HubStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const HUB_STATUS_VALUES: HubStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export const HUB_STATUS_LABELS: Record<HubStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

// Hub editorial content blocks (HUB-DATA §5). DISCOVER + LOCAL_TIP (en) are
// required for PUBLISHED; FAST_FACT feeds the hero bar.
export type HubSectionType =
  | 'DISCOVER'
  | 'LOCAL_TIP'
  | 'FAST_FACT'
  | 'EDITORIAL'
  | 'HIGHLIGHT';

export const HUB_SECTION_TYPE_VALUES: HubSectionType[] = [
  'DISCOVER',
  'LOCAL_TIP',
  'FAST_FACT',
  'EDITORIAL',
  'HIGHLIGHT',
];

export const HUB_SECTION_TYPE_LABELS: Record<HubSectionType, string> = {
  DISCOVER: 'Discover',
  LOCAL_TIP: 'Local Tip',
  FAST_FACT: 'Fast Fact',
  EDITORIAL: 'Discover Intro',
  HIGHLIGHT: 'First-timer Highlight',
};

// Our Picks classification.
export type HubPickType =
  | 'BEST_OVERALL'
  | 'MOST_POPULAR'
  | 'BEST_FOR_FAMILIES'
  | 'BEST_VALUE';

export const HUB_PICK_TYPE_VALUES: HubPickType[] = [
  'BEST_OVERALL',
  'MOST_POPULAR',
  'BEST_FOR_FAMILIES',
  'BEST_VALUE',
];

export const HUB_PICK_TYPE_LABELS: Record<HubPickType, string> = {
  BEST_OVERALL: 'Best Overall',
  MOST_POPULAR: 'Most Popular',
  BEST_FOR_FAMILIES: 'Best for Families',
  BEST_VALUE: 'Best Value',
};

// Supported currencies (ISO 4217) - must match the backend Prisma `Currency` enum.
export type Currency =
  | 'USD'
  | 'EUR';

export const CURRENCY_VALUES: Currency[] = ['USD', 'EUR'];

/** Currency code → human label for selectors. */
export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'USD',
  EUR: 'EUR',
};

export type AttributeDataType =
  | 'BOOLEAN'
  | 'ENUM'
  | 'ENUM_MULTI'
  | 'INTEGER'
  | 'DECIMAL'
  | 'TEXT';

export const ATTRIBUTE_DATA_TYPE_VALUES: AttributeDataType[] = [
  'BOOLEAN',
  'ENUM',
  'ENUM_MULTI',
  'INTEGER',
  'DECIMAL',
  'TEXT',
];

export type FilterDisplayType = 'CHECKBOX' | 'RANGE_SLIDER' | 'RADIO' | 'DROPDOWN';

export const FILTER_DISPLAY_TYPE_VALUES: FilterDisplayType[] = [
  'CHECKBOX',
  'RANGE_SLIDER',
  'RADIO',
  'DROPDOWN',
];

export type CollectionType = 'MANUAL' | 'DYNAMIC';

export const COLLECTION_TYPE_VALUES: CollectionType[] = ['MANUAL', 'DYNAMIC'];

export const COLLECTION_TYPE_LABELS: Record<CollectionType, string> = {
  MANUAL: 'Manual',
  DYNAMIC: 'Dynamic',
};

// Collection publish lifecycle (G5). New collections default to DRAFT; promote to
// PUBLISHED via the /status endpoint once the publish guard passes. Distinct from
// `isActive` (soft-delete).
export type CollectionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const COLLECTION_STATUS_VALUES: CollectionStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

// Card rendering style for the collection page. NUMBERED draws 01..n badges
// (e.g. "Top 10"); PERSONA highlights card #1 instead.
export type CollectionDisplayStyle = 'NUMBERED' | 'PERSONA';

export const COLLECTION_DISPLAY_STYLE_VALUES: CollectionDisplayStyle[] = ['NUMBERED', 'PERSONA'];

export const COLLECTION_DISPLAY_STYLE_LABELS: Record<CollectionDisplayStyle, string> = {
  NUMBERED: 'Numbered (01..n badges)',
  PERSONA: 'Persona (highlight first card)',
};

export type SlugEntityType = 'TOUR' | 'CATEGORY' | 'HUB' | 'COLLECTION' | 'RESERVED';
