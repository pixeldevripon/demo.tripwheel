'use client';

import { createContext, useContext } from 'react';
import { ROLE_PERMISSIONS, type PermissionKey, type RoleKey } from '@/lib/config/rbac';

interface RoleContextValue {
    role: string | undefined;
    /**
     * Which login door minted this session ('portal'|'staff'|'admin');
     * null/undefined = legacy session, shape the view by role. Drives
     * sign-out routing so a multi-hat account returns to the door it
     * entered through. (The 'account' traveller door was removed
     * 2026-07-28; a session stamped with it can no longer be created here.)
     */
    surface: string | null | undefined;
    /** The EFFECTIVE permission set gating this session's UI. */
    permissions: PermissionKey[];
    can: (permission: PermissionKey) => boolean;
    canAny: (permissions: PermissionKey[]) => boolean;
}

const RoleContext = createContext<RoleContextValue>({
    role: undefined,
    surface: undefined,
    permissions: [],
    can: () => false,
    canAny: () => false,
});

/**
 * Distributes the session's role + EFFECTIVE permissions.
 *
 * `permissions` comes from the backend (`GET /users/me/permissions`), which
 * computes the fine-grained set for staff members and operator team seats
 * (designation + per-member overrides). When it is absent (transient fetch
 * failure) the static ROLE_PERMISSIONS mirror is the fallback for
 * admins/operators - but a STAFF user falls back to the profile-only floor,
 * never the broad legacy STAFF list, so a fetch hiccup can't over-render UI
 * their real grants don't cover (the backend guards enforce regardless).
 */
const STAFF_FALLBACK: PermissionKey[] = ['VIEW_PROFILE', 'EDIT_PROFILE'];

export function RoleProvider({
    role,
    surface,
    permissions,
    children,
}: {
    role?: string;
    surface?: string | null;
    permissions?: string[];
    children: React.ReactNode;
}) {
    const effective: PermissionKey[] =
        permissions !== undefined
            ? (permissions as PermissionKey[])
            : role === 'STAFF'
              ? STAFF_FALLBACK
              : role
                ? (ROLE_PERMISSIONS[role as RoleKey] ?? [])
                : [];

    function can(permission: PermissionKey): boolean {
        return effective.includes(permission);
    }

    function canAny(perms: PermissionKey[]): boolean {
        return perms.some((p) => effective.includes(p));
    }

    return (
        <RoleContext.Provider
            value={{ role, surface, permissions: effective, can, canAny }}>
            {children}
        </RoleContext.Provider>
    );
}

export function useRole(): RoleContextValue {
    return useContext(RoleContext);
}
