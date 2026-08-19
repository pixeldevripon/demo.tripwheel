'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Delete02Icon,
    MailSend02Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    ToggleOffIcon,
    ToggleOnIcon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';
import {
    useRemoveStaff,
    useResendStaffInvite,
    useUpdateStaffStatus,
} from '@/hooks/staff/use-staff';
import type { StaffMember, StaffScope } from '@/types/staff';

interface StaffRowActionsProps {
    member: StaffMember;
    scope: StaffScope;
    onEdit: (member: StaffMember) => void;
}

/**
 * Row actions for a staff member / team seat. OWNER seats get no actions at
 * all - the owner account is managed through the operator module, and the
 * backend rejects owner mutations here anyway.
 *
 * The system administrator is listed for visibility but is equally untouchable:
 * it has no `staff_members` row, and every mutating staff endpoint rejects it
 * with 403. Hiding the menu keeps the UI from offering an action it knows will
 * fail - the backend guard remains the real enforcement.
 */
export function StaffRowActions({ member, scope, onEdit }: StaffRowActionsProps) {
    const [removeOpen, setRemoveOpen] = useState(false);
    const { mutate: updateStatus, isPending: statusPending } =
        useUpdateStaffStatus(scope);
    const { mutate: resendInvite, isPending: resendPending } =
        useResendStaffInvite(scope);
    const { mutate: removeMember, isPending: removePending } =
        useRemoveStaff(scope);

    if (member.isSystemAdmin || member.seatRole === 'OWNER') return null;

    const suspended = member.status === 'SUSPENDED';

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant='ghost'
                        size='icon'
                        className='size-8'
                        onClick={(e) => e.stopPropagation()}>
                        <HugeiconsIcon icon={MoreHorizontalIcon} />
                        <span className='sr-only'>Open member actions</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align='end'
                    onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuLabel>{member.user.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(member)}>
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                        Edit access
                    </DropdownMenuItem>
                    {member.status === 'INVITED' && (
                        <DropdownMenuItem
                            disabled={resendPending}
                            onClick={() => resendInvite({ id: member.id })}>
                            <HugeiconsIcon icon={MailSend02Icon} />
                            Resend invite
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                        disabled={statusPending}
                        onClick={() =>
                            updateStatus({
                                id: member.id,
                                payload: {
                                    status: suspended ? 'ACTIVE' : 'SUSPENDED',
                                },
                            })
                        }>
                        <HugeiconsIcon
                            icon={suspended ? ToggleOnIcon : ToggleOffIcon}
                        />
                        {suspended ? 'Reactivate' : 'Suspend'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        variant='destructive'
                        onClick={() => setRemoveOpen(true)}>
                        <HugeiconsIcon icon={Delete02Icon} />
                        Remove
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ForceDeleteDialog
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                title='Remove member'
                entityName={member.user.name}
                consequenceNote='Their login account is deleted and every active session is signed out immediately.'
                confirmLabel='Remove Member'
                isPending={removePending}
                onConfirm={() =>
                    removeMember(
                        { id: member.id },
                        { onSuccess: () => setRemoveOpen(false) },
                    )
                }
            />
        </>
    );
}
