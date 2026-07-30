import type {
    ClearInboxPayload,
    InboxDigest,
    InboxListParams,
    InboxListResponse,
    InboxSummary,
    MarkInboxReadPayload,
} from '@/types/inbox';
import { apiFetch } from './fetch';

function buildQuery(params: InboxListParams): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            qs.set(key, String(value));
        }
    }
    const str = qs.toString();
    return str ? `?${str}` : '';
}

/**
 * Every route is self-scoped by the session cookie - there is no user id to
 * pass, and no way to read someone else's inbox.
 */
export const inboxApi = {
    /**
     * The polled endpoint. One grouped count; the list is NOT fetched until the
     * bell is opened, which keeps the background cost to a single indexed
     * aggregate per interval per tab.
     */
    summary(): Promise<InboxSummary> {
        return apiFetch<InboxSummary>('/inbox/summary');
    },

    list(params: InboxListParams = {}): Promise<InboxListResponse> {
        return apiFetch<InboxListResponse>(`/inbox${buildQuery(params)}`);
    },

    markRead(payload: MarkInboxReadPayload): Promise<{ updated: number }> {
        return apiFetch<{ updated: number }>('/inbox/read', {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    /** Delete in bulk: one category, a set of ids, everything, or everything read. */
    clear(payload: ClearInboxPayload): Promise<{ deleted: number }> {
        return apiFetch<{ deleted: number }>('/inbox', {
            method: 'DELETE',
            body: JSON.stringify(payload),
        });
    },

    /** Dismiss one row. */
    remove(id: string): Promise<{ deleted: number }> {
        return apiFetch<{ deleted: number }>(`/inbox/${id}`, {
            method: 'DELETE',
        });
    },

    /**
     * POST because it stamps the server-side "digest shown" marker. Returns an
     * empty `data` when there is nothing new - the modal must not render then.
     */
    digest(): Promise<InboxDigest> {
        return apiFetch<InboxDigest>('/inbox/digest', { method: 'POST' });
    },
};
