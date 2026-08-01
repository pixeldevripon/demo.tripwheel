/**
 * The model x state payment box (review 5.5).
 *
 * TYP vocabulary only - Total / Deposit paid / Remaining balance. Never "Paid
 * so far" (F3): v1 cannot know the operator_link balance state, so those lines
 * stay neutral and deadline-focused, and after the window they never claim
 * paid OR unpaid (conflict log 84/85). No Pay button on any model (F9) - the
 * payment link lives only in the operator's balance email, and the locked
 * anti-fraud line renders only inside the operator_link box.
 *
 * Cancelled bookings render the locked 6.4 refund copy, driven by the ledger's
 * `refundStatus` - progress, not promises: "on its way" until the money moved,
 * then "refunded".
 */
import type { TravellerBooking } from '@/lib/api/public/traveller';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';

import { formatDeadline, isPositive, money } from './traveller-format';

function depositPct(deposit: string, total: string): string {
    const d = Number(deposit);
    const t = Number(total);
    if (!Number.isFinite(d) || !Number.isFinite(t) || t <= 0) return '';
    return String(Math.round((d / t) * 100));
}

export function TravellerPaymentBox({
    booking,
    dict,
    typDict,
    locale,
    nowMs,
    active,
}: {
    booking: TravellerBooking;
    dict: Dictionary['traveller'];
    typDict: Dictionary['thankYou'];
    locale: Locale;
    /** Server-stamped request instant - decides before/after the window. */
    nowMs: number;
    /** True for upcoming cards - deadline/arrival notes only make sense there. */
    active: boolean;
}) {
    const operatorName = booking.operator.name ?? dict.operatorFallback;
    const terminated =
        booking.displayStatus === 'CANCELLED' ||
        booking.displayStatus === 'REJECTED' ||
        booking.displayStatus === 'FORFEITED';
    const requested =
        booking.displayStatus === 'CANCELLATION_REQUESTED' ||
        booking.displayStatus === 'OPERATOR_CANCELLATION_REPORTED';
    const pct = depositPct(booking.depositAmount, booking.totalRetail);
    const deadline = booking.freeCancelDeadline;
    const windowOpen = deadline ? new Date(deadline).getTime() > nowMs : false;
    const total = money(booking.totalRetail, booking.currency, locale);

    // ── operator_full: Island Tours never touched money on this booking ─────
    if (booking.paymentModel === 'OPERATOR_FULL') {
        return (
            <Note>
                {terminated
                    ? dict.refundOperatorFull
                    : dict.payOperatorFull
                          .replace('{amount}', total)
                          .replace('{operator}', operatorName)}
            </Note>
        );
    }

    // ── paid_in_full: one green line, or the full-refund story ──────────────
    if (booking.paymentModel === 'PAID_IN_FULL') {
        if (terminated) {
            return (
                <>
                    <MoneyRow label={typDict.total} value={total} />
                    <Note>
                        {booking.refundStatus === 'REFUNDED'
                            ? dict.refundDone
                            : dict.refundFullOnWay}
                    </Note>
                </>
            );
        }
        return (
            <div className='flex items-baseline justify-between gap-4 rounded-[10px] bg-it-green-subtle px-3.5 py-2.5'>
                <span className='text-[14.5px] leading-[1.6] text-it-green'>
                    {dict.payPaidInFull}
                </span>
                <span className='text-right text-[14.5px] leading-[1.6] font-normal text-it-green'>
                    {total}
                </span>
            </div>
        );
    }

    // ── deposit models (operator_link / on_arrival) ─────────────────────────
    const showBalance =
        !terminated && !requested && isPositive(booking.balanceAmount);
    const balance = money(booking.balanceAmount, booking.currency, locale);

    return (
        <>
            <MoneyRow label={typDict.total} value={total} />
            {isPositive(booking.depositAmount) && (
                <MoneyRow
                    label={
                        pct
                            ? dict.payDepositPaidPct.replace('{pct}', pct)
                            : typDict.depositPaid
                    }
                    value={money(
                        booking.depositAmount,
                        booking.currency,
                        locale
                    )}
                />
            )}
            {showBalance && (
                <MoneyRow label={typDict.remainingBalance} value={balance} />
            )}

            {terminated &&
                (booking.refundStatus === 'REFUNDED' ? (
                    <>
                        <Note>{dict.refundDone}</Note>
                        {booking.paymentModel === 'OPERATOR_LINK' && (
                            <Micro>{dict.refundBalanceNote}</Micro>
                        )}
                    </>
                ) : booking.refundStatus === 'PENDING' ||
                  booking.refundStatus === 'PARTIAL' ? (
                    <Note>
                        {dict.refundDepositOnWay.replace('{pct}', pct || '')}
                    </Note>
                ) : booking.displayStatus === 'FORFEITED' ? (
                    // Review 9b: the deposit was kept after an admin-confirmed
                    // non-payment report - "Cancelled" copy would misrepresent
                    // that, and silence would read as a missing refund.
                    <Note>{dict.forfeitedNote}</Note>
                ) : null)}

            {active &&
                !requested &&
                booking.paymentModel === 'OPERATOR_LINK' && (
                    <>
                        {showBalance && (
                            <Note>
                                {windowOpen && deadline
                                    ? dict.payLinkBefore
                                          .replace('{operator}', operatorName)
                                          .replace(
                                              '{deadline}',
                                              formatDeadline(deadline, locale)
                                          )
                                    : dict.payLinkAfter
                                          .replace('{amount}', balance)
                                          .replace('{operator}', operatorName)}
                            </Note>
                        )}
                        {/* Locked anti-fraud line - operator_link box only. */}
                        <Micro>{dict.antiFraud}</Micro>
                    </>
                )}
            {active && !requested && booking.paymentModel === 'ON_ARRIVAL' && (
                <Note>
                    {booking.onArrivalPayment === 'CASH_ONLY'
                        ? dict.payOnArrivalCash
                        : dict.payOnArrivalCard}
                </Note>
            )}
        </>
    );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
    return (
        <div className='flex items-baseline justify-between gap-4'>
            <span className='text-[14.5px] leading-[1.6] text-it-text-muted'>
                {label}
            </span>
            <span className='text-right text-[14.5px] leading-[1.6] font-normal text-it-heading'>
                {value}
            </span>
        </div>
    );
}

function Note({ children }: { children: string }) {
    return (
        <p className='mt-1 mb-0 text-[13.5px] leading-[1.6] text-it-ink/80'>
            {children}
        </p>
    );
}

function Micro({ children }: { children: string }) {
    return (
        <p className='mt-1 mb-0 text-[12.5px] leading-[1.6] text-it-text-muted'>
            {children}
        </p>
    );
}

