import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { decrypt } from '@/common/utils/crypto.util';

/**
 * Thin wrapper over the Stripe SDK. Credentials live (encrypted) in the
 * `stripe_configuration` row managed via Settings - never in env. The client is
 * lazily built from the decrypted secret key and re-built if the key rotates.
 *
 * All money crosses the Stripe boundary in **integer minor units** (cents). The
 * platform stores Decimal(10,2); convert with `toMinorUnits`.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;
  private cachedSecretKey: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** True when a usable secret + webhook secret are configured. */
  async isConfigured(): Promise<boolean> {
    const cfg = await this.config();
    return Boolean(cfg.secretKey && cfg.webhookSecret);
  }

  /** The decrypted webhook signing secret (for signature verification). */
  async webhookSecret(): Promise<string | null> {
    const cfg = await this.config();
    return cfg.webhookSecret || null;
  }

  /** The publishable key (public - safe to return to the browser). */
  async publishableKey(): Promise<string | null> {
    const row = await this.prisma.stripeConfiguration.findUnique({
      where: { id: 'default' },
      select: { publishableKey: true },
    });
    return row?.publishableKey || null;
  }

  /** Configured payment-method types (empty → Stripe automatic methods). */
  async paymentMethods(): Promise<string[]> {
    const cfg = await this.config();
    return cfg.methods;
  }

  /** A Stripe client bound to the current secret key, or null if unconfigured. */
  private async getClient(): Promise<Stripe | null> {
    const cfg = await this.config();
    if (!cfg.secretKey) return null;
    if (!this.client || this.cachedSecretKey !== cfg.secretKey) {
      this.client = new Stripe(cfg.secretKey, { typescript: true });
      this.cachedSecretKey = cfg.secretKey;
    }
    return this.client;
  }

  /**
   * Create a PaymentIntent for `amount` (minor units). `idempotencyKey` makes the
   * call safe to retry - the same key returns the same intent.
   */
  async createPaymentIntent(params: {
    amount: number;
    currency: Currency;
    idempotencyKey: string;
    metadata: Record<string, string>;
    methods?: string[];
  }): Promise<Stripe.PaymentIntent> {
    const client = await this.requireClient();
    return client.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        metadata: params.metadata,
        ...(params.methods?.length
          ? { payment_method_types: params.methods }
          : { automatic_payment_methods: { enabled: true } }),
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  /** Refund a charge/intent by its PaymentIntent id. */
  async refundIntent(
    intentId: string,
    idempotencyKey: string,
  ): Promise<Stripe.Refund> {
    const client = await this.requireClient();
    return client.refunds.create(
      { payment_intent: intentId },
      { idempotencyKey },
    );
  }

  /**
   * A charge by id. Webhook payloads never expand nested objects - a succeeded
   * `payment_intent` carries `latest_charge` as a plain string - so the card /
   * billing snapshot has to fetch the charge itself. The balance transaction is
   * expanded too: its `exchange_rate` is Stripe's ACTUAL presentment->settlement
   * conversion for this charge (task #28 / 5C charge-rate reconciliation).
   */
  async retrieveCharge(chargeId: string): Promise<Stripe.Charge> {
    const client = await this.requireClient();
    return client.charges.retrieve(chargeId, {
      expand: ['balance_transaction'],
    });
  }

  /**
   * A PaymentIntent by id, with its charge expanded. Used by the synchronous
   * "settle on return" path (the client just confirmed and we verify the real
   * status with Stripe rather than trusting the browser) - the expanded charge
   * gives the card/billing snapshot + the balance transaction's `exchange_rate`
   * (charge-rate reconciliation) in one round-trip.
   */
  async retrievePaymentIntent(intentId: string): Promise<Stripe.PaymentIntent> {
    const client = await this.requireClient();
    return client.paymentIntents.retrieve(intentId, {
      expand: ['latest_charge.balance_transaction'],
    });
  }

  /**
   * Live "test connection" probe: proves the stored secret key works and
   * reads which payment methods the account has activated, straight from
   * Stripe's default payment-method configuration (the same source
   * `automatic_payment_methods` consults when the checkout creates an
   * intent, so the settings board and the checkout can never disagree).
   *
   * Speaks Stripe vocabulary only (`card`, `apple_pay`, ...) - mapping to
   * the checkout's brand marks (Visa/Mastercard/...) is the caller's job.
   * Throws on auth/network failure; the caller owns the error shaping.
   */
  async connectionSnapshot(): Promise<StripeConnectionSnapshot> {
    const client = await this.requireClient();
    const [account, configurations, domains, cfg] = await Promise.all([
      // The account the secret key itself belongs to.
      client.accounts.retrieveCurrent(),
      client.paymentMethodConfigurations.list({ limit: 100 }),
      // Apple Pay refuses the payment sheet on unregistered domains, so an
      // account can be fully "activated" and still never show the button -
      // the one activation state an admin cannot see anywhere else.
      client.paymentMethodDomains.list({ limit: 100 }),
      this.config(),
    ]);
    const pmc =
      configurations.data.find((c) => c.is_default) ??
      configurations.data[0] ??
      null;
    // A method counts as activated only when the account CAN use it AND the
    // configuration shows it - `available` alone still hides it from intents.
    const on = (method?: {
      available: boolean;
      display_preference: { value: string };
    }) =>
      Boolean(method?.available && method.display_preference.value === 'on');
    return {
      mode: pmc
        ? pmc.livemode
          ? 'live'
          : 'test'
        : cfg.secretKey.includes('_test_')
          ? 'test'
          : 'live',
      accountLabel:
        account.business_profile?.name ||
        account.settings?.dashboard?.display_name ||
        account.email ||
        account.id,
      methodFlags: {
        card: on(pmc?.card),
        paypal: on(pmc?.paypal),
        ideal: on(pmc?.ideal),
        apple_pay: on(pmc?.apple_pay),
        google_pay: on(pmc?.google_pay),
        klarna: on(pmc?.klarna),
      },
      applePayDomainReady: domains.data.some(
        (d) => d.enabled && d.apple_pay?.status === 'active',
      ),
      // Raw capability states ('active'|'inactive'|'pending') - 'pending'
      // distinguishes "Stripe is still reviewing" from plain inactive.
      capabilities: (account.capabilities ?? {}) as Record<string, string>,
    };
  }

  /** Verify the Stripe-Signature header against the raw request body. */
  async constructEvent(
    rawBody: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const client = await this.requireClient();
    const secret = await this.webhookSecret();
    if (!secret) throw new Error('Stripe webhook secret is not configured');
    return client.webhooks.constructEvent(rawBody, signature, secret);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async requireClient(): Promise<Stripe> {
    const client = await this.getClient();
    if (!client)
      throw new Error('Stripe is not configured (missing secret key)');
    return client;
  }

  /** Load + decrypt the stripe_configuration row. */
  private async config(): Promise<{
    secretKey: string;
    webhookSecret: string;
    methods: string[];
  }> {
    const row = await this.prisma.stripeConfiguration.findUnique({
      where: { id: 'default' },
      select: { secretKey: true, webhookSecret: true, paymentMethods: true },
    });
    return {
      secretKey: row?.secretKey ? safeDecrypt(row.secretKey, this.logger) : '',
      webhookSecret: row?.webhookSecret
        ? safeDecrypt(row.webhookSecret, this.logger)
        : '',
      methods: row?.paymentMethods ?? [],
    };
  }
}

/** What `connectionSnapshot` proves about the connected Stripe account. */
export interface StripeConnectionSnapshot {
  mode: 'live' | 'test';
  accountLabel: string | null;
  /** Stripe-vocabulary activation flags off the default configuration. */
  methodFlags: Record<
    'card' | 'paypal' | 'ideal' | 'apple_pay' | 'google_pay' | 'klarna',
    boolean
  >;
  /** At least one enabled payment-method domain has Apple Pay validated. */
  applePayDomainReady: boolean;
  /** Account capability states; 'pending' = Stripe is still reviewing. */
  capabilities: Record<string, string>;
}

/** Decimal(10,2) → integer minor units (cents). Rounds HALF_UP. */
export function toMinorUnits(amount: Prisma.Decimal, precision = 2): number {
  return amount
    .mul(new Prisma.Decimal(10).pow(precision))
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .toNumber();
}

function safeDecrypt(value: string, logger: Logger): string {
  try {
    return decrypt(value);
  } catch {
    logger.error(
      'Failed to decrypt a Stripe credential - check ENCRYPTION_KEY',
    );
    return '';
  }
}
