'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  useIntegrationsConfig,
  useMailchimpConfig,
  useSeo,
  useSiteInfo,
  useUpdateIntegrationsConfig,
  useUpdateMailchimpConfig,
  useUpdateSeo,
  useUpdateSiteInfo,
} from '@/hooks/settings/use-settings';
import { Field, FieldDescription } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

// ── AI translation ───────────────────────────────────────────────────────--
//
// Powers ALL AI translation: content entities (tours, destinations, hubs,
// categories, collections, homepage) AND approved review comments (LD32).
// Provider-agnostic: the dropdown mirrors the backend provider catalog
// (backend src/content-translation/providers/provider-catalog.ts - keep in
// sync). Gemini is the default AND the fallback; `custom` accepts any
// OpenAI-compatible endpoint via a base URL, which is what makes "any
// provider" literal. Config-gated: with no key the workers no-op and the
// "Translate with AI" button returns a clear error. DB values win over env.

interface ProviderModel {
  value: string;
  /** Has a real free tier vs. requires paid credits. */
  tier: 'free' | 'paid';
}

interface ProviderEntry {
  value: string;
  label: string;
  keyPlaceholder: string;
  keyHint: string;
  /** Blank model = this default; absent (custom) = model required. */
  defaultModel?: string;
  models: ProviderModel[];
  needsBaseUrl?: boolean;
}

const PROVIDERS: ProviderEntry[] = [
  {
    value: 'gemini',
    label: 'Gemini (Google AI Studio)',
    keyPlaceholder: 'AQ....',
    keyHint: 'Get a free key at aistudio.google.com.',
    defaultModel: 'gemini-3.6-flash',
    models: [
      { value: 'gemini-3.6-flash', tier: 'free' },
      // 2.5-family models only answer for accounts created before Google
      // retired them for new users - kept for those legacy keys.
      { value: 'gemini-2.5-flash-lite', tier: 'free' },
      { value: 'gemini-2.5-flash', tier: 'free' },
      { value: 'gemini-2.5-pro', tier: 'paid' },
    ],
  },
  {
    value: 'anthropic',
    label: 'Anthropic (Claude)',
    keyPlaceholder: 'sk-ant-...',
    keyHint: 'Key from console.anthropic.com.',
    defaultModel: 'claude-haiku-4-5-20251001',
    models: [
      { value: 'claude-haiku-4-5-20251001', tier: 'paid' },
      { value: 'claude-sonnet-5', tier: 'paid' },
      { value: 'claude-opus-5', tier: 'paid' },
    ],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    keyPlaceholder: 'sk-...',
    keyHint: 'Key from platform.openai.com.',
    defaultModel: 'gpt-5.4-mini',
    models: [
      { value: 'gpt-5.4-mini', tier: 'paid' },
      { value: 'gpt-5.4-nano', tier: 'paid' },
      { value: 'gpt-5.6', tier: 'paid' },
      { value: 'gpt-4o-mini', tier: 'paid' },
    ],
  },
  {
    value: 'groq',
    label: 'Groq',
    keyPlaceholder: 'gsk_...',
    keyHint: 'Free-tier key from console.groq.com.',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      { value: 'llama-3.3-70b-versatile', tier: 'free' },
      { value: 'llama-3.1-8b-instant', tier: 'free' },
      { value: 'openai/gpt-oss-120b', tier: 'free' },
      { value: 'qwen/qwen3.6-27b', tier: 'free' },
    ],
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    keyPlaceholder: 'sk-or-...',
    keyHint: 'Key from openrouter.ai - routes to hundreds of models.',
    // openrouter/free auto-routes to whatever free models are live right
    // now, so it never dies to a model retirement.
    defaultModel: 'openrouter/free',
    models: [
      { value: 'openrouter/free', tier: 'free' },
      { value: 'openrouter/auto', tier: 'paid' },
      { value: 'meta-llama/llama-3.3-70b-instruct', tier: 'paid' },
      { value: 'deepseek/deepseek-chat', tier: 'paid' },
    ],
  },
  {
    value: 'mistral',
    label: 'Mistral',
    keyPlaceholder: 'key...',
    keyHint: 'Key from console.mistral.ai (free experiment tier available).',
    defaultModel: 'mistral-small-latest',
    models: [
      { value: 'mistral-small-latest', tier: 'free' },
      { value: 'mistral-medium-latest', tier: 'paid' },
      { value: 'mistral-large-latest', tier: 'paid' },
    ],
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    keyPlaceholder: 'sk-...',
    keyHint: 'Key from platform.deepseek.com.',
    defaultModel: 'deepseek-chat',
    models: [
      { value: 'deepseek-chat', tier: 'paid' },
      { value: 'deepseek-reasoner', tier: 'paid' },
    ],
  },
  {
    value: 'custom',
    label: 'Custom (any OpenAI-compatible endpoint)',
    keyPlaceholder: 'key...',
    keyHint:
      'Works with Together, xAI, self-hosted Ollama/vLLM - anything exposing /chat/completions.',
    models: [],
    needsBaseUrl: true,
  },
];

