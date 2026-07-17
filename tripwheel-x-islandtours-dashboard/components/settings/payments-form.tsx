'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { useStripeConfig, useUpdateStripeConfig } from '@/hooks/settings/use-settings';
import { StripeMethodsField } from './stripe-methods-field';
import { ConnectionStatus, SecretField, SettingsCard, SettingsCardSkeleton, TextField } from './settings-fields';

// ── Stripe ─────────────────────────────────────────────────────────────────

const stripeSchema = z.object({
  paymentLabel: z.string().optional(),
  publishableKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  paymentMethods: z.array(z.string()),
});
type StripeFormValues = z.infer<typeof stripeSchema>;

function StripeCard() {
  const { data, isLoading } = useStripeConfig();
  const { mutate, isPending } = useUpdateStripeConfig();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StripeFormValues>({
    resolver: zodResolver(stripeSchema),
    defaultValues: { paymentLabel: 'Stripe', publishableKey: '', secretKey: '', webhookSecret: '', paymentMethods: [] },
  });

  useEffect(() => {
    if (data) {
      reset({
        paymentLabel: data.paymentLabel ?? 'Stripe',
        publishableKey: data.publishableKey ?? '',
        secretKey: '',
        webhookSecret: '',
        paymentMethods: data.paymentMethods ?? [],
      });
    }
  }, [data, reset]);

  function onSubmit(values: StripeFormValues) {
    mutate({
      paymentLabel: values.paymentLabel,
      publishableKey: values.publishableKey,
      paymentMethods: values.paymentMethods,
      // Only send secrets when a new value is entered; blank keeps the current key.
      ...(values.secretKey ? { secretKey: values.secretKey } : {}),
      ...(values.webhookSecret ? { webhookSecret: values.webhookSecret } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  const selected = watch('paymentMethods');

  return (
    <SettingsCard
      title="Stripe"
      description="Card and local payment processing via Stripe."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
      status={<ConnectionStatus connected={!!data?.secretKey} />}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Payment Label" registration={register('paymentLabel')} error={errors.paymentLabel?.message} placeholder="Stripe" />
        <TextField label="Publishable Key" registration={register('publishableKey')} error={errors.publishableKey?.message} placeholder="pk_live_..." />
      </div>
      <SecretField
        label="Secret Key"
        registration={register('secretKey')}
        error={errors.secretKey?.message}
        placeholder="sk_live_..."
        description={data?.secretKey ? `Current: ${data.secretKey}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <SecretField
        label="Webhook Secret"
        registration={register('webhookSecret')}
        error={errors.webhookSecret?.message}
        placeholder="whsec_..."
        description={data?.webhookSecret ? `Current: ${data.webhookSecret}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <Field>
        <Label>Payment Methods</Label>
        {/* Enabling a method opens a setup guide; disabling asks to confirm. */}
        <StripeMethodsField
          value={selected}
          onChange={(next) => setValue('paymentMethods', next, { shouldDirty: true })}
        />
        <FieldDescription>Methods offered to travelers at checkout.</FieldDescription>
      </Field>
    </SettingsCard>
  );
}

// ── Mollie ─────────────────────────────────────────────────────────────────
// HIDDEN for v1: the checkout collects card via Stripe and redirects to
// PayPal/iDEAL via Stripe, so Mollie is not wired yet. The card below is kept
// (commented, not deleted) - to restore it, uncomment this block AND its
// <MollieCard /> render, and re-add the imports:
//   import { MultiSelect } from '@/components/ui/multi-select';
//   import { useMollieConfig, useUpdateMollieConfig } from '@/hooks/settings/use-settings';
//   import { MOLLIE_PAYMENT_METHODS } from './payment-methods';
/*
const mollieSchema = z.object({
  paymentLabel: z.string().optional(),
  apiKey: z.string().optional(),
  paymentMethods: z.array(z.string()),
});
type MollieFormValues = z.infer<typeof mollieSchema>;

function MollieCard() {
  const { data, isLoading } = useMollieConfig();
  const { mutate, isPending } = useUpdateMollieConfig();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MollieFormValues>({
    resolver: zodResolver(mollieSchema),
    defaultValues: { paymentLabel: 'Mollie', apiKey: '', paymentMethods: [] },
  });

  useEffect(() => {
    if (data) {
      reset({
        paymentLabel: data.paymentLabel ?? 'Mollie',
        apiKey: '',
        paymentMethods: data.paymentMethods ?? [],
      });
    }
  }, [data, reset]);

  function onSubmit(values: MollieFormValues) {
    mutate({
      paymentLabel: values.paymentLabel,
      paymentMethods: values.paymentMethods,
      ...(values.apiKey ? { apiKey: values.apiKey } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  const selected = watch('paymentMethods');

  return (
    <SettingsCard
      title="Mollie"
      description="European payment processing via Mollie."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Payment Label" registration={register('paymentLabel')} error={errors.paymentLabel?.message} placeholder="Mollie" />
      </div>
      <SecretField
        label="API Key"
        registration={register('apiKey')}
        error={errors.apiKey?.message}
        placeholder="live_..."
        description={data?.apiKey ? `Current: ${data.apiKey}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <Field>
        <Label>Payment Methods</Label>
        <MultiSelect
          options={MOLLIE_PAYMENT_METHODS}
          value={selected}
          onChange={(next) => setValue('paymentMethods', next, { shouldDirty: true })}
          placeholder="Select payment methods"
        />
        <FieldDescription>Methods offered to travelers at checkout.</FieldDescription>
      </Field>
    </SettingsCard>
  );
}
*/

export function PaymentsForm() {
  return (
    <div className="space-y-6">
      <StripeCard />
      {/* <MollieCard /> - hidden for v1 (see the commented Mollie block above) */}
    </div>
  );
}
