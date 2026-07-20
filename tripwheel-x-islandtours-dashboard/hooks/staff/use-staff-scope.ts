'use client';

import { useRole } from '@/contexts/role-context';
import type { StaffScope } from '@/types/staff';

/**
 * Which staff route family this session manages (mirrors the backend's two):
 * - ADMIN -> 'platform': Island Tours' own staff + platform designations.
 * - Operator OWNER -> 'team': their team seats + team designations.
 * - Anyone else -> null: the nav item never shows for them, so this is only
 *   the belt for a hand-typed URL.
 *
 * Shared by the Users list and the member profile so the two can never resolve
 * a different scope for the same session and hit different endpoints.
 */
export function useStaffScope(): StaffScope | null {
    const { role, can } = useRole();

    if (role === 'ADMIN' && can('MANAGE_STAFF')) return 'platform';
    if (can('MANAGE_TEAM')) return 'team';
    return null;
}