/** Sentinel Select values (SelectItem forbids empty strings). */
const MODEL_DEFAULT = '__default__';
const MODEL_CUSTOM = '__custom__';

function ModelTierBadge({ tier }: { tier: 'free' | 'paid' }) {
  return (
    <span
      className={
        tier === 'free'
          ? 'ml-2 rounded-full bg-success-subtle px-1.5 text-xs font-semibold uppercase text-success-fg'
          : 'ml-2 rounded-full bg-surface-inset px-1.5 text-xs font-semibold uppercase text-content-muted'
      }
    >
      {tier}
    </span>
  );
}

const aiTranslationSchema = z.object({
  translationProvider: z.string(),
  translationApiKey: z.string().optional(),
  translationModel: z.string().optional(),
  translationBaseUrl: z.string().optional(),
});
type AiTranslationFormValues = z.infer<typeof aiTranslationSchema>;

function AiTranslationCard() {
  const { data, isLoading } = useIntegrationsConfig();
  const { mutate, isPending } = useUpdateIntegrationsConfig();
  // 'list' = the model comes from the provider dropdown; 'custom' = typed.
  const [modelMode, setModelMode] = useState<'list' | 'custom'>('list');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AiTranslationFormValues>({
    resolver: zodResolver(aiTranslationSchema),
    defaultValues: {
      translationProvider: 'gemini',
      translationApiKey: '',
      translationModel: '',
      translationBaseUrl: '',
    },
  });

  useEffect(() => {
    if (data) {
      // '' in the DB = the backend default (gemini).
      const provider = data.translationProvider || 'gemini';
      const model = data.translationModel ?? '';
      const entry =
        PROVIDERS.find(p => p.value === provider) ?? PROVIDERS[0];
      reset({
        translationProvider: provider,
        translationApiKey: '',
        translationModel: model,
        translationBaseUrl: data.translationBaseUrl ?? '',
      });
      // A stored model the list does not know renders as "Custom model".
      setModelMode(
        model && !entry.models.some(m => m.value === model)
          ? 'custom'
          : 'list',
      );
    }
  }, [data, reset]);

  const provider = watch('translationProvider');
  const model = watch('translationModel') ?? '';
  const selected = PROVIDERS.find(p => p.value === provider) ?? PROVIDERS[0];
  const hasModelList = selected.models.length > 0;
  const showModelInput = !hasModelList || modelMode === 'custom';

  const modelSelectValue =
    modelMode === 'custom'
      ? MODEL_CUSTOM
      : model && selected.models.some(m => m.value === model)
        ? model
        : MODEL_DEFAULT;

  function onSubmit(values: AiTranslationFormValues) {
    mutate({
      translationProvider: values.translationProvider,
      translationModel: values.translationModel,
      translationBaseUrl: values.translationBaseUrl,
      ...(values.translationApiKey
        ? { translationApiKey: values.translationApiKey }
        : {}),
    });
  }

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="AI Translation"
      description="Auto-translates catalog content and approved reviews into the 6 non-English locales. Pick a provider and paste its API key - Gemini is the default, and Custom accepts any OpenAI-compatible endpoint."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={isPending}
      status={<ConnectionStatus connected={!!data?.translationApiKey} />}
    >
      <Field>
        <Label>Provider</Label>
        <Select
          value={provider}
          onValueChange={v => {
            setValue('translationProvider', v, { shouldDirty: true });
            // Models are provider-specific - never carry one across.
            setValue('translationModel', '', { shouldDirty: true });
            setModelMode('list');
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map(p => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          The API key, model and base URL below belong to the selected
          provider.
        </FieldDescription>
      </Field>
      {selected.needsBaseUrl && (
        <TextField
          label="Base URL"
          registration={register('translationBaseUrl')}
          error={errors.translationBaseUrl?.message}
          placeholder="https://api.together.xyz/v1"
          description="The endpoint's OpenAI-compatible API root (it must serve /chat/completions)."
        />
      )}
      <SecretField
        label="API Key"
        registration={register('translationApiKey')}
        error={errors.translationApiKey?.message}
        placeholder={selected.keyPlaceholder}
        description={
          data?.translationApiKey
            ? `Current: ${data.translationApiKey}. Leave blank to keep it.`
            : `Stored encrypted. ${selected.keyHint}`
        }
      />
      {hasModelList && (
        <Field>
          <Label>Model</Label>
          <Select
            value={modelSelectValue}
            onValueChange={v => {
              if (v === MODEL_CUSTOM) {
                setModelMode('custom');
                return;
              }
              setModelMode('list');
              setValue('translationModel', v === MODEL_DEFAULT ? '' : v, {
                shouldDirty: true,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selected.defaultModel && (
                <SelectItem value={MODEL_DEFAULT}>
                  Provider default ({selected.defaultModel})
                  <ModelTierBadge
                    tier={
                      selected.models.find(
                        m => m.value === selected.defaultModel,
                      )?.tier ?? 'paid'
                    }
                  />
                </SelectItem>
              )}
              {selected.models.map(m => (
                <SelectItem key={m.value} value={m.value}>
                  {m.value}
                  <ModelTierBadge tier={m.tier} />
                </SelectItem>
              ))}
              <SelectItem value={MODEL_CUSTOM}>Custom model…</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            Free = usable on the provider&apos;s free tier; Paid = needs paid
            credits.
          </FieldDescription>
        </Field>
      )}
      {showModelInput && (
        <TextField
          label={hasModelList ? 'Custom model name' : 'Model'}
          registration={register('translationModel')}
          error={errors.translationModel?.message}
          placeholder={selected.defaultModel ?? 'model-name'}
          description={
            selected.defaultModel
              ? `Any model the provider serves. Leave blank to use the default (${selected.defaultModel}).`
              : 'Required: the model name your endpoint serves.'
          }
        />
      )}
    </SettingsCard>
  );
}

// ── Cookiebot ────────────────────────────────────────────────────────────--
//
// Lives on the Integrations tab (it is a third-party service hookup, not a
// meta-tag concern) but stores on the SEO settings row: the public site reads
// `cookiebotCbid` from the public SEO projection, and moving the column would
// mean a backend migration for a purely cosmetic relocation. The PATCH is
// partial (backend upsert ignores absent fields), so saving only the cbid
// never touches the rest of the SEO record - and vice versa.

const cookiebotSchema = z.object({
  cookiebotCbid: z.string().optional(),
});
type CookiebotFormValues = z.infer<typeof cookiebotSchema>;

function CookiebotCard() {
  const { data, isLoading } = useSeo();
  const { mutate, isPending } = useUpdateSeo();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CookiebotFormValues>({
    resolver: zodResolver(cookiebotSchema),
    defaultValues: { cookiebotCbid: '' },
  });

  useEffect(() => {
    if (data) {
      reset({ cookiebotCbid: data.cookiebotCbid ?? '' });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="Cookiebot"
      description="Consent banner and the Manage Cookies dialog on the public site."
      onSubmit={handleSubmit((v) => mutate({ cookiebotCbid: v.cookiebotCbid }))}
      isSaving={isPending}
      status={<ConnectionStatus connected={!!data?.cookiebotCbid} />}
    >
      <TextField
        label="Cookiebot Domain Group ID"
        description="The data-cbid UUID from Cookiebot admin > Settings > Your scripts. Clear the field to disable the banner."
        registration={register('cookiebotCbid')}
        error={errors.cookiebotCbid?.message}
        placeholder="12345678-abcd-1234-abcd-123456789abc"
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
      <AiTranslationCard />
      <CookiebotCard />
      {/* <MailchimpCard /> */}
      <SocialWidgetsCard />
    </div>
  );
}
