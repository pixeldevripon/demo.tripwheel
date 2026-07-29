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

// ── Active provider switch ──────────────────────────────────────────────────
// Exactly ONE provider charges travellers at checkout (Stripe = inline card
// fields, Mollie = hosted redirect page). Switching goes through a CONFIRM
// dialog - it changes how every new booking is charged. The backend REJECTS
// switching to a provider without usable credentials, so a switch can never
// brick checkout. Never retroactive: existing payments keep their provider
// for webhooks/refunds.

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
    { value: 'STRIPE', label: 'Stripe' },
    { value: 'MOLLIE', label: 'Mollie' },
];

function ActiveProviderCard() {
    const { data, isLoading } = usePaymentProvider();
    const { mutate, isPending } = useUpdatePaymentProvider();
    // The provider awaiting confirmation; the dialog is open while set.
    const [pending, setPending] = useState<PaymentProvider | null>(null);

    if (isLoading) return <SettingsCardSkeleton />;

    const current = data?.activeProvider ?? 'STRIPE';
    const pendingLabel = PROVIDERS.find(p => p.value === pending)?.label;

    return (
        <SettingsCard
            title='Active Provider'
            description='Which provider charges travelers at checkout. Existing payments keep their original provider for refunds.'
            onSubmit={() => {}}
            isSaving={false}
            canSave={false}>
            <div className='flex flex-wrap gap-2'>
                {PROVIDERS.map(opt => {
                    const isCurrent = current === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type='button'
                            disabled={isPending}
                            onClick={() => {
                                if (!isCurrent) setPending(opt.value);
                            }}
                            aria-pressed={isCurrent}
                            className={`flex w-full flex-1 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                                isCurrent
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/40'
                            } ${isPending ? 'opacity-60' : ''}`}>
                            <span
                                className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                                    isCurrent
                                        ? 'border-primary'
                                        : 'border-muted-foreground/40'
                                }`}>
                                {isCurrent && (
                                    <span className='size-2 rounded-full bg-primary' />
                                )}
                            </span>
                            <span className='text-sm font-medium'>
                                {opt.label}
                            </span>
                            {isCurrent && (
                                <span className='ml-auto rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success-fg'>
                                    Active
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

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
                            configured below or the switch is rejected. Existing
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
        </SettingsCard>
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

function StripeCard() {
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
            status={<ConnectionStatus connected={!!data?.secretKey} />}>
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

function MollieCard() {
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
            status={<ConnectionStatus connected={!!data?.apiKey} />}>
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
    return (
        <div className='space-y-6'>
            <ActiveProviderCard />
            <StripeCard />
            <MollieCard />
        </div>
    );
}

