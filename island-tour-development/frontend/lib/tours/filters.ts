/**
 * All Tours page - filter/sort URL model (isomorphic: used by the server listing
 * section to parse the request and by the client toolbar to build hrefs).
 *
 * The URL query is the single source of truth for filter + sort + page state, so
 * the server refetches the filtered/sorted page and streams it. Only the subset
 * the backend supports today is wired (Phase 1): category (single), sort, price,
 * rating, duration. Date / guests / time-of-day / cancellation / pickup are not
 * yet in the URL (they need backend listing support).
 */

// Price slider bounds (canonical source; the filter modal re-exports these).
export const PRICE_MIN = 0;
export const PRICE_MAX = 560;

/** Duration bucket keys (match the filter modal) -> [minMinutes, maxMinutes|null]. */
export const DURATION_BUCKETS: Record<string, [number, number | null]> = {
    upTo2: [0, 120],
    '2to4': [120, 240],
    '4to6': [240, 360],
    fullDay: [360, null],
};

/** UI sort values (as shown in the sort dropdown). */
export type ToursSortValue = 'localsFavorites' | 'priceLowHigh' | 'priceHighLow';

/** Backend `sort` enum values the listing endpoint accepts. */
export type ToursBackendSort = 'recommended' | 'price_asc' | 'price_desc';

export interface ToursFilterState {
    /** Selected category slug (single-select), or undefined for all. */
    category?: string;
    sort: ToursSortValue;
    price: [number, number];
    /** Minimum rating key: '3' | '4' | '4.5', or null. */
    rating: string | null;
    /** Selected duration bucket keys. */
    durations: string[];
    /** 1-based page. */
    page: number;
}

const RATING_KEYS = ['3', '4', '4.5'];

// UI sort <-> URL param <-> backend enum.
const SORT_TO_PARAM: Record<ToursSortValue, string | null> = {
    localsFavorites: null, // default -> omitted from the URL
    priceLowHigh: 'price_asc',
    priceHighLow: 'price_desc',
};
const PARAM_TO_SORT: Record<string, ToursSortValue> = {
    price_asc: 'priceLowHigh',
    price_desc: 'priceHighLow',
};
const SORT_TO_BACKEND: Record<ToursSortValue, ToursBackendSort> = {
    localsFavorites: 'recommended',
    priceLowHigh: 'price_asc',
    priceHighLow: 'price_desc',
};

function first(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
}

function toNumber(v: string | undefined, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

/** Parse the raw route search params into a normalized filter state. */
export function parseToursFilters(
    sp: Record<string, string | string[] | undefined>,
): ToursFilterState {
    const category = first(sp.category) || undefined;

    const sortParam = first(sp.sort);
    const sort = (sortParam && PARAM_TO_SORT[sortParam]) || 'localsFavorites';

    const min = toNumber(first(sp.minPrice), PRICE_MIN);
    const max = toNumber(first(sp.maxPrice), PRICE_MAX);
    const price: [number, number] = [
        Math.max(PRICE_MIN, Math.min(min, max)),
        Math.min(PRICE_MAX, Math.max(min, max)),
    ];

    const ratingRaw = first(sp.rating);
    const rating = ratingRaw && RATING_KEYS.includes(ratingRaw) ? ratingRaw : null;

    const durationRaw = first(sp.duration);
    const durations = durationRaw
        ? durationRaw.split(',').filter(k => k in DURATION_BUCKETS)
        : [];

    const pageNum = Number(first(sp.page));
    const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

    return { category, sort, price, rating, durations, page };
}

/**
 * Selected duration buckets -> a single spanning [min, max] range.
 * NOTE: the backend takes one contiguous range, so a NON-contiguous selection
 * (e.g. `upTo2` + `fullDay`) widens to the full span - an intentional Phase-1
 * approximation. Contiguous selections map exactly.
 */
export function durationsToRange(keys: string[]): {
    durationMin?: number;
    durationMax?: number;
} {
    const ranges = keys.map(k => DURATION_BUCKETS[k]).filter(Boolean);
    if (ranges.length === 0) return {};
    const durationMin = Math.min(...ranges.map(r => r[0]));
    const maxes = ranges.map(r => r[1]);
    const durationMax = maxes.includes(null)
        ? undefined
        : Math.max(...(maxes as number[]));
    return { durationMin, durationMax };
}

/**
 * Backend `getDestinationTours` query fields derived from the filter state
 * (everything except `categoryId`, which the server resolves from the slug).
 * Defaults are omitted so an unset price/rating never over-filters.
 */
export function filtersToTourQuery(state: ToursFilterState): {
    sort: ToursBackendSort;
    minPrice?: number;
    maxPrice?: number;
    ratingMin?: number;
    durationMin?: number;
    durationMax?: number;
} {
    return {
        sort: SORT_TO_BACKEND[state.sort],
        minPrice: state.price[0] > PRICE_MIN ? state.price[0] : undefined,
        maxPrice: state.price[1] < PRICE_MAX ? state.price[1] : undefined,
        ratingMin: state.rating ? Number(state.rating) : undefined,
        ...durationsToRange(state.durations),
    };
}

/** Build the All Tours href for a filter state (drops defaults + page 1). */
export function buildToursHref(pathname: string, state: ToursFilterState): string {
    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    const sortParam = SORT_TO_PARAM[state.sort];
    if (sortParam) params.set('sort', sortParam);
    if (state.price[0] > PRICE_MIN) params.set('minPrice', String(state.price[0]));
    if (state.price[1] < PRICE_MAX) params.set('maxPrice', String(state.price[1]));
    if (state.rating) params.set('rating', state.rating);
    if (state.durations.length) params.set('duration', state.durations.join(','));
    if (state.page > 1) params.set('page', String(state.page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}
