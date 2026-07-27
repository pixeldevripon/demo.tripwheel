'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSeo, useUpdateSeo } from '@/hooks/settings/use-settings';
import {
  CheckboxField,
  ImageField,
  SettingsCard,
  SettingsCardSkeleton,
  TextField,
  TextareaField,
} from './settings-fields';

const schema = z.object({
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
  canonicalUrl: z.string().optional(),
  robotsMeta: z.string().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImage: z.string().optional(),
  twitterTitle: z.string().optional(),
  twitterDescription: z.string().optional(),
  twitterImage: z.string().optional(),
  googleAnalyticsId: z.string().optional(),
  googleTagManagerId: z.string().optional(),
  googleSearchConsole: z.string().optional(),
  facebookPixelId: z.string().optional(),
  robotsTxt: z.string().optional(),
  // Stored as a string flag ('true' | 'false') to match the backend column;
  // the checkbox below maps it to/from a boolean.
  autoGenerateSitemap: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  metaTitle: '', metaDescription: '', metaKeywords: '', canonicalUrl: '', robotsMeta: '',
  ogTitle: '', ogDescription: '', ogImage: '',
  twitterTitle: '', twitterDescription: '', twitterImage: '',
  googleAnalyticsId: '', googleTagManagerId: '', googleSearchConsole: '', facebookPixelId: '',
  robotsTxt: '', autoGenerateSitemap: '',
};

export function SeoForm() {
  const { data, isLoading } = useSeo();
  const { mutate, isPending } = useUpdateSeo();

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
        metaTitle: data.metaTitle ?? '',
        metaDescription: data.metaDescription ?? '',
        metaKeywords: data.metaKeywords ?? '',
        canonicalUrl: data.canonicalUrl ?? '',
        robotsMeta: data.robotsMeta ?? '',
        ogTitle: data.ogTitle ?? '',
        ogDescription: data.ogDescription ?? '',
        ogImage: data.ogImage ?? '',
        twitterTitle: data.twitterTitle ?? '',
        twitterDescription: data.twitterDescription ?? '',
        twitterImage: data.twitterImage ?? '',
        googleAnalyticsId: data.googleAnalyticsId ?? '',
        googleTagManagerId: data.googleTagManagerId ?? '',
        googleSearchConsole: data.googleSearchConsole ?? '',
        facebookPixelId: data.facebookPixelId ?? '',
        robotsTxt: data.robotsTxt ?? '',
        autoGenerateSitemap: data.autoGenerateSitemap ?? '',
      });
    }
  }, [data, reset]);

  if (isLoading) return <SettingsCardSkeleton />;

  return (
    <SettingsCard
      title="SEO & Tracking"
      description="Default meta tags, social cards, and analytics IDs."
      onSubmit={handleSubmit((v) => mutate(v))}
      isSaving={isPending}
    >
      <TextField label="Meta Title" registration={register('metaTitle')} error={errors.metaTitle?.message} />
      <TextareaField label="Meta Description" registration={register('metaDescription')} error={errors.metaDescription?.message} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Meta Keywords" registration={register('metaKeywords')} error={errors.metaKeywords?.message} placeholder="tours, island, travel" />
        <TextField label="Canonical URL" registration={register('canonicalUrl')} error={errors.canonicalUrl?.message} placeholder="https://islandtours.com" />
        <TextField label="Robots Meta" registration={register('robotsMeta')} error={errors.robotsMeta?.message} placeholder="index, follow" />
      </div>

      <TextField label="OG Title" registration={register('ogTitle')} error={errors.ogTitle?.message} />
      <TextareaField label="OG Description" registration={register('ogDescription')} error={errors.ogDescription?.message} />
      <ImageField
        label="OG Image"
        description="Open Graph social-share image."
        value={watch('ogImage') || null}
        onChange={(url) => setValue('ogImage', url ?? '', { shouldDirty: true })}
      />

      <TextField label="Twitter Title" registration={register('twitterTitle')} error={errors.twitterTitle?.message} />
      <TextareaField label="Twitter Description" registration={register('twitterDescription')} error={errors.twitterDescription?.message} />
      <ImageField
        label="Twitter Image"
        description="Image used on Twitter / X cards."
        value={watch('twitterImage') || null}
        onChange={(url) => setValue('twitterImage', url ?? '', { shouldDirty: true })}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label="Google Analytics ID" registration={register('googleAnalyticsId')} error={errors.googleAnalyticsId?.message} placeholder="G-XXXXXXX" />
        <TextField label="Google Tag Manager ID" registration={register('googleTagManagerId')} error={errors.googleTagManagerId?.message} placeholder="GTM-XXXXX" />
        <TextField
          label="Search Console Verification Code"
          description="Ownership token from Google Search Console (HTML-tag method) - rendered on the site as the google-site-verification meta tag. Not a G-XXXX ID."
          registration={register('googleSearchConsole')}
          error={errors.googleSearchConsole?.message}
          placeholder="dBw5CvburAxi537Rp9qi5uG2..."
        />
        <TextField label="Facebook Pixel ID" registration={register('facebookPixelId')} error={errors.facebookPixelId?.message} />
      </div>

      <CheckboxField
        id="autoGenerateSitemap"
        label="Advertise sitemap in robots.txt"
        description="When on, the generated robots.txt links to /sitemap.xml so crawlers discover every page. Ignored if a custom robots.txt is set below."
        checked={watch('autoGenerateSitemap') !== 'false'}
        onChange={(c) =>
          setValue('autoGenerateSitemap', c ? 'true' : 'false', {
            shouldDirty: true,
          })
        }
      />
      <TextareaField
        label="Custom robots.txt"
        description="Optional. When set, this exact text is served at /robots.txt verbatim. Leave empty to use the generated default (blocks checkout/booking/private routes and links the sitemap)."
        registration={register('robotsTxt')}
        error={errors.robotsTxt?.message}
      />
    </SettingsCard>
  );
}
