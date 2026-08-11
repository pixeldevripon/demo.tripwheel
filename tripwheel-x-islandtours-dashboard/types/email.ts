/**
 * Email send-log types (WP-E), mirroring the backend's `EmailSend` model
 * (island-tour-development `technical-doc/emails/EMAIL-IMPLEMENTATION-PLAN.md`
 * §2.2). Rows are read-only timeline entries served by
 * `GET /operators/:id/emails` and `GET /bookings/:id/emails`.
 */

export const EMAIL_TEMPLATE_KEYS = [
    'BK1_CONFIRMATION',
    'BK2_PRE_TOUR_REMINDER',
    'BK3_REVIEW_REQUEST',
    'BK3R_REVIEW_REMINDER',
    'MK1_NEXT_ADVENTURE',
    'CX1_CANCELLATION',
    'OB1_VERIFY_EMAIL',
    'OB2_WELCOME_AGREEMENT',
    'OB2A_APPROVED',
    'OB3_FIRST_TOUR_HOWTO',
    'OB4_BUILD_IT_WITH_YOU',
    'OB5_TOUR_LIVE',
    'OB6_CHECK_IN',
    'OB7_CONNECT_CALENDAR',
    'OB8_PAGE_STRONGER',
    'INT1_NEW_OPERATOR',
    'INT1R_PENDING_REMINDER',
    'INT2_NEW_TOUR',
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export type EmailStream =
    | 'TRANSACTIONAL'
    | 'LIFECYCLE'
    | 'MARKETING'
    | 'INTERNAL';

export const EMAIL_SEND_STATUS_VALUES = [
    'SENT',
    'FAILED',
    'SUPPRESSED',
] as const;

export type EmailSendStatus = (typeof EMAIL_SEND_STATUS_VALUES)[number];

/**
 * One send-log row. `templateKey` arrives as a plain string rather than the
 * closed union so a template key added on the backend renders (with its raw
 * key as the label) instead of breaking the timeline.
 */
export interface EmailSendRow {
    id: string;
    templateKey: string;
    /** Dedupe scope: booking id, operator id (or `...#resend-n`), or email. */
    scopeId: string;
    toEmail: string;
    stream: EmailStream;
    status: EmailSendStatus;
    /** Platform locale the copy rendered in; null for English-only sends. */
    locale: string | null;
    providerMessageId: string | null;
    /** Why the email deliberately did not go out (status = SUPPRESSED). */
    suppressedReason: string | null;
    /** Transport error (status = FAILED). */
    error: string | null;
    createdAt: string;
}

/**
 * Templates the dashboard may re-send through
 * `POST /operators/:id/emails/:templateKey/resend` - the operator onboarding
 * set (OB-*, incl. OB-2A). Booking/marketing/internal emails have their own
 * paths and are never resent from here.
 */
export const RESENDABLE_TEMPLATE_KEYS = [
    'OB1_VERIFY_EMAIL',
    'OB2_WELCOME_AGREEMENT',
    'OB2A_APPROVED',
    'OB3_FIRST_TOUR_HOWTO',
    'OB4_BUILD_IT_WITH_YOU',
    'OB5_TOUR_LIVE',
    'OB6_CHECK_IN',
    'OB7_CONNECT_CALENDAR',
    'OB8_PAGE_STRONGER',
] as const satisfies readonly EmailTemplateKey[];

export function isResendableTemplate(templateKey: string): boolean {
    return (RESENDABLE_TEMPLATE_KEYS as readonly string[]).includes(
        templateKey,
    );
}
