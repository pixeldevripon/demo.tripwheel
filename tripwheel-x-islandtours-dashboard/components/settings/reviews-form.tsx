'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  usePlatformReviews,
  useRefreshPlatformReviews,
  useUpdatePlatformReviews,
} from '@/hooks/settings/use-settings';
import {
  CheckboxField,
  ConnectionStatus,
  SecretField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
} from './settings-fields';

const schema = z.object({
  provider: z.enum(['trustpilot', 'google']).optional(),
  apiKey: z.string().optional(),
  businessId: z.string().optional(),
  enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  provider: undefined,
  apiKey: '',
  businessId: '',
  enabled: false,
};

/**
 * Third-party reviews integration (master point 15): the admin picks
 * Trustpilot or Google Reviews, supplies the API credential and business/place
 * ID, and the public site fetches + renders the reviews automatically. The
 * section only shows publicly once the platform count exceeds 100 reviews
 * (social-proof gate, enforced by the backend).
 */
export function ReviewsForm() {
  const { data, isLoading } = usePlatformReviews();
  const { mutate: save, isPending: saving } = useUpdatePlatformReviews();
  const { mutate: refresh, isPending: refreshing } =
    useRefreshPlatformReviews();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (data) {
      reset({
        provider: data.provider ?? undefined,
        apiKey: data.apiKey ?? '',
        businessId: data.businessId ?? '',
        enabled: data.enabled,
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  const provider = watch('provider');
  const configured = !!data?.provider && !!data?.businessId;

  function onSubmit(v: FormValues) {
    save({
      provider: v.provider,
      // Masked echoes are ignored server-side; omit when untouched-empty.
      ...(v.apiKey !== undefined ? { apiKey: v.apiKey } : {}),
      businessId: v.businessId ?? '',
      enabled: v.enabled,
    });
  }

  return (
    <SettingsCard
      title="Platform Reviews"
      description="Trustpilot or Google reviews, fetched automatically and shown on the public site once the review count passes 100."
      onSubmit={handleSubmit(onSubmit)}
      isSaving={saving}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase">Provider</label>
          <select
            {...register('provider')}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">Not configured</option>
            <option value="trustpilot">Trustpilot</option>
            <option value="google">Google Reviews</option>
          </select>
        </div>

        <TextField
          label={provider === 'google' ? 'Google Place ID' : 'Business Unit ID'}
          description={
            provider === 'google'
              ? 'From Google Business Profile / the Places API (starts with ChIJ...).'
              : 'Trustpilot business-unit ID from the Trustpilot Business console.'
          }
          registration={register('businessId')}
          error={errors.businessId?.message}
          placeholder={
            provider === 'google'
              ? 'ChIJN1t_tDeuEmsRUsoyG83frY4'
              : '46d6a890000064000500e0d2'
          }
        />
      </div>

      <SecretField
        label="API Key"
        description={
          provider === 'google'
            ? 'Google Cloud API key with the Places API (New) enabled.'
            : 'Trustpilot API key (public endpoints).'
        }
        registration={register('apiKey')}
        error={errors.apiKey?.message}
      />

      <CheckboxField
        id="platform-reviews-enabled"
        label="Show on the public site"
        description="Renders the reviews section on the homepage. Even when enabled, it stays hidden until the platform count exceeds 100 reviews."
        checked={watch('enabled')}
        onChange={(v) => setValue('enabled', v, { shouldDirty: true })}
      />

      {/* Fetch status + manual refresh */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
        <ConnectionStatus connected={configured && !data?.lastError} />
        <p className="m-0 flex-1 text-xs text-muted-foreground">
          {data?.lastError
            ? `Last fetch failed: ${data.lastError}`
            : data?.fetchedAt
              ? `Last fetched ${new Date(data.fetchedAt).toLocaleString()} - ${data.reviewCount ?? 0} reviews, rating ${data.rating ?? '-'}`
              : 'Not fetched yet - save the credentials, then fetch.'}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!configured || refreshing}
          onClick={() => refresh()}
        >
          {refreshing ? 'Fetching...' : 'Fetch now'}
        </Button>
      </div>
    </SettingsCard>
  );
}
