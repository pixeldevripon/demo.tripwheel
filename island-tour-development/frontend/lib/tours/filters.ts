/**
 * All Tours page - filter/sort URL model (isomorphic: used by the server listing
 * section to parse the request and by the client toolbar to build hrefs).
 *
 * The URL query is the single source of truth for filter + sort + page state, so
 * the server refetches the filtered/sorted page and streams it. Wired to the
 * backend `GET /tours` params: category (multi-select), sort, price, rating,
 * duration (Phase 1) + free-cancellation cutoff and pickup (Phase 2). Date /
 * guests / time-of-day are Phase 3 (availability-aware, not yet in the URL).
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

/** Guest breakdown carried in the toolbar's guests stepper. */
export interface ToursGuests {
    adults: number;
    children: number;
    infants: number;
}

export const DEFAULT_GUESTS: ToursGuests = { adults: 2, children: 0, infants: 0 };

/** Time-of-day bucket keys (match the filter modal + backend). */
export const TIME_OF_DAY_KEYS = ['morning', 'afternoon', 'evening'];

export interface ToursFilterState {
    /** Selected category slugs (multi-select); empty for all. */
    categories: string[];
    sort: ToursSortValue;
    price: [number, number];
    /** Minimum rating key: '3' | '4' | '4.5', or null. */
    rating: string | null;
    /** Selected duration bucket keys. */
    durations: string[];
    /** Free-cancellation cutoff key: '24h' | '48h' | '72h', or null. */
    cancellation: string | null;
    /** Restrict to tours that offer pickup. */
    pickup: boolean;
    /** Availability anchor date (YYYY-MM-DD), or null. */
    date: string | null;
    /** Guest breakdown (only affects results together with a date). */
    guests: ToursGuests;
    /** Time-of-day buckets (only affect results together with a date). */
    timeOfDay: string[];
    /**
     * Dynamic attribute filters keyed by AttributeDefinition.key -> selected
     * values (e.g. `{ boat_type: ['catamaran'] }`). The backend supports these as
     * raw `?key=v1,v2` params (comma = OR within a key, multiple keys = AND).
     * There is no modal UI for them (removed by request); they still flow
     * URL -> backend and are PRESERVED across toolbar navigations, so attribute
     * filtering works via URL / deep links.
     */
    attributes: Record<string, string[]>;
    /** 1-based page. */
    page: number;
}

/**
 * URL params owned by the fixed filter model. Everything else is treated as a
 * dynamic attribute filter (mirrors the backend's reserved-key convention).
 */
const RESERVED_PARAM_KEYS = new Set([
    'category',
    'sort',
    'minPrice',
    'maxPrice',
    'rating',
    'duration',
    'cancellation',
    'pickup',
    'date',
    'adults',
    'children',
    'infants',
    'timeOfDay',
    'page',
]);

/** Backend seat count (pax) from a guest breakdown - infants are lap-held. */
export function guestsToPax(g: ToursGuests): number {
    return g.adults + g.children;
}

const RATING_KEYS = ['3', '4', '4.5'];
const CANCELLATION_KEYS = ['24h', '48h', '72h'];

