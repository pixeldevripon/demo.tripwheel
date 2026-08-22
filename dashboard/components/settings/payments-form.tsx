'use client';

import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    useActivateProvider,
    useMollieConfig,
    usePaymentProvider,
    useStripeConfig,
    useUpdateMollieConfig,
    useUpdateStripeConfig,
} from '@/hooks/settings/use-settings';
import {
    PROVIDER_LABELS,
    cleanCredential,
    isProviderReady,
    missingProviderFields,
    type ProviderCredentialField,
} from '@/lib/settings/payment-requirements';
import type { PaymentProvider } from '@/types/settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
    ConnectionTestStrip,
    ProviderMethodsSection,
} from './payment-methods-board';
import {
    ConnectionStatus,
    SecretField,
    SettingsCard,
    SettingsCardSkeleton,
    TextField,
} from './settings-fields';

// ── Active provider switching ───────────────────────────────────────────────
// Exactly ONE provider charges travellers at checkout (Stripe = inline card
// fields, Mollie = hosted redirect page). Each provider card carries a header
// SWITCH (founder call 2026-08-02 - the separate Active Provider card was one
// section too many): toggling opens the CONFIRM dialog, because it changes how
// every new booking is charged. With exactly two providers, either gesture
// means "move checkout to the other one" - toggling the inactive card ON asks
// to activate it, toggling the active card OFF asks to activate the other
// (checkout can never be left with none). The backend REJECTS switching to a
// provider without usable credentials, so a switch can never brick checkout.
// Never retroactive: existing payments keep their provider for webhooks and
// refunds.
//
// When the target is MISSING a credential the dialog does not just warn - it
// COLLECTS (QA 2026-08-02). Bouncing the admin out to the card below, telling
// them to fill a field and come back to re-toggle made the toggle a liar: it
// offered an action it then refused. The confirm step is where consent already
// lives, so it is where the missing keys are asked for, saved and applied.

