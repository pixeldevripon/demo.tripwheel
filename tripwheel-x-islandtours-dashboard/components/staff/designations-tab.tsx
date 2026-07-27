'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
    Delete02Icon,
    MoreHorizontalIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Shield01Icon,
} from '@hugeicons/core-free-icons';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { ForceDeleteDialog } from '@/components/common/force-delete-dialog';
import {
    useDeleteDesignation,
    useDesignations,
    usePermissionCatalog,
} from '@/hooks/staff/use-staff';
import type { StaffDesignation, StaffScope } from '@/types/staff';
import { DesignationDialog } from './designation-dialog';

/**
 * Designation (permission template) management. Cards over a table: each
 * designation is a small, self-describing policy object - name, purpose,
 * member count, permission count - and there are rarely more than a handful.
 */
export function DesignationsTab({ scope }: { scope: StaffScope }) {
    const { data: designations, isLoading } = useDesignations(scope);
    const { data: catalog } = usePermissionCatalog(scope);
    const { mutate: deleteDesignation, isPending: deleting } =
        useDeleteDesignation(scope);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<StaffDesignation | null>(null);
    const [removing, setRemoving] = useState<StaffDesignation | null>(null);

    const totalGrantable =
        catalog?.groups.reduce((n, g) => n + g.permissions.length, 0) ?? 0;

    function openCreate() {
        setEditing(null);
        setDialogOpen(true);
    }

    function openEdit(designation: StaffDesignation) {
        setEditing(designation);
        setDialogOpen(true);
    }

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

            {isLoading ? (
                <div className='grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className='h-36 rounded-xl' />
                    ))}
                </div>
            ) : (designations ?? []).length === 0 ? (
                <Card>
                    <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
                        <HugeiconsIcon
                            icon={Shield01Icon}
                            className='size-8 text-muted-foreground'
                        />
                        <div>
                            <p className='font-medium'>No designations yet.</p>
                            <p className='text-sm text-muted-foreground'>
                                Create a permission template to invite members
                                faster.
                            </p>
                        </div>
                        <Button size='sm' onClick={openCreate}>
                            <HugeiconsIcon icon={PlusSignIcon} />
                            New Designation
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className='grid gap-4 @xl/main:grid-cols-2 @4xl/main:grid-cols-3'>
                    {(designations ?? []).map((designation) => (
                        <Card key={designation.id} className='gap-3'>
                            <CardHeader className='flex flex-row items-start justify-between gap-2'>
                                <div className='min-w-0 space-y-1'>
                                    <CardTitle className='flex items-center gap-2 text-base'>
                                        <span className='truncate'>
                                            {designation.name}
                                        </span>
                                        {designation.isSystem && (
                                            <StatusBadge variant='info'>
                                                System
                                            </StatusBadge>
                                        )}
                                    </CardTitle>
                                    {designation.description && (
                                        <CardDescription className='line-clamp-2'>
                                            {designation.description}
                                        </CardDescription>
                                    )}
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            className='size-8 shrink-0'>
                                            <HugeiconsIcon
                                                icon={MoreHorizontalIcon}
                                            />
                                            <span className='sr-only'>
                                                Designation actions
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align='end'>
                                        <DropdownMenuItem
                                            onClick={() =>
                                                openEdit(designation)
                                            }>
                                            <HugeiconsIcon
                                                icon={PencilEdit02Icon}
                                            />
                                            Edit
                                        </DropdownMenuItem>
                                        {!designation.isSystem && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant='destructive'
                                                    disabled={
                                                        designation.memberCount >
                                                        0
                                                    }
                                                    onClick={() =>
                                                        setRemoving(designation)
                                                    }>
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
                            </CardHeader>
                            <CardContent className='flex items-center gap-4 text-xs text-muted-foreground'>
                                <span>
                                    <span className='font-semibold text-content'>
                                        {designation.permissions.length}
                                    </span>
                                    /{totalGrantable || '?'} permissions
                                </span>
                                <span>
                                    <span className='font-semibold text-content'>
                                        {designation.memberCount}
                                    </span>{' '}
                                    member{designation.memberCount === 1 ? '' : 's'}
                                </span>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

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
