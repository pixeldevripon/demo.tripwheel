'use client';

import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { StaffScope } from '@/types/staff';
import { PermissionMatrix } from './permission-matrix';
import { NO_DESIGNATION, type useAccessEditor } from './use-access-editor';

/**
 * The access form body - designation, seat role (team scope), permission
 * matrix. Rendered inside the sheet from a list row and inline on the member
 * profile; both drive it with the same `useAccessEditor` state.
 */
export function StaffAccessFields({
    scope,
    editor,
}: {
    scope: StaffScope;
    editor: ReturnType<typeof useAccessEditor>;
}) {
    return (
        <div className='space-y-6'>
            <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-2'>
                    <Label>Designation</Label>
                    <Select
                        value={editor.designationId}
                        onValueChange={editor.changeDesignation}>
                        <SelectTrigger className='w-full'>
                            <SelectValue placeholder='No designation' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_DESIGNATION}>
                                No designation
                            </SelectItem>
                            {(editor.designations ?? []).map((designation) => (
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
                            value={editor.seatRole}
                            onValueChange={(v) =>
                                editor.setSeatRole(v as 'MANAGER' | 'STAFF')
                            }>
                            <SelectTrigger className='w-full'>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value='STAFF'>User</SelectItem>
                                <SelectItem value='MANAGER'>Manager</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className='text-xs text-muted-foreground'>
                            A team-list label - access is set by the designation
                            and permissions below.
                        </p>
                    </div>
                )}
            </div>

            <div className='space-y-2'>
                <div className='flex items-baseline justify-between'>
                    <Label>Permissions</Label>
                    <span className='text-xs text-muted-foreground'>
                        {editor.effectiveCount} effective
                    </span>
                </div>
                <p className='text-xs text-muted-foreground'>
                    Selecting a designation resets this to its template; any
                    further changes are saved as per-member overrides. Grayed
                    permissions are always granted.
                </p>
                <PermissionMatrix
                    groups={editor.catalog?.groups ?? []}
                    value={editor.checked}
                    onChange={editor.setChecked}
                    lockedKeys={editor.catalog?.base ?? []}
                />
            </div>
        </div>
    );
}
