/** Shared navbar types - one island/category shape, the two dictionary slices. */

export type Island = { name: string; slug: string };
export type Category = {
    name: string;
    slug: string;
    /** Published tour count - shown in the categories dropdown rows. */
    tours?: number;
    /** Category thumbnail for the dropdown row; null keeps the peach slot. */
    image?: string | null;
};

/** Strings the navbar chrome needs (labels, aria text). */
export type NavDict = {
    selectIsland: string;
    /** Short island label for the mobile selector pill (mockup .nss). */
    island: string;
    wishlist: string;
    /** "Saved" - the wishlist pill's visible label (mockup navpill). */
    saved: string;
    account: string;
    myAccount: string;
    /**
     * No longer rendered: the `/bookings` lookup moved to the footer as
     * "Track your booking". Kept on the contract because the dictionaries still
     * carry `nav.myBookings` in all 7 locales, and dropping the field here would
     * only hide that from the next person who greps for it.
     */
    myBookings: string;
    logout: string;
    menu: string;
    close: string;
    language: string;
    categories: string;
    /** Count word for the categories dropdown rows - "15 tours". */
    tours: string;
    /** "All {destination} tours" - the categories dropdown footer link. */
    allIslandTours: string;
    search: string;
};

/** Strings used by the search typeahead (the `search` dict + a few card labels). */
export type SearchDict = {
    /** "Search" - the hero pill's labeled submit button (+ /search page title). */
    title: string;
    searching: string;
    seeAll: string;
    noResults: string;
    // Suggest panel sections (Fever-style).
    toursIn: string;
    /** Zero-state group headings (master 5.10). */
    categoriesAndHubs: string;
    collections: string;
    beyond: string;
    tourCount: string;
    tourCountOne: string;
    seeAllTours: string;
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
