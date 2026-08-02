'use client';

import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useRole } from '@/contexts/role-context';
import { isPlatformWideRole } from '@/lib/rbac-utils';
import {
    useDeleteResource,
    useResources,
    useUpdateResource,
} from '@/hooks/resources/use-resources';
import type { Resource } from '@/types/resource';
import { ResourceFormDialog } from './resource-form-dialog';
import { ResourcesTable } from './resources-table';

/**
 * Every boat, vehicle and guide the operator owns, in one place.
 *
 * Until this screen existed, assets could only be created from inside a tour's
 * Schedule step - so an operator had to open some arbitrary tour to rename a
 * boat, and nothing anywhere listed what they had. The data was always
 * operator-scoped; only the door was missing.
 */
export function ResourcesListView() {
    const { data, isLoading } = useResources();
    const update = useUpdateResource();
    const remove = useDeleteResource();
    const { can, role } = useRole();
    const canManage = can('MANAGE_AVAILABILITY');
    // The backend does not scope an admin's list to one operator, so the owner
    // has to be on screen or two operators' identically-named assets collide.
    const showOperator = isPlatformWideRole(role);

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<Resource | null>(null);
    const [deactivating, setDeactivating] = useState<Resource | null>(null);
    const [deleting, setDeleting] = useState<Resource | null>(null);

    const rows = data?.data ?? [];

    const openCreate = () => {
        setEditing(null);
        setFormOpen(true);
    };

    const openEdit = (resource: Resource) => {
        setEditing(resource);
        setFormOpen(true);
    };

    /**
     * Reactivating restores a constraint and is harmless, so it happens at once.
     * Deactivating removes one - the asset stops coupling its tours and its
     * calendar feed empties - so it asks first.
     */
    const toggleActive = (resource: Resource) => {
        if (!resource.isActive) {
            update.mutate({ id: resource.id, payload: { isActive: true } });
            return;
        }
        setDeactivating(resource);
    };

    return (
        <div className='space-y-4'>
            <ResourcesTable
                data={rows}
                isLoading={isLoading}
                canManage={canManage}
                showOperator={showOperator}
                onEdit={openEdit}
                onToggleActive={toggleActive}
                onDelete={setDeleting}
                actionSlot={
                    canManage && (
                        <Button size='sm' onClick={openCreate}>
                            <HugeiconsIcon icon={PlusSignIcon} /> Add equipment
                        </Button>
                    )
                }
            />

            <ResourceFormDialog
                open={formOpen}
                onOpenChange={setFormOpen}
                resource={editing}
            />

            <ConfirmDialog
                open={deactivating !== null}
                onOpenChange={open => !open && setDeactivating(null)}
                loading={update.isPending}
                title={`Deactivate ${deactivating?.name ?? 'this asset'}?`}
                description={
                    <>
                        It stops holding its tours apart, so they can each be
                        sold to their own capacity again
                        {deactivating && deactivating.tours.length > 0
                            ? ` (${deactivating.tours.map(t => t.name).join(', ')})`
                            : ''}
                        . Any calendar link for it goes empty. Nothing is
                        deleted and you can reactivate it at any time.
                    </>
                }
                confirmLabel='Deactivate'
                onConfirm={() => {
                    if (!deactivating) return;
                    update.mutate(
                        { id: deactivating.id, payload: { isActive: false } },
                        { onSettled: () => setDeactivating(null) }
                    );
                }}
            />

            <ConfirmDialog
                open={deleting !== null}
                onOpenChange={open => !open && setDeleting(null)}
                destructive
                loading={remove.isPending}
                title={`Delete ${deleting?.name ?? 'this asset'}?`}
                description={
                    <>
                        This cannot be undone. It is removed from
                        {deleting && deleting.tours.length > 0
                            ? ` ${deleting.tours.map(t => t.name).join(', ')}`
                            : ' every tour'}
                        , and any calendar link for it stops working
                        immediately. Bookings and departures are untouched.
                        {/* Deactivating keeps the history and is reversible;
                            deleting is neither. Say so where the choice is. */}
                        <span className='mt-2 block'>
                            If you have just retired it, deactivate instead.
                        </span>
                    </>
                }
                confirmLabel='Delete'
                onConfirm={() => {
                    if (!deleting) return;
                    remove.mutate(deleting.id, {
                        onSettled: () => setDeleting(null),
                    });
                }}
            />
        </div>
    );
}
