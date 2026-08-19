'use client';

/**
 * Read-only quick view of everything the payout ledger knows about one
 * settlement. Opened by a row click; the trimmed Recorded column lives here
 * in full alongside the money breakdown and the payout timeline.
 */

import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { StatusBadge } from '@/components/common/status-badge';
import { SETTLEMENT_STATUS } from '@/components/common/status-maps';
import {
    MoneyRow,
    Row,
    Section,
    SheetPager,
    type SheetPagerProps,
} from '@/components/common/detail-sheet';
import { formatDate } from '@/lib/utils';
import type { SettlementListItem } from '@/types/booking';
import { money, settlementNextStep } from './settlement-columns';

export function SettlementDetailSheet({
    settlement: s,
    isAdmin,
    onOpenChange,
    ...pager
}: {
    settlement: SettlementListItem | null;
    isAdmin: boolean;
    onOpenChange: (open: boolean) => void;
} & SheetPagerProps) {
    return (
        <Sheet open={s !== null} onOpenChange={onOpenChange}>
            <SheetContent className='flex w-full flex-col gap-0 sm:max-w-2xl!'>
                {s && (
                    <SettlementDetailBody
                        settlement={s}
                        isAdmin={isAdmin}
                        {...pager}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function SettlementDetailBody({
    settlement: s,
    isAdmin,
    onPrev,
    onNext,
    position,
}: {
    settlement: SettlementListItem;
    isAdmin: boolean;
} & SheetPagerProps) {
    const statusMeta = SETTLEMENT_STATUS[s.status];
    const next = settlementNextStep(s, isAdmin);
    const reversed = s.status === 'REVERSED';
    // A reversed row's net was zeroed; keep the would-have-been payout
    // readable, matching the struck-through list cell.
    const wouldHaveBeen = (
        Number(s.amountCollected) - Number(s.commissionOwed)
    ).toFixed(2);

    return (
        <>
            <SheetHeader className='border-b'>
                <div className='flex items-center justify-between gap-3 pr-8'>
                    <div className='min-w-0'>
                        <div className='flex items-center gap-2.5'>
                            <SheetTitle className='font-mono'>
                                {s.displayRef}
                            </SheetTitle>
                            <StatusBadge
                                variant={statusMeta.variant}
                                hint={statusMeta.hint}
                            >
                                {statusMeta.label}
                            </StatusBadge>
                        </div>
                        <SheetDescription>
                            {s.tourName ?? 'Unknown tour'}
                            {isAdmin && s.operatorName
                                ? ` · ${s.operatorName}`
                                : ''}
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
                <Section label='Payout'>
                    <div className='divide-y rounded-lg border bg-muted/30'>
                        <MoneyRow
                            label='Booking total collected'
                            value={money(s.amountCollected, s.currency)}
                        />
                        <MoneyRow
                            label='Island Tours commission'
                            value={money(s.commissionOwed, s.currency)}
                        />
                        <MoneyRow
                            label={
                                reversed
                                    ? 'Payout (reversed - nothing owed)'
                                    : isAdmin
                                      ? 'Payout to operator'
                                      : 'Your payout'
                            }
                            value={money(
                                reversed ? wouldHaveBeen : s.netPosition,
                                s.currency,
                            )}
                            strong={!reversed}
                        />
                        {s.operatorPayout != null && (
                            <MoneyRow
                                label='Actually paid out'
                                value={money(s.operatorPayout, s.currency)}
                                strong
                            />
                        )}
                    </div>
                    {next && (
                        <Row
                            label='Next'
                            value={
                                s.payoutHeld ? (
                                    <StatusBadge variant='warning'>{next}</StatusBadge>
                                ) : (
                                    next
                                )
                            }
                        />
                    )}
                    <Row
                        label='Eligible for payout'
                        value={
                            s.payoutEligible ? (
                                <StatusBadge variant='success'>Yes</StatusBadge>
                            ) : (
                                <span className='text-content-muted'>Not yet</span>
                            )
                        }
                    />
                </Section>

                {isAdmin && (
                    <Section label='Operator'>
                        <Row
                            label='Operator'
                            value={s.operatorName ?? s.operatorId}
                        />
                    </Section>
                )}

                <Section label='Timeline'>
                    <Row label='Recorded' value={formatDate(s.createdAt, 'long')} />
                    {s.payoutReleaseAt && (
                        <Row
                            label='Clears for payout'
                            value={formatDate(s.payoutReleaseAt, 'long')}
                        />
                    )}
                    {s.settledAt && (
                        <Row
                            label='Marked paid'
                            value={formatDate(s.settledAt, 'long')}
                        />
                    )}
                </Section>
            </SheetBody>
        </>
    );
}
