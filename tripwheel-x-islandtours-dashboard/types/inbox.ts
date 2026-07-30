/**
 * The dashboard inbox - the bell, the sidebar badges and the login digest.
 *
 * Mirrors `backend/src/inbox`. NOT the backend's `notifications` module, which
 * is the OCTO webhook system (machine-to-machine delivery to OTA partners) and
 * has nothing to do with this.
 */

export type InboxCategory =
    | 'TOURS'
    | 'BOOKINGS'
    | 'CANCELLATIONS'
    | 'PAYMENTS'
    | 'REVIEWS'
    | 'SETTLEMENTS'
    | 'PROMOTION'
    | 'TEAM'
    | 'SYSTEM';

export type InboxEvent =
    | 'TOUR_SUBMITTED_FOR_REVIEW'
    | 'TOUR_APPROVED'
    | 'TOUR_CHANGES_REQUESTED'
    | 'TOUR_PUBLISHED'
    | 'TOUR_UNLISTED_NO_DEPARTURES'
    | 'SPOTLIGHT_REQUESTED'
    | 'SPOTLIGHT_APPROVED'
    | 'SPOTLIGHT_REJECTED'
    | 'TIER_DEMOTED'
    | 'BOOKING_CONFIRMED'
    | 'BOOKING_CANCELLATION_REQUESTED'
    | 'BOOKING_OPERATOR_REPORTED_CANCELLATION'
    | 'BOOKING_OPERATOR_REPORTED_NON_PAYMENT'
    | 'BOOKING_CANCELLED'
    | 'REVIEW_SUBMITTED'
    | 'REVIEW_PUBLISHED'
    | 'SETTLEMENT_STATEMENT_READY'
    | 'TEAM_SEAT_INVITED';

export interface InboxNotification {
    id: string;
    category: InboxCategory;
    event: InboxEvent;
    title: string;
    body: string | null;
    /** Dashboard-RELATIVE path. Never render it as an external link. */
    url: string;
    entityType: string | null;
    entityId: string | null;
    /** Null while unread. */
    readAt: string | null;
    createdAt: string;
}

export interface InboxListResponse {
    data: InboxNotification[];
    /** Pass back as `cursor`; null when the list is exhausted. */
    nextCursor: string | null;
}

export interface InboxSummary {
    unread: number;
    /** Only non-zero categories are present. */
    byCategory: Partial<Record<InboxCategory, number>>;
    latestAt: string | null;
}

export interface InboxDigest {
    data: InboxNotification[];
    unread: number;
}

export interface InboxListParams {
    cursor?: string;
    limit?: number;
    category?: InboxCategory;
    unreadOnly?: boolean;
}

export interface MarkInboxReadPayload {
    ids?: string[];
    category?: InboxCategory;
    all?: boolean;
}

/**
 * Deleting, not hiding. Same shape as marking read, plus `onlyRead` for the
 * safe sweep. An empty object deletes nothing - the backend refuses it too.
 */
export interface ClearInboxPayload {
    ids?: string[];
    category?: InboxCategory;
    all?: boolean;
    onlyRead?: boolean;
}
