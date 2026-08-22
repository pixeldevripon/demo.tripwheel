/**
 * The traveller-facing payment brand marks - the 8 badges the public site's
 * footer shows (Visa, Mastercard, PayPal, iDEAL, Apple Pay, Google Pay,
 * Klarna, American Express). This is the vocabulary of the dashboard's
 * "Payment methods" board; PSPs speak their own dialects (Stripe `card`,
 * Mollie `creditcard`) and `PaymentConnectionService` owns the translation.
 *
 * The dashboard mirrors this list in `lib/settings/payment-method-guides.ts`
 * (icon + label + per-provider setup guide per brand). Change one, change
 * the other.
 */
export const PAYMENT_METHOD_BRANDS = [
  'visa',
  'mastercard',
  'amex',
  'paypal',
  'ideal',
  'applepay',
  'googlepay',
  'klarna',
] as const;

export type PaymentMethodBrand = (typeof PAYMENT_METHOD_BRANDS)[number];

/**
 * Per-brand activation state on a connected PSP account.
 * - `active`      activated on the account; intents/hosted checkout can use it
 * - `inactive`    the PSP offers it but the account has not activated it
 * - `unsupported` the PSP does not offer this method at all (e.g. Google Pay
 *                 on Mollie) - "activate it" would be a lie, so it gets its
 *                 own state instead of masquerading as inactive
 */
export const PAYMENT_METHOD_STATES = [
  'active',
  'inactive',
  'unsupported',
] as const;

export type PaymentMethodState = (typeof PAYMENT_METHOD_STATES)[number];

/**
 * The ONLY method keys the per-provider `paymentMethods[]` switch may store.
 * Validated with @IsIn on the settings DTOs: the vocabularies differ per PSP
 * and a typo'd key would not fail loudly - Stripe's offer-intersection would
 * silently resolve to ZERO methods site-wide, and Mollie would 500 every
 * hosted checkout when the junk value reaches `payments.create({ method })`.
 * A 400 at save time is the honest failure.
 *
 * Mollie keeps its legacy Klarna flavours + the hosted-page-only methods
 * (bancontact/banktransfer) valid so a pre-switch stored list never starts
 * failing PATCHes; the dashboard's switches only ever write from its own
 * TOGGLEABLE_METHOD_KEYS mirror.
 */
export const STRIPE_CHECKOUT_METHOD_KEYS = [
  'card',
  'ideal',
  'paypal',
  'klarna',
  // Wallets. Not intent payment_method_types - they ride the card rails and
  // surface as the Express Checkout Element's wallet buttons. The switch
  // gates the intent response's `walletMethods`, which tells the checkout
  // which wallet buttons it may render; the device/browser and Stripe's own
  // domain checks decide the rest.
  'applepay',
  'googlepay',
] as const;

export const MOLLIE_CHECKOUT_METHOD_KEYS = [
  'creditcard',
  'ideal',
  'paypal',
  'klarna',
  'klarnapaylater',
  'klarnapaynow',
  'klarnasliceit',
  'applepay',
  'bancontact',
  'banktransfer',
] as const;
