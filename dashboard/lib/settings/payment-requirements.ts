import type {
    MollieConfiguration,
    PaymentProvider,
    StripeConfiguration,
} from '@/types/settings';

/**
 * What each PSP must have stored before it may charge travellers at checkout.
 *
 * MIRROR of the backend gate in `settings.service.ts`
 * (`missingProviderCredentials`) - that one is the authority and rejects the
 * switch with a 400; this one exists so the switch dialog can COLLECT the gaps
 * up front rather than firing a request it already knows will be refused.
 * Change one, change the other.
 *
 * Stripe needs the publishable key alongside the server-side pair: the checkout
 * mounts Stripe.js with it and refuses the payment step when the intent comes
 * back without one. Mollie's profile ID is deliberately absent - it is optional
 * (empty just means the hosted page instead of the inline card form), so it is
 * not a blocker for going live.
 */

export type ProviderCredentialField = {
    /** Key on the provider's update payload. */
    readonly name: 'publishableKey' | 'secretKey' | 'webhookSecret' | 'apiKey';
    readonly label: string;
    readonly placeholder: string;
    /** Renders as a masked field with a reveal toggle, and is never logged. */
    readonly secret: boolean;
    /** Where an admin finds this value, shown under the input. */
    readonly help: string;
};

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
    STRIPE: 'Stripe',
    MOLLIE: 'Mollie',
};

export const PROVIDER_REQUIREMENTS: Record<
    PaymentProvider,
    readonly ProviderCredentialField[]
> = {
    STRIPE: [
        {
            name: 'publishableKey',
            label: 'Publishable Key',
            placeholder: 'pk_live_...',
            secret: false,
            help: 'Stripe Dashboard, Developers, API keys. Public - it ships to the browser.',
        },
        {
            name: 'secretKey',
            label: 'Secret Key',
            placeholder: 'sk_live_...',
            secret: true,
            help: 'Stripe Dashboard, Developers, API keys. Stored encrypted.',
        },
        {
            name: 'webhookSecret',
            label: 'Webhook Secret',
            placeholder: 'whsec_...',
            secret: true,
            help: 'Stripe Dashboard, Developers, Webhooks, your endpoint. Stored encrypted.',
        },
    ],
    MOLLIE: [
        {
            name: 'apiKey',
            label: 'API Key',
            placeholder: 'live_...',
            secret: true,
            help: 'Mollie Dashboard, Developers, API keys. Use test_... for test mode. Stored encrypted.',
        },
    ],
};

/** The cached GET responses; either may still be loading. */
export type ProviderConfigs = {
    stripe?: StripeConfiguration;
    mollie?: MollieConfiguration;
};

/**
 * The subset of a provider's required fields that is still empty.
 *
 * Reads the GET responses the settings page already has cached, so this costs
 * no extra request. Secrets come back MASKED ("....1rOO") or null/empty - a
 * masked string is proof one is stored, which is all this needs to know.
 * Returns every requirement when the config has not loaded yet, so a switch is
 * never waved through on missing data.
 */
export function missingProviderFields(
    provider: PaymentProvider,
    { stripe, mollie }: ProviderConfigs,
): readonly ProviderCredentialField[] {
    const stored: Partial<Record<ProviderCredentialField['name'], unknown>> =
        provider === 'STRIPE'
            ? {
                  publishableKey: stripe?.publishableKey,
                  secretKey: stripe?.secretKey,
                  webhookSecret: stripe?.webhookSecret,
              }
            : { apiKey: mollie?.apiKey };

    return PROVIDER_REQUIREMENTS[provider].filter(field => !stored[field.name]);
}

/** True when the provider holds everything it needs to take a payment. */
export function isProviderReady(
    provider: PaymentProvider,
    configs: ProviderConfigs,
): boolean {
    return missingProviderFields(provider, configs).length === 0;
}

/**
 * Strip whitespace and zero-width characters from a pasted key.
 *
 * Copying from a provider dashboard picks these up routinely and they are never
 * part of a real value, but they survive a `.min(1)` check and then fail
 * authentication with an error that blames the key itself.
 */
export function cleanCredential(value: string): string {
    return value.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
}
