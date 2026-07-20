'use client';

import { Button } from '@/components/ui/button';
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
import type { StaffMember, StaffScope } from '@/types/staff';
import { StaffAccessFields } from './staff-access-fields';
import { useAccessEditor } from './use-access-editor';

interface StaffMemberSheetProps {
    scope: StaffScope;
    member: StaffMember | null;
    onOpenChange: (open: boolean) => void;
}

/**
 * "Edit access" sheet, opened from a Users list row. The form body and the
 * override maths are shared with the member profile's in-page editor
 * (`StaffAccessFields` + `useAccessEditor`); this only supplies the sheet
 * chrome.
 */
export function StaffMemberSheet({
    scope,
    member,
    onOpenChange,
}: StaffMemberSheetProps) {
    const editor = useAccessEditor(scope, member);
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

                <div className='flex-1 p-4'>
                    <StaffAccessFields scope={scope} editor={editor} />
                </div>

                <SheetFooter className='flex-row justify-end gap-2 border-t'>
                    <Button
                        variant='outline'
                        disabled={editor.isPending}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        disabled={editor.isPending || !member}
                        onClick={() => editor.save(() => onOpenChange(false))}>
                        {editor.isPending ? 'Saving...' : 'Save access'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
