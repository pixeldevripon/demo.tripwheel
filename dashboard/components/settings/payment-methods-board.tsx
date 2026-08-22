'use client';

import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
    usePaymentConnectionStatus,
    useTestPaymentConnection,
} from '@/hooks/settings/use-payment-connection';
import {
    useMollieConfig,
    useStripeConfig,
    useUpdateMollieConfig,
    useUpdateStripeConfig,
} from '@/hooks/settings/use-settings';
import {
    CHECKOUT_METHODS,
    PAYMENT_BRANDS,
    TOGGLEABLE_METHOD_KEYS,
    type CheckoutMethodMeta,
} from '@/lib/settings/payment-method-guides';
import { PROVIDER_LABELS } from '@/lib/settings/payment-requirements';
import type {
    PaymentMethodState,
    PaymentProvider,
    PaymentProviderConnection,
} from '@/types/settings';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import { useState } from 'react';
import { toast } from 'sonner';

type TestMutation = ReturnType<typeof useTestPaymentConnection>;

function columnFor(
    provider: PaymentProvider,
    status?: {
        stripe: PaymentProviderConnection | null;
        mollie: PaymentProviderConnection | null;
    },
): PaymentProviderConnection | null {
    if (!status) return null;
    return provider === 'STRIPE' ? status.stripe : status.mollie;
}

const mutedText =
    'text-xs font-light text-muted-foreground normal-case tracking-normal';

// ── Per-provider "Test connection" strip ────────────────────────────────────
// Lives at the bottom of each provider's credentials card (same shape as the
// platform-reviews "Fetch now" strip). The strip is the durable record of the
// last probe; the toast is just the moment's echo.

export function ConnectionTestStrip({
    provider,
}: {
    provider: PaymentProvider;
}) {
    const { data, isLoading } = usePaymentConnectionStatus();
    const test = useTestPaymentConnection();
    const label = PROVIDER_LABELS[provider];
    const column = columnFor(provider, data);
    // Only THIS strip's button shows pending - the per-method row buttons
    // share the mutation but carry a brand in their variables.
    const testing =
        test.isPending &&
        test.variables?.provider === provider &&
        !test.variables?.brand;

    const badge = !column || !column.configured ? (
        <StatusBadge variant='neutral'>Not configured</StatusBadge>
    ) : column.ok ? (
        <StatusBadge
            variant='success'
            hint={`Verified against the live ${label} API`}>
            Connection OK
        </StatusBadge>
    ) : (
        <StatusBadge variant='danger'>Connection failed</StatusBadge>
    );

    if (isLoading) {
        // Same skeleton language as the method rows below - a shaped strip,
        // not a sentence, while the live probe runs.
        return (
            <div className='flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5'>
                <Skeleton className='h-5 w-24 rounded-full' />
                <Skeleton className='h-3 flex-1' />
                <Skeleton className='h-8 w-28 rounded-md' />
            </div>
        );
    }

    const sentence = !column
          ? 'Connection status unavailable.'
          : !column.configured
            ? `Save the ${column.missing.join(', ')} above first - the test runs against the stored credentials.`
            : column.ok
              ? `Connected to ${column.accountLabel ?? label}${column.mode ? ` in ${column.mode} mode` : ''}.`
              : `Last test failed: ${column.error ?? 'unknown error'}`;

    return (
        <div className='flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5'>
            {badge}
            <p className={`m-0 flex-1 ${mutedText}`}>{sentence}</p>
            <Button
                // Inside the SettingsCard <form>: a bare button would submit
                // the credentials form instead of testing it.
                type='button'
                size='sm'
                variant='outline'
                disabled={testing || !column?.configured}
                onClick={() => test.mutate({ provider })}>
                {testing ? 'Testing...' : 'Test connection'}
            </Button>
        </div>
    );
}

// ── The per-provider methods list (status + switch + test, per method) ──────

const STATE_BADGE: Record<
    PaymentMethodState,
    { variant: 'success' | 'neutral'; label: string }
