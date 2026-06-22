import type { MultiSelectOption } from '@/components/ui/multi-select';

/** Common Stripe payment method types (subset relevant to a tour marketplace). */
export const STRIPE_PAYMENT_METHODS: MultiSelectOption[] = [
  { value: 'card', label: 'Card' },
  { value: 'ideal', label: 'iDEAL' },
  { value: 'bancontact', label: 'Bancontact' },
  { value: 'sofort', label: 'SOFORT' },
  { value: 'sepa_debit', label: 'SEPA Direct Debit' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'klarna', label: 'Klarna' },
  { value: 'link', label: 'Link' },
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
