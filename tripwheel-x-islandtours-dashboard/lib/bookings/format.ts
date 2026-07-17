import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
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
export function refundDue(b: BookingListItem): string | null {
  if (!b.requestedInFreeWindow) return null;
  if (b.paymentModel === 'OPERATOR_FULL') return null;
  const amount =
    b.paymentModel === 'PAID_IN_FULL' ? b.totalRetail : b.depositAmount;
  return Number(amount) > 0 ? bookingMoney(amount, b.currency) : null;
}
