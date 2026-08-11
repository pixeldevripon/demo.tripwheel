/**
 * Email centre types (WP-H), mirroring the backend's `email-centre.dto.ts`
 * (island-tour-development `src/mail/dto/email-centre.dto.ts`, merged in
 * PR #192). The send-log row itself lives in `types/email.ts` (WP-E) and is
 * reused as-is.
 *
 * DELIBERATELY ABSENT: any switch for the booking emails (BK-1/BK-2/CX-1).
 * They are contractual and always-on (founder decision 2026-08-11); the
 * backend 400s any attempt to PATCH such a field.
 */

import type { EmailSendStatus, EmailStream } from './email';

export type EmailAudience = 'TRAVELLER' | 'OPERATOR';

/** `{ total, page, limit, data }` — the platform's paginated wrapper. */
export interface Paginated<T> {
    total: number;
    page: number;
    limit: number;
    data: T[];
}

// ── Settings ────────────────────────────────────────────────────────────────

/**
 * The BK-3/BK-3R schedule slice carried on the same settings payload (one
 * switchboard). Unlike the email settings it is never nullable — its table
 * has NOT NULL defaults, so there is no "clear back to fallback" concept.
 * `reminderEnabled`/`batchSize` stay on Settings → Review Requests.
 */
export interface ReviewRequestSettingsSlice {
    enabled: boolean;
    firstSendLocalHour: number;
    firstSendDelayDays: number;
    reminderAfterDays: number;
    giveUpAfterDays: number;
}

/** One fully resolved value set (the GET's `effective` and `defaults`). */
export interface EmailSettingsValues {
    marketingEnabled: boolean;
    onboardingEnabled: boolean;
    calendarEmailEnabled: boolean;
    ob8PartnerOffer: boolean;
    salesEmail: string | null;
    mailReplyTo: string | null;
    ob6ReplyTo: string | null;
    ob3DelayHours: number;
    ob4DelayDays: number;
    ob6DelayDays: number;
    ob7AfterLiveDays: number;
    ob8AfterLiveDays: number;
    pendingReminderBusinessDays: number;
    windowWeekdays: string;
    windowStartHour: number;
    windowEndHour: number;
    mk1DelayHours: number;
    review: ReviewRequestSettingsSlice;
}

/** The raw stored row — null everywhere the admin never overrode. */
export type EmailSettingsStored = {
    [K in Exclude<keyof EmailSettingsValues, 'review'>]:
        | EmailSettingsValues[K]
        | null;
} & { review: ReviewRequestSettingsSlice };

/** The email-settings keys an admin can override (everything but `review`). */
export type EmailSettingsScalarKey = Exclude<
    keyof EmailSettingsValues,
    'review'
>;

/**
 * GET /email/settings — `effective` is what the programme runs on right now;
 * `stored` is what the admin explicitly set (null = never touched);
 * `defaults` is what a null falls back to (env value where one exists, else
 * the built-in), for the "using default (…)" hints.
 */
export interface EmailSettingsResponse {
    effective: EmailSettingsValues;
    stored: EmailSettingsStored;
    defaults: EmailSettingsValues;
}

/**
 * PATCH /email/settings. Tri-state per email-settings field: absent =
 * untouched · null = clear the override (back to env/built-in) · value =
 * store. The `review` object accepts any subset of its five fields and is
 * never nullable.
 */
export type UpdateEmailSettingsPayload = {
    [K in EmailSettingsScalarKey]?: EmailSettingsValues[K] | null;
} & { review?: Partial<ReviewRequestSettingsSlice> };

// ── Lists ───────────────────────────────────────────────────────────────────

export interface EmailSendsQueryParams {
    templateKey?: string;
    status?: EmailSendStatus;
    stream?: EmailStream;
    /** Exact recipient match (case-insensitive). */
    toEmail?: string;
    /** Rows created at/after this instant (ISO 8601). */
    from?: string;
    /** Rows created at/before this instant (ISO 8601). */
    to?: string;
    page?: number;
    limit?: number;
}

export interface EmailPeopleQueryParams {
    /** Email search — prefix or exact match on the lowercased column. */
    email?: string;
    page?: number;
    limit?: number;
}

export interface EmailOptOutRow {
    id: string;
    email: string;
    audience: EmailAudience;
    stream: EmailStream;
    source: string;
    createdAt: string;
}

export interface EmailConsentRow {
    id: string;
    email: string;
    source: string;
    bookingId: string | null;
    createdAt: string;
}
