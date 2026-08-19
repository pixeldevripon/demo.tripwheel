'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { staffApi } from '@/lib/api/staff';
import type {
    CreateDesignationPayload,
    InviteStaffPayload,
    StaffQueryParams,
    StaffScope,
    UpdateDesignationPayload,
    UpdateStaffPayload,
    UpdateStaffStatusPayload,
} from '@/types/staff';

export const staffKeys = {
    all: ['staff'] as const,
    catalogs: () => [...staffKeys.all, 'catalog'] as const,
    catalog: (scope: StaffScope) => [...staffKeys.catalogs(), scope] as const,
    members: (scope: StaffScope) => [...staffKeys.all, scope, 'member'] as const,
    memberList: (scope: StaffScope, params: StaffQueryParams) =>
        [...staffKeys.members(scope), 'list', params] as const,
    memberDetail: (scope: StaffScope, id: string) =>
        [...staffKeys.members(scope), 'detail', id] as const,
    designations: (scope: StaffScope, operatorId?: string) =>
        [...staffKeys.all, scope, 'designations', operatorId ?? null] as const,
};

const onError = (err: Error) => toast.error(err.message || 'Something went wrong');

// ── Permission catalog ────────────────────────────────────────────────────────

export function usePermissionCatalog(scope: StaffScope) {
    return useQuery({
        queryKey: staffKeys.catalog(scope),
        queryFn: () => staffApi.getPermissionCatalog(scope),
        // The catalog is code-defined on the backend - it only changes on deploy.
        staleTime: 5 * 60_000,
    });
}

// ── Members ───────────────────────────────────────────────────────────────────

export function useStaffMembers(scope: StaffScope, params: StaffQueryParams = {}) {
    return useQuery({
        queryKey: staffKeys.memberList(scope, params),
        queryFn: () => staffApi.getMembers(scope, params),
        placeholderData: keepPreviousData,
    });
}

/** One member's profile. `id` empty/undefined keeps the query idle. */
export function useStaffMember(scope: StaffScope, id: string) {
    return useQuery({
        queryKey: staffKeys.memberDetail(scope, id),
        queryFn: () => staffApi.getMember(scope, id),
        enabled: Boolean(id),
    });
}

export function useInviteStaff(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: InviteStaffPayload) => staffApi.invite(scope, payload),
        onSuccess: (member) => {
            qc.invalidateQueries({ queryKey: staffKeys.members(scope) });
            toast.success(`Invite sent to ${member.user.email}`);
        },
        onError,
    });
}

export function useUpdateStaff(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateStaffPayload }) =>
            staffApi.update(scope, id, payload),
        onSuccess: (member) => {
            qc.invalidateQueries({ queryKey: staffKeys.members(scope) });
            qc.invalidateQueries({ queryKey: staffKeys.memberDetail(scope, member.id) });
            toast.success('Member updated');
        },
        onError,
    });
}

/**
 * Renames a member's auth account (UPDATE_USER, admin-only). Invalidates the
 * whole scope: the name shows on the list row, the profile and the sheet.
 */
export function useRenameStaffUser(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, name }: { userId: string; name: string }) =>
            staffApi.renameUser(userId, name),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: staffKeys.members(scope) });
            toast.success('Name updated');
        },
        onError,
    });
}

export function useUpdateStaffStatus(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateStaffStatusPayload }) =>
            staffApi.updateStatus(scope, id, payload),
        onSuccess: (member) => {
            qc.invalidateQueries({ queryKey: staffKeys.members(scope) });
            toast.success(
                member.status === 'SUSPENDED'
                    ? 'Member suspended - all their sessions were signed out'
                    : 'Member reactivated',
            );
        },
        onError,
    });
}

export function useRemoveStaff(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, operatorId }: { id: string; operatorId?: string }) =>
            staffApi.remove(scope, id, operatorId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: staffKeys.members(scope) });
            toast.success('Member removed');
        },
        onError,
    });
}

export function useResendStaffInvite(scope: StaffScope) {
    return useMutation({
        mutationFn: ({ id, operatorId }: { id: string; operatorId?: string }) =>
            staffApi.resendInvite(scope, id, operatorId),
        onSuccess: () => toast.success('Invite email sent'),
        onError,
    });
}

// ── Designations ──────────────────────────────────────────────────────────────

export function useDesignations(scope: StaffScope, operatorId?: string) {
    return useQuery({
        queryKey: staffKeys.designations(scope, operatorId),
        queryFn: () => staffApi.getDesignations(scope, operatorId),
    });
}

export function useCreateDesignation(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateDesignationPayload) =>
            staffApi.createDesignation(scope, payload),
        onSuccess: (designation) => {
            qc.invalidateQueries({ queryKey: staffKeys.all });
            toast.success(`Designation "${designation.name}" created`);
        },
        onError,
    });
}

export function useUpdateDesignation(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: UpdateDesignationPayload }) =>
            staffApi.updateDesignation(scope, id, payload),
        onSuccess: () => {
            // A template edit changes every holder's effective set - refresh
            // members too, not just the designation list.
            qc.invalidateQueries({ queryKey: staffKeys.all });
            toast.success('Designation updated');
        },
        onError,
    });
}

export function useDeleteDesignation(scope: StaffScope) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, operatorId }: { id: string; operatorId?: string }) =>
            staffApi.deleteDesignation(scope, id, operatorId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: staffKeys.all });
            toast.success('Designation deleted');
        },
        onError,
    });
}
