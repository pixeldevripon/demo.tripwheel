/** Shared types for the destination hero shell + its split search component. */

export type DestinationHeroDict = {
    toursActivities: string;
    subtitle: string;
    searchPlaceholder: string;
    /**
     * Mobile placeholders. "What?" / "When?" rather than the full questions,
     * which truncate in a 375px-wide pill - the aria-labels stay the full
     * question at every width, so only the visible hint shortens.
     */
    searchPlaceholderShort: string;
    selectDate: string;
    selectDateShort: string;
    clearDate: string;
    popularLabel: string;
};

/** An "activity" (category) chip in the hero - links to its category page. */
export type ActivityLink = { label: string; href: string };
