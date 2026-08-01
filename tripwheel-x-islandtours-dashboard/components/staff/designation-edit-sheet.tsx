'use client';

import { useEffect, useState } from 'react';
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
import { Field, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    useCreateDesignation,
    usePermissionCatalog,
    useUpdateDesignation,
} from '@/hooks/staff/use-staff';
import type { PermissionKey } from '@/lib/config/rbac';
import type { StaffDesignation, StaffScope } from '@/types/staff';
import { PermissionMatrix } from './permission-matrix';

interface DesignationEditSheetProps {
    scope: StaffScope;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Null = create mode. */
    designation: StaffDesignation | null;
    /**
     * Create mode only: receives the created row before the sheet closes.
     * The invite dialog uses it to auto-select the fresh designation.
     */
    onCreated?: (designation: StaffDesignation) => void;
}

/**
 * Create / edit a designation (named permission template), in the standard
 * list-surface sheet chrome (sticky header/footer, scrollable body). System
 * designations keep their name locked (the backend rejects renames) but their
 * permission set stays editable - an edit re-computes every holder's access.
 */
export function DesignationEditSheet({
    scope,
    open,
    onOpenChange,
    designation,
    onCreated,
}: DesignationEditSheetProps) {
    const { data: catalog } = usePermissionCatalog(scope);
    const { mutate: createDesignation, isPending: creating } =
        useCreateDesignation(scope);
    const { mutate: updateDesignation, isPending: updating } =
        useUpdateDesignation(scope);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [permissions, setPermissions] = useState<PermissionKey[]>([]);
    const [nameError, setNameError] = useState<string | null>(null);

    const isEdit = designation !== null;
    const isPending = creating || updating;

    useEffect(() => {
        if (!open) return;
        setName(designation?.name ?? '');
        setDescription(designation?.description ?? '');
        setPermissions(designation?.permissions ?? []);
        setNameError(null);
    }, [open, designation]);

    function handleSave() {
        if (name.trim().length < 2) {
            setNameError('Name must be at least 2 characters');
            return;
        }
        const payload = {
            name: name.trim(),
            description: description.trim() || undefined,
            permissions,
        };
        if (isEdit) {
            updateDesignation(
                {
                    id: designation.id,
                    payload: designation.isSystem
                        ? { permissions }
                        : payload,
                },
                { onSuccess: () => onOpenChange(false) },
            );
        } else {
            createDesignation(payload, {
                onSuccess: (created) => {
                    onCreated?.(created);
                    onOpenChange(false);
                },
            });
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            {/* Sticky header + footer; only the form body scrolls. */}
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl!'>
                <SheetHeader className='border-b'>
                    <SheetTitle>
                        {isEdit
                            ? `Edit "${designation.name}"`
                            : 'New designation'}
                    </SheetTitle>
                    <SheetDescription>
                        A designation is a named permission template. Members
                        assigned to it inherit its permissions; editing it
                        updates every member instantly.
                    </SheetDescription>
                </SheetHeader>

                <SheetBody className='space-y-4 py-4'>
                    <div className='grid gap-4 sm:grid-cols-2'>
                        <Field>
                            <Label>
                                Name{' '}
                                <span className='text-destructive'>*</span>
                            </Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder='e.g. Reservations Desk'
                                disabled={isEdit && designation.isSystem}
                                aria-invalid={!!nameError}
                            />
                            <FieldError>{nameError}</FieldError>
                        </Field>
                        <Field>
                            <Label>Description</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder='What this designation is for'
                                rows={1}
                                disabled={isEdit && designation.isSystem}
                            />
                        </Field>
                    </div>

                    <div className='space-y-2'>
                        <div className='flex items-baseline justify-between'>
                            <Label>Permissions</Label>
                            <span className='text-xs text-muted-foreground'>
                                {permissions.length} selected
                            </span>
                        </div>
                        <PermissionMatrix
                            groups={catalog?.groups ?? []}
                            value={permissions}
                            onChange={setPermissions}
                        />
                    </div>
                </SheetBody>

                <SheetFooter className='flex-row justify-end gap-2 border-t'>
                    <Button
                        variant='outline'
                        disabled={isPending}
                        onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button disabled={isPending} onClick={handleSave}>
                        {isPending
                            ? 'Saving...'
                            : isEdit
                              ? 'Save changes'
                              : 'Create designation'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
