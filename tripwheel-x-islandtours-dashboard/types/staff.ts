// Mirrors backend: src/staff/dto/staff.dto.ts
// Staff & Teams: platform (admin-side) staff and operator team seats over one
// unified model. `scope` in the API clients maps to the two route families:
//   platform -> /staff, /staff/designations        (MANAGE_STAFF, admin)
//   team     -> /staff/team, /staff/team/designations (MANAGE_TEAM, owner/admin)

import type { PermissionKey } from '@/lib/config/rbac';

export const STAFF_SEAT_ROLE_VALUES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type StaffSeatRole = (typeof STAFF_SEAT_ROLE_VALUES)[number];

export const STAFF_STATUS_VALUES = ['INVITED', 'ACTIVE', 'SUSPENDED'] as const;
export type StaffStatus = (typeof STAFF_STATUS_VALUES)[number];

export type StaffScope = 'platform' | 'team';

export interface StaffUserSummary {
    id: string;
    name: string;
    email: string;
    image: string | null;
    status: string;
}

export interface StaffMember {
    id: string;
    operatorId: string | null;
    seatRole: StaffSeatRole;
    status: StaffStatus;
    user: StaffUserSummary;
    designation: { id: string; name: string } | null;
    extraPermissions: PermissionKey[];
    revokedPermissions: PermissionKey[];
    /** The computed set the backend guards actually enforce. */
    effectivePermissions: PermissionKey[];
    invitedBy: { id: string; name: string } | null;
    invitedAt: string;
    activatedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedStaff {
    total: number;
    page: number;
    limit: number;
    data: StaffMember[];
}

export interface StaffDesignation {
    id: string;
    operatorId: string | null;
    name: string;
    description: string | null;
    permissions: PermissionKey[];
    isSystem: boolean;
    memberCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface PermissionCatalogEntry {
    key: PermissionKey;
    label: string;
}

export interface PermissionCatalogGroup {
    group: string;
    permissions: PermissionCatalogEntry[];
}

export interface PermissionCatalog {
    groups: PermissionCatalogGroup[];
    /** Flat grant ceiling for the requested scope. */
    ceiling: PermissionKey[];
    /** Always granted to active members; not revocable. */
    base: PermissionKey[];
}

// ── Query params ──────────────────────────────────────────────────────────────

export interface StaffQueryParams {
    search?: string;
    status?: StaffStatus;
    designationId?: string;
    page?: number;
    limit?: number;
    /** ADMIN ONLY on team scope - owners are auto-resolved by the backend. */
    operatorId?: string;
}

// ── Payloads ──────────────────────────────────────────────────────────────────

export interface InviteStaffPayload {
    email: string;
    name: string;
    designationId?: string;
    extraPermissions?: PermissionKey[];
    /** Team scope only. */
    seatRole?: Exclude<StaffSeatRole, 'OWNER'>;
    /** ADMIN ONLY on team scope. */
    operatorId?: string;
}

export interface UpdateStaffPayload {
    designationId?: string | null;
    extraPermissions?: PermissionKey[];
    revokedPermissions?: PermissionKey[];
    /** Team scope only. */
    seatRole?: Exclude<StaffSeatRole, 'OWNER'>;
    /** ADMIN ONLY on team scope. */
    operatorId?: string;
}

export interface UpdateStaffStatusPayload {
    status: Exclude<StaffStatus, 'INVITED'>;
    /** ADMIN ONLY on team scope. */
    operatorId?: string;
}

export interface CreateDesignationPayload {
    name: string;
    description?: string;
    permissions: PermissionKey[];
    /** ADMIN ONLY on team scope. */
    operatorId?: string;
}

export interface UpdateDesignationPayload {
    name?: string;
    description?: string;
    permissions?: PermissionKey[];
    /** ADMIN ONLY on team scope. */
    operatorId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const STAFF_STATUS_LABEL: Record<StaffStatus, string> = {
    INVITED: 'Invited',
    ACTIVE: 'Active',
    SUSPENDED: 'Suspended',
};

export const SEAT_ROLE_LABEL: Record<StaffSeatRole, string> = {
    OWNER: 'Owner',
    MANAGER: 'Manager',
    STAFF: 'Staff',
};
