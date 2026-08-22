'use client';

import { Mail01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { StatusBadge } from '@/components/common/status-badge';
import { STAFF_MEMBER_STATUS } from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import type { StaffMember, StaffScope } from '@/types/staff';
import { SEAT_ROLE_LABEL } from '@/types/staff';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StaffRowActions } from './staff-row-actions';

interface BuildStaffColumnsOptions {
    scope: StaffScope;
    onEdit: (member: StaffMember) => void;
}

export function buildStaffColumns({
    scope,
    onEdit,
}: BuildStaffColumnsOptions): ColumnDef<StaffMember>[] {
    const columns: ColumnDef<StaffMember>[] = [
        {
            id: 'member',
            header: 'Member',
            cell: ({ row }) => {
                const member = row.original;
                return (
                    <div className='flex items-center gap-3'>
                        <span className='flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium uppercase'>
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
                        <div className='min-w-0'>
                            <Link
                                href={`/users/${member.id}`}
                                onClick={e => e.stopPropagation()}
                                className='block max-w-50 truncate font-medium hover:underline'>
                                {member.user.name}
                            </Link>
                            <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                                <HugeiconsIcon
                                    icon={Mail01Icon}
                                    className='size-3 shrink-0'
                                />
                                <span className='max-w-50 truncate'>
                                    {member.user.email}
                                </span>
                            </span>
                        </div>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            id: 'designation',
            header: 'Designation',
            cell: ({ row }) => {
                const member = row.original;
                // The platform admin is not a designation holder and not an
                // operator owner - name it for what it is so the row is not
                // mistaken for a normal seat.
                if (member.isSystemAdmin) {
                    return (
                        <span className='text-sm font-medium'>
                            System Administrator
                        </span>
                    );
                }
                if (member.seatRole === 'OWNER') {
                    return (
                        <span className='text-sm font-medium'>
                            {SEAT_ROLE_LABEL.OWNER}
                        </span>
                    );
                }
                return member.designation ? (
                    <span className='text-sm'>{member.designation.name}</span>
                ) : (
                    <span className='text-sm text-muted-foreground'>
                        Custom permissions
                    </span>
                );
            },
            enableSorting: false,
        },
    ];

    if (scope === 'team') {
        columns.push({
            id: 'seatRole',
            header: 'Seat',
            cell: ({ row }) => (
                <span className='text-sm'>
                    {SEAT_ROLE_LABEL[row.original.seatRole]}
                </span>
            ),
            enableSorting: false,
        });
    }

    columns.push(
        {
            id: 'permissions',
            header: 'Permissions',
            cell: ({ row }) => {
                const member = row.original;
                if (member.seatRole === 'OWNER') {
                    return (
                        <span className='text-xs text-muted-foreground'>
                            Full access
                        </span>
                    );
                }
                return (
                    <span className='text-xs text-muted-foreground'>
                        {member.effectivePermissions.length} granted
                    </span>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const meta = STAFF_MEMBER_STATUS[row.original.status];
                return (
                    <StatusBadge variant={meta.variant} hint={meta.hint}>
                        {meta.label}
                    </StatusBadge>
                );
            },
            enableSorting: true,
        },
        {
            accessorKey: 'lastLoginAt',
            header: 'Last login',
            cell: ({ row }) => (
                <span className='text-xs text-muted-foreground'>
                    {row.original.lastLoginAt
                        ? formatDate(row.original.lastLoginAt)
                        : 'Never'}
                </span>
            ),
            enableSorting: true,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <StaffRowActions
                    member={row.original}
                    scope={scope}
                    onEdit={onEdit}
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 48,
        }
    );

    return columns;
}

