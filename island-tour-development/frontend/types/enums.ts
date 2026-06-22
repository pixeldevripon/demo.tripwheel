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

export type SlugEntityType = 'TOUR' | 'CATEGORY' | 'HUB' | 'COLLECTION' | 'RESERVED';
