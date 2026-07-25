'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useIntegrationsConfig,
  useMailchimpConfig,
  useSiteInfo,
  useUpdateIntegrationsConfig,
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

// ── Meta Conversions API ─────────────────────────────────────────────────--
//
// Server-side booking_complete conversions (master 8.1.4). The token is the
// secret; the test_event_code only routes events to Events Manager's test tab
// and MUST be cleared for production. DB value wins over the env fallback.

const metaCapiSchema = z.object({
  metaCapiToken: z.string().optional(),
  metaCapiTestCode: z.string().optional(),
});
type MetaCapiFormValues = z.infer<typeof metaCapiSchema>;

function MetaCapiCard() {
  const { data, isLoading } = useIntegrationsConfig();
  const { mutate, isPending } = useUpdateIntegrationsConfig();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MetaCapiFormValues>({
    resolver: zodResolver(metaCapiSchema),
    defaultValues: { metaCapiToken: '', metaCapiTestCode: '' },
  });

  useEffect(() => {
    if (data) {
      reset({
        metaCapiToken: '',
        metaCapiTestCode: data.metaCapiTestCode ?? '',
      });
    }
  }, [data, reset]);

  function onSubmit(values: MetaCapiFormValues) {
    mutate({
      // Always send the test code: clearing the field must clear the stored
      // value (it routes production events to the test tab when left behind).
      metaCapiTestCode: values.metaCapiTestCode,
      ...(values.metaCapiToken ? { metaCapiToken: values.metaCapiToken } : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="Meta Conversions API"
      description="Server-side booking conversions sent to Meta, deduplicated against the browser pixel. The Pixel ID itself lives on the SEO tab."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
      status={<ConnectionStatus connected={!!data?.metaCapiToken} />}
    >
      <SecretField
        label="Access Token"
        registration={register('metaCapiToken')}
        error={errors.metaCapiToken?.message}
        placeholder="EAAG..."
        description={data?.metaCapiToken ? `Current: ${data.metaCapiToken}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <TextField
        label="Test Event Code"
        registration={register('metaCapiTestCode')}
        error={errors.metaCapiTestCode?.message}
        placeholder="TEST12345"
        description="Routes events to Events Manager's Test Events tab. Clear this in production or conversions will not count."
      />
    </SettingsCard>
  );
}

// ── Google Cloud Translation ─────────────────────────────────────────────--
//
// Powers the review auto-translation job (LD32). Config-gated: with no key the
// worker no-ops. DB value wins over the env fallback.

const googleTranslateSchema = z.object({
  googleTranslateApiKey: z.string().optional(),
  googleTranslateProjectId: z.string().optional(),
});
type GoogleTranslateFormValues = z.infer<typeof googleTranslateSchema>;

function GoogleTranslateCard() {
  const { data, isLoading } = useIntegrationsConfig();
  const { mutate, isPending } = useUpdateIntegrationsConfig();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GoogleTranslateFormValues>({
    resolver: zodResolver(googleTranslateSchema),
    defaultValues: { googleTranslateApiKey: '', googleTranslateProjectId: '' },
  });

  useEffect(() => {
    if (data) {
      reset({
        googleTranslateApiKey: '',
        googleTranslateProjectId: data.googleTranslateProjectId ?? '',
      });
    }
  }, [data, reset]);

  function onSubmit(values: GoogleTranslateFormValues) {
    mutate({
      googleTranslateProjectId: values.googleTranslateProjectId,
      ...(values.googleTranslateApiKey
        ? { googleTranslateApiKey: values.googleTranslateApiKey }
        : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="Google Translate"
      description="Machine-translates approved reviews into the 6 non-English locales."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
      status={<ConnectionStatus connected={!!data?.googleTranslateApiKey} />}
    >
      <SecretField
        label="API Key"
        registration={register('googleTranslateApiKey')}
        error={errors.googleTranslateApiKey?.message}
        placeholder="AIza..."
        description={data?.googleTranslateApiKey ? `Current: ${data.googleTranslateApiKey}. Leave blank to keep it.` : 'Stored encrypted.'}
      />
      <TextField
        label="Project ID"
        registration={register('googleTranslateProjectId')}
        error={errors.googleTranslateProjectId?.message}
        placeholder="my-gcp-project"
      />
    </SettingsCard>
  );
}

// ── WhatsApp ─────────────────────────────────────────────────────────────--
//
// Instagram is NOT here: its switch lives with the handle, layout and tiles it
// governs, on the Instagram tab. A toggle three tabs away from the thing it
// turns on is how the old widget-ID field went unnoticed for months.

const socialWidgetsSchema = z.object({
  enableWhatsappChat: z.boolean(),
  whatsappNumber: z.string().optional(),
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
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        enableWhatsappChat: data.enableWhatsappChat ?? false,
        whatsappNumber: data.whatsappNumber ?? '',
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="WhatsApp"
      description="Chat button shown on the public site."
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
    </SettingsCard>
  );
}

export function IntegrationsForm() {
  return (
    <div className="space-y-6">
      <MetaCapiCard />
      <GoogleTranslateCard />
      <MailchimpCard />
      <SocialWidgetsCard />
    </div>
  );
}
