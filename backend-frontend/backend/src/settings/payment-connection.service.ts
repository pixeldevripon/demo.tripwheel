import { Injectable, Logger } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { StripeService } from '@/payments/stripe.service';
import { MollieService } from '@/payments/mollie.service';
import { SettingsService } from './settings.service';
import {
  PAYMENT_METHOD_BRANDS,
  type PaymentMethodBrand,
  type PaymentMethodState,
} from './payment-method-brands';

/** One provider's column of the dashboard board. */
export interface ProviderConnectionStatus {
  configured: boolean;
  missing: string[];
  ok: boolean;
  mode: 'live' | 'test' | null;
  accountLabel: string | null;
  error: string | null;
  methods: {
    key: PaymentMethodBrand;
    status: PaymentMethodState;
    /**
     * "This still needs something" - set when a method looks fine by status
     * alone but will not actually work (Apple Pay activated with no validated
     * payment-method domain) or is stuck waiting (a capability Stripe is
     * still reviewing). Null = nothing owed.
     */
    attention: string | null;
  }[];
}

/**
 * Brand → the Stripe account capability whose 'pending' state means "Stripe
 * is still reviewing" (as opposed to plainly inactive). Wallets have no
 * capability of their own - they ride card_payments.
 */
const STRIPE_CAPABILITY: Partial<Record<PaymentMethodBrand, string>> = {
  visa: 'card_payments',
  mastercard: 'card_payments',
  amex: 'card_payments',
  paypal: 'paypal_payments',
  ideal: 'ideal_payments',
  klarna: 'klarna_payments',
};

/**
 * Brand → the Stripe payment-method-configuration flag that carries it.
 * Card brands are not separate Stripe payment methods: activating `card`
 * activates Visa, Mastercard AND American Express together.
 */
const STRIPE_SOURCE: Record<
  PaymentMethodBrand,
  'card' | 'paypal' | 'ideal' | 'apple_pay' | 'google_pay' | 'klarna'
> = {
  visa: 'card',
  mastercard: 'card',
  amex: 'card',
  paypal: 'paypal',
  ideal: 'ideal',
  applepay: 'apple_pay',
  googlepay: 'google_pay',
  klarna: 'klarna',
};

/**
 * Brand → Mollie method id(s); any one enabled counts. `null` = Mollie does
 * not offer the method at all (state `unsupported`, never `inactive`). The
 * Klarna aliases cover both the unified method and the legacy per-flavour
 * ids older profiles still report.
 */
const MOLLIE_SOURCE: Record<PaymentMethodBrand, string[] | null> = {
  visa: ['creditcard'],
  mastercard: ['creditcard'],
  amex: ['creditcard'],
  paypal: ['paypal'],
  ideal: ['ideal'],
  applepay: ['applepay'],
  googlepay: null,
  klarna: ['klarna', 'klarnapaylater', 'klarnapaynow', 'klarnasliceit'],
};

/**
 * The live half of Settings → Integrations → Payments: a "test connection"
 * probe against the STORED credentials (secrets never travel in a request -
 * they are masked on every read, so testing anything else is impossible)
 * plus the per-brand activation board for the dashboard.
 *
 * A provider is only probed when `missingProviderCredentials` says its
 * credential set is COMPLETE - that list is the platform's one activation
 * contract, and reporting "connection OK" for a Stripe that still lacks its
 * webhook secret would certify a provider the checkout cannot actually use.
 *
 * A failed probe is a REPORT, not an exception: the response carries
 * `ok: false` + a sanitized reason so one provider's bad key never 502s the
 * other provider's column.
 */
@Injectable()
export class PaymentConnectionService {
  private readonly logger = new Logger(PaymentConnectionService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly stripe: StripeService,
    private readonly mollie: MollieService,
  ) {}

  async getStatus(provider?: PaymentProvider): Promise<{
    activeProvider: PaymentProvider;
    checkedAt: string;
    stripe: ProviderConnectionStatus | null;
    mollie: ProviderConnectionStatus | null;
  }> {
    const wantStripe = !provider || provider === PaymentProvider.STRIPE;
    const wantMollie = !provider || provider === PaymentProvider.MOLLIE;
    const [{ activeProvider }, stripe, mollie] = await Promise.all([
      this.settings.getPaymentProviderSettings(),
      wantStripe ? this.stripeStatus() : Promise.resolve(null),
      wantMollie ? this.mollieStatus() : Promise.resolve(null),
    ]);
    return {
      activeProvider,
      checkedAt: new Date().toISOString(),
      stripe,
      mollie,
    };
  }

