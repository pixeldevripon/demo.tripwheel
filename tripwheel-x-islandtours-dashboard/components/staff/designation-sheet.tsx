'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon } from '@hugeicons/core-free-icons';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { STAFF_MEMBER_STATUS } from '@/components/common/status-maps';
import { usePermissionCatalog, useStaffMembers } from '@/hooks/staff/use-staff';
import type { StaffDesignation, StaffScope } from '@/types/staff';

interface DesignationSheetProps {
    scope: StaffScope;
    designation: StaffDesignation | null;
    onOpenChange: (open: boolean) => void;
}

/**
 * Read-only designation detail sheet, opened from a Designations list row.
 * Shows what the template grants (per catalog group) and who holds it. Editing
 * stays in the row's dropdown - this view answers "what is this and who has
 * it" without the risk of a stray click changing a policy object.
 */
export function DesignationSheet({
    scope,
    designation,
    onOpenChange,
}: DesignationSheetProps) {
    return (
        <Sheet open={designation !== null} onOpenChange={onOpenChange}>
            <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-2xl'>
                {/* Body is mounted only while open so its queries never fire
                    for a closed sheet. */}
                {designation && (
                    <DesignationSheetBody
                        scope={scope}
                        designation={designation}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function DesignationSheetBody({
    scope,
    designation,
}: {
    scope: StaffScope;
    designation: StaffDesignation;
}) {
    const { data: catalog } = usePermissionCatalog(scope);
    const { data: members, isLoading: membersLoading } = useStaffMembers(
        scope,
        {
            designationId: designation.id,
            limit: 100,
        },
    );

    const granted = new Set<string>(designation.permissions);
    const totalGrantable =
        catalog?.groups.reduce((n, g) => n + g.permissions.length, 0) ?? 0;
    const grantedGroups = (catalog?.groups ?? [])
        .map((group) => ({
            group: group.group,
            permissions: group.permissions.filter((p) => granted.has(p.key)),
        }))
        .filter((group) => group.permissions.length > 0);

    return (
        <>
            <SheetHeader className='border-b'>
                <SheetTitle className='flex items-center gap-2'>
                    {designation.name}
                    {designation.isSystem && (
                        <StatusBadge variant='info'>System</StatusBadge>
                    )}
                </SheetTitle>
                <SheetDescription>
                    {designation.description ?? 'Reusable permission template.'}
                </SheetDescription>
            </SheetHeader>

            <div className='flex-1 space-y-6 p-4'>
                <section className='space-y-3'>
                    <div className='flex items-baseline justify-between'>
                        <h3 className='text-sm font-medium'>Permissions</h3>
                        <span className='text-xs text-muted-foreground'>
                            {designation.permissions.length}/
                            {totalGrantable || '?'} granted
                        </span>
                    </div>
                    {grantedGroups.length === 0 ? (
                        <p className='text-sm text-muted-foreground'>
                            This designation grants no permissions beyond the
                            base set.
                        </p>
                    ) : (
                        grantedGroups.map((group) => (
                            <div key={group.group} className='space-y-1.5'>
                                <p className='text-xs font-medium text-muted-foreground'>
                                    {group.group}
                                </p>
                                <div className='flex flex-wrap gap-1.5'>
                                    {group.permissions.map((permission) => (
                                        <Badge
                                            key={permission.key}
                                            variant='secondary'
                                            className='font-normal'
                                        >
                                            {permission.label}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </section>

                <section className='space-y-3'>
                    <div className='flex items-baseline justify-between'>
                        <h3 className='text-sm font-medium'>Members</h3>
                        <span className='text-xs text-muted-foreground'>
                            {designation.memberCount} assigned
                        </span>
                    </div>
                    {membersLoading ? (
                        <div className='space-y-2'>
                            {Array.from({
                                length: Math.min(
                                    Math.max(designation.memberCount, 1),
                                    5,
                                ),
                            }).map((_, i) => (
                                <Skeleton key={i} className='h-12 rounded-lg' />
                            ))}
                        </div>
                    ) : (members?.data ?? []).length === 0 ? (
                        <p className='text-sm text-muted-foreground'>
                            No members hold this designation yet.
                        </p>
                    ) : (
                        <div className='divide-y divide-line rounded-lg border border-line'>
                            {(members?.data ?? []).map((member) => {
                                const statusMeta =
                                    STAFF_MEMBER_STATUS[member.status];
                                return (
                                    <div
                                        key={member.id}
                                        className='flex items-center gap-3 px-3 py-2.5'
                                    >
                                        <span className='flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold uppercase'>
                                            {member.user.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={member.user.image}
                                                    alt={member.user.name}
                                                    className='h-full w-full object-cover'
                                                />
                                            ) : (
                                                member.user.name.charAt(0)
                                            )}
                                        </span>
                                        <div className='min-w-0 flex-1'>
                                            <Link
                                                href={`/users/${member.id}`}
                                                className='block max-w-60 truncate text-sm font-medium hover:underline'
                                            >
                                                {member.user.name}
                                            </Link>
                                            <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                                                <HugeiconsIcon
                                                    icon={Mail01Icon}
                                                    className='size-3 shrink-0'
                                                />
                                                <span className='max-w-60 truncate'>
                                                    {member.user.email}
                                                </span>
                                            </span>
                                        </div>
                                        <StatusBadge
                                            variant={statusMeta.variant}
                                            hint={statusMeta.hint}
                                        >
                                            {statusMeta.label}
                                        </StatusBadge>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}
