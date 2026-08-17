import type { PaymentMethodBrand, PaymentProvider } from '@/types/settings';

/**
 * The 8 traveller-facing payment brands the Payments board reports on - the
 * same set (and the same SVG marks) the public site's footer shows. Mirrors
 * the backend's `src/settings/payment-method-brands.ts`; change one, change
 * the other.
 *
 * `guide` holds the per-provider activation steps shown for a method the
 * account has NOT activated. `null` = the provider does not offer the method
 * at all, so no steps could be honest ("activate it" would be a lie).
 *
 * Activation happens at the PSP - none of these steps touch this dashboard.
 * The board's footnote owns the other half of the truth: what the traveller
 * checkout actually renders today.
 */
export interface PaymentBrandMeta {
  key: PaymentMethodBrand;
  label: string;
  /** Brand mark under public/icons/payments (footer badge set). */
  icon: string;
  guide: Record<PaymentProvider, string[] | null>;
}

/**
 * The rows of each provider card's methods list - METHOD-level, because that
 * is the granularity of both PSP activation and the admin's checkout switch
 * (Visa/Mastercard/Amex always ride the one card method; no PSP toggles them
 * separately).
 *
 * `methodKey` is what `paymentMethods[]` stores per provider and what the
 * backend intersects the checkout offer with; `null` = the switch cannot
 * exist there (Stripe wallets are display preferences, not intent method
 * types the offer-filter could act on; Google Pay does not exist at Mollie).
 * `checkoutNote` is the honest line for a method the traveller checkout
 * cannot render yet regardless of switches.
 */
export interface CheckoutMethodMeta {
  id: string;
  label: string;
  /** Marks shown on the row; the FIRST brand carries the activation status. */
  brands: PaymentMethodBrand[];
  methodKey: Record<PaymentProvider, string | null>;
  checkoutNote?: Partial<Record<PaymentProvider, string>>;
  /**
   * Device wallet: the traveller checkout renders it as a wallet BUTTON
   * (Express Checkout Element), not a radio row, and only on devices that can
   * pay. Wallet methods never satisfy the "at least one method stays on"
   * guard - a Firefox traveller cannot see them, so a wallet-only checkout is
   * a checkout with zero methods for part of the audience.
   */
  wallet?: boolean;
  /**
   * "How it works at checkout" - shown ALWAYS for wallet rows (an Active
   * badge alone left admins asking what, if anything, was still needed).
   * State-INDEPENDENT steps only; the "you're done here" reassurance lives
   * in `walletActiveNote`, or an inactive row would print "already
   * activated - nothing to buy" straight after its own activation steps.
   */
  walletGuide?: Partial<Record<PaymentProvider, string[]>>;
  /** Prepended to the wallet guide ONLY while the method is Active. */
  walletActiveNote?: Partial<Record<PaymentProvider, string>>;
}

export const CHECKOUT_METHODS: CheckoutMethodMeta[] = [
  {
    id: 'card',
    label: 'Card',
    brands: ['visa', 'mastercard', 'amex'],
    methodKey: { STRIPE: 'card', MOLLIE: 'creditcard' },
  },
  {
    id: 'ideal',
    label: 'iDEAL',
    brands: ['ideal'],
    methodKey: { STRIPE: 'ideal', MOLLIE: 'ideal' },
  },
  {
    id: 'paypal',
    label: 'PayPal',
    brands: ['paypal'],
    methodKey: { STRIPE: 'paypal', MOLLIE: 'paypal' },
  },
  {
    id: 'klarna',
    label: 'Klarna',
    brands: ['klarna'],
    methodKey: { STRIPE: 'klarna', MOLLIE: 'klarna' },
  },
  {
    id: 'applepay',
    label: 'Apple Pay',
    brands: ['applepay'],
    methodKey: { STRIPE: 'applepay', MOLLIE: 'applepay' },
    wallet: true,
    walletActiveNote: {
      STRIPE:
        'Configured means Apple Pay is already activated on the Stripe account - nothing to buy or request.',
    },
    walletGuide: {
      STRIPE: [
        'One-time setup: register the public site domain in Stripe -> Settings -> Payment method domains. Apple refuses the payment sheet on unregistered domains (localhost can never be registered).',
        'The button then appears at checkout automatically - only in Safari on Apple devices with a card in Apple Wallet. Other browsers never see it, by design.',
      ],
      MOLLIE: [
        "Offered on Mollie's hosted payment page, only to Safari/Apple devices with a card in Apple Wallet.",
      ],
    },
  },
  {
    id: 'googlepay',
    label: 'Google Pay',
    brands: ['googlepay'],
    methodKey: { STRIPE: 'googlepay', MOLLIE: null },
    wallet: true,
    walletActiveNote: {
      STRIPE:
        'Configured means Google Pay is already activated on the Stripe account - no further setup on the Stripe side.',
    },
    walletGuide: {
      STRIPE: [
        'The button appears at checkout automatically in Chrome (and on Android) when the browser has a card saved in Google Pay. No domain registration needed.',
        'Browsers without a Google Pay card never see the button, by design.',
      ],
    },
  },
];