> = {
    active: { variant: 'success', label: 'Configured' },
    inactive: { variant: 'neutral', label: 'Not configured' },
    unsupported: { variant: 'neutral', label: 'Not offered' },
};

/**
 * The loading shape of one method row - chip, label, badge, Test, switch -
 * so the live probe (two PSP round-trips, easily seconds) reads as "the list
 * is coming" instead of a bare sentence that looks like a dead end.
 */
function MethodRowSkeleton() {
    return (
        <div
            data-testid='method-row-skeleton'
            className='flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-2'>
            <Skeleton className='h-6 w-10 rounded' />
            <Skeleton className='h-4 w-24' />
            <span className='ml-auto flex items-center gap-2'>
                <Skeleton className='h-5 w-16 rounded-full' />
                <Skeleton className='h-6 w-10 rounded-md' />
                <Skeleton className='h-5 w-9 rounded-full' />
            </span>
        </div>
    );
}

const brandMeta = (key: string) => PAYMENT_BRANDS.find(b => b.key === key);

function MethodRow({
    method,
    status,
    attention,
    provider,
    test,
    offered,
    onToggle,
    togglePending,
}: {
    method: CheckoutMethodMeta;
    status: PaymentMethodState;
    /** "Still needs something" reason from the live probe, or null. */
    attention: string | null;
    provider: PaymentProvider;
    test: TestMutation;
    /** Switch state; null = this method has no switch on this provider. */
    offered: boolean | null;
    onToggle: (methodKey: string, on: boolean) => void;
    togglePending: boolean;
}) {
    const [open, setOpen] = useState(false);
    const label = PROVIDER_LABELS[provider];
    const methodKey = method.methodKey[provider];
    // The first brand carries the method's activation status and its guide -
    // one PSP method, one activation switch at the PSP.
    const primaryBrand = method.brands[0];
    const steps = brandMeta(primaryBrand)?.guide[provider] ?? null;
    const walletSteps = method.walletGuide?.[provider] ?? null;
    const walletActiveNote = method.walletActiveNote?.[provider] ?? null;
    const badge = STATE_BADGE[status];
    const note = method.checkoutNote?.[provider];
    // Hoisted so "does the collapsible show" and "what does it list" stay one
    // decision: wallets always guide (activation steps prepended while
    // inactive; the "you're done" note prepended only while active), plain
    // methods guide only while inactive.
    const showGuide = method.wallet
        ? status !== 'unsupported' && Boolean(walletSteps)
        : status === 'inactive' && Boolean(steps);
    const guideSteps = !method.wallet
        ? (steps ?? [])
        : status === 'inactive'
          ? [...(steps ?? []), ...(walletSteps ?? [])]
          : [
                ...(walletActiveNote ? [walletActiveNote] : []),
                ...(walletSteps ?? []),
            ];
    const testing =
        test.isPending &&
        test.variables?.provider === provider &&
        test.variables?.brand === primaryBrand;

    return (
        <div className='rounded-md border border-border/60 px-2.5 py-1.5'>
            <div className='flex flex-wrap items-center gap-2'>
                {/* White chips like real payment badges - the marks are dark
                    glyphs and must stay legible on any card background. */}
                <span className='flex shrink-0 items-center gap-1'>
                    {method.brands.map(brand => (
                        <span
                            key={brand}
                            className='flex h-6 w-10 items-center justify-center rounded border border-border/60 bg-white'>
                            <Image
                                src={brandMeta(brand)?.icon ?? ''}
                                alt=''
                                width={74}
                                height={41}
                                className='h-4 w-auto'
                            />
                        </span>
                    ))}
                </span>
                <span className='text-sm font-medium'>{method.label}</span>
                <span className='ml-auto flex items-center gap-2'>
                    {attention && (
                        <StatusBadge variant='warning' hint={attention}>
                            Action needed
                        </StatusBadge>
                    )}
                    <StatusBadge
                        variant={badge.variant}
                        hint={
                            status === 'unsupported'
                                ? `${label} does not offer ${method.label} at all`
                                : status === 'inactive'
                                  ? `Offered by ${label} but not configured on this account yet`
                                  : `Configured on the connected ${label} account`
                        }>
                        {badge.label}
                    </StatusBadge>
                    <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        disabled={test.isPending}
                        onClick={() =>
                            test.mutate({
                                provider,
                                brand: primaryBrand,
                                label: method.label,
                            })
                        }>
                        {testing ? 'Testing...' : 'Test'}
                    </Button>
                    {offered !== null && methodKey && (
                        <Switch
                            // A method the account has not activated cannot be
                            // switched on - the offer intersection would drop
                            // it anyway, and an ON switch with no effect is a
                            // lie. Locked OFF until activation (re-test after
                            // activating at the PSP unlocks it).
                            checked={status === 'active' && offered}
                            disabled={togglePending || status !== 'active'}
                            aria-label={`Offer ${method.label} at checkout via ${label}`}
                            onCheckedChange={on => onToggle(methodKey, on)}
                        />
                    )}
                </span>
            </div>

            {attention && (
                // The badge names the state; this line says exactly what is
                // owed, in place, without opening anything.
                <p className='mt-1 text-xs font-light normal-case tracking-normal text-warning-fg'>
                    {attention}
                </p>
            )}

            {status === 'unsupported' && (
                <p className={`mt-1 ${mutedText}`}>
                    {label} does not offer {method.label}.
                    {provider === 'MOLLIE' &&
                        ' It is available when Stripe takes checkout payments.'}
                </p>
            )}

            {note && status !== 'unsupported' && (
                <p className={`mt-1 ${mutedText}`}>{note}</p>
            )}

            {/* Non-wallet methods: activation steps while inactive. Wallet
                methods: a "how it works" guide ALWAYS - an Active badge alone
                left admins asking what, if anything, was still needed (domain
                registration, which browsers show the button). */}
            {showGuide && (
                <Collapsible open={open} onOpenChange={setOpen}>
                    <CollapsibleTrigger className='mt-0.5 flex w-full items-center justify-between gap-3 rounded-md py-1 text-left text-xs font-medium normal-case tracking-normal transition-colors hover:text-foreground/70'>
                        {method.wallet
                            ? 'How it works at checkout'
                            : 'How to activate'}
                        <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            className={`size-4 shrink-0 transition-transform duration-200 ${
                                open ? 'rotate-180' : ''
                            }`}
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent className='pt-1'>
                        <ol
                            className={`list-decimal space-y-1.5 pb-1 pl-4 ${mutedText}`}>
                            {guideSteps.map(step => (
                                <li key={step}>{step}</li>
                            ))}
                        </ol>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
}

/**
 * A provider's payment methods, embedded at the bottom of its OWN credentials
 * card - so it is always legible which method is enabled in Stripe and which
 * in Mollie. Per method: the live activation state on the connected account
 * (checked against the PSP), a Test action, and the admin's OFFER switch -
 * on/off controls whether the traveller checkout presents the method (the
 * backend intersects the intent's method list with this). An empty stored
 * list means every method is on (the pre-toggle default); the first flip
 * materializes the explicit list.
 */
export function ProviderMethodsSection({
    provider,
}: {
    provider: PaymentProvider;
}) {
    const { data, isLoading, isError } = usePaymentConnectionStatus();
    const test = useTestPaymentConnection();
    const stripeConfig = useStripeConfig();
    const mollieConfig = useMollieConfig();
    const updateStripe = useUpdateStripeConfig();
    const updateMollie = useUpdateMollieConfig();

    const label = PROVIDER_LABELS[provider];
    const column = columnFor(provider, data);
    const statusByKey = new Map(
        (column?.methods ?? []).map(m => [m.key, m.status]),
    );
    const attentionByKey = new Map(
        (column?.methods ?? []).map(m => [m.key, m.attention ?? null]),
    );

    const config =
        provider === 'STRIPE' ? stripeConfig.data : mollieConfig.data;
    const update = provider === 'STRIPE' ? updateStripe : updateMollie;
    const allKeys = TOGGLEABLE_METHOD_KEYS[provider];
    const stored = config?.paymentMethods ?? [];
    // Empty list = all on: the columns predate the switches, and "nothing
    // stored" has always meant "offer everything eligible".
    const enabled = new Set(stored.length === 0 ? allKeys : stored);
    // Method keys that are actually ACTIVE at the PSP - and not wallets. The
    // zero-guard must count only these: a switched-on-but-inactive method
    // offers nothing at checkout, and a wallet shows only on devices that can
    // pay, so "one nominal method left" can still mean zero real ones for
    // part of the audience.
    const activeKeys = new Set(
        CHECKOUT_METHODS.flatMap(m => {
            const key = m.methodKey[provider];
            return key &&
                !m.wallet &&
                statusByKey.get(m.brands[0]) === 'active'
                ? [key]
                : [];
        }),
    );

    function toggle(methodKey: string, on: boolean) {
        const next = new Set(enabled);
        if (on) next.add(methodKey);
        else next.delete(methodKey);
        const list = allKeys.filter(k => next.has(k));
        if (!list.some(k => activeKeys.has(k))) {
            // Refused, not saved: no ACTIVE method left would brick the
            // checkout - each step of card-off, ideal-off, paypal-off can
            // look individually safe while the survivors are all inactive,
            // and the stored [] means "all on", so the state could not even
            // be expressed.
            toast.error(
                'At least one payment method must stay on - travellers need a way to pay.',
            );
            return;
        }
        update.mutate({ paymentMethods: list });
    }

    return (
        <section className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
                <h3 className='text-xs font-semibold uppercase'>
                    Payment methods
                </h3>
                {column?.ok && column.mode && (
                    <StatusBadge
                        variant={column.mode === 'live' ? 'success' : 'info'}
                        hint={
                            column.mode === 'live'
                                ? 'Real charges - the account is in live mode'
                                : 'Test keys - no real money moves'
                        }>
                        {column.mode} mode
                    </StatusBadge>
                )}
                <span className={`ml-auto ${mutedText}`}>
                    Switch = offered at checkout; to block a method fully,
                    deactivate it at the provider
                </span>
            </div>

            {isLoading ? (
                // Skeleton rows, not a loading sentence - the live probe can
                // take seconds and the list's SHAPE is already known.
                <div className='space-y-1.5'>
                    {CHECKOUT_METHODS.map(m => (
                        <MethodRowSkeleton key={m.id} />
                    ))}
                </div>
            ) : isError || (!column && !data) ? (
                <p className={`text-sm ${mutedText}`}>
                    Could not load the payment method status. Use Test
                    connection above to retry.
                </p>
            ) : !column || !column.configured ? (
                <p className={`text-sm ${mutedText}`}>
                    Configure {label} above - once its credentials are saved,
                    this list reads the activated methods straight from the
                    account.
                </p>
            ) : !column.ok ? (
                <p className={`text-sm ${mutedText}`}>
                    The {label} connection is failing, so its method list
                    cannot be read: {column.error ?? 'unknown error'}
                </p>
            ) : (
                <div className='space-y-1.5'>
                    {CHECKOUT_METHODS.map(method => {
                        const methodKey = method.methodKey[provider];
                        return (
                            <MethodRow
                                key={method.id}
                                method={method}
                                provider={provider}
                                status={
                                    statusByKey.get(method.brands[0]) ??
                                    'inactive'
                                }
                                attention={
                                    attentionByKey.get(method.brands[0]) ??
                                    null
                                }
                                test={test}
                                offered={
                                    methodKey
                                        ? enabled.has(methodKey)
                                        : null
                                }
                                onToggle={toggle}
                                togglePending={update.isPending}
                            />
                        );
                    })}
                </div>
            )}
        </section>
    );
}
