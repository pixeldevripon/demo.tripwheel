/** Shared navbar types - one island/category shape, the two dictionary slices. */

export type Island = { name: string; slug: string };
export type Category = { name: string; slug: string };

/** Strings the navbar chrome needs (labels, aria text). */
export type NavDict = {
    selectIsland: string;
    wishlist: string;
    account: string;
    menu: string;
    close: string;
    language: string;
    categories: string;
    search: string;
};

/** Strings used by the search typeahead (the `search` dict + a few card labels). */
export type SearchDict = {
    searching: string;
    seeAll: string;
    noResults: string;
    // Duration units (satisfies DurationDict for formatDuration).
    hours: string;
    hour: string;
    minutes: string;
    range: string;
    // Card meta labels.
    pickupAvailable: string;
    freeCancellation: string;
    from: string;
};
