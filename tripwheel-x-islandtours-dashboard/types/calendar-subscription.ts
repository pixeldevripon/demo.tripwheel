/**
 * Inbound calendar sync (iCal import). Mirrors backend
 * `src/calendar-sync/dto/calendar-subscription.dto.ts`.
 *
 * Export feeds are a separate thing entirely - see `types/calendar-feed.ts`.
 * One pushes our availability out to a channel; this pulls a channel's busy
 * dates in.
 */

export const CalendarPlatform = {
    AIRBNB: 'AIRBNB',
    BOOKING_COM: 'BOOKING_COM',
    EXPEDIA: 'EXPEDIA',
    VRBO: 'VRBO',
    VIATOR: 'VIATOR',
    GETYOURGUIDE: 'GETYOURGUIDE',
    MAKEMYTRIP: 'MAKEMYTRIP',
    GOOGLE_CALENDAR: 'GOOGLE_CALENDAR',
    OTHER: 'OTHER',
} as const;
export type CalendarPlatform =
    (typeof CalendarPlatform)[keyof typeof CalendarPlatform];

/** Human names for the picker and every message that says where a block came from. */
export const PLATFORM_LABELS: Record<CalendarPlatform, string> = {
    AIRBNB: 'Airbnb',
    BOOKING_COM: 'Booking.com',
    EXPEDIA: 'Expedia',
    VRBO: 'Vrbo',
    VIATOR: 'Viator',
    GETYOURGUIDE: 'GetYourGuide',
    MAKEMYTRIP: 'MakeMyTrip',
    GOOGLE_CALENDAR: 'Google Calendar',
    OTHER: 'Other',
};

/**
 * What a busy event from the channel does to this tour's inventory.
 *
 * The operator picks, because iCal carries NO seat count: an external "Busy"
 * means the listing is unavailable, never "one of sixty seats sold".
 */
export const CalendarImportMode = {
    CLOSE_DATES: 'CLOSE_DATES',
    CLOSE_SLOTS: 'CLOSE_SLOTS',
    WARN_ONLY: 'WARN_ONLY',
    IGNORE: 'IGNORE',
} as const;
export type CalendarImportMode =
    (typeof CalendarImportMode)[keyof typeof CalendarImportMode];

export const CalendarSubscriptionStatus = {
    PENDING: 'PENDING',
    SYNCING: 'SYNCING',
    ACTIVE: 'ACTIVE',
    ERROR: 'ERROR',
    INVALID_URL: 'INVALID_URL',
    PAUSED: 'PAUSED',
    DISCONNECTED: 'DISCONNECTED',
} as const;
export type CalendarSubscriptionStatus =
    (typeof CalendarSubscriptionStatus)[keyof typeof CalendarSubscriptionStatus];

export interface CalendarSubscription {
    id: string;
    tourId: string;
    platform: CalendarPlatform;
    platformLabel: string | null;
    /** Masked to the origin in list responses; full only on the single read. */
    url: string;
    urlMasked: boolean;
    importMode: CalendarImportMode;
    status: CalendarSubscriptionStatus;
    autoSyncEnabled: boolean;
    syncIntervalMinutes: number;
    lastPolledAt: string | null;
    lastSuccessAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
    lastEventCount: number;
    /** Dates this connection currently holds closed. */
    blockedCount: number;
    /** Unacknowledged double-sale warnings - the number to badge. */
    openConflictCount: number;
    excludeFromExport: boolean;
    notes: string | null;
    createdAt: string;
}

/** Dry-run result from the URL field, before anything is saved. */
export interface ValidateFeedResult {
    valid: boolean;
    eventCount?: number;
    calendarName?: string | null;
    firstEvent?: string | null;
    lastEvent?: string | null;
    feedSizeBytes?: number;
    warnings?: string[];
    errorCode?: string;
    message?: string;
}

export interface SyncRunResult {
    outcome: string;
    eventsFound: number;
    blocksCreated: number;
    blocksRemoved: number;
    conflictsDetected: number;
    errorCode: string | null;
    errorMessage: string | null;
    durationMs: number;
}

export interface DisconnectResult {
    datesReleased: number;
    datesConvertedToManual: number;
}

export type IcalSyncOutcome =
    | 'SUCCESS'
    | 'PARTIAL'
    | 'FAILED'
    | 'UNCHANGED'
    | 'DRY_RUN';

export type IcalSyncTrigger =
    | 'SCHEDULED'
    | 'MANUAL'
    | 'ON_CONNECT'
    | 'RETRY'
    | 'ADMIN';

/** One run, as the operator reads it in the history panel. */
export interface SyncLogEntry {
    id: string;
    outcome: IcalSyncOutcome;
    trigger: IcalSyncTrigger;
    httpStatus: number | null;
    eventsFound: number;
    /** The delta that matters - a run changing nothing shows 0/0. */
    blocksCreated: number;
    blocksRemoved: number;
    conflictsDetected: number;
    errorCode: string | null;
    errorMessage: string | null;
    durationMs: number;
    startedAt: string;
}

export interface PaginatedSyncLogs {
    total: number;
    page: number;
    limit: number;
    data: SyncLogEntry[];
}

export interface CreateCalendarSubscriptionPayload {
    tourId: string;
    platform: CalendarPlatform;
    platformLabel?: string;
    url: string;
    importMode?: CalendarImportMode;
    syncIntervalMinutes?: number;
    notes?: string;
}

export interface UpdateCalendarSubscriptionPayload {
    url?: string;
    importMode?: CalendarImportMode;
    syncIntervalMinutes?: number;
    autoSyncEnabled?: boolean;
    excludeFromExport?: boolean;
    notes?: string;
    platformLabel?: string;
}
