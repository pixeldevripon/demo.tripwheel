import type { MultiSelectOption } from '@/components/ui/multi-select';

/**
 * Stripe payment methods offerable at checkout. Restricted to the set the checkout
 * actually supports today (BOOKING-FLOW: card is collected inline via Card Elements;
 * PayPal + iDEAL confirm client-side and redirect). Others (Bancontact, SOFORT,
 * SEPA, Klarna, Link) are intentionally not selectable until the checkout handles
 * them - selecting an unsupported method previously broke intent creation
 * (e.g. Klarna is USD-only and rejected EUR bookings). Re-add here as each is wired.
 *
 * Note: the up-front PaymentIntent uses Stripe `automatic_payment_methods`, so the
 * real eligibility (account-activated + currency-compatible) is enforced server-side
 * and surfaced to the checkout; this list governs what admins may enable.
 */
export const STRIPE_PAYMENT_METHODS: MultiSelectOption[] = [
  { value: 'card', label: 'Card' },
  { value: 'ideal', label: 'iDEAL' },
  { value: 'paypal', label: 'PayPal' },
];

/** Common Mollie payment methods. */
export const MOLLIE_PAYMENT_METHODS: MultiSelectOption[] = [
  { value: 'creditcard', label: 'Credit Card' },
  { value: 'ideal', label: 'iDEAL' },
  { value: 'bancontact', label: 'Bancontact' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'banktransfer', label: 'Bank Transfer' },
  { value: 'applepay', label: 'Apple Pay' },
  { value: 'klarna', label: 'Klarna' },
];
