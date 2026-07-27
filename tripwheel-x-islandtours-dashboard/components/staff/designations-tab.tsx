'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Delete02Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Shield01Icon,
} from '@hugeicons/core-free-icons';

import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from '@/components/common/status-badge';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';
import {
    useDeleteDesignation,
    useDesignations,
    usePermissionCatalog,
} from '@/hooks/staff/use-staff';
import type { StaffDesignation, StaffScope } from '@/types/staff';
import { DesignationDialog } from './designation-dialog';
import { DesignationSheet } from './designation-sheet';

interface BuildDesignationColumnsOptions {
    totalGrantable: number;
    onEdit: (designation: StaffDesignation) => void;
    onDelete: (designation: StaffDesignation) => void;
}

function buildDesignationColumns({
    totalGrantable,
    onEdit,
    onDelete,
}: BuildDesignationColumnsOptions): ColumnDef<StaffDesignation>[] {
    return [
        {
            id: 'name',
            header: 'Designation',
            cell: ({ row }) => (
                <span className='flex items-center gap-2'>
                    <span className='max-w-50 truncate font-medium'>
                        {row.original.name}
                    </span>
                    {row.original.isSystem && (
                        <StatusBadge variant='info'>System</StatusBadge>
                    )}
                </span>
            ),
            enableSorting: false,
        },
        {
            id: 'description',
            header: 'Description',
            cell: ({ row }) =>
                row.original.description ? (
                    <span className='block max-w-120 truncate text-sm text-muted-foreground'>
                        {row.original.description}
                    </span>
                ) : (
                    <span className='text-sm text-muted-foreground'>-</span>
                ),
            enableSorting: false,
        },
        {
            id: 'permissions',
            header: 'Permissions',
            cell: ({ row }) => (
                <span className='text-xs text-muted-foreground'>
                    <span className='font-semibold text-content'>
                        {row.original.permissions.length}
                    </span>
                    /{totalGrantable || '?'}
                </span>
            ),
            enableSorting: false,
        },
        {
            id: 'members',
            header: 'Members',
            cell: ({ row }) => (
                <span className='text-xs text-muted-foreground'>
                    <span className='font-semibold text-content'>
                        {row.original.memberCount}
                    </span>{' '}
                    member{row.original.memberCount === 1 ? '' : 's'}
                </span>
            ),
            enableSorting: false,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => {
                const designation = row.original;
                return (
                    // Rows open the detail sheet; keep menu clicks out of that.
                    <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant='ghost'
                                    size='icon'
                                    className='size-8'
                                >
                                    <HugeiconsIcon icon={MoreHorizontalIcon} />
                                    <span className='sr-only'>
                                        Designation actions
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                    onClick={() => onEdit(designation)}
                                >
                                    <HugeiconsIcon icon={PencilEdit02Icon} />
                                    Edit
                                </DropdownMenuItem>
                                {!designation.isSystem && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            variant='destructive'
                                            disabled={
                                                designation.memberCount > 0
                                            }
                                            onClick={() =>
                                                onDelete(designation)
                                            }
                                        >
                                            <HugeiconsIcon
                                                icon={Delete02Icon}
                                            />
                                            {designation.memberCount > 0
                                                ? 'Delete (in use)'
                                                : 'Delete'}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
            enableSorting: false,
            enableHiding: false,
            size: 48,
        },
    ];
}

/**
 * Designation (permission template) management, rendered on the shared
 * DataTable like every other list screen. Client-side paging: the list is a
 * handful of policy objects, and the endpoint returns an unpaged array.
 */
export function DesignationsTab({ scope }: { scope: StaffScope }) {
    const { data: designations, isLoading } = useDesignations(scope);
    const { data: catalog } = usePermissionCatalog(scope);
    const { mutate: deleteDesignation, isPending: deleting } =
        useDeleteDesignation(scope);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<StaffDesignation | null>(null);
    const [removing, setRemoving] = useState<StaffDesignation | null>(null);
    const [viewing, setViewing] = useState<StaffDesignation | null>(null);

    const totalGrantable =
        catalog?.groups.reduce((n, g) => n + g.permissions.length, 0) ?? 0;

    function openCreate() {
        setEditing(null);
        setDialogOpen(true);
    }

    const columns = useMemo(
        () =>
            buildDesignationColumns({
                totalGrantable,
                onEdit: (designation) => {
                    setEditing(designation);
                    setDialogOpen(true);
                },
                onDelete: setRemoving,
            }),
        [totalGrantable],
    );

    return (
        <div className='space-y-4'>
            <div className='flex items-center justify-between'>
                <p className='text-sm text-muted-foreground'>
                    Reusable permission templates. Assign one to a member, then
                    fine-tune their access individually when needed.
                </p>
                <Button size='sm' onClick={openCreate}>
                    <HugeiconsIcon icon={PlusSignIcon} />
                    New Designation
                </Button>
            </div>

            <DataTable
                columns={columns}
                data={designations ?? []}
                isLoading={isLoading}
                skeletonRows={3}
                onRowClick={setViewing}
                empty={{
                    icon: Shield01Icon,
                    title: 'No designations yet.',
                    description:
                        'Create a permission template to invite members faster.',
                    action: (
                        <Button size='sm' onClick={openCreate}>
                            <HugeiconsIcon icon={PlusSignIcon} />
                            New Designation
                        </Button>
                    ),
                }}
            />

            <DesignationSheet
                scope={scope}
                designation={viewing}
                onOpenChange={(open) => {
                    if (!open) setViewing(null);
                }}
            />

            <DesignationDialog
                scope={scope}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                designation={editing}
            />

            <ForceDeleteDialog
                open={removing !== null}
                onOpenChange={(open) => {
                    if (!open) setRemoving(null);
                }}
                title='Delete designation'
                entityName={removing?.name ?? ''}
                consequenceNote='Members are never deleted with a designation - deletion is only possible once no member is assigned to it.'
                confirmLabel='Delete Designation'
                isPending={deleting}
                onConfirm={() => {
                    if (!removing) return;
                    deleteDesignation(
                        { id: removing.id },
                        { onSuccess: () => setRemoving(null) },
                    );
                }}
            />
        </div>
    );
}
