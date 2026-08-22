'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Alert02Icon,
    UserAdd02Icon,
    UserGroupIcon,
} from '@hugeicons/core-free-icons';

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

    const { data, isLoading, isError, refetch } = useStaffMembers(scope, {
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter as StaffStatus } : {}),
    });

    const [inviteOpen, setInviteOpen] = useState(false);
    // Index-based so the sheet's prev/next arrows can walk the current page.
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const rows = useMemo(() => data?.data ?? [], [data]);
    const editing = editIndex != null ? (rows[editIndex] ?? null) : null;

    const openMember = useMemo(
        () => (member: StaffMember) =>
            setEditIndex(rows.findIndex((m) => m.id === member.id)),
        [rows],
    );

    const columns = useMemo(
        () => buildStaffColumns({ scope, onEdit: openMember }),
        [scope, openMember],
    );

    const inviteButton = (
        <Button size='sm' onClick={() => setInviteOpen(true)}>
            <HugeiconsIcon icon={UserAdd02Icon} />
            {scope === 'platform' ? 'Invite User' : 'Invite Member'}
        </Button>
    );

    return (
        <>
            <DataTable
                columns={columns}
                data={rows}
                isLoading={isLoading}
                onRowClick={openMember}
                pagination={{
                    total: data?.total ?? 0,
                    page,
                    limit,
                    onPageChange: setPage,
                    onLimitChange: setLimit,
                }}
                // A failed fetch must never masquerade as an empty team - an
                // outage while the Suspended filter is active would otherwise
                // read as "no suspended members".
                empty={
                    isError
                        ? {
                              icon: Alert02Icon,
                              title: "Couldn't load members.",
                              description:
                                  'The server did not respond. Check that the backend is running, then retry.',
                              action: (
                                  <Button size='sm' onClick={() => refetch()}>
                                      Retry
                                  </Button>
                              ),
                          }
                        : {
                              icon: UserGroupIcon,
                              title:
                                  scope === 'platform'
                                      ? 'No users yet.'
                                      : 'No team members yet.',
                              description:
                                  'Invite your first member - they get a set-password email and sign in with their own account.',
                              action: inviteButton,
                          }
                }
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
                    if (!open) setEditIndex(null);
                }}
                onPrev={
                    editIndex != null && editIndex > 0
                        ? () => setEditIndex(editIndex - 1)
                        : undefined
                }
                onNext={
                    editIndex != null && editIndex < rows.length - 1
                        ? () => setEditIndex(editIndex + 1)
                        : undefined
                }
                position={
                    editIndex != null
                        ? { index: editIndex + 1, count: rows.length }
                        : undefined
                }
            />
        </>
    );
}
