/**
 * Dashboard-owned tour performance signals.
 *
 * Shared by the Collection, Our Picks and Comparison tour selectors so every
 * dashboard picker surfaces the same aggregated numbers, not just the tour name.
 * Admin-only: these are the figures an admin curates on, never shopper-facing.
 */
import { isCurrency } from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';

/**
 * "★ 4.8 (1,738) · 42 booked · From $120" - the performance signals an admin
 * picks on.
 */
export function tourPerfSummary(t: {
  aggregateRating?: number | null;
  aggregateReviewCount?: number;
  bookingCount?: number;
  priceFrom?: number | string | null;
  basePrice?: number | string | null;
  /** The tour's own currency; admin views always show it (never the shopper cookie). */
  defaultCurrency?: string | null;
}): string {
  const parts: string[] = [];
  const reviews = t.aggregateReviewCount ?? 0;
  if (reviews > 0) {
    parts.push(`★ ${t.aggregateRating ?? '-'} (${reviews.toLocaleString()})`);
  } else {
    parts.push('No reviews yet');
  }
  parts.push(`${(t.bookingCount ?? 0).toLocaleString()} booked`);
  const price = Number(t.priceFrom ?? t.basePrice ?? 0);
  if (Number.isFinite(price) && price > 0) {
    const currency = isCurrency(t.defaultCurrency) ? t.defaultCurrency : 'EUR';
    parts.push(`From ${formatPriceFrom(price, currency, 'en')}`);
  }
  return parts.join(' · ');
}
