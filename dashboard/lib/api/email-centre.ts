import type { EmailSendRow } from '@/types/email';
import type {
    EmailConsentRow,
    EmailOptOutRow,
    EmailPeopleQueryParams,
    EmailSendsQueryParams,
    EmailSettingsResponse,
    Paginated,
    UpdateEmailSettingsPayload,
} from '@/types/email-centre';
import { apiFetch, buildQuery } from './fetch';

/**
 * The admin email centre (WP-H): settings switchboard, global activity log,
 * people lists and test-send. Every route here is MANAGE_SYSTEM on the
 * backend.
 *
 * These are `/email/...` paths — they back no cached public page, so they
 * trigger no public-site revalidation (see `cache-revalidation.ts`).
 */
export const emailCentreApi = {
    getSettings(): Promise<EmailSettingsResponse> {
        return apiFetch<EmailSettingsResponse>('/email/settings');
    },

    /**
     * Tri-state PATCH: send ONLY the fields the admin touched — a value
     * stores an override, an explicit null clears one, an absent key leaves
     * the setting untouched. Responds with the same `{effective, stored,
     * defaults}` shape as the GET.
     */
    updateSettings(
        payload: UpdateEmailSettingsPayload,
    ): Promise<EmailSettingsResponse> {
        return apiFetch<EmailSettingsResponse>('/email/settings', {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    listSends(
        params: EmailSendsQueryParams = {},
    ): Promise<Paginated<EmailSendRow>> {
        return apiFetch<Paginated<EmailSendRow>>(
            `/email/sends${buildQuery({ ...params })}`,
        );
    },

    listOptOuts(
        params: EmailPeopleQueryParams = {},
    ): Promise<Paginated<EmailOptOutRow>> {
        return apiFetch<Paginated<EmailOptOutRow>>(
            `/email/opt-outs${buildQuery({ ...params })}`,
        );
    },

    listConsents(
        params: EmailPeopleQueryParams = {},
    ): Promise<Paginated<EmailConsentRow>> {
        return apiFetch<Paginated<EmailConsentRow>>(
            `/email/consents${buildQuery({ ...params })}`,
        );
    },

    /**
     * Renders the template with fixed sample data and sends it to the
     * CALLING admin's own address — the body carries no recipient. The
     * response is the written send-log row (`scopeId = test:<userId>#<n>`).
     */
    testSend(templateKey: string): Promise<EmailSendRow> {
        return apiFetch<EmailSendRow>('/email/test-send', {
            method: 'POST',
            body: JSON.stringify({ templateKey }),
        });
    },
};
