import { BookingStatus } from '@prisma/client';

/**
 * The statuses that count as a real, money-bearing trip for a customer.
 *
 * Both the customer's live spend summary (`BookingsService.getCustomerSummary`)
 * and the `customers` aggregate snapshot
 * (`CustomerProvisioningService.recomputeAggregates`) answer the same question
 * - "which of this traveller's bookings actually happened?" - so they share one
 * definition and cannot drift into disagreeing about a customer's history.
 *
 * REDEEMED is included: a redeemed booking is a completed trip, not a
 * cancelled one. CANCELLED/EXPIRED/ON_HOLD are excluded.
 */
export const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.REDEEMED,
] as const;
