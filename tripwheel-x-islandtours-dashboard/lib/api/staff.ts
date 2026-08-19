import type {
    CreateDesignationPayload,
    InviteStaffPayload,
    PaginatedStaff,
    PermissionCatalog,
    StaffDesignation,
    StaffMember,
    StaffQueryParams,
    StaffScope,
    UpdateDesignationPayload,
    UpdateStaffPayload,
    UpdateStaffStatusPayload,
} from '@/types/staff';
import { apiFetch, buildQuery } from './fetch';

/**
 * Staff & Teams API. One client, two route families selected by `scope`:
 *   platform -> /staff...       (admin manages platform staff + designations)
 *   team     -> /staff/team...  (operator owner manages team seats; admins
 *                                pass operatorId explicitly)
 */
const base = (scope: StaffScope) => (scope === 'team' ? '/staff/team' : '/staff');

/** Non-GET routes carry admin operatorId in the QUERY for these endpoints. */
const scopeQuery = (operatorId?: string) => buildQuery({ operatorId });

export const staffApi = {
    getPermissionCatalog(scope: StaffScope): Promise<PermissionCatalog> {
        return apiFetch<PermissionCatalog>(
            `/staff/permission-catalog${buildQuery({ scope })}`,
        );
    },

    // ── Members ──────────────────────────────────────────────────────────────

    getMembers(scope: StaffScope, params: StaffQueryParams = {}): Promise<PaginatedStaff> {
        const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
        return apiFetch<PaginatedStaff>(`${base(scope)}${query}`);
    },

    getMember(scope: StaffScope, id: string, operatorId?: string): Promise<StaffMember> {
        return apiFetch<StaffMember>(`${base(scope)}/${id}${scopeQuery(operatorId)}`);
    },

    invite(scope: StaffScope, payload: InviteStaffPayload): Promise<StaffMember> {
        return apiFetch<StaffMember>(`${base(scope)}/invite`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    update(scope: StaffScope, id: string, payload: UpdateStaffPayload): Promise<StaffMember> {
        return apiFetch<StaffMember>(`${base(scope)}/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    updateStatus(
        scope: StaffScope,
        id: string,
        payload: UpdateStaffStatusPayload,
    ): Promise<StaffMember> {
        return apiFetch<StaffMember>(`${base(scope)}/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    remove(scope: StaffScope, id: string, operatorId?: string): Promise<{ message: string }> {
        return apiFetch<{ message: string }>(
            `${base(scope)}/${id}${scopeQuery(operatorId)}`,
            { method: 'DELETE' },
        );
    },

    resendInvite(scope: StaffScope, id: string, operatorId?: string): Promise<{ message: string }> {
        return apiFetch<{ message: string }>(
            `${base(scope)}/${id}/resend-invite${scopeQuery(operatorId)}`,
            { method: 'POST' },
        );
    },

    // ── Designations ─────────────────────────────────────────────────────────

    getDesignations(scope: StaffScope, operatorId?: string): Promise<StaffDesignation[]> {
        return apiFetch<StaffDesignation[]>(
            `${base(scope)}/designations${scopeQuery(operatorId)}`,
        );
    },

    createDesignation(
        scope: StaffScope,
        payload: CreateDesignationPayload,
    ): Promise<StaffDesignation> {
        return apiFetch<StaffDesignation>(`${base(scope)}/designations`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    updateDesignation(
        scope: StaffScope,
        id: string,
        payload: UpdateDesignationPayload,
    ): Promise<StaffDesignation> {
        return apiFetch<StaffDesignation>(`${base(scope)}/designations/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        });
    },

    deleteDesignation(
        scope: StaffScope,
        id: string,
        operatorId?: string,
    ): Promise<{ message: string }> {
        return apiFetch<{ message: string }>(
            `${base(scope)}/designations/${id}${scopeQuery(operatorId)}`,
            { method: 'DELETE' },
        );
    },

    /**
     * Renames the underlying auth account. Not a staff route: the display name
     * lives on `user`, not on the seat, so this hits the admin user override
     * (PATCH /users/:id, gated by UPDATE_USER). `userId` is `member.user.id`,
     * NOT the staff-member id.
     */
    renameUser(userId: string, name: string): Promise<{ id: string; name: string }> {
        return apiFetch<{ id: string; name: string }>(`/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
        });
    },
};
