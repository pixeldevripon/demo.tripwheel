import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { decrypt } from '@/common/utils/crypto.util';

/**
 * Thin wrapper over the Stripe SDK. Credentials live (encrypted) in the
 * `stripe_configuration` row managed via Settings — never in env. The client is
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

  /** The publishable key (public — safe to return to the browser). */
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
   * call safe to retry — the same key returns the same intent.
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
  async refundIntent(intentId: string, idempotencyKey: string): Promise<Stripe.Refund> {
    const client = await this.requireClient();
    return client.refunds.create(
      { payment_intent: intentId },
      { idempotencyKey },
    );
  }

  /** Verify the Stripe-Signature header against the raw request body. */
  async constructEvent(rawBody: Buffer, signature: string): Promise<Stripe.Event> {
    const client = await this.requireClient();
    const secret = await this.webhookSecret();
    if (!secret) throw new Error('Stripe webhook secret is not configured');
    return client.webhooks.constructEvent(rawBody, signature, secret);
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async requireClient(): Promise<Stripe> {
    const client = await this.getClient();
    if (!client) throw new Error('Stripe is not configured (missing secret key)');
    return client;
  }

  /** Load + decrypt the stripe_configuration row. */
  private async config(): Promise<{ secretKey: string; webhookSecret: string; methods: string[] }> {
    const row = await this.prisma.stripeConfiguration.findUnique({
      where: { id: 'default' },
      select: { secretKey: true, webhookSecret: true, paymentMethods: true },
    });
    return {
      secretKey: row?.secretKey ? safeDecrypt(row.secretKey, this.logger) : '',
      webhookSecret: row?.webhookSecret ? safeDecrypt(row.webhookSecret, this.logger) : '',
      methods: row?.paymentMethods ?? [],
    };
  }
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
    logger.error('Failed to decrypt a Stripe credential — check ENCRYPTION_KEY');
    return '';
  }
}