/**
 * Every method key the switch may write for a provider, in row order. The
 * stored empty list means "all on" (the pre-toggle default); the first toggle
 * materializes the explicit list from this set.
 */
export const TOGGLEABLE_METHOD_KEYS: Record<PaymentProvider, string[]> = {
  STRIPE: CHECKOUT_METHODS.flatMap(m => m.methodKey.STRIPE ?? []),
  MOLLIE: CHECKOUT_METHODS.flatMap(m => m.methodKey.MOLLIE ?? []),
};

export const PAYMENT_BRANDS: PaymentBrandMeta[] = [
  {
    key: 'visa',
    label: 'Visa',
    icon: '/icons/payments/pay-1.svg',
    guide: {
      STRIPE: [
        'Visa is part of card payments, which are on by default once your Stripe account is activated.',
        'If the Card row shows Not configured, turn cards on in Stripe -> Settings -> Payment methods.',
      ],
      MOLLIE: [
        'Visa rides on the credit card method: in the Mollie Dashboard -> Settings -> Website profiles -> Payment methods, request Credit card.',
        'Mollie and its card acquirer approve the request before it goes live (usually a few business days).',
      ],
    },
  },
  {
    key: 'mastercard',
    label: 'Mastercard',
    icon: '/icons/payments/pay-2.svg',
    guide: {
      STRIPE: [
        'Mastercard is part of card payments, which are on by default once your Stripe account is activated.',
        'If the Card row shows Not configured, turn cards on in Stripe -> Settings -> Payment methods.',
      ],
      MOLLIE: [
        'Mastercard rides on the credit card method: request Credit card in the Mollie Dashboard -> Settings -> Website profiles -> Payment methods.',
        'Mollie and its card acquirer approve the request before it goes live.',
      ],
    },
  },
  {
    key: 'amex',
    label: 'American Express',
    icon: '/icons/payments/pay-8.svg',
    guide: {
      STRIPE: [
        'American Express is included in Stripe card payments by default.',
        'If the Card row shows Not configured, turn cards on in Stripe -> Settings -> Payment methods.',
      ],
      MOLLIE: [
        'American Express is part of the Mollie credit card method - request Credit card in the Mollie Dashboard.',
        'Amex acceptance can need separate acquirer approval; Mollie confirms this during the credit card request.',
      ],
    },
  },
  {
    key: 'paypal',
    label: 'PayPal',
    icon: '/icons/payments/pay-3.svg',
    guide: {
      STRIPE: [
        'In Stripe -> Settings -> Payment methods, turn on PayPal and finish connecting your PayPal business account.',
        'PayPal via Stripe is available to European (EEA/UK/CH) Stripe accounts.',
      ],
      MOLLIE: [
        'In the Mollie Dashboard -> Settings -> Website profiles -> Payment methods, enable PayPal.',
        'Link your PayPal business account when Mollie asks for it during activation.',
      ],
    },
  },
  {
    key: 'ideal',
    label: 'iDEAL',
    icon: '/icons/payments/pay-4.svg',
    guide: {
      STRIPE: [
        'In Stripe -> Settings -> Payment methods, turn on iDEAL.',
        'iDEAL settles in euro only, so it appears at checkout only for EUR bookings.',
      ],
      MOLLIE: [
        'In the Mollie Dashboard -> Settings -> Website profiles -> Payment methods, enable iDEAL.',
        'iDEAL settles in euro only, so it appears at checkout only for EUR bookings.',
      ],
    },
  },
  {
    key: 'applepay',
    label: 'Apple Pay',
    icon: '/icons/payments/pay-5.svg',
    guide: {
      STRIPE: [
        'In Stripe -> Settings -> Payment methods, enable Apple Pay under Wallets.',
        'Register the site domain in Stripe -> Settings -> Payment method domains - Apple refuses the wallet sheet on unregistered domains.',
      ],
      MOLLIE: [
        'In the Mollie Dashboard -> Settings -> Website profiles -> Payment methods, enable Apple Pay.',
      ],
    },
  },
  {
    key: 'googlepay',
    label: 'Google Pay',
    icon: '/icons/payments/pay-6.svg',
    guide: {
      STRIPE: [
        'In Stripe -> Settings -> Payment methods, enable Google Pay under Wallets.',
      ],
      MOLLIE: null,
    },
  },
  {
    key: 'klarna',
    label: 'Klarna',
    icon: '/icons/payments/pay-7.svg',
    guide: {
      STRIPE: [
        'In Stripe -> Settings -> Payment methods, turn on Klarna and complete its review.',
        'Availability and currencies depend on your Stripe account country - Stripe shows the exact terms during activation.',
      ],
      MOLLIE: [
        'In the Mollie Dashboard -> Settings -> Website profiles -> Payment methods, enable Klarna.',
        'Klarna reviews the business before going live; Mollie shows the request status in the same screen.',
      ],
    },
  },
];
