import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProvider } from '@prisma/client';
import { StripeService } from '@/payments/stripe.service';
import { MollieService } from '@/payments/mollie.service';
import { SettingsService } from './settings.service';
import {
  PaymentConnectionService,
  sanitizeProbeError,
} from './payment-connection.service';

/**
 * The board's one hard job is telling the truth per provider: probe only
 * fully-credentialed providers, translate PSP vocabulary into the 8 brand
 * marks without inventing availability (Google Pay does not exist at
 * Mollie), and never let one provider's bad key blank the other's column.
 */
describe('PaymentConnectionService', () => {
  let service: PaymentConnectionService;

  const settings = {
    getPaymentProviderSettings: jest.fn(),
    missingProviderCredentials: jest.fn(),
  };
  const stripe = { connectionSnapshot: jest.fn() };
  const mollie = { connectionSnapshot: jest.fn() };

  const stripeSnapshot = (
    flags: Partial<Record<string, boolean>> = {},
    over: Record<string, unknown> = {},
  ) => ({
    mode: 'test' as const,
    accountLabel: 'Island Tours BV',
    methodFlags: {
      card: true,
      paypal: true,
      ideal: true,
      apple_pay: false,
      google_pay: false,
      klarna: false,
      ...flags,
    },
    applePayDomainReady: true,
    capabilities: {},
    ...over,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    settings.getPaymentProviderSettings.mockResolvedValue({
      id: 'default',
      activeProvider: PaymentProvider.STRIPE,
      updatedAt: new Date(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentConnectionService,
        { provide: SettingsService, useValue: settings },
        { provide: StripeService, useValue: stripe },
        { provide: MollieService, useValue: mollie },
      ],
    }).compile();

    service = module.get(PaymentConnectionService);
  });

  it('never probes a provider whose credential set is incomplete', async () => {
    settings.missingProviderCredentials.mockImplementation(
      async (provider: PaymentProvider) =>
        provider === PaymentProvider.STRIPE ? ['webhook secret'] : ['API key'],
    );

    const result = await service.getStatus();

    expect(stripe.connectionSnapshot).not.toHaveBeenCalled();
    expect(mollie.connectionSnapshot).not.toHaveBeenCalled();
    expect(result.stripe).toEqual(
      expect.objectContaining({
        configured: false,
        missing: ['webhook secret'],
        ok: false,
        error: null,
        methods: [],
      }),
    );
    expect(result.mollie).toEqual(
      expect.objectContaining({ configured: false, missing: ['API key'] }),
    );
  });

  it('maps Stripe card activation onto all three card brands at once', async () => {
    settings.missingProviderCredentials.mockResolvedValue([]);
    stripe.connectionSnapshot.mockResolvedValue(stripeSnapshot());
    mollie.connectionSnapshot.mockResolvedValue({
      mode: 'test',
      accountLabel: null,
      enabledMethodIds: [],
    });

    const result = await service.getStatus(PaymentProvider.STRIPE);

    const byKey = Object.fromEntries(
      result.stripe!.methods.map((m) => [m.key, m.status]),
    );
    expect(byKey).toEqual({
      visa: 'active',
      mastercard: 'active',
      amex: 'active',
      paypal: 'active',
      ideal: 'active',
      applepay: 'inactive',
      googlepay: 'inactive',
      klarna: 'inactive',
    });
    expect(result.stripe).toEqual(
      expect.objectContaining({
        ok: true,
        mode: 'test',
        accountLabel: 'Island Tours BV',
        error: null,
      }),
    );
    // The provider filter must not probe the other PSP.
    expect(result.mollie).toBeNull();
    expect(mollie.connectionSnapshot).not.toHaveBeenCalled();
  });

  it('flags an ACTIVE Apple Pay whose domain is not registered - the green badge alone would lie', async () => {
    settings.missingProviderCredentials.mockResolvedValue([]);
    stripe.connectionSnapshot.mockResolvedValue(
      stripeSnapshot({ apple_pay: true }, { applePayDomainReady: false }),
    );

    const result = await service.getStatus(PaymentProvider.STRIPE);
    const applepay = result.stripe!.methods.find((m) => m.key === 'applepay')!;
    const googlepay = result.stripe!.methods.find(
      (m) => m.key === 'googlepay',
    )!;

    expect(applepay.status).toBe('active');
    expect(applepay.attention).toContain('Payment method domains');
    // Google Pay needs no domain - never flagged for this.
    expect(googlepay.attention).toBeNull();
  });

  it('says "Stripe is still reviewing" when an inactive method has a PENDING capability', async () => {
    settings.missingProviderCredentials.mockResolvedValue([]);
    stripe.connectionSnapshot.mockResolvedValue(
      stripeSnapshot(
        { klarna: false },
        { capabilities: { klarna_payments: 'pending' } },
      ),
    );

    const result = await service.getStatus(PaymentProvider.STRIPE);
    const klarna = result.stripe!.methods.find((m) => m.key === 'klarna')!;
    const paypal = result.stripe!.methods.find((m) => m.key === 'paypal')!;

    expect(klarna.status).toBe('inactive');
    expect(klarna.attention).toContain('still reviewing');
    // An ACTIVE method never carries the pending note.
    expect(paypal.attention).toBeNull();
  });

  it('reports Google Pay as unsupported at Mollie and honours legacy Klarna ids', async () => {
    settings.missingProviderCredentials.mockResolvedValue([]);
    mollie.connectionSnapshot.mockResolvedValue({
      mode: 'live',
      accountLabel: 'pfl_3RkSN1zuPE',
      enabledMethodIds: ['creditcard', 'ideal', 'klarnapaylater'],
    });

    const result = await service.getStatus(PaymentProvider.MOLLIE);

    const byKey = Object.fromEntries(
      result.mollie!.methods.map((m) => [m.key, m.status]),
    );
    expect(byKey).toEqual({
      visa: 'active',
      mastercard: 'active',
      amex: 'active',
      paypal: 'inactive',
      ideal: 'active',
      applepay: 'inactive',
      googlepay: 'unsupported',
      klarna: 'active',
    });
    expect(result.mollie!.mode).toBe('live');
    expect(result.stripe).toBeNull();
  });

  it('a failed probe reports ok:false with a reason instead of throwing, and the other provider still answers', async () => {
    settings.missingProviderCredentials.mockResolvedValue([]);
    stripe.connectionSnapshot.mockRejectedValue(
      new Error('Invalid API Key provided: sk_test_4eC39Hq'),
    );
    mollie.connectionSnapshot.mockResolvedValue({
      mode: 'test',
      accountLabel: null,
      enabledMethodIds: ['creditcard'],
    });

    const result = await service.getStatus();

    expect(result.stripe).toEqual(
      expect.objectContaining({ configured: true, ok: false, methods: [] }),
    );
    // The secret-shaped token is redacted even though Stripe pre-masks.
    expect(result.stripe!.error).toBe('Invalid API Key provided: ••••');
    expect(result.mollie!.ok).toBe(true);
  });

  it('cuts off a hung PSP probe instead of hanging the admin request (Mollie has NO SDK timeout)', async () => {
    jest.useFakeTimers();
    try {
      settings.missingProviderCredentials.mockResolvedValue([]);
      mollie.connectionSnapshot.mockReturnValue(new Promise(() => {}));

      const pending = service.getStatus(PaymentProvider.MOLLIE);
      await jest.advanceTimersByTimeAsync(12_000);
      const result = await pending;

      expect(result.mollie).toEqual(
        expect.objectContaining({
          configured: true,
          ok: false,
          error: 'Mollie probe timed out',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('carries the active provider so the board can mark whose methods charge at checkout', async () => {
    settings.getPaymentProviderSettings.mockResolvedValue({
      id: 'default',
      activeProvider: PaymentProvider.MOLLIE,
      updatedAt: new Date(),
    });
    settings.missingProviderCredentials.mockResolvedValue(['API key']);

    const result = await service.getStatus(PaymentProvider.MOLLIE);

    expect(result.activeProvider).toBe(PaymentProvider.MOLLIE);
    expect(typeof result.checkedAt).toBe('string');
  });
});

describe('sanitizeProbeError', () => {
  it('redacts Mollie-style live/test keys and collapses whitespace', () => {
    expect(
      sanitizeProbeError(
        new Error('Bad key\n  live_dHar4XY7LxsDOtmnkVtjNVWX rejected'),
      ),
    ).toBe('Bad key •••• rejected');
  });

  it('never returns an empty string and caps runaway messages', () => {
    expect(sanitizeProbeError(new Error('   '))).toBe('Connection failed');
    expect(sanitizeProbeError(new Error('x'.repeat(500))).length).toBe(300);
  });

  it('survives non-Error throws', () => {
    expect(sanitizeProbeError('plain failure')).toBe('plain failure');
  });

  it('redacts a token even when glued onto a preceding word (no \\b before it)', () => {
    expect(sanitizeProbeError(new Error('keysk_live_abcdef rejected'))).toBe(
      'keysk_live_abcdef rejected'.replace('sk_live_abcdef', '••••'),
    );
  });
});
