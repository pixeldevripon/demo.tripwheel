'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useDesignations, useInviteStaff } from '@/hooks/staff/use-staff';
import type { StaffScope } from '@/types/staff';
import { DesignationEditSheet } from './designation-edit-sheet';

const inviteSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.email('Enter a valid email address'),
    designationId: z.string().optional(),
});

/**
 * Honest per-role copy: MANAGER/STAFF is an organizational label - the
 * permission set always comes from the designation/overrides, and payouts +
 * team management stay with the owner regardless.
 */
const SEAT_ROLE_OPTIONS: {
    value: 'STAFF' | 'MANAGER';
    label: string;
    description: string;
}[] = [
    {
        value: 'STAFF',
        label: 'User',
        description: 'Day-to-day team member.',
    },
    {
        value: 'MANAGER',
        label: 'Manager',
        description: 'Senior label on the team list.',
    },
];

type InviteValues = z.infer<typeof inviteSchema>;

const NO_DESIGNATION = 'none';

interface StaffInviteDialogProps {
    scope: StaffScope;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Invite dialog: provisions the account and emails a set-password link. The
 * designation supplies the initial permission set; per-member fine-tuning
 * happens afterwards in "Edit access" (kept out of this dialog on purpose -
 * an invite should be a 10-second action).
 */
export function StaffInviteDialog({
    scope,
    open,
    onOpenChange,
}: StaffInviteDialogProps) {
    const { data: designations } = useDesignations(scope);
    const { mutate: invite, isPending } = useInviteStaff(scope);
    const [designationId, setDesignationId] = useState<string>(NO_DESIGNATION);
    const [seatRole, setSeatRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
    // The "Add designation" action inside the dropdown: the select must be
    // controlled (the action closes it), and the create sheet stacks over
    // this dialog (its portal means clicks inside it register as "outside").
    const [designationSelectOpen, setDesignationSelectOpen] = useState(false);
    const [createSheetOpen, setCreateSheetOpen] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<InviteValues>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { name: '', email: '' },
    });

    function close() {
        onOpenChange(false);
        reset();
        setDesignationId(NO_DESIGNATION);
        setSeatRole('STAFF');
    }

    function onSubmit(values: InviteValues) {
        invite(
            {
                name: values.name,
                email: values.email,
                ...(designationId !== NO_DESIGNATION && { designationId }),
                ...(scope === 'team' && { seatRole }),
            },
            { onSuccess: close },
        );
    }

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
            <DialogContent
                className='sm:max-w-md'
                // While the create-designation sheet is stacked on top, every
                // interaction inside it happens outside THIS dialog's portal -
                // without the guards the dialog dismisses under the sheet.
                onInteractOutside={(e) => {
                    if (createSheetOpen) e.preventDefault();
                }}
                onEscapeKeyDown={(e) => {
                    if (createSheetOpen) e.preventDefault();
                }}>
                <DialogHeader>
                    <DialogTitle>
                        {scope === 'platform'
                            ? 'Invite user'
                            : 'Invite team member'}
                    </DialogTitle>
                    <DialogDescription>
                        They receive a set-password link by email and sign in
                        with their own credentials. Access follows the selected
                        designation and can be fine-tuned afterwards.
                    </DialogDescription>
                </DialogHeader>

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className='space-y-4'
                    id='staff-invite-form'>
                    <Field>
                        <Label>
                            Full name <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                            {...register('name')}
                            placeholder='e.g. Maria Fernandes'
                            autoComplete='off'
                            aria-invalid={!!errors.name}
                        />
                        <FieldError>{errors.name?.message}</FieldError>
                    </Field>

                    <Field>
                        <Label>
                            Email <span className='text-destructive'>*</span>
                        </Label>
                        <Input
                            type='email'
                            {...register('email')}
                            placeholder='name@company.com'
                            autoComplete='off'
                            aria-invalid={!!errors.email}
                        />
                        <FieldError>{errors.email?.message}</FieldError>
                    </Field>

                    {scope === 'team' && (
                        <Field>
                            <Label>Seat role</Label>
                            <Select
                                value={seatRole}
                                onValueChange={(v) =>
                                    setSeatRole(v as 'MANAGER' | 'STAFF')
                                }>
                                <SelectTrigger className='w-full'>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEAT_ROLE_OPTIONS.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}>
                                            <span>{option.label}</span>
                                            <span className='text-muted-foreground'>
                                                - {option.description}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldDescription>
                                A label shown on the team list - what this
                                member can DO is set by the designation below.
                                Payouts, bank details and team management
                                always stay with the owner account.
                            </FieldDescription>
                        </Field>
                    )}

                    <Field>
                        <Label>Designation</Label>
                        <Select
                            open={designationSelectOpen}
                            onOpenChange={setDesignationSelectOpen}
                            value={designationId}
                            onValueChange={setDesignationId}>
                            <SelectTrigger className='w-full'>
                                <SelectValue placeholder='No designation' />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NO_DESIGNATION}>
                                    No designation (grant manually)
                                </SelectItem>
                                {(designations ?? []).map((designation) => (
                                    <SelectItem
                                        key={designation.id}
                                        value={designation.id}>
                                        {designation.name}
                                    </SelectItem>
                                ))}
                                <SelectSeparator />
                                {/* Deliberately NOT a SelectItem - it must
                                    never become the field's value. It swaps
                                    the dropdown for the create sheet. */}
                                <button
                                    type='button'
                                    className='flex w-full cursor-pointer items-center gap-2.5 rounded-sm py-2 pr-8 pl-3 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground'
                                    onClick={() => {
                                        setDesignationSelectOpen(false);
                                        setCreateSheetOpen(true);
                                    }}>
                                    <HugeiconsIcon
                                        icon={PlusSignIcon}
                                        className='size-3.5 shrink-0'
                                    />
                                    Add designation
                                </button>
                            </SelectContent>
                        </Select>
                        <FieldDescription>
                            The permission template this member starts with.
                        </FieldDescription>
                    </Field>
                </form>

                {/* Quick-create, stacked over the invite dialog; the new
                    designation is auto-selected above once it exists. */}
                <DesignationEditSheet
                    scope={scope}
                    open={createSheetOpen}
                    onOpenChange={setCreateSheetOpen}
                    designation={null}
                    onCreated={(created) => setDesignationId(created.id)}
                />

                <DialogFooter>
                    <Button
                        type='button'
                        variant='outline'
                        disabled={isPending}
                        onClick={close}>
                        Cancel
                    </Button>
                    <Button
                        type='submit'
                        form='staff-invite-form'
                        disabled={isPending}>
                        {isPending ? 'Sending invite...' : 'Send invite'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
