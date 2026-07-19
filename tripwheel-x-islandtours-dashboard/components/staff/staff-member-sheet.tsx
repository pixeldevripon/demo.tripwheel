'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/common/status-badge';
import { STAFF_MEMBER_STATUS } from '@/components/common/status-maps';
import {
    useDesignations,
    usePermissionCatalog,
    useUpdateStaff,
} from '@/hooks/staff/use-staff';
import type { PermissionKey } from '@/lib/config/rbac';
import type { StaffMember, StaffScope } from '@/types/staff';
import { PermissionMatrix } from './permission-matrix';

const NO_DESIGNATION = 'none';

interface StaffMemberSheetProps {
    scope: StaffScope;
    member: StaffMember | null;
    onOpenChange: (open: boolean) => void;
}

/**
 * "Edit access" sheet. The matrix always shows the member's WOULD-BE effective
 * set: picking a designation resets it to that template; ticking/unticking
 * individual permissions is stored as per-member extra/revoked overrides
 * relative to the template (computed on save, mirroring the backend formula).
 */
export function StaffMemberSheet({
    scope,
    member,
    onOpenChange,
}: StaffMemberSheetProps) {
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

    // Re-seed the editor when a member is opened: the matrix starts from
    // their current effective set (minus the locked base floor).
    useEffect(() => {
        if (!member) return;
        setDesignationId(member.designation?.id ?? NO_DESIGNATION);
        setChecked(
            member.effectivePermissions.filter((p) => !base.has(p)),
        );
        setSeatRole(member.seatRole === 'MANAGER' ? 'MANAGER' : 'STAFF');
    }, [member, base]);

    function handleDesignationChange(next: string) {
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

    function handleSave() {
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
            { onSuccess: () => onOpenChange(false) },
        );
    }

    const statusMeta = member ? STAFF_MEMBER_STATUS[member.status] : null;

    return (
        <Sheet open={member !== null} onOpenChange={onOpenChange}>
            <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl'>
                <SheetHeader className='border-b'>
                    <SheetTitle className='flex items-center gap-2'>
                        {member?.user.name}
                        {statusMeta && (
                            <StatusBadge variant={statusMeta.variant}>
                                {statusMeta.label}
                            </StatusBadge>
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        {member?.user.email} - changes apply on their next
                        request.
                    </SheetDescription>
                </SheetHeader>

                <div className='flex-1 space-y-6 p-4'>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        <div className='space-y-2'>
                            <Label>Designation</Label>
                            <Select
                                value={designationId}
                                onValueChange={handleDesignationChange}>
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder='No designation' />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NO_DESIGNATION}>
                                        No designation
                                    </SelectItem>
                                    {(designations ?? []).map((designation) => (
                                        <SelectItem
                                            key={designation.id}
                                            value={designation.id}>
                                            {designation.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {scope === 'team' && (
                            <div className='space-y-2'>
                                <Label>Seat role</Label>
                                <Select
                                    value={seatRole}
                                    onValueChange={(v) =>
                                        setSeatRole(v as 'MANAGER' | 'STAFF')
                                    }>
                                    <SelectTrigger className='w-full'>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value='STAFF'>
                                            Staff
                                        </SelectItem>
                                        <SelectItem value='MANAGER'>
                                            Manager
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <div className='space-y-2'>
                        <div className='flex items-baseline justify-between'>
                            <Label>Permissions</Label>
                            <span className='text-xs text-muted-foreground'>
                                {checked.length + base.size} effective
                            </span>
                        </div>
                        <p className='text-xs text-muted-foreground'>
                            Selecting a designation resets this to its template;
                            any further changes are saved as per-member
                            overrides. Grayed permissions are always granted.
                        </p>
                        <PermissionMatrix
                            groups={catalog?.groups ?? []}
                            value={checked}
                            onChange={setChecked}
                            lockedKeys={catalog?.base ?? []}
                        />
                    </div>
                </div>

                <SheetFooter className='flex-row justify-end gap-2 border-t'>
                    <Button
                        variant='outline'
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={isPending || !member} onClick={handleSave}>
                        {isPending ? 'Saving...' : 'Save access'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
