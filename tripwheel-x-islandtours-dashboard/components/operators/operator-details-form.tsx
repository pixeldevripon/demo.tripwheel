'use client';

import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/common/status-badge';
import { OPERATOR_VERIFICATION } from '@/components/common/status-maps';
import { useRole } from '@/contexts/role-context';
import { useUpdateOperator } from '@/hooks/operators/use-operators';
import { formatDate } from '@/lib/utils';
import type {
    OperatorDetail,
    OperatorVerificationStatus,
} from '@/types/operator';
import { getOperatorDisplayName } from '@/types/operator';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { OperatorDeleteDialog } from './operator-delete-dialog';
import { OperatorEmailTimeline } from './operator-email-timeline';
import {
    ApproveOperatorDialog,
    RejectOperatorDialog,
    type DecisionTarget,
} from './verification-decision-dialogs';

const detailsSchema = z.object({
    isActive: z.boolean(),
    contactEmail: z
        .string()
        .optional()
        .refine(
            v => !v || z.email().safeParse(v).success,
            'Must be a valid email'
        ),
    contactPhone: z.string().optional(),
});

type DetailsFormValues = z.infer<typeof detailsSchema>;

const STATUS_LABEL: Record<OperatorVerificationStatus, string> = {
    UNVERIFIED: 'Unverified',
    PENDING: 'Pending',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
};

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
    return (
        <div className='flex flex-col gap-1'>
            <span className='text-xs font-medium text-muted-foreground'>
                {label}
            </span>
            <span className='text-sm'>{value}</span>
        </div>
    );
}

interface OperatorDetailsFormProps {
    operator: OperatorDetail;
}

