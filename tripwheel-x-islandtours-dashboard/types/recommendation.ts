/**
 * Post-booking recommendations - mirrors the backend DTOs
 * (`src/recommendations/dto/recommendation.dto.ts`).
 *
 * A recommendation is one card promoted on a post-booking surface (the
 * thank-you page and/or the confirmation email). It is EITHER:
 *
 * - EXTERNAL - our own pick on someone else's site (an apartment on Airbnb, a
 *   restaurant, a shop). It carries its own photo, link, rating, price and
 *   per-locale copy, exactly as the old "hotel" promo did.
 * - INTERNAL - a pointer at one of our own entities (a tour, destination,
 *   collection or hub). It has no copy or imagery of its own: the card is drawn
 *   from the live entity, so only the reference (`refType` + `refId`) is stored.
 *
 * A LIST that feeds a FEW cards: each surface promotes the winning rows by
 * `displayOrder`, so holding several rows is about swapping which pick is shown -
 * and keeping the retired one's copy - without retyping it every season.
 */

import type { Locale } from '@/types/locale';

/** Where a recommendation is fed from. */
export type RecommendationSource = 'INTERNAL' | 'EXTERNAL';

/** The post-booking surfaces a recommendation can appear on. */
export type RecommendationPlacement = 'THANK_YOU_PAGE' | 'CONFIRMATION_EMAIL';

/** The kind of internal entity an INTERNAL recommendation points at. */
export type RecommendationRefType = 'TOUR' | 'DESTINATION' | 'COLLECTION' | 'HUB';

/** The only currencies the platform prices in. */
export type RecommendationCurrency = 'USD' | 'EUR';

/** Human labels for each placement surface. */
export const RECOMMENDATION_PLACEMENT_LABELS: Record<
    RecommendationPlacement,
    string
> = {
    THANK_YOU_PAGE: 'Thank-you page',
    CONFIRMATION_EMAIL: 'Confirmation email',
};

/** The surfaces, in the order they are offered in the form. */
export const RECOMMENDATION_PLACEMENTS: RecommendationPlacement[] = [
    'THANK_YOU_PAGE',
    'CONFIRMATION_EMAIL',
];

/** Human labels for each internal reference type. */
export const RECOMMENDATION_REF_TYPE_LABELS: Record<
    RecommendationRefType,
    string
> = {
    TOUR: 'Tour',
    DESTINATION: 'Destination',
    COLLECTION: 'Collection',
    HUB: 'Hub',
};

/** The reference types, in the order they are offered in the form. */
export const RECOMMENDATION_REF_TYPES: RecommendationRefType[] = [
    'TOUR',
    'DESTINATION',
    'COLLECTION',
    'HUB',
];

/**
 * The recommendation category, a fixed backend enum (no admin CRUD). Every pick is
 * bucketed under exactly one of these; the value stored on the row IS the enum key.
 */
export type RecommendationCategory =
    | 'HOTEL'
    | 'APARTMENT'
    | 'VILLA'
    | 'RESTAURANT'
    | 'BAR'
    | 'CAFE'
    | 'CAR_RENTAL'
    | 'TRANSFER'
    | 'SHOP'
    | 'SPA'
    | 'BEACH_CLUB'
    | 'ATTRACTION'
    | 'ACTIVITY'
    | 'NIGHTLIFE'
    | 'OTHER';

/** The categories, in the order they are offered in the form. */
export const RECOMMENDATION_CATEGORIES: RecommendationCategory[] = [
    'HOTEL',
    'APARTMENT',
    'VILLA',
    'RESTAURANT',
    'BAR',
    'CAFE',
    'CAR_RENTAL',
    'TRANSFER',
    'SHOP',
    'SPA',
    'BEACH_CLUB',
    'ATTRACTION',
    'ACTIVITY',
    'NIGHTLIFE',
    'OTHER',
];

/** Human labels for each category. */
export const RECOMMENDATION_CATEGORY_LABELS: Record<
    RecommendationCategory,
    string
