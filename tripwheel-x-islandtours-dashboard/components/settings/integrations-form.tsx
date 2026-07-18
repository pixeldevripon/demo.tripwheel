'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useMailchimpConfig,
  useSiteInfo,
  useSmtpConfig,
  useUpdateMailchimpConfig,
  useUpdateSiteInfo,
  useUpdateSmtpConfig,
} from '@/hooks/settings/use-settings';
import {
  CheckboxField,
  ConnectionStatus,
  SecretField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

// ── SMTP ─────────────────────────────────────────────────────────────────--

const smtpSchema = z.object({
  smtpHost: z.string().optional(),
  smtpPort: z.string().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure: z.boolean(),
});
type SmtpFormValues = z.infer<typeof smtpSchema>;

function SmtpCard() {
  const { data, isLoading } = useSmtpConfig();
  const { mutate, isPending } = useUpdateSmtpConfig();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SmtpFormValues>({
    resolver: zodResolver(smtpSchema),
    defaultValues: { smtpHost: '', smtpPort: '', smtpUsername: '', smtpPassword: '', smtpSecure: true },
  });

  useEffect(() => {
    if (data) {
      reset({
        smtpHost: data.smtpHost ?? '',
        smtpPort: data.smtpPort ?? '',
        smtpUsername: data.smtpUsername ?? '',
        smtpPassword: '',
        smtpSecure: data.smtpSecure ?? true,
      });
    }
  }, [data, reset]);

  function onSubmit(values: SmtpFormValues) {
    mutate({
      smtpHost: values.smtpHost,
      smtpPort: values.smtpPort,
      smtpUsername: values.smtpUsername,
      smtpSecure: values.smtpSecure,
      ...(values.smtpPassword ? { smtpPassword: values.smtpPassword } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="SMTP"
      description="Outgoing email server used for transactional and notification emails."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
      status={<ConnectionStatus connected={!!data?.smtpHost} />}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Host" registration={register('smtpHost')} error={errors.smtpHost?.message} placeholder="smtp.example.com" />
        <TextField label="Port" registration={register('smtpPort')} error={errors.smtpPort?.message} placeholder="587" />
        <TextField label="Username" registration={register('smtpUsername')} error={errors.smtpUsername?.message} placeholder="user@example.com" />
      </div>
      <SecretField
        label="Password"
        registration={register('smtpPassword')}
        error={errors.smtpPassword?.message}
        description={data?.smtpPassword ? `Current: ${data.smtpPassword}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <CheckboxField
        id="smtpSecure"
        label="Use TLS / SSL"
        description="Enable a secure connection to the mail server."
        checked={watch('smtpSecure')}
        onChange={(c) => setValue('smtpSecure', c, { shouldDirty: true })}
      />
    </SettingsCard>
  );
}

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
  instagramWidgetId: z.string().optional(),
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
      instagramWidgetId: '',
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        enableWhatsappChat: data.enableWhatsappChat ?? false,
        whatsappNumber: data.whatsappNumber ?? '',
        enableInstagram: data.enableInstagram ?? false,
        instagramWidgetId: data.instagramWidgetId ?? '',
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="WhatsApp & Instagram"
      description="Chat button and feed widget shown on the public site."
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
        label="Enable Instagram Feed"
        description="Display an Instagram widget in the footer."
        checked={watch('enableInstagram')}
        onChange={(c) => setValue('enableInstagram', c, { shouldDirty: true })}
      />
      <TextField label="Instagram Widget ID" registration={register('instagramWidgetId')} error={errors.instagramWidgetId?.message} />
    </SettingsCard>
  );
}

export function IntegrationsForm() {
  return (
    <div className="space-y-6">
     {/*  <SmtpCard /> */}
      <MailchimpCard />
      <SocialWidgetsCard />
    </div>
  );
}
