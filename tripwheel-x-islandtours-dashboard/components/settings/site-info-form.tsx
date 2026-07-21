'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSiteInfo, useUpdateSiteInfo } from '@/hooks/settings/use-settings';
import {
  ImageField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
  TextareaField,
  VideoField,
} from './settings-fields';

const schema = z.object({
  siteName: z.string().optional(),
  siteTagline: z.string().optional(),
  siteDescription: z.string().optional(),
  logo: z.string().optional(),
  favicon: z.string().optional(),
  faqHostImage: z.string().optional(),
  faqHostVideo: z.string().optional(),
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
      faqHostImage: '',
      faqHostVideo: '',
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
        faqHostImage: data.faqHostImage ?? '',
        faqHostVideo: data.faqHostVideo ?? '',
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

      {/* Lives here rather than on the homepage: this avatar renders in the FAQ
          block on the home, destination AND collection pages, so one page's
          record would leave the other two on the bundled file. */}
      <div className="grid gap-6 sm:grid-cols-2">
        <ImageField
          label="FAQ Host Photo"
          description="The round avatar beside the WhatsApp button in the FAQ block. Empty keeps the built-in one."
          value={watch('faqHostImage') || null}
          onChange={(url) =>
            setValue('faqHostImage', url ?? '', { shouldDirty: true })
          }
        />
        <VideoField
          label="FAQ Host Video"
          description="Optional short clip that loops inside that circle. Without one the photo shows on its own."
          value={watch('faqHostVideo') || null}
          onChange={(url) =>
            setValue('faqHostVideo', url ?? '', { shouldDirty: true })
          }
        />
      </div>
    </SettingsCard>
  );
}
