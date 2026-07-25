import { PaymentStatus } from '@prisma/client';

/**
 * Map a Stripe refund status onto the REFUND `Payment` row.
 *
 * Card refunds come back `succeeded` immediately, but bank-debit methods
 * (iDEAL, SEPA, ACH) start `pending` and only settle - or fail - hours to days
 * later via `refund.updated` / `refund.failed`. The row must carry Stripe's
 * actual answer, never an assumed success: a booking whose refund is still in
 * flight reads "Refund pending", and a failed refund flips it back to owed.
 *
 * `requires_action` (rare; some APMs ask the customer for details) is still
 * money-not-moved, so it maps to PROCESSING. A null/absent status (older API
 * shapes) means the create call was accepted synchronously -> SUCCEEDED.
 */
export function mapStripeRefundStatus(
  status: string | null | undefined,
): PaymentStatus {
  switch (status) {
    case 'failed':
    case 'canceled':
      return PaymentStatus.FAILED;
    case 'pending':
    case 'requires_action':
      return PaymentStatus.PROCESSING;
    default:
      return PaymentStatus.SUCCEEDED;
  }
}

/**
 * Map a Mollie refund status onto the REFUND `Payment` row - same contract as
 * the Stripe mapper. Mollie refunds are ALWAYS asynchronous: they start
 * `queued`/`pending` and settle to `refunded` (or fail) later, reconciled by
 * the payment webhook re-fetch (Mollie re-posts the payment id when a refund
 * settles). Only `refunded` is money-moved.
 */
export function mapMollieRefundStatus(
  status: string | null | undefined,
): PaymentStatus {
  switch (status) {
    case 'refunded':
      return PaymentStatus.SUCCEEDED;
    case 'failed':
    case 'canceled':
      return PaymentStatus.FAILED;
    default:
      // queued / pending / processing - accepted but money not yet moved.
      return PaymentStatus.PROCESSING;
  }
}
