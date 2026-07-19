'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { UserAdd02Icon, UserGroupIcon } from '@hugeicons/core-free-icons';

import { useMemo, useState } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import {
    DataTableActions,
    DataTableSearch,
} from '@/components/data-table/data-table-toolbar';
import { useTableState } from '@/components/data-table/use-table-state';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useStaffMembers } from '@/hooks/staff/use-staff';
import type { StaffMember, StaffScope, StaffStatus } from '@/types/staff';
import { buildStaffColumns } from './staff-columns';
import { StaffInviteDialog } from './staff-invite-dialog';
import { StaffMemberSheet } from './staff-member-sheet';

const STATUS_FILTERS: { value: string; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'INVITED', label: 'Invited' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'SUSPENDED', label: 'Suspended' },
];

export function StaffMembersTab({ scope }: { scope: StaffScope }) {
    const { page, limit, search, debouncedSearch, filters, setPage, setLimit, setSearch, setFilter } =
        useTableState();
    const statusFilter = filters.status ?? 'all';

    const { data, isLoading } = useStaffMembers(scope, {
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter as StaffStatus } : {}),
    });

    const [inviteOpen, setInviteOpen] = useState(false);
    const [editing, setEditing] = useState<StaffMember | null>(null);

    const columns = useMemo(
        () => buildStaffColumns({ scope, onEdit: setEditing }),
        [scope],
    );

    const inviteButton = (
        <Button size='sm' onClick={() => setInviteOpen(true)}>
            <HugeiconsIcon icon={UserAdd02Icon} />
            {scope === 'platform' ? 'Invite Staff' : 'Invite Member'}
        </Button>
    );

    return (
        <>
            <DataTable
                columns={columns}
                data={data?.data ?? []}
                isLoading={isLoading}
                pagination={{
                    total: data?.total ?? 0,
                    page,
                    limit,
                    onPageChange: setPage,
                    onLimitChange: setLimit,
                }}
                empty={{
                    icon: UserGroupIcon,
                    title:
                        scope === 'platform'
                            ? 'No staff members yet.'
                            : 'No team members yet.',
                    description:
                        'Invite your first member - they get a set-password email and sign in with their own account.',
                    action: inviteButton,
                }}
                toolbar={() => (
                    <>
                        <DataTableSearch
                            value={search}
                            onChange={setSearch}
                            placeholder='Search by name or email...'
                        />
                        <Select
                            value={statusFilter}
                            onValueChange={(v) =>
                                setFilter('status', v === 'all' ? undefined : v)
                            }>
                            <SelectTrigger className='w-36 shrink-0'>
                                <SelectValue placeholder='Status' />
                            </SelectTrigger>
                            <SelectContent>
                                {STATUS_FILTERS.map((f) => (
                                    <SelectItem key={f.value} value={f.value}>
                                        {f.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DataTableActions>{inviteButton}</DataTableActions>
                    </>
                )}
            />

            <StaffInviteDialog
                scope={scope}
                open={inviteOpen}
                onOpenChange={setInviteOpen}
            />
            <StaffMemberSheet
                scope={scope}
                member={editing}
                onOpenChange={(open) => {
                    if (!open) setEditing(null);
                }}
            />
        </>
    );
}