  private async stripeStatus(): Promise<ProviderConnectionStatus> {
    const missing = await this.settings.missingProviderCredentials(
      PaymentProvider.STRIPE,
    );
    if (missing.length) return unconfigured(missing);
    try {
      const snap = await withTimeout(
        this.stripe.connectionSnapshot(),
        PROBE_TIMEOUT_MS,
        'Stripe probe timed out',
      );
      return {
        configured: true,
        missing: [],
        ok: true,
        mode: snap.mode,
        accountLabel: snap.accountLabel,
        error: null,
        methods: PAYMENT_METHOD_BRANDS.map((key) => {
          const active = snap.methodFlags[STRIPE_SOURCE[key]];
          // "Active" alone can still owe the admin something - say so
          // instead of letting the green badge read as "done".
          let attention: string | null = null;
          if (key === 'applepay' && active && !snap.applePayDomainReady) {
            attention =
              'Activated, but no site domain is registered with Stripe - the Apple Pay button cannot appear until one is added (Stripe -> Settings -> Payment method domains).';
          } else if (!active) {
            const capability = STRIPE_CAPABILITY[key];
            if (capability && snap.capabilities[capability] === 'pending') {
              attention =
                'Stripe is still reviewing this activation - nothing to do unless Stripe emails for more information.';
            }
          }
          return { key, status: active ? 'active' : 'inactive', attention };
        }),
      };
    } catch (error) {
      return this.probeFailed('Stripe', error);
    }
  }

  private async mollieStatus(): Promise<ProviderConnectionStatus> {
    const missing = await this.settings.missingProviderCredentials(
      PaymentProvider.MOLLIE,
    );
    if (missing.length) return unconfigured(missing);
    try {
      const snap = await withTimeout(
        this.mollie.connectionSnapshot(),
        PROBE_TIMEOUT_MS,
        'Mollie probe timed out',
      );
      const enabled = new Set(snap.enabledMethodIds);
      return {
        configured: true,
        missing: [],
        ok: true,
        mode: snap.mode,
        accountLabel: snap.accountLabel,
        error: null,
        methods: PAYMENT_METHOD_BRANDS.map((key) => {
          const ids = MOLLIE_SOURCE[key];
          return {
            key,
            status:
              ids === null
                ? ('unsupported' as const)
                : ids.some((id) => enabled.has(id))
                  ? ('active' as const)
                  : ('inactive' as const),
            // Mollie exposes no domain/review detail over the API - a method
            // it returns from /v2/methods is genuinely chargeable.
            attention: null,
          };
        }),
      };
    } catch (error) {
      return this.probeFailed('Mollie', error);
    }
  }

  private probeFailed(label: string, error: unknown): ProviderConnectionStatus {
    const message = sanitizeProbeError(error);
    this.logger.warn(`${label} connection probe failed: ${message}`);
    return {
      configured: true,
      missing: [],
      ok: false,
      mode: null,
      accountLabel: null,
      error: message,
      methods: [],
    };
  }
}

/**
 * Hard cap on a single PSP probe. Stripe's SDK defaults to an 80s request
 * timeout and Mollie's node client has NONE at all (its fetch is unbounded) -
 * either way an admin clicking "Test connection" must get an answer, not a
 * request that hangs until some upstream proxy gives up. The race does not
 * cancel the underlying call; it just turns a stall into a reported failure.
 */
const PROBE_TIMEOUT_MS = 12_000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
      // Never keep the process alive just to fire a rejection.
      timer.unref?.();
    }),
  ]).finally(() => clearTimeout(timer));
}

function unconfigured(missing: string[]): ProviderConnectionStatus {
  return {
    configured: false,
    missing,
    ok: false,
    mode: null,
    accountLabel: null,
    error: null,
    methods: [],
  };
}

/**
 * PSP error → one admin-readable line. Secret-shaped tokens are redacted
 * even though Stripe masks its own key echoes - this string lands verbatim
 * in the dashboard and the log, and belt-and-braces beats trusting every
 * PSP's error formatter forever.
 */
export function sanitizeProbeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // Stripe-style prefixes are redacted ANYWHERE, boundary or not: a token
  // glued onto a preceding word (`keysk_live_x`) slips every \b/lookbehind
  // guard, and mangling the rare `task_...`-shaped word is a cosmetic cost
  // where a leaked key is a real one. `live|test` keeps its boundary - those
  // are ordinary English words and Mollie never echoes keys in errors.
  const flat = raw
    .replace(/(?:sk|rk|whsec)_\S+/g, '••••')
    .replace(/\b(?:live|test)_[A-Za-z0-9]{8,}\b/g, '••••')
    .replace(/\s+/g, ' ')
    .trim();
  return (flat || 'Connection failed').slice(0, 300);
}