/** Minimal accessible switch - the repo has no ui/switch primitive yet. */
function ProviderSwitch({
    checked,
    disabled,
    label,
    onRequestSwitch,
}: {
    checked: boolean;
    disabled: boolean;
    label: string;
    onRequestSwitch: () => void;
}) {
    return (
        <span className='ml-auto flex items-center gap-2'>
            <span className='text-xs font-medium text-muted-foreground normal-case tracking-normal'>
                {checked ? 'Active at checkout' : 'Inactive'}
            </span>
            <button
                type='button'
                role='switch'
                aria-checked={checked}
                aria-label={`${label} charges travellers at checkout`}
                disabled={disabled}
                onClick={onRequestSwitch}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    checked ? 'bg-primary' : 'bg-muted-foreground/25'
                } ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'}`}>
                <span
                    className={`size-4 rounded-full bg-white shadow transition-transform ${
                        checked ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                />
            </button>
        </span>
    );
}

// ── Stripe ─────────────────────────────────────────────────────────────────
// The Payment Methods selector was removed from this card: the offered-methods
// list is not admin-configurable for v1. The PATCH no longer sends
// paymentMethods, so whatever is stored stays as-is.

const stripeSchema = z.object({
    paymentLabel: z.string().optional(),
    publishableKey: z.string().optional(),
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
});
type StripeFormValues = z.infer<typeof stripeSchema>;

function StripeCard({ activeControl }: { activeControl: React.ReactNode }) {
    const { data, isLoading } = useStripeConfig();
    const { mutate, isPending } = useUpdateStripeConfig();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<StripeFormValues>({
        resolver: zodResolver(stripeSchema),
        defaultValues: {
            paymentLabel: 'Stripe',
            publishableKey: '',
            secretKey: '',
            webhookSecret: '',
        },
    });

    useEffect(() => {
        if (data) {
            reset({
                paymentLabel: data.paymentLabel ?? 'Stripe',
                publishableKey: data.publishableKey ?? '',
                secretKey: '',
                webhookSecret: '',
            });
        }
    }, [data, reset]);

    function onSubmit(values: StripeFormValues) {
        mutate({
            paymentLabel: values.paymentLabel,
            publishableKey: values.publishableKey,
            // Only send secrets when a new value is entered; blank keeps the current key.
            ...(values.secretKey ? { secretKey: values.secretKey } : {}),
            ...(values.webhookSecret
                ? { webhookSecret: values.webhookSecret }
                : {}),
        });
    }

    if (isLoading) return <SettingsCardSkeleton />;

    return (
        <SettingsCard
            title='Stripe'
            description='Card and local payment processing via Stripe.'
            fill
            onSubmit={handleSubmit(onSubmit)}
            isSaving={isPending}
            status={
                <>
                    {/* "Configured" has to mean what the switch enforces. Keyed
                        off the secret key alone it promised a Stripe that could
                        still be refused for a missing publishable key or
                        webhook secret. */}
                    <ConnectionStatus
                        connected={isProviderReady('STRIPE', { stripe: data })}
                    />
                    {activeControl}
                </>
            }>
            {/* Every field here is autoComplete-guarded. Chrome reads a card of
                text + password inputs as a login form and offered the admin's
                own email for the publishable key and their password for the
                secrets - and because a blank secret means "keep the current
                one", a silently filled one means "replace it". */}
            <div className='grid gap-6 sm:grid-cols-2'>
                <TextField
                    label='Payment Label'
                    registration={register('paymentLabel')}
                    error={errors.paymentLabel?.message}
                    placeholder='Stripe'
                    autoComplete='off'
                />
                <TextField
                    label='Publishable Key'
                    registration={register('publishableKey')}
                    error={errors.publishableKey?.message}
                    placeholder='pk_live_...'
                    autoComplete='off'
                />
            </div>
            <SecretField
                label='Secret Key'
                registration={register('secretKey')}
                error={errors.secretKey?.message}
                placeholder='sk_live_...'
                autoComplete='new-password'
                description={
                    data?.secretKey
                        ? `Current: ${data.secretKey}. Leave blank to keep it.`
                        : 'Stored encrypted.'
                }
            />
            <SecretField
                label='Webhook Secret'
                registration={register('webhookSecret')}
                error={errors.webhookSecret?.message}
                placeholder='whsec_...'
                autoComplete='new-password'
                description={
                    data?.webhookSecret
                        ? `Current: ${data.webhookSecret}. Leave blank to keep it.`
                        : 'Stored encrypted.'
                }
            />
            <ConnectionTestStrip provider='STRIPE' />
            <ProviderMethodsSection provider='STRIPE' />
        </SettingsCard>
    );
}

// ── Mollie ─────────────────────────────────────────────────────────────────
// Like the Stripe card, the offered-methods multiselect is not admin-facing
// for v1 (an empty stored list lets Mollie's hosted page offer every eligible
// method). Only the API key is needed - Mollie has no webhook secret: the
// backend verifies webhooks by re-fetching the payment with this key.

const mollieSchema = z.object({
    paymentLabel: z.string().optional(),
    apiKey: z.string().optional(),
    profileId: z.string().optional(),
});
type MollieFormValues = z.infer<typeof mollieSchema>;

function MollieCard({ activeControl }: { activeControl: React.ReactNode }) {
    const { data, isLoading } = useMollieConfig();
    const { mutate, isPending } = useUpdateMollieConfig();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<MollieFormValues>({
        resolver: zodResolver(mollieSchema),
        defaultValues: { paymentLabel: 'Mollie', apiKey: '', profileId: '' },
    });

    useEffect(() => {
        if (data) {
            reset({
                paymentLabel: data.paymentLabel ?? 'Mollie',
                apiKey: '',
                profileId: data.profileId ?? '',
            });
        }
    }, [data, reset]);

    function onSubmit(values: MollieFormValues) {
        // Ids/keys pasted from Mollie's dashboard can carry stray whitespace
        // or zero-width characters - never part of a real value.
        const apiKey = cleanCredential(values.apiKey ?? '');
        mutate({
            paymentLabel: values.paymentLabel,
            profileId: cleanCredential(values.profileId ?? ''),
            // Only send the key when a new value is entered; blank keeps the current one.
            ...(apiKey ? { apiKey } : {}),
        });
    }

    if (isLoading) return <SettingsCardSkeleton />;

    return (
        <SettingsCard
            title='Mollie'
            description='Hosted checkout via Mollie (cards, iDEAL, Bancontact, PayPal and more).'
            fill
            onSubmit={handleSubmit(onSubmit)}
            isSaving={isPending}
            status={
                <>
                    <ConnectionStatus
                        connected={isProviderReady('MOLLIE', { mollie: data })}
                    />
                    {activeControl}
                </>
            }>
            <div className='grid gap-6 sm:grid-cols-2'>
                <TextField
                    label='Payment Label'
                    registration={register('paymentLabel')}
                    error={errors.paymentLabel?.message}
                    placeholder='Mollie'
                    autoComplete='off'
                />
                <TextField
                    label='Profile ID'
                    registration={register('profileId')}
                    error={errors.profileId?.message}
                    placeholder='pfl_...'
                    autoComplete='off'
                />
            </div>
            <p className='-mt-4 text-xs text-muted-foreground normal-case tracking-normal font-light'>
                The profile ID (public) enables the inline card form at
                checkout; leave it empty to always use Mollie&apos;s hosted
                payment page.
            </p>
            <SecretField
                label='API Key'
                registration={register('apiKey')}
                error={errors.apiKey?.message}
                placeholder='live_...'
                autoComplete='new-password'
                description={
                    data?.apiKey
                        ? `Current: ${data.apiKey}. Leave blank to keep it.`
                        : 'Stored encrypted. Use test_... for test mode.'
                }
            />
            <ConnectionTestStrip provider='MOLLIE' />
            <ProviderMethodsSection provider='MOLLIE' />
        </SettingsCard>
    );
}

/**
 * The confirm step for a provider switch, in one of two modes.
 *
 * READY - the target holds every credential it needs: a plain confirmation.
 * INCOMPLETE - it does not: the same dialog also asks for exactly the fields
 * that are missing, and activating saves them first.
 *
 * Remounted per target (keyed by the caller) so the form starts empty each
 * time and a key typed for one provider can never be submitted to the other.
 */
function SwitchProviderDialog({
    target,
    missing,
    onClose,
}: {
    target: PaymentProvider;
    missing: readonly ProviderCredentialField[];
    onClose: () => void;
}) {
    const { mutateAsync, isPending } = useActivateProvider();
    const label = PROVIDER_LABELS[target];
    const needsCredentials = missing.length > 0;

    // Built from the missing fields, so the schema is exactly as strict as the
    // gap. Trimmed because a pasted key that is only whitespace passes a bare
    // `.min(1)` and then fails the switch for looking configured.
    const schema = useMemo(
        () =>
            z.object(
                Object.fromEntries(
                    missing.map(field => [
                        field.name,
                        z
                            .string()
                            .trim()
                            .min(1, `${field.label} is required`),
                    ])
                )
            ),
        [missing]
    );

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<Record<string, string>>({
        resolver: zodResolver(schema),
        defaultValues: Object.fromEntries(missing.map(f => [f.name, ''])),
    });

    async function activate(values: Record<string, string>) {
        try {
            // Same cleanup the Mollie card applies: keys pasted from a provider
            // dashboard carry stray whitespace and zero-width characters that
            // are never part of the real value.
            const credentials = Object.fromEntries(
                Object.entries(values).map(([key, value]) => [
                    key,
                    cleanCredential(value),
                ])
            );
            await mutateAsync({
                provider: target,
                ...(needsCredentials ? { credentials } : {}),
            });
            onClose();
        } catch {
            // The hook already reported it. Hold the dialog open with the
            // typed values intact so a retry is one click, not a re-entry.
        }
    }

    return (
        <AlertDialogContent
            // Land on the first input rather than Cancel when there is
            // something to type; Radix focuses Cancel by default.
            onOpenAutoFocus={
                needsCredentials ? event => event.preventDefault() : undefined
            }>
            {/* autoComplete="off" on the form, and per-field below. A dialog
                holding one text input and one password input reads to Chrome
                as a login form, and it offered the admin's OWN email and
                password for the Stripe keys - which would have been encrypted
                and stored as real credentials. */}
            <form
                onSubmit={handleSubmit(activate)}
                autoComplete='off'
                className='contents'>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {needsCredentials
                            ? `Add ${label} credentials to switch checkout payments?`
                            : `Switch checkout payments to ${label}?`}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {needsCredentials
                            ? `${label} cannot take a payment yet. Enter the details below and they are saved before the switch, so checkout is never pointed at a provider that cannot charge. Every new booking will then be charged through ${label} immediately.`
                            : `Every new booking will be charged through ${label} immediately.`}{' '}
                        Existing payments keep their original provider for
                        refunds and webhooks.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {needsCredentials && (
                    <div className='space-y-4 text-left'>
                        {missing.map((field, index) =>
                            field.secret ? (
                                <SecretField
                                    key={field.name}
                                    label={field.label}
                                    registration={register(field.name)}
                                    error={errors[field.name]?.message}
                                    placeholder={field.placeholder}
                                    description={field.help}
                                    disabled={isPending}
                                    autoFocus={index === 0}
                                    // Chrome ignores "off" on a password input
                                    // when it holds a saved login for the site;
                                    // "new-password" is the one signal it
                                    // honours as "do not fill this".
                                    autoComplete='new-password'
                                />
                            ) : (
                                <TextField
                                    key={field.name}
                                    label={field.label}
                                    registration={register(field.name)}
                                    error={errors[field.name]?.message}
                                    placeholder={field.placeholder}
                                    description={field.help}
                                    disabled={isPending}
                                    autoFocus={index === 0}
                                    autoComplete='off'
                                />
                            )
                        )}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending} type='button'>
                        Cancel
                    </AlertDialogCancel>
                    {/* A plain submit, NOT AlertDialogAction: that one closes
                        the dialog on click, which would throw away typed keys
                        the moment validation or the request failed. */}
                    <Button type='submit' disabled={isPending}>
                        {isPending
                            ? 'Switching...'
                            : needsCredentials
                              ? `Save and switch to ${label}`
                              : `Switch to ${label}`}
                    </Button>
                </AlertDialogFooter>
            </form>
        </AlertDialogContent>
    );
}

export function PaymentsForm() {
    const { data, isLoading } = usePaymentProvider();
    // Same query keys the cards below use, so React Query serves both from one
    // cache entry - reading them here costs no extra request.
    const { data: stripe } = useStripeConfig();
    const { data: mollie } = useMollieConfig();
    // The provider awaiting confirmation; the dialog is open while set.
    const [pending, setPending] = useState<PaymentProvider | null>(null);

    const current = data?.activeProvider ?? 'STRIPE';
    const other = (p: PaymentProvider): PaymentProvider =>
        p === 'STRIPE' ? 'MOLLIE' : 'STRIPE';
    // Toggling the active card OFF = activating the other; toggling the
    // inactive card ON = activating it. Both land in the same confirm dialog.
    const requestSwitch = (card: PaymentProvider) =>
        setPending(current === card ? other(card) : card);

    const switchFor = (card: PaymentProvider) => (
        <ProviderSwitch
            checked={current === card}
            disabled={isLoading}
            label={PROVIDER_LABELS[card]}
            onRequestSwitch={() => requestSwitch(card)}
        />
    );

    return (
        <div className='space-y-6'>
            <p className='text-sm text-muted-foreground normal-case tracking-normal font-light'>
                The switched-on provider charges travelers at checkout. Existing
                payments keep their original provider for refunds and webhooks.
            </p>
            {/* Side by side so which-method-lives-where reads at a glance.
                The default grid stretch + fill cards = EQUAL heights, Save
                pinned to each card's bottom (founder call 2026-08-17 - the
                shorter Mollie card ending mid-row read as broken). */}
            <div className='grid gap-6 xl:grid-cols-2'>
                <StripeCard activeControl={switchFor('STRIPE')} />
                <MollieCard activeControl={switchFor('MOLLIE')} />
            </div>
            <p className='text-xs text-muted-foreground normal-case tracking-normal font-light'>
                Methods are activated at the provider, not here. The traveller
                checkout currently offers card, iDEAL and PayPal with Stripe,
                and the inline card form with Mollie - other activated methods
                join the checkout as support for them is built.
            </p>

            <AlertDialog
                open={pending !== null}
                onOpenChange={open => !open && setPending(null)}>
                {pending && (
                    <SwitchProviderDialog
                        key={pending}
                        target={pending}
                        missing={missingProviderFields(pending, {
                            stripe,
                            mollie,
                        })}
                        onClose={() => setPending(null)}
                    />
                )}
            </AlertDialog>
        </div>
    );
}

