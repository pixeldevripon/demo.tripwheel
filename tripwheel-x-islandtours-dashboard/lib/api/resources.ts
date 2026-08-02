import type {
    CreateResourcePayload,
    PaginatedResources,
    Resource,
    UpdateResourcePayload,
} from '@/types/resource';
import { apiFetch } from './fetch';

/**
 * Resources - the boats, guides and vehicles that couple tours together.
 *
 * The backend scopes every call to the caller's own operator and rejects any
 * tour or resource id it does not own, so nothing here passes an operatorId.
 */
export const resourcesApi = {
    list(tourId?: string): Promise<PaginatedResources> {
        const qs = tourId ? `?tourId=${encodeURIComponent(tourId)}` : '';
        return apiFetch<PaginatedResources>(`/resources${qs}`);
    },

    get(id: string): Promise<Resource> {
        return apiFetch<Resource>(`/resources/${id}`);
    },

    create(payload: CreateResourcePayload): Promise<Resource> {
        return apiFetch<Resource>('/resources', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    update(id: string, payload: UpdateResourcePayload): Promise<Resource> {
        return apiFetch<Resource>(`/resources/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    remove(id: string): Promise<void> {
        return apiFetch<void>(`/resources/${id}`, { method: 'DELETE' });
    },

    /**
     * Full replace of what a tour consumes - an empty array detaches
     * everything. One call rather than add/remove, so a partial failure cannot
     * leave the tour half-attached.
     */
    setForTour(tourId: string, resourceIds: string[]): Promise<Resource[]> {
        return apiFetch<Resource[]>(`/tours/${tourId}/resources`, {
            method: 'PUT',
            body: JSON.stringify({ resourceIds }),
        });
    },
};
