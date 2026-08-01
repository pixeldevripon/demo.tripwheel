'use client';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    useMollieConfig,
    usePaymentProvider,
    useStripeConfig,
    useUpdateMollieConfig,
    useUpdatePaymentProvider,
    useUpdateStripeConfig,
} from '@/hooks/settings/use-settings';
import type { PaymentProvider } from '@/types/settings';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
    STRIPE: 'Stripe',
    MOLLIE: 'Mollie',
};

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
            onSubmit={handleSubmit(onSubmit)}
            isSaving={isPending}
            status={
                <>
                    <ConnectionStatus connected={!!data?.secretKey} />
                    {activeControl}
                </>
            }>
            <div className='grid gap-6 sm:grid-cols-2'>
                <TextField
                    label='Payment Label'
                    registration={register('paymentLabel')}
                    error={errors.paymentLabel?.message}
                    placeholder='Stripe'
                />
                <TextField
                    label='Publishable Key'
                    registration={register('publishableKey')}
                    error={errors.publishableKey?.message}
                    placeholder='pk_live_...'
                />
            </div>
            <SecretField
                label='Secret Key'
                registration={register('secretKey')}
                error={errors.secretKey?.message}
                placeholder='sk_live_...'
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
                description={
                    data?.webhookSecret
                        ? `Current: ${data.webhookSecret}. Leave blank to keep it.`
                        : 'Stored encrypted.'
                }
            />
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
        // Ids/keys pasted from Mollie's dashboard can carry stray whitespace or
        // zero-width characters - never part of a real value, always stripped.
        const clean = (v?: string) =>
            v?.replace(/[\s\u200B-\u200D\uFEFF]/g, '') ?? '';
        const apiKey = clean(values.apiKey);
        mutate({
            paymentLabel: values.paymentLabel,
            profileId: clean(values.profileId),
            // Only send the key when a new value is entered; blank keeps the current one.
            ...(apiKey ? { apiKey } : {}),
        });
    }

    if (isLoading) return <SettingsCardSkeleton />;

    return (
        <SettingsCard
            title='Mollie'
            description='Hosted checkout via Mollie (cards, iDEAL, Bancontact, PayPal and more).'
            onSubmit={handleSubmit(onSubmit)}
            isSaving={isPending}
            status={
                <>
                    <ConnectionStatus connected={!!data?.apiKey} />
                    {activeControl}
                </>
            }>
            <div className='grid gap-6 sm:grid-cols-2'>
                <TextField
                    label='Payment Label'
                    registration={register('paymentLabel')}
                    error={errors.paymentLabel?.message}
                    placeholder='Mollie'
                />
                <TextField
                    label='Profile ID'
                    registration={register('profileId')}
                    error={errors.profileId?.message}
                    placeholder='pfl_...'
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
                description={
                    data?.apiKey
                        ? `Current: ${data.apiKey}. Leave blank to keep it.`
                        : 'Stored encrypted. Use test_... for test mode.'
                }
            />
        </SettingsCard>
    );
}

export function PaymentsForm() {
    const { data, isLoading } = usePaymentProvider();
    const { mutate, isPending } = useUpdatePaymentProvider();
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
            disabled={isLoading || isPending}
            label={PROVIDER_LABELS[card]}
            onRequestSwitch={() => requestSwitch(card)}
        />
    );

    const pendingLabel = pending ? PROVIDER_LABELS[pending] : '';

    return (
        <div className='space-y-6'>
            <p className='text-sm text-muted-foreground normal-case tracking-normal font-light'>
                The switched-on provider charges travelers at checkout. Existing
                payments keep their original provider for refunds and webhooks.
            </p>
            <StripeCard activeControl={switchFor('STRIPE')} />
            <MollieCard activeControl={switchFor('MOLLIE')} />

            <AlertDialog
                open={pending !== null}
                onOpenChange={open => !open && setPending(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Switch checkout payments to {pendingLabel}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Every new booking will be charged through{' '}
                            {pendingLabel} immediately. Its API keys must be
                            configured or the switch is rejected. Existing
                            payments keep their original provider for refunds
                            and webhooks.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (pending)
                                    mutate({ activeProvider: pending });
                                setPending(null);
                            }}>
                            Switch to {pendingLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

