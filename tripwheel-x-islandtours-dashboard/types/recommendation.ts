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

/** The category a recommendation belongs to, as embedded on the row. */
export interface RecommendationCategoryRef {
    id: string;
    name: string;
    slug: string;
}

/** One recommendation as the dashboard sees it. */
export interface Recommendation {
    id: string;
    source: RecommendationSource;
    /** Null = uncategorised. */
    category: RecommendationCategoryRef | null;
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

/** One recommendation category as the dashboard sees it. */
export interface RecommendationCategory {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    displayOrder: number;
    /** Seeded categories cannot be deleted (the API answers 403). */
    isSeeded: boolean;
    /** How many recommendations sit in this category. */
    recommendationCount: number;
}

/**
 * PATCH /recommendations/:id - only the named fields are touched; null clears
 * one. The English-copy fields (title/areaLabel/...) are NOT here: on an existing
 * recommendation the copy lives in the Content tab.
 */
export interface UpdateRecommendationPayload {
    source?: RecommendationSource;
    categoryId?: string | null;
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

/** POST /recommendations/categories */
export interface CreateRecommendationCategoryPayload {
    name: string;
    slug?: string;
    icon?: string | null;
    displayOrder?: number;
}

/** PATCH /recommendations/categories/:categoryId */
export interface UpdateRecommendationCategoryPayload {
    name?: string;
    slug?: string;
    icon?: string | null;
    displayOrder?: number;
}

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
