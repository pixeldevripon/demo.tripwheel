import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import { formatDate } from '@/lib/utils';
import type { BookingListItem, BookingPaymentModel } from '@/types/booking';

export const paymentModelLabel: Record<BookingPaymentModel, string> = {
  OPERATOR_LINK: 'Operator link',
  ON_ARRIVAL: 'On arrival',
  PAID_IN_FULL: 'Paid in full',
  OPERATOR_FULL: 'Operator full',
};

export function bookingMoney(amount: string | number, rawCurrency: string): string {
  const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
  return formatPriceFrom(amount, currency, 'en');
}

/**
 * The refund the traveller is entitled to when the cancellation request landed
 * inside the free window (C23, payment_model-aware): deposit models refund the
 * deposit, paid_in_full the whole payment, operator_full nothing (no platform
 * charge). Outside the window nothing is due from the platform.
 */
/**
 * Is the free-cancellation window still open right now? Drives whether we
 * promise a refund or warn that the window has closed. A booking with no
 * deadline (no departure snapshot) is treated as closed - never promise a
 * refund we cannot back.
 */
export function isFreeWindowOpen(b: BookingListItem): boolean {
  if (!b.freeCancelDeadline) return false;
  return new Date(b.freeCancelDeadline).getTime() > Date.now();
}

/**
 * The reassuring one-liner for a confirmed booking whose free window is still
 * open. Null in every other state: an expired window, a non-confirmed booking,
 * or one already awaiting a cancellation decision has nothing to advertise.
 */
export function freeCancellationNote(b: BookingListItem): string | null {
  // Eligibility is the server's call (departed / not confirmed / already
  // requested all collapse into this one flag) - never promise a window on a
  // booking the endpoint would refuse.
  if (!b.canRequestCancellation) return null;
  if (!isFreeWindowOpen(b)) return null;
  return `Free cancellation until ${formatDate(b.freeCancelDeadline, 'short')}`;
}

/**
 * Party lines grouped by unit price ("2 x EUR 79.99"), derived from the
 * booking's unit items. Age-band NAMES are not on the list payload, so we
 * group by what we actually have rather than inventing labels.
 */
export function partyPriceLines(
  b: BookingListItem,
): Array<{ count: number; each: string }> {
  const byPrice = new Map<string, number>();
  for (const item of b.unitItems) {
    byPrice.set(item.priceRetail, (byPrice.get(item.priceRetail) ?? 0) + 1);
  }
  return [...byPrice.entries()]
    .sort((a, z) => Number(z[0]) - Number(a[0]))
    .map(([price, count]) => ({
      count,
      each: bookingMoney(price, b.currency),
    }));
}

export function refundDue(b: BookingListItem): string | null {
  if (!b.requestedInFreeWindow) return null;
  if (b.paymentModel === 'OPERATOR_FULL') return null;
  const amount =
    b.paymentModel === 'PAID_IN_FULL' ? b.totalRetail : b.depositAmount;
  return Number(amount) > 0 ? bookingMoney(amount, b.currency) : null;
}
