'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSiteInfo, useUpdateSiteInfo } from '@/hooks/settings/use-settings';
import {
  CheckboxField,
  ImageField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
  TextareaField,
} from './settings-fields';

const schema = z.object({
  siteName: z.string().optional(),
  siteTagline: z.string().optional(),
  siteDescription: z.string().optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  enableWhatsappChat: z.boolean(),
  whatsappNumber: z.string().optional(),
  enableInstagram: z.boolean(),
  instagramWidgetId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SiteInfoForm() {
  const { data, isLoading } = useSiteInfo();
  const { mutate, isPending } = useUpdateSiteInfo();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteName: '',
      siteTagline: '',
      siteDescription: '',
      logo: '',
      favicon: '',
      enableWhatsappChat: false,
      whatsappNumber: '',
      enableInstagram: false,
      instagramWidgetId: '',
    },
  });

  useEffect(() => {
    if (data) {
      reset({
        siteName: data.siteName ?? '',
        siteTagline: data.siteTagline ?? '',
        siteDescription: data.siteDescription ?? '',
        logo: data.logo ?? '',
        favicon: data.favicon ?? '',
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
      title="Site Information"
      description="Core identity shown across the public site."
      onSubmit={handleSubmit((v) => mutate(v))}
      isSaving={isPending}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Site Name" registration={register('siteName')} error={errors.siteName?.message} placeholder="Island Tours" />
        <TextField label="Tagline" registration={register('siteTagline')} error={errors.siteTagline?.message} placeholder="Your Caribbean adventure starts here" />
      </div>
      <TextareaField label="Description" registration={register('siteDescription')} error={errors.siteDescription?.message} placeholder="A short description of the platform" />
      <div className="grid gap-6 sm:grid-cols-2">
        <ImageField
          label="Logo"
          description="Select the site logo from your media library."
          value={watch('logo') || null}
          onChange={(url) => setValue('logo', url ?? '', { shouldDirty: true })}
        />
        <ImageField
          label="Favicon"
          description="Select the browser-tab icon from your media library."
          value={watch('favicon') || null}
          onChange={(url) => setValue('favicon', url ?? '', { shouldDirty: true })}
        />
      </div>

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
