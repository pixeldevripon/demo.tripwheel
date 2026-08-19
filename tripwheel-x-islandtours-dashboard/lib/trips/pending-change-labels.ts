import type { PendingChangeArea } from '@/types/trip';

/** Human labels for a change set's areas - shared by the banner chips, the
 *  queue chips and the diff section headings so they can never disagree. */
export const PENDING_AREA_LABELS: Record<PendingChangeArea, string> = {
    title: 'Title',
    content: 'Description',
    photos: 'Photos',
    conditions: 'Booking conditions',
    highlights: 'Highlights',
    inclusions: "What's included",
    exclusions: 'Not included',
    features: 'Info & terms',
    locations: 'Itinerary',
};
