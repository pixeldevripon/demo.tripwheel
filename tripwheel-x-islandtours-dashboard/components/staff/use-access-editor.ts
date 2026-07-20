'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
    useDesignations,
    usePermissionCatalog,
    useUpdateStaff,
} from '@/hooks/staff/use-staff';
import type { PermissionKey } from '@/lib/config/rbac';
import type { StaffMember, StaffScope } from '@/types/staff';

export const NO_DESIGNATION = 'none';

/**
 * The access-editing engine behind both surfaces that change a member's
 * permissions: the sheet opened from a list row, and the in-page editor on the
 * member profile. The override maths (designation template -> extra/revoked)
 * lives here once so the two can never compute a different payload.
 *
 * The matrix always shows the member's WOULD-BE effective set: picking a
 * designation resets it to that template; ticking/unticking individual
 * permissions is stored as per-member overrides relative to the template
 * (computed on save, mirroring the backend formula).
 */
export function useAccessEditor(scope: StaffScope, member: StaffMember | null) {
    const { data: catalog } = usePermissionCatalog(scope);
    const { data: designations } = useDesignations(scope);
    const { mutate: updateMember, isPending } = useUpdateStaff(scope);

    const [designationId, setDesignationId] = useState<string>(NO_DESIGNATION);
    const [checked, setChecked] = useState<PermissionKey[]>([]);
    const [seatRole, setSeatRole] = useState<'MANAGER' | 'STAFF'>('STAFF');

    const base = useMemo(() => new Set(catalog?.base ?? []), [catalog]);
    const ceiling = useMemo(() => new Set(catalog?.ceiling ?? []), [catalog]);

    const designationPermissions = useMemo(() => {
        if (designationId === NO_DESIGNATION) return [] as PermissionKey[];
        const designation = designations?.find((d) => d.id === designationId);
        return (designation?.permissions ?? []).filter(
            (p) => ceiling.has(p) && !base.has(p),
        );
    }, [designationId, designations, ceiling, base]);

    /**
     * Seed from the member: the matrix starts at their current effective set
     * minus the locked base floor. Also the reset path - Cancel calls this to
     * drop unsaved edits, and the profile calls it before opening the editor.
     */
    const reset = useCallback(() => {
        if (!member) return;
        setDesignationId(member.designation?.id ?? NO_DESIGNATION);
        setChecked(member.effectivePermissions.filter((p) => !base.has(p)));
        setSeatRole(member.seatRole === 'MANAGER' ? 'MANAGER' : 'STAFF');
    }, [member, base]);

    // Auto-seed once per member, and again when the catalog lands (the base
    // floor decides what gets stripped). Deliberately keyed on the member's
    // ID, not the object: with refetchOnWindowFocus on, a background refetch
    // hands back a new object, and re-seeding on that would silently wipe
    // in-progress edits the moment the window regains focus.
    const memberId = member?.id ?? null;
    const catalogReady = Boolean(catalog);
    useEffect(() => {
        reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [memberId, catalogReady]);

    function changeDesignation(next: string) {
        setDesignationId(next);
        if (next === NO_DESIGNATION) {
            setChecked([]);
            return;
        }
        const designation = designations?.find((d) => d.id === next);
        setChecked(
            (designation?.permissions ?? []).filter(
                (p) => ceiling.has(p) && !base.has(p),
            ),
        );
    }

    function save(onSuccess?: () => void) {
        if (!member) return;
        const template = new Set(designationPermissions);
        const selected = new Set(checked);
        const extraPermissions = checked.filter((p) => !template.has(p));
        const revokedPermissions = designationPermissions.filter(
            (p) => !selected.has(p),
        );

        updateMember(
            {
                id: member.id,
                payload: {
                    designationId:
                        designationId === NO_DESIGNATION ? null : designationId,
                    extraPermissions,
                    revokedPermissions,
                    ...(scope === 'team' && { seatRole }),
                },
            },
            { onSuccess: () => onSuccess?.() },
        );
    }

    return {
        catalog,
        designations,
        designationId,
        changeDesignation,
        checked,
        setChecked,
        seatRole,
        setSeatRole,
        /** Count shown next to the matrix: selected + the always-granted floor. */
        effectiveCount: checked.length + base.size,
        isPending,
        reset,
        save,
    };
}
