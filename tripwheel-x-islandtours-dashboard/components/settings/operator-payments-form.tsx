'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Field } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  useOperatorMollieConfig,
  useOperatorStripeConfig,
  useUpdateOperatorMollieConfig,
  useUpdateOperatorStripeConfig,
} from '@/hooks/operators/use-operator-settings';
import { MOLLIE_PAYMENT_METHODS, STRIPE_PAYMENT_METHODS } from './payment-methods';
import {
  CheckboxField,
  SecretField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

// ── Stripe ─────────────────────────────────────────────────────────────────

const stripeSchema = z.object({
  publishableKey: z.string().optional(),
  secretKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  paymentMethods: z.array(z.string()),
  isActive: z.boolean(),
});
type StripeFormValues = z.infer<typeof stripeSchema>;

function StripeCard({ operatorId }: { operatorId: string }) {
  const { data, isLoading } = useOperatorStripeConfig(operatorId);
  const { mutate, isPending } = useUpdateOperatorStripeConfig(operatorId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StripeFormValues>({
    resolver: zodResolver(stripeSchema),
    defaultValues: { publishableKey: '', secretKey: '', webhookSecret: '', paymentMethods: [], isActive: false },
  });

  useEffect(() => {
    if (data) {
      reset({
        publishableKey: data.publishableKey ?? '',
        secretKey: '',
        webhookSecret: '',
        paymentMethods: data.paymentMethods ?? [],
        isActive: data.isActive ?? false,
      });
    }
  }, [data, reset]);

  function onSubmit(values: StripeFormValues) {
    mutate({
      publishableKey: values.publishableKey,
      paymentMethods: values.paymentMethods,
      isActive: values.isActive,
      ...(values.secretKey ? { secretKey: values.secretKey } : {}),
      ...(values.webhookSecret ? { webhookSecret: values.webhookSecret } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  const selected = watch('paymentMethods');

  return (
    <SettingsCard
      title="Stripe"
      description="Connect your own Stripe account to receive payments for your tours."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
    >
      <TextField label="Publishable Key" registration={register('publishableKey')} error={errors.publishableKey?.message} placeholder="pk_live_..." />
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
        <Label className="text-xs font-semibold">Payment Methods</Label>
        <MultiSelect
          options={STRIPE_PAYMENT_METHODS}
          value={selected}
          onChange={(next) => setValue('paymentMethods', next, { shouldDirty: true })}
          placeholder="Select payment methods"
        />
      </Field>
      <CheckboxField
        id="stripeActive"
        label="Active"
        description="Enable Stripe as a checkout option for your tours."
        checked={watch('isActive')}
        onChange={(c) => setValue('isActive', c, { shouldDirty: true })}
      />
    </SettingsCard>
  );
}

// ── Mollie ─────────────────────────────────────────────────────────────────

const mollieSchema = z.object({
  apiKey: z.string().optional(),
  paymentMethods: z.array(z.string()),
  isActive: z.boolean(),
});
type MollieFormValues = z.infer<typeof mollieSchema>;

function MollieCard({ operatorId }: { operatorId: string }) {
  const { data, isLoading } = useOperatorMollieConfig(operatorId);
  const { mutate, isPending } = useUpdateOperatorMollieConfig(operatorId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MollieFormValues>({
    resolver: zodResolver(mollieSchema),
    defaultValues: { apiKey: '', paymentMethods: [], isActive: false },
  });

  useEffect(() => {
    if (data) {
      reset({
        apiKey: '',
        paymentMethods: data.paymentMethods ?? [],
        isActive: data.isActive ?? false,
      });
    }
  }, [data, reset]);

  function onSubmit(values: MollieFormValues) {
    mutate({
      paymentMethods: values.paymentMethods,
      isActive: values.isActive,
      ...(values.apiKey ? { apiKey: values.apiKey } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  const selected = watch('paymentMethods');

  return (
    <SettingsCard
      title="Mollie"
      description="Connect your own Mollie account to receive payments for your tours."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
    >
      <SecretField
        label="API Key"
        registration={register('apiKey')}
        error={errors.apiKey?.message}
        placeholder="live_..."
        description={data?.apiKey ? `Current: ${data.apiKey}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <Field>
        <Label className="text-xs font-semibold">Payment Methods</Label>
        <MultiSelect
          options={MOLLIE_PAYMENT_METHODS}
          value={selected}
          onChange={(next) => setValue('paymentMethods', next, { shouldDirty: true })}
          placeholder="Select payment methods"
        />
      </Field>
      <CheckboxField
        id="mollieActive"
        label="Active"
        description="Enable Mollie as a checkout option for your tours."
        checked={watch('isActive')}
        onChange={(c) => setValue('isActive', c, { shouldDirty: true })}
      />
    </SettingsCard>
  );
}

export function OperatorPaymentsForm({ operatorId }: { operatorId: string }) {
  return (
    <div className="space-y-6">
      <StripeCard operatorId={operatorId} />
      {/* <MollieCard operatorId={operatorId} /> */}
    </div>
  );
}
