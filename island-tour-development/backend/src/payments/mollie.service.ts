import { Injectable, Logger } from '@nestjs/common';
import createMollieClient, {
  Locale as MollieLocale,
  PaymentEmbed,
  type MollieClient,
  type Payment as MolliePayment,
  type PaymentMethod,
  type Refund as MollieRefund,
} from '@mollie/api-client';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { decrypt } from '@/common/utils/crypto.util';

/**
 * Thin wrapper over the Mollie SDK - the Mollie sibling of `StripeService`.
 * Credentials live (encrypted) in the `mollie_configuration` row managed via
 * Settings - never in env. The client is lazily built from the decrypted API
 * key and re-built if the key rotates.
 *
 * Mollie is REDIRECT-based: `createPayment` returns a hosted-checkout URL the
 * traveller is sent to, and money crosses the boundary as a **decimal string**
 * (`"41.99"`, `toMollieAmount`) - not minor units like Stripe. Status truth is
 * always a re-fetch (`getPayment`): the webhook delivers only a payment id and
 * carries no signature, so fetching with our API key IS the verification.
 */
@Injectable()
export class MollieService {
  private readonly logger = new Logger(MollieService.name);
  private client: MollieClient | null = null;
  private cachedApiKey: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** True when a usable API key is configured (Mollie has no webhook secret). */
  async isConfigured(): Promise<boolean> {
    const cfg = await this.config();
    return Boolean(cfg.apiKey);
  }

  /** Configured payment-method ids (empty → Mollie shows every eligible method). */
  async paymentMethods(): Promise<string[]> {
    const cfg = await this.config();
    return cfg.methods;
  }

  /**
   * Browser-side Components config: the profile id (pfl_..., PUBLIC - the
   * mollie.js equivalent of a publishable key) and whether the account runs in
   * test mode (derived from the API key prefix; mollie.js needs the flag to
   * tokenize against the test profile). Null profileId = inline card form not
   * configured; the checkout uses the hosted page.
   */
  async componentsProfile(): Promise<{
    profileId: string | null;
    testmode: boolean;
  }> {
    const [row, cfg] = await Promise.all([
      this.prisma.mollieConfiguration.findUnique({
        where: { id: 'default' },
        select: { profileId: true },
      }),
      this.config(),
    ]);
    return {
      profileId: row?.profileId || null,
      testmode: cfg.apiKey.startsWith('test_'),
    };
  }

  /**
   * Create a hosted-checkout payment. `idempotencyKey` makes the call safe to
   * retry (same key → same payment). `webhookUrl` is optional: on localhost
   * Mollie could never reach us anyway, so dev relies on the settle-on-return
   * path, exactly like Stripe's dev story.
   */
  async createPayment(params: {
    amount: Prisma.Decimal;
    currency: Currency;
    description: string;
    redirectUrl: string;
    cancelUrl?: string;
    webhookUrl?: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
    locale?: string | null;
    /**
     * Mollie Components card token (from mollie.js in the browser). Forces
     * `method: creditcard` - the traveller typed their card on OUR page, so the
     * hosted method-selection screen is skipped; the returned checkout URL is
     * then only the 3DS authentication hop.
     */
    cardToken?: string;
  }): Promise<MolliePayment> {
    const client = await this.requireClient();
    const methods = await this.paymentMethods();
    return client.payments.create({
      amount: {
        currency: params.currency,
        value: toMollieAmount(params.amount),
      },
      description: params.description,
      redirectUrl: params.redirectUrl,
      ...(params.cancelUrl ? { cancelUrl: params.cancelUrl } : {}),
      ...(params.webhookUrl ? { webhookUrl: params.webhookUrl } : {}),
      ...(params.cardToken
        ? // Inline card: the token IS the method choice.
          ({ method: 'creditcard', cardToken: params.cardToken } as object)
        : // Hosted page: an ARRAY keeps Mollie's method-selection screen but
          // restricts it to the admin-enabled set; empty config → Mollie
          // offers everything eligible.
          methods.length
          ? { method: methods as PaymentMethod[] }
          : {}),
      ...(toMollieLocale(params.locale)
        ? { locale: toMollieLocale(params.locale) }
        : {}),
      metadata: params.metadata,
      idempotencyKey: params.idempotencyKey,
    });
  }

  /**
   * A payment by id with its refunds embedded. This is BOTH the webhook
   * verification (an id fetched with our key cannot be forged) and the refund
   * reconciliation source (Mollie re-posts the same payment id on every status
   * change, including refund settlement).
   */
  async getPayment(paymentId: string): Promise<MolliePayment> {
    const client = await this.requireClient();
    return client.payments.get(paymentId, {
      embed: [PaymentEmbed.refunds],
    });
  }

  /** Refund a payment (full or partial - `amount` decides). */
  async createRefund(params: {
    paymentId: string;
    amount: Prisma.Decimal;
    currency: Currency;
    description?: string;
    idempotencyKey: string;
  }): Promise<MollieRefund> {
    const client = await this.requireClient();
    return client.paymentRefunds.create({
      paymentId: params.paymentId,
      amount: {
        currency: params.currency,
        value: toMollieAmount(params.amount),
      },
      ...(params.description ? { description: params.description } : {}),
      idempotencyKey: params.idempotencyKey,
    });
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** A Mollie client bound to the current API key, or null if unconfigured. */
  private async getClient(): Promise<MollieClient | null> {
    const cfg = await this.config();
    if (!cfg.apiKey) return null;
    if (!this.client || this.cachedApiKey !== cfg.apiKey) {
      this.client = createMollieClient({ apiKey: cfg.apiKey });
      this.cachedApiKey = cfg.apiKey;
    }
    return this.client;
  }

  private async requireClient(): Promise<MollieClient> {
    const client = await this.getClient();
    if (!client) throw new Error('Mollie is not configured (missing API key)');
    return client;
  }

  /** Load + decrypt the mollie_configuration row. */
  private async config(): Promise<{ apiKey: string; methods: string[] }> {
    const row = await this.prisma.mollieConfiguration.findUnique({
      where: { id: 'default' },
      select: { apiKey: true, paymentMethods: true },
    });
    return {
      apiKey: row?.apiKey ? safeDecrypt(row.apiKey, this.logger) : '',
      methods: row?.paymentMethods ?? [],
    };
  }
}

/** Decimal(10,2) → Mollie amount string ("41.99"). Exact 2 decimals required. */
export function toMollieAmount(amount: Prisma.Decimal): string {
  return amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Platform locale → Mollie checkout locale. Unmapped locales (zh) return
 * undefined and Mollie falls back to browser detection.
 */
export function toMollieLocale(
  locale?: string | null,
): MollieLocale | undefined {
  switch (locale) {
    case 'en':
      return MollieLocale.en_US;
    case 'nl':
      return MollieLocale.nl_NL;
    case 'de':
      return MollieLocale.de_DE;
    case 'fr':
      return MollieLocale.fr_FR;
    case 'es':
      return MollieLocale.es_ES;
    case 'pt':
      return MollieLocale.pt_PT;
    default:
      return undefined;
  }
}

function safeDecrypt(value: string, logger: Logger): string {
  try {
    return decrypt(value);
  } catch {
    logger.error(
      'Failed to decrypt a Mollie credential - check ENCRYPTION_KEY',
    );
    return '';
  }
}