> = {
    HOTEL: 'Hotel',
    APARTMENT: 'Apartment',
    VILLA: 'Villa',
    RESTAURANT: 'Restaurant',
    BAR: 'Bar',
    CAFE: 'Café',
    CAR_RENTAL: 'Car rental',
    TRANSFER: 'Transfer',
    SHOP: 'Shop',
    SPA: 'Spa',
    BEACH_CLUB: 'Beach club',
    ATTRACTION: 'Attraction',
    ACTIVITY: 'Activity',
    NIGHTLIFE: 'Nightlife',
    OTHER: 'Other',
};

/**
 * Icon-name keys from `lib/constants/category-icons.ts` (the same curated
 * Hugeicons set the platform categories use). Every value below is a verified key
 * of `CATEGORY_ICON_COMPONENTS`; `getCategoryIconComponent` falls back to Tag for
 * anything unknown.
 */
export const RECOMMENDATION_CATEGORY_ICON: Record<
    RecommendationCategory,
    string
> = {
    HOTEL: 'TreePalm',
    APARTMENT: 'TreePalm',
    VILLA: 'Crown',
    RESTAURANT: 'Utensils',
    BAR: 'Wine',
    CAFE: 'Coffee',
    CAR_RENTAL: 'Car',
    TRANSFER: 'Plane',
    SHOP: 'Gem',
    SPA: 'Droplets',
    BEACH_CLUB: 'Sun',
    ATTRACTION: 'Ticket',
    ACTIVITY: 'Sparkles',
    NIGHTLIFE: 'Music',
    OTHER: 'Tag',
};

/**
 * The optional "fact" fields an EXTERNAL pick can carry in its meta row. The photo
 * and link are NOT here - they are the render gate, always shown. Copy (name, pitch,
 * etc.) lives in the Content tab.
 */
export type RecommendationFactField =
    | 'rating'
    | 'reviewCount'
    | 'sleeps'
    | 'priceAmount';

/**
 * Which fact fields are relevant PER CATEGORY, so the form only shows what fits the
 * kind of place: a hotel has "Sleeps", a restaurant does not; a shop has no price
 * line. `sleeps` is deliberately stay-only (hotel/apartment/villa) - it is the one
 * field that reads wrong on any other kind of pick.
 */
export const CATEGORY_FACT_FIELDS: Record<
    RecommendationCategory,
    RecommendationFactField[]
> = {
    HOTEL: ['rating', 'reviewCount', 'sleeps', 'priceAmount'],
    APARTMENT: ['rating', 'reviewCount', 'sleeps', 'priceAmount'],
    VILLA: ['rating', 'reviewCount', 'sleeps', 'priceAmount'],
    RESTAURANT: ['rating', 'reviewCount', 'priceAmount'],
    BAR: ['rating', 'reviewCount', 'priceAmount'],
    CAFE: ['rating', 'reviewCount', 'priceAmount'],
    CAR_RENTAL: ['rating', 'reviewCount', 'priceAmount'],
    TRANSFER: ['rating', 'priceAmount'],
    SHOP: ['rating', 'reviewCount'],
    SPA: ['rating', 'reviewCount', 'priceAmount'],
    BEACH_CLUB: ['rating', 'reviewCount', 'priceAmount'],
    ATTRACTION: ['rating', 'reviewCount', 'priceAmount'],
    ACTIVITY: ['rating', 'priceAmount'],
    NIGHTLIFE: ['rating', 'reviewCount', 'priceAmount'],
    OTHER: ['rating', 'reviewCount', 'priceAmount'],
};

/** The fact fields to show for a category (its own set, or the default). */
export function factFieldsForCategory(
    c: RecommendationCategory,
): RecommendationFactField[] {
    return CATEGORY_FACT_FIELDS[c] ?? ['rating', 'reviewCount', 'priceAmount'];
}

/** Per-locale recommendation copy (EXTERNAL only). */
export interface RecommendationTranslation {
    locale: Locale;
    /** Null = the site keeps its own translated eyebrow label. */
    eyebrow: string | null;
    areaLabel: string | null;
    title: string | null;
    /** One line per paragraph on the card. */
    description: string | null;
    /** Null = the site keeps its own translated CTA label. */
    ctaLabel: string | null;
    isMachineTranslated: boolean;
}

