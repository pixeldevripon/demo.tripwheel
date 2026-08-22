'use client';

import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/common/status-badge';
import { STAFF_MEMBER_STATUS } from '@/components/common/status-maps';
import {
    SheetPager,
    type SheetPagerProps,
} from '@/components/common/detail-sheet';
import type { StaffMember, StaffScope } from '@/types/staff';
import { StaffAccessFields } from './staff-access-fields';
import { useAccessEditor } from './use-access-editor';

interface StaffMemberSheetProps extends SheetPagerProps {
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
    onPrev,
    onNext,
    position,
}: StaffMemberSheetProps) {
    const editor = useAccessEditor(scope, member);
    const statusMeta = member ? STAFF_MEMBER_STATUS[member.status] : null;
    // The system admin and owner seats are read-only for ACCESS everywhere
    // (every staff mutation on them 403s) - same rule as the member profile.
    const accessReadOnly =
        !!member && (member.isSystemAdmin || member.seatRole === 'OWNER');

    return (
        <Sheet open={member !== null} onOpenChange={onOpenChange}>
            {/* Sticky header + footer; only the form body scrolls. */}
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl!'>
                <SheetHeader className='border-b'>
                    <div className='flex items-center justify-between gap-3 pr-8'>
                        <div className='min-w-0'>
                            <SheetTitle className='flex items-center gap-2'>
                                {member?.user.name}
                                {statusMeta && (
                                    <StatusBadge
                                        variant={statusMeta.variant}
                                        hint={statusMeta.hint}>
                                        {statusMeta.label}
                                    </StatusBadge>
                                )}
                            </SheetTitle>
                            <SheetDescription>
                                {member?.user.email}
                                {accessReadOnly
                                    ? ' - full access, not editable.'
                                    : ' - changes apply on their next request.'}
                            </SheetDescription>
                        </div>
                        <SheetPager
                            onPrev={onPrev}
                            onNext={onNext}
                            position={position}
                        />
                    </div>
                </SheetHeader>

                <SheetBody className='py-4'>
                    {accessReadOnly && member ? (
                        <div className='space-y-2'>
                            <p className='m-0 text-sm font-medium'>
                                {member.isSystemAdmin
                                    ? 'System Administrator'
                                    : 'Owner'}
                            </p>
                            <p className='m-0 text-sm text-muted-foreground'>
                                {member.isSystemAdmin
                                    ? 'Holds every platform permission. This account cannot be edited, suspended or removed.'
                                    : 'Holds full access to their team. Owner access cannot be edited from here.'}
                            </p>
                        </div>
                    ) : (
                        <StaffAccessFields scope={scope} editor={editor} />
                    )}
                </SheetBody>

                {!accessReadOnly && (
                    <SheetFooter className='flex-row justify-end gap-2 border-t'>
                        <Button
                            variant='outline'
                            disabled={editor.isPending}
                            onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={editor.isPending || !member}
                            onClick={() =>
                                editor.save(() => onOpenChange(false))
                            }>
                            {editor.isPending ? 'Saving...' : 'Save access'}
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}
