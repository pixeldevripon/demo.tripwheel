'use client';

/**
 * Row-click quick view for the verification queue (E-13): who is asking to
 * join, how long they have been waiting, and every email the platform has
 * sent them (the OB-1/OB-2 trail an approval decision should be based on).
 * Approve/Reject stay available in the footer for PENDING rows so the
 * decision can be made without leaving the sheet.
 *
 * Contact phone comes from the operator DETAIL endpoint (the list rows do
 * not carry it), fetched lazily while the sheet is open.
 */

import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import Link from 'next/link';

import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/status-badge';
import { OPERATOR_VERIFICATION } from '@/components/common/status-maps';
import {
    Row,
    Section,
    SheetPager,
    type SheetPagerProps,
} from '@/components/common/detail-sheet';
import { useRole } from '@/contexts/role-context';
import { useOperator } from '@/hooks/operators/use-operators';
import {
    businessDaysSince,
    PENDING_BUSINESS_DAY_THRESHOLD,
} from '@/lib/operators/business-days';
import { formatDate } from '@/lib/utils';
import type { OperatorListItem } from '@/types/operator';
import { getOperatorDisplayName } from '@/types/operator';
import { OperatorEmailTimeline } from './operator-email-timeline';
import type { DecisionTarget } from './verification-decision-dialogs';

interface OperatorVerificationSheetProps extends SheetPagerProps {
    operator: OperatorListItem | null;
    onOpenChange: (open: boolean) => void;
    onApprove: (target: DecisionTarget) => void;
    onReject: (target: DecisionTarget) => void;
}

export function OperatorVerificationSheet({
    operator,
    onOpenChange,
    onApprove,
    onReject,
    ...pager
}: OperatorVerificationSheetProps) {
    return (
        <Sheet open={operator !== null} onOpenChange={onOpenChange}>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl!'>
                {operator && (
                    <SheetInner
                        operator={operator}
                        onApprove={onApprove}
                        onReject={onReject}
                        {...pager}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function SheetInner({
    operator: op,
    onApprove,
    onReject,
    onPrev,
    onNext,
    position,
}: {
    operator: OperatorListItem;
    onApprove: (target: DecisionTarget) => void;
    onReject: (target: DecisionTarget) => void;
} & SheetPagerProps) {
    const { can } = useRole();
    const canManage = can('MANAGE_OPERATORS');
    // Lazy detail fetch for the fields the list rows do not carry (phone).
    const { data: detail } = useOperator(op.id);

    const name = getOperatorDisplayName(op);
    const statusMeta = OPERATOR_VERIFICATION[op.verificationStatus];
    const daysPending = businessDaysSince(op.createdAt);
    const overdue = daysPending >= PENDING_BUSINESS_DAY_THRESHOLD;
    const target: DecisionTarget = { id: op.id, name };

    return (
        <>
            <SheetHeader className='border-b'>
                <div className='flex items-center justify-between gap-3 pr-8'>
                    <div className='min-w-0'>
                        <div className='flex items-center gap-2.5'>
                            <SheetTitle className='truncate'>{name}</SheetTitle>
                            <StatusBadge
                                variant={statusMeta.variant}
                                hint={statusMeta.hint}>
                                {statusMeta.label}
                            </StatusBadge>
                        </div>
                        <SheetDescription>
                            Signed up {formatDate(op.createdAt, 'long')}
                        </SheetDescription>
                    </div>
                    <SheetPager
                        onPrev={onPrev}
                        onNext={onNext}
                        position={position}
                    />
                </div>
            </SheetHeader>

            <SheetBody className='divide-y'>
                <Section label='Company'>
                    <Row
                        label='Company'
                        value={
                            <Link
                                href={`/tour-operators/${op.id}/edit`}
                                className='hover:underline underline-offset-4'>
                                {op.companyInfo?.companyName ?? '-'}
                            </Link>
                        }
                    />
                    <Row label='Signatory' value={op.user.name} />
                    <Row
                        label='Email'
                        value={
                            <a
                                href={`mailto:${op.user.email}`}
                                className='hover:underline underline-offset-4'>
                                {op.user.email}
                            </a>
                        }
                    />
                    <Row
                        label='Phone / WhatsApp'
                        value={detail?.contactPhone ?? '-'}
                    />
                </Section>

                <Section label='Pipeline'>
                    <Row
                        label='Accepted'
                        value={formatDate(op.createdAt, 'long')}
                    />
                    <Row
                        label='Days pending'
                        value={
                            <StatusBadge
                                variant={overdue ? 'warning' : 'neutral'}
                                hint={
                                    overdue
                                        ? 'At or past the 2-business-day sales reminder threshold'
                                        : undefined
                                }>
                                {daysPending} business day
                                {daysPending === 1 ? '' : 's'}
                            </StatusBadge>
                        }
                    />
                    <Row label='Tours submitted' value={op.toursSubmitted} />
                    {op.firstTourLiveAt && (
                        <Row
                            label='First tour live'
                            value={formatDate(op.firstTourLiveAt, 'long')}
                        />
                    )}
                    {op.verificationDecidedAt && (
                        <Row
                            label='Decision made'
                            value={formatDate(op.verificationDecidedAt, 'long')}
                        />
                    )}
                </Section>

                <OperatorEmailTimeline
                    operatorId={op.id}
                    canResend={canManage}
                />
            </SheetBody>

            {canManage && op.verificationStatus === 'PENDING' && (
                <SheetFooter className='flex-row justify-end gap-2 border-t'>
                    <Button variant='outline' onClick={() => onReject(target)}>
                        <HugeiconsIcon icon={Cancel01Icon} />
                        Reject
                    </Button>
                    <Button onClick={() => onApprove(target)}>
                        <HugeiconsIcon icon={Tick02Icon} />
                        Approve
                    </Button>
                </SheetFooter>
            )}
        </>
    );
}