/** One recommendation as the dashboard sees it. */
export interface Recommendation {
    id: string;
    source: RecommendationSource;
    /** The fixed enum bucket this pick is grouped under. */
    category: RecommendationCategory;
    /** Whether this recommendation may be promoted at all. */
    isEnabled: boolean;
    /** Promotion priority within a surface - lower shows first. */
    displayOrder: number;
    /**
     * Seeded recommendations cannot be deleted (the API answers 403), the same
     * protection seeded destinations have.
     */
    isSeeded: boolean;
    /** The surfaces this recommendation is configured to appear on. */
    placements: RecommendationPlacement[];
    /** INTERNAL only - the kind of entity this points at. */
    refType: RecommendationRefType | null;
    /** INTERNAL only - the id of the referenced entity. */
    refId: string | null;
    /**
     * INTERNAL only - the resolved live name of the referenced entity, or null
     * if it no longer resolves (the entity was deleted or unpublished).
     */
    refLabel: string | null;
    imageUrl: string | null;
    linkUrl: string | null;
    /** Out of 5, one decimal place. */
    rating: number | null;
    reviewCount: number | null;
    sleeps: number | null;
    priceAmount: number | null;
    currency: RecommendationCurrency;
    /**
     * Which surfaces this row currently WINS - i.e. is the card actually shown
     * on. Surfaced because the failure mode is silent: an incomplete or
     * lower-priority row simply never appears, with nothing else to explain why.
     */
    featuredPlacements: RecommendationPlacement[];
    /** Whether it COULD be promoted: the render gate, minus the on/off switch. */
    isComplete: boolean;
    translations: RecommendationTranslation[];
}

/**
 * PATCH /recommendations/:id - only the named fields are touched; null clears
 * one. The English-copy fields (title/areaLabel/...) are NOT here: on an existing
 * recommendation the copy lives in the Content tab.
 */
export interface UpdateRecommendationPayload {
    source?: RecommendationSource;
    category?: RecommendationCategory;
    isEnabled?: boolean;
    displayOrder?: number;
    placements?: RecommendationPlacement[];
    refType?: RecommendationRefType | null;
    refId?: string | null;
    imageUrl?: string | null;
    linkUrl?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    sleeps?: number | null;
    priceAmount?: number | null;
    currency?: RecommendationCurrency;
}

/**
 * POST /recommendations - the record plus its English copy, written together.
 *
 * Backend rules: an EXTERNAL recommendation requires `title`; an INTERNAL one
 * requires `refType` + `refId` (and the referenced entity must exist).
 */
export interface CreateRecommendationPayload extends UpdateRecommendationPayload {
    title?: string;
    areaLabel?: string | null;
    description?: string | null;
    eyebrow?: string | null;
    ctaLabel?: string | null;
}

/** Copy fields, wrapped exactly like every other translatable entity. */
export type RecommendationTranslationFields = Partial<
    Omit<RecommendationTranslation, 'locale' | 'isMachineTranslated'>
>;

export interface UpsertRecommendationTranslationPayload {
    fields: RecommendationTranslationFields;
    isMachineTranslated?: boolean;
}

/**
 * Per-surface caps on how many recommendation cards actually render. Extras stay
 * "next in line" - complete and enabled, but not shown until a higher-priority
 * row drops out. Each is clamped 1-10 by the backend.
 */
export interface RecommendationSettings {
    thankYouPageLimit: number;
    confirmationEmailLimit: number;
}

/** PATCH /recommendations/settings - either cap alone, or both. */
export type UpdateRecommendationSettingsPayload =
    Partial<RecommendationSettings>;

/**
 * What the list and console label a row by:
 * - EXTERNAL: the English title (its own copy), or a placeholder.
 * - INTERNAL: the resolved live name of the entity it points at, or a note that
 *   the reference no longer resolves.
 */
export function recommendationName(rec: Recommendation): string {
    if (rec.source === 'INTERNAL') {
        return rec.refLabel?.trim() || '(unresolved reference)';
    }
    const en = rec.translations.find((t) => t.locale === 'en');
    return en?.title?.trim() || '(untitled)';
}
