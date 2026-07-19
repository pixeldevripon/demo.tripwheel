'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useMailchimpConfig,
  useUpdateMailchimpConfig,
} from '@/hooks/settings/use-settings';
import {
  SecretField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

// ── Mailchimp ─────────────────────────────────────────────────────────────--

const mailchimpSchema = z.object({
  apiKey: z.string().optional(),
  audienceId: z.string().optional(),
  serverPrefix: z.string().optional(),
});
type MailchimpFormValues = z.infer<typeof mailchimpSchema>;

function MailchimpCard() {
  const { data, isLoading } = useMailchimpConfig();
  const { mutate, isPending } = useUpdateMailchimpConfig();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MailchimpFormValues>({
    resolver: zodResolver(mailchimpSchema),
    defaultValues: { apiKey: '', audienceId: '', serverPrefix: '' },
  });

  useEffect(() => {
    if (data) {
      reset({
        apiKey: '',
        audienceId: data.audienceId ?? '',
        serverPrefix: data.serverPrefix ?? '',
      });
    }
  }, [data, reset]);

  function onSubmit(values: MailchimpFormValues) {
    mutate({
      audienceId: values.audienceId,
      serverPrefix: values.serverPrefix,
      ...(values.apiKey ? { apiKey: values.apiKey } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="Mailchimp"
      description="Sync newsletter subscribers to your Mailchimp audience."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
    >
      <SecretField
        label="API Key"
        registration={register('apiKey')}
        error={errors.apiKey?.message}
        placeholder="xxxxxxxxxxxx-usX"
        description={data?.apiKey ? `Current: ${data.apiKey}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Audience ID" registration={register('audienceId')} error={errors.audienceId?.message} />
        <TextField label="Server Prefix" registration={register('serverPrefix')} error={errors.serverPrefix?.message} placeholder="us21" />
      </div>
    </SettingsCard>
  );
}

export function IntegrationsForm() {
  return (
    <div className="space-y-6">
      <MailchimpCard />
    </div>
  );
}
