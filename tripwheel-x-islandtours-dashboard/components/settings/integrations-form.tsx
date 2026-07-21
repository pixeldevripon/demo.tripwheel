'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useMailchimpConfig,
  useSiteInfo,
  useUpdateMailchimpConfig,
  useUpdateSiteInfo,
} from '@/hooks/settings/use-settings';
import {
  CheckboxField,
  ConnectionStatus,
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
      status={<ConnectionStatus connected={!!data?.apiKey} />}
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

// ── WhatsApp & Instagram ─────────────────────────────────────────────────--

const socialWidgetsSchema = z.object({
  enableWhatsappChat: z.boolean(),
  whatsappNumber: z.string().optional(),
  enableInstagram: z.boolean(),
});
type SocialWidgetsFormValues = z.infer<typeof socialWidgetsSchema>;

function SocialWidgetsCard() {
  const { data, isLoading } = useSiteInfo();
  const { mutate, isPending } = useUpdateSiteInfo();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SocialWidgetsFormValues>({
    resolver: zodResolver(socialWidgetsSchema),
    defaultValues: {
      enableWhatsappChat: false,
      whatsappNumber: '',
      enableInstagram: false,
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        enableWhatsappChat: data.enableWhatsappChat ?? false,
        whatsappNumber: data.whatsappNumber ?? '',
        enableInstagram: data.enableInstagram ?? false,
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="WhatsApp & Instagram"
      description="Chat button and Instagram grid shown on the public site."
      onSubmit={handleSubmit((v) => mutate(v))}
      isSaving={isPending}
    >
      <CheckboxField
        id="enableWhatsappChat"
        label="Enable WhatsApp Chat"
        description="Show a WhatsApp chat button on the public site."
        checked={watch('enableWhatsappChat')}
        onChange={(c) => setValue('enableWhatsappChat', c, { shouldDirty: true })}
      />
      <TextField label="WhatsApp Number" registration={register('whatsappNumber')} error={errors.whatsappNumber?.message} placeholder="+5999 123 4567" />

      <CheckboxField
        id="enableInstagram"
        label="Enable Instagram Grid"
        description="Show the Instagram grid on destination pages. Curate the handle and tiles under Settings > Instagram."
        checked={watch('enableInstagram')}
        onChange={(c) => setValue('enableInstagram', c, { shouldDirty: true })}
      />
    </SettingsCard>
  );
}

export function IntegrationsForm() {
  return (
    <div className="space-y-6">
      <MailchimpCard />
      <SocialWidgetsCard />
    </div>
  );
}
