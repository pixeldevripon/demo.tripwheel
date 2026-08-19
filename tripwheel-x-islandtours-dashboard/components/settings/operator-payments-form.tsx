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
    useOperatorMollieConfig,
    useOperatorPaymentProvider,
    useOperatorStripeConfig,
    useUpdateOperatorMollieConfig,
    useUpdateOperatorPaymentProvider,
    useUpdateOperatorStripeConfig,
} from '@/hooks/operators/use-operator-settings';
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

// ── Active provider (single switch - same setup as admin Settings > Payments,
//    but with PAYOUT semantics: the operator RECEIVES payouts through this
//    provider; travelers are always charged by the platform, never here) ──────

const PROVIDERS: { value: PaymentProvider; label: string }[] = [
    { value: 'STRIPE', label: 'Stripe' },
    { value: 'MOLLIE', label: 'Mollie' },
];

function ActiveProviderCard({ operatorId }: { operatorId: string }) {
    const { data, isLoading } = useOperatorPaymentProvider(operatorId);
    const { mutate, isPending } = useUpdateOperatorPaymentProvider(operatorId);
    // The provider awaiting confirmation; the dialog is open while set.
    const [pending, setPending] = useState<PaymentProvider | null>(null);

    if (isLoading) return <SettingsCardSkeleton />;

    const current = data?.activeProvider ?? 'STRIPE';
    const pendingLabel = PROVIDERS.find(p => p.value === pending)?.label;

    return (
        <SettingsCard
            title='Payout Provider'
            description='Which provider Island Tours uses to send your payouts. Travelers are always charged by the platform - this never changes the checkout.'
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
                            Receive payouts through {pendingLabel}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Future payouts will be sent to your {pendingLabel}{' '}
                            account. Its API keys must be configured below or
                            the switch is rejected. Booking payments are
                            unaffected - travelers are always charged by the
                            platform, and payouts already in progress keep their
                            provider.
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
// Which provider is live is decided by the Active Provider switch above (the
// per-card isActive flags are synced server-side); the card only holds keys.

const stripeSchema = z.object({
    publishableKey: z.string().optional(),
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
});
type StripeFormValues = z.infer<typeof stripeSchema>;

function StripeCard({ operatorId }: { operatorId: string }) {
    const { data, isLoading } = useOperatorStripeConfig(operatorId);
    const { mutate, isPending } = useUpdateOperatorStripeConfig(operatorId);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<StripeFormValues>({
        resolver: zodResolver(stripeSchema),
        defaultValues: { publishableKey: '', secretKey: '', webhookSecret: '' },
    });

    useEffect(() => {
        if (data) {
            reset({
                publishableKey: data.publishableKey ?? '',
                secretKey: '',
                webhookSecret: '',
            });
        }
    }, [data, reset]);

    function onSubmit(values: StripeFormValues) {
        mutate({
            publishableKey: values.publishableKey,
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
            description='Connect your own Stripe account to receive payouts for your bookings.'
            onSubmit={handleSubmit(onSubmit)}
            isSaving={isPending}
            status={<ConnectionStatus connected={!!data?.secretKey} />}>
            <TextField
                label='Publishable Key'
                registration={register('publishableKey')}
                error={errors.publishableKey?.message}
                placeholder='pk_live_...'
            />
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

const mollieSchema = z.object({ apiKey: z.string().optional() });
type MollieFormValues = z.infer<typeof mollieSchema>;

function MollieCard({ operatorId }: { operatorId: string }) {
    const { data, isLoading } = useOperatorMollieConfig(operatorId);
    const { mutate, isPending } = useUpdateOperatorMollieConfig(operatorId);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<MollieFormValues>({
        resolver: zodResolver(mollieSchema),
        defaultValues: { apiKey: '' },
    });

    useEffect(() => {
        if (data) reset({ apiKey: '' });
    }, [data, reset]);

    function onSubmit(values: MollieFormValues) {
        mutate({ ...(values.apiKey ? { apiKey: values.apiKey } : {}) });
    }

    if (isLoading) return <SettingsCardSkeleton />;

    return (
        <SettingsCard
            title='Mollie'
            description='Connect your own Mollie account to receive payouts for your bookings.'
            onSubmit={handleSubmit(onSubmit)}
            isSaving={isPending}
            status={<ConnectionStatus connected={!!data?.apiKey} />}>
            <SecretField
                label='API Key'
                registration={register('apiKey')}
                error={errors.apiKey?.message}
                placeholder='live_...'
                description={
                    data?.apiKey
                        ? `Current: ${data.apiKey}. Leave blank to keep it.`
                        : 'Stored encrypted.'
                }
            />
        </SettingsCard>
    );
}

export function OperatorPaymentsForm({ operatorId }: { operatorId: string }) {
    return (
        <div className='space-y-6'>
            <ActiveProviderCard operatorId={operatorId} />
            <StripeCard operatorId={operatorId} />
            <MollieCard operatorId={operatorId} />
        </div>
    );
}