export function OperatorDetailsForm({ operator }: OperatorDetailsFormProps) {
    const router = useRouter();
    const { can } = useRole();
    const canManage = can('MANAGE_OPERATORS');
    const [deleteOpen, setDeleteOpen] = useState(false);

    const { mutate: updateOperator, isPending } = useUpdateOperator();
    const [approveTarget, setApproveTarget] = useState<DecisionTarget | null>(
        null,
    );
    const [rejectTarget, setRejectTarget] = useState<DecisionTarget | null>(
        null,
    );

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<DetailsFormValues>({
        resolver: zodResolver(detailsSchema),
        defaultValues: {
            isActive: operator.isActive,
            contactEmail: operator.contactEmail ?? '',
            contactPhone: operator.contactPhone ?? '',
        },
    });

    const isActiveValue = watch('isActive');

    function onSubmit(values: DetailsFormValues) {
        // `verificationStatus` is deliberately NOT in this payload: the
        // backend DTO rejects it (400) - decisions go through the dedicated
        // verification endpoint via the Approve/Reject buttons below.
        updateOperator(
            {
                id: operator.id,
                payload: {
                    isActive: values.isActive,
                    contactEmail: values.contactEmail || null,
                    contactPhone: values.contactPhone || null,
                },
            },
            {
                onSuccess: () =>
                    toast.success('Operator updated successfully.'),
                onError: err =>
                    toast.error(
                        err instanceof Error
                            ? err.message
                            : 'Failed to update operator.'
                    ),
            }
        );
    }

    const rating =
        operator.aggregateRating != null
            ? `${operator.aggregateRating.toFixed(1)} (${operator.aggregateReviewCount} reviews)`
            : 'No reviews yet';

    const verificationMeta = OPERATOR_VERIFICATION[operator.verificationStatus];
    const decisionTarget: DecisionTarget = {
        id: operator.id,
        name: getOperatorDisplayName(operator),
    };

    return (
        <div className='space-y-6'>
            <Card>
                <CardHeader className='border-b pb-8'>
                    <CardTitle>Account</CardTitle>
                </CardHeader>
                <CardContent className='pt-8'>
                    <div className='grid gap-6 sm:grid-cols-2'>
                        <ReadOnlyRow
                            label='Contact Name'
                            value={operator.user.name}
                        />
                        <ReadOnlyRow
                            label='Login Email'
                            value={operator.user.email}
                        />
                        <ReadOnlyRow
                            label='Total Bookings'
                            value={String(operator.totalBookings)}
                        />
                        <ReadOnlyRow label='Rating' value={rating} />
                        <ReadOnlyRow
                            label='Cancellation Rate (90d)'
                            value={`${operator.cancellationRate90d}%`}
                        />
                        <ReadOnlyRow
                            label='Current Status'
                            value={`${operator.isActive ? 'Active' : 'Inactive'} · ${STATUS_LABEL[operator.verificationStatus]}`}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className='border-b pb-8'>
                    <CardTitle>Management</CardTitle>
                </CardHeader>
                <CardContent className='pt-8'>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='space-y-6'>
                        {/* Read-only by design (WP-E E-15): the backend's
                            PATCH DTO rejects verificationStatus. The decision
                            endpoint is the only writer, reached through the
                            Approve/Reject dialogs. */}
                        <Field>
                            <Label>Verification Status</Label>
                            <div className='flex flex-wrap items-center gap-3'>
                                <StatusBadge
                                    variant={verificationMeta.variant}
                                    hint={verificationMeta.hint}>
                                    {verificationMeta.label}
                                </StatusBadge>
                                {operator.verificationDecidedAt && (
                                    <span className='text-xs text-muted-foreground'>
                                        Decided{' '}
                                        {formatDate(
                                            operator.verificationDecidedAt,
                                            'long'
                                        )}
                                    </span>
                                )}
                                {canManage &&
                                    operator.verificationStatus ===
                                        'PENDING' && (
                                        <div className='flex gap-2'>
                                            <Button
                                                type='button'
                                                size='sm'
                                                variant='outline'
                                                onClick={() =>
                                                    setRejectTarget(
                                                        decisionTarget
                                                    )
                                                }>
                                                Reject
                                            </Button>
                                            <Button
                                                type='button'
                                                size='sm'
                                                onClick={() =>
                                                    setApproveTarget(
                                                        decisionTarget
                                                    )
                                                }>
                                                Approve
                                            </Button>
                                        </div>
                                    )}
                            </div>
                            <FieldDescription>
                                Set by the approval decision - approving sends
                                the &ldquo;You&rsquo;re approved&rdquo; email
                                and lets the operator publish tours.
                            </FieldDescription>
                        </Field>

                        <div className='grid gap-6 sm:grid-cols-2'>
                            <Field>
                                <Label>Support Email</Label>
                                <Input
                                    type='email'
                                    {...register('contactEmail')}
                                    placeholder='support@company.com'
                                    aria-invalid={!!errors.contactEmail}
                                    disabled={!canManage}
                                />
                                <FieldError>
                                    {errors.contactEmail?.message}
                                </FieldError>
                            </Field>
                            <Field>
                                <Label>Support Phone</Label>
                                <Input
                                    {...register('contactPhone')}
                                    placeholder='+5999 123 4567'
                                    disabled={!canManage}
                                />
                            </Field>
                        </div>

                        <Field>
                            <div className='flex items-center gap-2'>
                                <Checkbox
                                    id='isActive'
                                    checked={isActiveValue}
                                    onCheckedChange={checked =>
                                        setValue('isActive', !!checked)
                                    }
                                    disabled={!canManage}
                                />
                                <Label
                                    htmlFor='isActive'
                                    className='cursor-pointer'>
                                    Active
                                </Label>
                            </div>
                            <FieldDescription>
                                Inactive operators and their tours are hidden
                                from the public site.
                            </FieldDescription>
                        </Field>

                        {canManage && (
                            <div className='flex justify-end pt-2'>
                                <Button type='submit' disabled={isPending}>
                                    {isPending ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </form>
                </CardContent>
            </Card>

            {/* Every send-log row for this operator (WP-E E-21): onboarding
                sequence, approval email, internal alerts - with per-row
                resend for the OB set. */}
            <Card>
                <CardHeader className='border-b pb-8'>
                    <CardTitle>Emails</CardTitle>
                </CardHeader>
                <CardContent className='pt-4'>
                    <OperatorEmailTimeline
                        operatorId={operator.id}
                        canResend={canManage}
                    />
                </CardContent>
            </Card>

            <ApproveOperatorDialog
                target={approveTarget}
                onClose={() => setApproveTarget(null)}
            />
            <RejectOperatorDialog
                target={rejectTarget}
                onClose={() => setRejectTarget(null)}
            />

            {canManage && (
                <Card className='border-destructive/30 ring-destructive/10'>
                    <CardHeader className='border-b pb-8'>
                        <CardTitle className='text-destructive'>
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent className='pt-8'>
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <p className='text-sm font-medium'>
                                    Delete this operator
                                </p>
                                <p className='text-sm text-muted-foreground mt-1'>
                                    Permanently removes the operator account and
                                    profile. Operators with existing tours or
                                    bookings cannot be deleted - deactivate them
                                    instead.
                                </p>
                            </div>
                            <div className='shrink-0'>
                                <Button
                                    variant='destructive'
                                    size='sm'
                                    type='button'
                                    onClick={() => setDeleteOpen(true)}>
                                    <HugeiconsIcon icon={Delete02Icon} />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {canManage && (
                <OperatorDeleteDialog
                    operator={{
                        id: operator.id,
                        user: { name: operator.user.name },
                        companyInfo: operator.companyInfo,
                    }}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    onSuccess={() => router.push('/tour-operators')}
                />
            )}
        </div>
    );
}

