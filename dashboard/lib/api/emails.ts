import type { EmailSendRow } from '@/types/email';
import { apiFetch } from './fetch';

/**
 * Send-log timeline reads + admin resend (WP-E). Rows come from the backend's
 * global email send log; both list endpoints return newest-first.
 *
 * `resend` targets WP-D's `POST /operators/:id/emails/:templateKey/resend`
 * (plan §2.5) - it writes a `#resend-{n}` log row and re-sends the template.
 */
export const emailsApi = {
    listForOperator(operatorId: string): Promise<EmailSendRow[]> {
        return apiFetch<EmailSendRow[]>(
            `/operators/${encodeURIComponent(operatorId)}/emails`,
        );
    },

    listForBooking(bookingId: string): Promise<EmailSendRow[]> {
        return apiFetch<EmailSendRow[]>(
            `/bookings/${encodeURIComponent(bookingId)}/emails`,
        );
    },

    resend(operatorId: string, templateKey: string): Promise<EmailSendRow> {
        return apiFetch<EmailSendRow>(
            `/operators/${encodeURIComponent(operatorId)}/emails/${encodeURIComponent(templateKey)}/resend`,
            { method: 'POST' },
        );
    },
};
