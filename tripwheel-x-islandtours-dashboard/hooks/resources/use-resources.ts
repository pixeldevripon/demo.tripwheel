'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { resourcesApi } from '@/lib/api/resources';
import type {
    CreateResourcePayload,
    UpdateResourcePayload,
} from '@/types/resource';

export const resourceKeys = {
    all: ['resources'] as const,
    list: (tourId?: string) => [...resourceKeys.all, tourId ?? 'operator'] as const,
};

const onError = (err: Error) => toast.error(err.message || 'Resource request failed');

/** Every resource this operator has. Used by the picker and the manage screen. */
export function useResources(tourId?: string) {
    return useQuery({
        queryKey: resourceKeys.list(tourId),
        queryFn: () => resourcesApi.list(tourId),
    });
}

/**
 * A resource change alters which tours are coupled, so BOTH the operator-wide
 * list and any per-tour view are stale afterwards. Invalidating the whole key
 * space is cheap here - an operator has a handful of assets, not thousands -
 * and it avoids a stale picker showing a fleet that was just renamed.
 */
function invalidateResources(qc: ReturnType<typeof useQueryClient>) {
    void qc.invalidateQueries({ queryKey: resourceKeys.all });
}

export function useCreateResource() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateResourcePayload) => resourcesApi.create(payload),
        onSuccess: (resource) => {
            invalidateResources(qc);
            toast.success(`${resource.name} added`);
        },
        onError,
    });
}

export function useUpdateResource() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateResourcePayload }) =>
            resourcesApi.update(id, payload),
        onSuccess: () => {
            invalidateResources(qc);
            toast.success('Saved');
        },
        onError,
    });
}

export function useDeleteResource() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => resourcesApi.remove(id),
        onSuccess: () => {
            invalidateResources(qc);
            toast.success('Removed');
        },
        onError,
    });
}

/** Replace the whole set a tour consumes. */
export function useSetTourResources(tourId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (resourceIds: string[]) =>
            resourcesApi.setForTour(tourId, resourceIds),
        onSuccess: () => {
            invalidateResources(qc);
            toast.success('Shared equipment updated');
        },
        onError,
    });
}
