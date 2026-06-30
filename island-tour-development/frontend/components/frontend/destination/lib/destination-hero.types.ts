/** Shared types for the destination hero shell + its split search component. */

export type DestinationHeroDict = {
    toursActivities: string;
    subtitle: string;
    searchPlaceholder: string;
    selectDate: string;
    popularLabel: string;
};

/** An "activity" (category) chip in the hero - links to its category page. */
export type ActivityLink = { label: string; href: string };