/** Free-cancellation key -> the backend `cancellationMaxHours` ceiling. */
const CANCELLATION_TO_HOURS: Record<string, number> = {
    '24h': 24,
    '48h': 48,
    '72h': 72,
};

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
    priceMax: number = PRICE_MAX,
): ToursFilterState {
    const categoryRaw = first(sp.category);
    const categories = categoryRaw
        ? categoryRaw.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const sortParam = first(sp.sort);
    const sort = (sortParam && PARAM_TO_SORT[sortParam]) || 'localsFavorites';

    const min = toNumber(first(sp.minPrice), PRICE_MIN);
    const max = toNumber(first(sp.maxPrice), priceMax);
    const price: [number, number] = [
        Math.max(PRICE_MIN, Math.min(min, max)),
        Math.min(priceMax, Math.max(min, max)),
    ];

    const ratingRaw = first(sp.rating);
    const rating = ratingRaw && RATING_KEYS.includes(ratingRaw) ? ratingRaw : null;

    const durationRaw = first(sp.duration);
    const durations = durationRaw
        ? durationRaw.split(',').filter(k => k in DURATION_BUCKETS)
        : [];

    const cancellationRaw = first(sp.cancellation);
    const cancellation =
        cancellationRaw && CANCELLATION_KEYS.includes(cancellationRaw)
            ? cancellationRaw
            : null;

    const pickupRaw = first(sp.pickup);
    const pickup = pickupRaw === '1' || pickupRaw === 'true';

    const dateRaw = first(sp.date);
    const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;

    const clampGuest = (v: string | undefined, fallback: number, min: number) =>
        Math.min(20, Math.max(min, Math.round(toNumber(v, fallback))));
    const guests: ToursGuests = {
        adults: clampGuest(first(sp.adults), DEFAULT_GUESTS.adults, 1),
        children: clampGuest(first(sp.children), DEFAULT_GUESTS.children, 0),
        infants: clampGuest(first(sp.infants), DEFAULT_GUESTS.infants, 0),
    };

    const timeRaw = first(sp.timeOfDay);
    const timeOfDay = timeRaw
        ? timeRaw.split(',').filter(k => TIME_OF_DAY_KEYS.includes(k))
        : [];

    // Any non-reserved query key is a dynamic attribute filter (comma-separated
    // values). Mirrors the backend's RESERVED_QUERY_KEYS convention.
    const attributes: Record<string, string[]> = {};
    for (const [key, raw] of Object.entries(sp)) {
        if (RESERVED_PARAM_KEYS.has(key)) continue;
        const val = first(raw);
        if (!val) continue;
        const values = val.split(',').map(v => v.trim()).filter(Boolean);
        if (values.length) attributes[key] = values;
    }

    const pageNum = Number(first(sp.page));
    const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

    return {
        categories,
        sort,
        price,
        rating,
        durations,
        cancellation,
        pickup,
        date,
        guests,
        timeOfDay,
        attributes,
        page,
    };
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
export function filtersToTourQuery(
    state: ToursFilterState,
    priceMax: number = PRICE_MAX,
): {
    sort: ToursBackendSort;
    minPrice?: number;
    maxPrice?: number;
    ratingMin?: number;
    durationMin?: number;
    durationMax?: number;
    cancellationMaxHours?: number;
    pickupAvailable?: boolean;
    date?: string;
    guests?: number;
    timeOfDay?: string;
} {
    // Availability params (date / guests / timeOfDay) only take effect together
    // with a date - matching the backend's date-anchored filter.
    const dateActive = Boolean(state.date);
    return {
        sort: SORT_TO_BACKEND[state.sort],
        minPrice: state.price[0] > PRICE_MIN ? state.price[0] : undefined,
        maxPrice: state.price[1] < priceMax ? state.price[1] : undefined,
        ratingMin: state.rating ? Number(state.rating) : undefined,
        cancellationMaxHours: state.cancellation
            ? CANCELLATION_TO_HOURS[state.cancellation]
            : undefined,
        pickupAvailable: state.pickup || undefined,
        date: state.date ?? undefined,
        guests: dateActive ? guestsToPax(state.guests) : undefined,
        timeOfDay:
            dateActive && state.timeOfDay.length
                ? state.timeOfDay.join(',')
                : undefined,
        ...durationsToRange(state.durations),
    };
}

/** Build the All Tours href for a filter state (drops defaults + page 1). */
export function buildToursHref(
    pathname: string,
    state: ToursFilterState,
    priceMax: number = PRICE_MAX,
): string {
    const params = new URLSearchParams();
    if (state.categories.length)
        params.set('category', state.categories.join(','));
    const sortParam = SORT_TO_PARAM[state.sort];
    if (sortParam) params.set('sort', sortParam);
    if (state.price[0] > PRICE_MIN) params.set('minPrice', String(state.price[0]));
    if (state.price[1] < priceMax) params.set('maxPrice', String(state.price[1]));
    if (state.rating) params.set('rating', state.rating);
    if (state.durations.length) params.set('duration', state.durations.join(','));
    if (state.cancellation) params.set('cancellation', state.cancellation);
    if (state.pickup) params.set('pickup', '1');
    if (state.date) params.set('date', state.date);
    // Guest counts are encoded only when they differ from the default, keeping the
    // URL clean; they survive navigation so the stepper value is preserved.
    if (state.guests.adults !== DEFAULT_GUESTS.adults)
        params.set('adults', String(state.guests.adults));
    if (state.guests.children !== DEFAULT_GUESTS.children)
        params.set('children', String(state.guests.children));
    if (state.guests.infants !== DEFAULT_GUESTS.infants)
        params.set('infants', String(state.guests.infants));
    if (state.timeOfDay.length) params.set('timeOfDay', state.timeOfDay.join(','));
    // Dynamic attribute filters as raw `key=v1,v2` params (preserved across nav).
    for (const [key, values] of Object.entries(state.attributes)) {
        if (values.length) params.set(key, values.join(','));
    }
    if (state.page > 1) params.set('page', String(state.page));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}
