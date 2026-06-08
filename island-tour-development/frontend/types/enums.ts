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

// Supported currencies (ISO 4217) — must match the backend Prisma `Currency` enum.
export type Currency =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'CAD'
  | 'ANG'
  | 'AWG'
  | 'XCD'
  | 'BSD';

export const CURRENCY_VALUES: Currency[] = ['USD', 'EUR', 'GBP', 'CAD', 'ANG', 'AWG', 'XCD', 'BSD'];

/** Currency code → human label for selectors. */
export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'USD — US Dollar',
  EUR: 'EUR — Euro',
  GBP: 'GBP — British Pound',
  CAD: 'CAD — Canadian Dollar',
  ANG: 'ANG — Netherlands Antillean Guilder',
  AWG: 'AWG — Aruban Florin',
  XCD: 'XCD — East Caribbean Dollar',
  BSD: 'BSD — Bahamian Dollar',
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
