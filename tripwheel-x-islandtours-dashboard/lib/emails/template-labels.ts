import type { EmailTemplateKey } from '@/types/email';

/**
 * Human labels for `EmailTemplateKey` - the SINGLE source for every surface
 * that names an email (verification queue sheet, operator edit page timeline,
 * booking details sheet). Add a backend template key here once and it renders
 * identically everywhere.
 */
export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
    BK1_CONFIRMATION: 'Booking confirmation',
    BK2_PRE_TOUR_REMINDER: 'Pre-tour reminder',
    BK3_REVIEW_REQUEST: 'Review request',
    BK3R_REVIEW_REMINDER: 'Review reminder',
    MK1_NEXT_ADVENTURE: 'Next adventure (marketing)',
    CX1_CANCELLATION: 'Cancellation confirmation',
    OB1_VERIFY_EMAIL: 'Verify your email',
    OB2_WELCOME_AGREEMENT: 'Welcome & agreement',
    OB2A_APPROVED: "You're approved",
    OB3_FIRST_TOUR_HOWTO: 'First tour, step by step',
    OB4_BUILD_IT_WITH_YOU: "We'll build it with you",
    OB5_TOUR_LIVE: 'Your tour is live',
    OB6_CHECK_IN: 'Founder check-in',
    OB7_CONNECT_CALENDAR: 'Connect your calendar',
    OB8_PAGE_STRONGER: 'Make your page stronger',
    INT1_NEW_OPERATOR: 'New operator alert (sales)',
    INT1R_PENDING_REMINDER: 'Pending-review reminder (sales)',
    INT2_NEW_TOUR: 'New tour submitted (sales)',
};

/** Label for a template key; falls back to the raw key for unknown ones. */
export function emailTemplateLabel(templateKey: string): string {
    return (
        EMAIL_TEMPLATE_LABELS[templateKey as EmailTemplateKey] ?? templateKey
    );
}
